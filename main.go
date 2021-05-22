package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/url"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/pion/mediadevices"
	"github.com/pion/mediadevices/pkg/codec/vpx"
	"github.com/pion/mediadevices/pkg/frame"
	"github.com/pion/mediadevices/pkg/prop"
	"github.com/pion/webrtc/v3"
	"github.com/sourcegraph/jsonrpc2"

	// Note: If you don't have a camera or microphone or your adapters are not supported,
	//       you can always swap your adapters with our dummy adapters below.
	_ "github.com/pion/mediadevices/pkg/driver/audiotest"
	_ "github.com/pion/mediadevices/pkg/driver/videotest"
	// _ "github.com/pion/mediadevices/pkg/driver/camera"     // This is required to register camera adapter
	// _ "github.com/pion/mediadevices/pkg/driver/microphone" // This is required to register microphone adapter
)

type Candidate struct {
	Target    int                  `json:"target"`
	Candidate *webrtc.ICECandidate `json:"candidate"`
}

type ResponseCandidate struct {
	Target    int                      `json:"target"`
	Candidate *webrtc.ICECandidateInit `json:"candidate"`
}

// struct holding our offer and the required sid that specifies the room we want to join that we can then convert into JSON.
// SendOffer object to send to the sfu over Websockets
type SendOffer struct {
	SID   string                     `json:"sid"`
	Offer *webrtc.SessionDescription `json:"offer"`
}

// SendAnswer object to send to the sfu over Websockets
type SendAnswer struct {
	SID    string                     `json:"sid"`
	Answer *webrtc.SessionDescription `json:"answer"`
}

// TrickleResponse received from the sfu server
type TrickleResponse struct {
	Params ResponseCandidate `json:"params"`
	Method string            `json:"method"`
}

// Response received from the sfu over Websockets
type Response struct {
	Params *webrtc.SessionDescription `json:"params"`
	Result *webrtc.SessionDescription `json:"result"`
	Method string                     `json:"method"`
	Id     uint64                     `json:"id"`
}

var peerConnection *webrtc.PeerConnection
var connectionID uint64
var remoteDescription *webrtc.SessionDescription

var addr string

func main() {

	//The flag is used to dynamically provide the URL of the Websockets server when starting the script and
	// has a standard value of localhost:7000
	flag.StringVar(&addr, "a", "localhost:7000", "address to use")
	flag.Parse()

	u := url.URL{Scheme: "ws", Host: addr, Path: "/ws"}
	log.Printf("connecting to %s", u.String())

	// The URL is used to create a Websockets client using the Dial method.
	// Then we check if the connection resulted in an error and print a log if that is the case.

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer c.Close()

	// we first create a WebRTC config where we define our STUN and TURN server that will be used in the signaling process.
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
			/*{
				URLs:       []string{"turn:TURN_IP:3478"},
				Username:   "username",
				Credential: "password",
			},*/
		},
		SDPSemantics: webrtc.SDPSemanticsUnifiedPlanWithFallback,
	}

	// Create a new RTCPeerConnection

	//we create a MediaEngine that lets us define the codecs supported by the peer connection.
	mediaEngine := webrtc.MediaEngine{}

	vpxParams, err := vpx.NewVP8Params()
	if err != nil {
		panic(err)
	}
	vpxParams.BitRate = 500_000 // 500kbps

	codecSelector := mediadevices.NewCodecSelector(
		mediadevices.WithVideoEncoders(&vpxParams),
	)

	codecSelector.Populate(&mediaEngine)

	//api
	api := webrtc.NewAPI(webrtc.WithMediaEngine(&mediaEngine))

	// With all that configuration done we can create a new peer connection
	// by calling the NewPeerConnection function on the WebRTC API we just created.
	peerConnection, err = api.NewPeerConnection(config)
	if err != nil {
		panic(err)
	}

	// Read incoming Websocket messages
	done := make(chan struct{})

	go readMessage(c, done)

	//Before sending the offer to the ion-sfu server over Websockets we first need to add the video and audio stream.
	// This is where the media device library comes into play to read the video from the camera.

	fmt.Println("media-devices", mediadevices.EnumerateDevices())

	// Once an instance of the media devices library is created using the peer connection
	// you can get the user media using the GetUserMedia function and passing the parameters.
	s, err := mediadevices.GetUserMedia(mediadevices.MediaStreamConstraints{
		Video: func(c *mediadevices.MediaTrackConstraints) {
			c.FrameFormat = prop.FrameFormat(frame.FormatYUY2)
			c.Width = prop.Int(640)
			c.Height = prop.Int(480)
		},
		Codec: codecSelector,
	})

	if err != nil {
		panic(err)
	}

	for _, track := range s.GetTracks() {
		track.OnEnded(func(err error) {
			fmt.Printf("Track (ID: %s) ended with error: %v\n",
				track.ID(), err)
		})
		_, err = peerConnection.AddTransceiverFromTrack(track,
			webrtc.RtpTransceiverInit{
				Direction: webrtc.RTPTransceiverDirectionSendonly,
			},
		)
		if err != nil {
			panic(err)
		}
	}

	// The offer can now be created and saved into the local description of the peer connection.

	// Creating WebRTC offer
	offer, err := peerConnection.CreateOffer(nil)

	// Set the remote SessionDescription
	err = peerConnection.SetLocalDescription(offer)
	if err != nil {
		panic(err)
	}

	// The OnICECandidate event is called whenever a new ICE candidate is found.
	// The method is then used to negotiate a connection with the remote peer by sending a trickle request to the sfu.

	// Handling OnICECandidate event
	// triggered after we set offer as our local description
	peerConnection.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate != nil {
			candidateJSON, err := json.Marshal(&Candidate{
				Candidate: candidate,
				Target:    0,
			})

			params := (*json.RawMessage)(&candidateJSON)

			if err != nil {
				log.Fatal(err)
			}

			message := &jsonrpc2.Request{
				Method: "trickle",
				Params: params,
			}

			reqBodyBytes := new(bytes.Buffer)
			json.NewEncoder(reqBodyBytes).Encode(message)

			messageBytes := reqBodyBytes.Bytes()
			c.WriteMessage(websocket.TextMessage, messageBytes)
		}
	})

	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		fmt.Printf("Connection State has changed to %s \n", connectionState.String())
	})

	offerJSON, err := json.Marshal(&SendOffer{
		Offer: peerConnection.LocalDescription(),
		SID:   "test room",
	})

	params := (*json.RawMessage)(&offerJSON)

	connectionUUID := uuid.New()
	connectionID = uint64(connectionUUID.ID())

	offerMessage := &jsonrpc2.Request{
		Method: "join",
		Params: params,
		ID: jsonrpc2.ID{
			IsString: false,
			Str:      "",
			Num:      connectionID,
		},
	}

	reqBodyBytes := new(bytes.Buffer)
	json.NewEncoder(reqBodyBytes).Encode(offerMessage)

	messageBytes := reqBodyBytes.Bytes()
	// After converting the request to a byte array the message can finally be send over Websockets using the WriteMessage() function.
	c.WriteMessage(websocket.TextMessage, messageBytes)

	// The last line of the main() function makes sure that the script runs as long as the done variable is not closed.
	<-done
}

//The readMessage function then reads the incoming messages by calling ReadMessage() on the Websocket connection and
// is run as a Go routine so it doesn't block the main thread and can run in the background.

// is used to receive and react to the incoming Websockets messages send by the sfu.
//handling two different events: 1)offer 2)trickle

// Offer - The sfu sends an offer and we react by saving the send offer into the remote description of our peer connection
//         and sending back an answer with the local description so we can connect to the remote peer

//Trickle - The sfu sends a new ICE candidate and we add it to the peer connection

func readMessage(connection *websocket.Conn, done chan struct{}) {
	defer close(done)
	for {
		_, message, err := connection.ReadMessage()
		if err != nil || err == io.EOF {
			log.Fatal("Error reading: ", err)
			break
		}

		fmt.Printf("recv: %s", message)

		var response Response
		json.Unmarshal(message, &response)

		if response.Id == connectionID {
			result := *response.Result
			remoteDescription = response.Result
			if err := peerConnection.SetRemoteDescription(result); err != nil {
				log.Fatal(err)
			}
		} else if response.Id != 0 && response.Method == "offer" {
			peerConnection.SetRemoteDescription(*response.Params)
			answer, err := peerConnection.CreateAnswer(nil)

			if err != nil {
				log.Fatal(err)
			}

			peerConnection.SetLocalDescription(answer)

			connectionUUID := uuid.New()
			connectionID = uint64(connectionUUID.ID())

			offerJSON, err := json.Marshal(&SendAnswer{
				Answer: peerConnection.LocalDescription(),
				SID:    "test room",
			})

			params := (*json.RawMessage)(&offerJSON)

			answerMessage := &jsonrpc2.Request{
				Method: "answer",
				Params: params,
				ID: jsonrpc2.ID{
					IsString: false,
					Str:      "",
					Num:      connectionID,
				},
			}

			reqBodyBytes := new(bytes.Buffer)
			json.NewEncoder(reqBodyBytes).Encode(answerMessage)

			messageBytes := reqBodyBytes.Bytes()
			connection.WriteMessage(websocket.TextMessage, messageBytes)
		} else if response.Method == "trickle" {
			var trickleResponse TrickleResponse

			if err := json.Unmarshal(message, &trickleResponse); err != nil {
				log.Fatal(err)
			}

			err := peerConnection.AddICECandidate(*trickleResponse.Params.Candidate)

			if err != nil {
				log.Fatal(err)
			}
		}
	}
}
