import { useEffect, useRef, useState } from 'react';

export const Sender = () => {
  const sentVideoRef = useRef<HTMLVideoElement>(null);
  const websocket = useRef<WebSocket>();
  const pcSend = useRef<RTCPeerConnection>();

  const [connectionState, setConnectionState] = useState<string>();

  useEffect(() => {
    const successCallbcak = (stream: any) => {
      if (sentVideoRef.current) {
        sentVideoRef.current.srcObject = stream;
      }
    };

    navigator.getUserMedia(
      {
        video: true,
        audio: false,
      },
      successCallbcak,
      console.error
    );
  }, []);

  // Free public STUN servers provided by Google.
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
}


  const handleStartPublishing = async () => {
    if (!sentVideoRef.current) {
      return;
    }

    websocket.current = new WebSocket('ws://ec2-18-181-195-202.ap-northeast-1.compute.amazonaws.com:7000/ws');
    websocket.current.onopen = () => console.log('connection opened');
    websocket.current.onmessage = async (e) => {
      const response = JSON.parse(e.data);
      if (response.type === 'answer') {
        await pcSend.current?.setRemoteDescription(response);
        console.log('set-remote-description');
      }

      if (response.candidate && response.target === 0) {
        await pcSend.current?.addIceCandidate(response.candidate);
        console.log('add-ice-candidate');
      }
    };

    pcSend.current = new RTCPeerConnection(iceServers);
    pcSend.current.onconnectionstatechange = () => {
      console.log('state: ', pcSend.current?.connectionState);
      setConnectionState(pcSend.current?.connectionState);
    };

    //called after adding tracks
    pcSend.current.onicecandidate = (event) => {
      console.log('oniceCandiate Sender Called');
      if (event.candidate) {
        websocket.current?.send(
          JSON.stringify({
            type: 'tricle',
            data: JSON.stringify({
              target: 0,
              candidates: event.candidate,
            }),
          })
        );
      }
    };

    // Before sending the offer to the ion-sfu server over Websockets we first need to add the video and audio stream.
    // This is where the media device library comes into play to read the video from the camera.

    const stream = sentVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      for (const t of stream.getTracks()) {
        console.log('adding tracks...');
        pcSend.current?.addTrack(t, stream);
      }
    }
    console.log('offer created');
    const offer = await pcSend.current.createOffer();
    pcSend.current.setLocalDescription(offer);

    setTimeout(() => {
      websocket.current?.send(
        JSON.stringify({
          type: 'offer',
          data: offer.sdp,
        })
      );
    }, 2000);
  };

  return (
    <div className="w-full h-full">
      <video className="object-cover h-full w-full" autoPlay ref={sentVideoRef}></video>
      {connectionState != 'connected' && (
        <button
        className="bg-blue-700 absolute bottom-5 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white max-h-10 max-w-52 rounded-md px-5 py-2"
        onClick={handleStartPublishing}
        >
          Start Publishing
        </button>
      )}
    </div>
  );
};
