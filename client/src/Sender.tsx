import { useEffect, useRef, useState } from 'react';
import { AiOutlineAudio, AiOutlineAudioMuted } from 'react-icons/ai';
import { FiVideo, FiVideoOff } from 'react-icons/fi';
import { MdScreenShare,MdStopScreenShare } from 'react-icons/md';

export const Sender: React.FC<any> = ({ setSenderStreamID }) => {
  const sentVideoRef = useRef<HTMLVideoElement>(null);
  const websocket = useRef<WebSocket>();
  const pcSend = useRef<RTCPeerConnection>();

  const [videoMuted, setVideoMuted] = useState(false);
  const [muted, setMuted] = useState(false);

  const [screenShareEnabled, setScreenShareEnabled] = useState<MediaStreamTrack>();

  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState>('new');

  useEffect(() => {
    const successCallbcak = (stream: any) => {
      if (sentVideoRef.current) {
        sentVideoRef.current.srcObject = stream;
        setSenderStreamID(stream.id);
      }
    };

    navigator.getUserMedia(
      {
        video: true,
        audio: true,
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
  };

  const handleStartPublishing = async () => {
    setConnectionState('connecting');

    if (!sentVideoRef.current) {
      return;
    }

    websocket.current = new WebSocket(
      'ws://ec2-18-181-195-202.ap-northeast-1.compute.amazonaws.com:7000/ws'
    );
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
      setConnectionState(pcSend.current?.connectionState || 'new');
    };

    pcSend.current.onnegotiationneeded = async () => {
      console.log("negotiation is needed");
      if (websocket.current?.readyState === WebSocket.OPEN) {
        const offer = await pcSend.current?.createOffer()
        if (offer) {
          await pcSend.current?.setLocalDescription(offer)
          websocket.current?.send(
            JSON.stringify({
              type: 'offer',
              data: offer.sdp,
            })
          );
        }
      }
    }

    //called after adding tracks
    pcSend.current.onicecandidate = (event) => {
      console.log('oniceCandiate Sender Called', websocket.current);

      if (event.candidate && connectionState == 'connected') {
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

  const removeScreenShare = () => {
    const sender = pcSend.current?.getSenders().find(s => s.track?.id === screenShareEnabled?.id)
    if (sender) {
      pcSend.current?.removeTrack(sender);
    }
    setScreenShareEnabled(undefined);
  }

  const handleScreenShare = async () => {
    if (screenShareEnabled) {
      screenShareEnabled?.stop();
      removeScreenShare();
      return
    }
    try {
      //@ts-ignore
      const media = await navigator.mediaDevices.getDisplayMedia() as MediaStream;
      const screenTrack = media.getTracks()
      setScreenShareEnabled(screenTrack[0])

      screenTrack[0].onended = removeScreenShare
      await pcSend.current?.addTrack(screenTrack[0], media)

    } catch (e) {
      console.log(e);
    }
  }

  return (
    <div className="w-full h-full">
      <video
        className="object-cover h-full w-full"
        autoPlay
        muted
        ref={sentVideoRef}
      ></video>
      {['new', 'disconnected', 'failed'].includes(connectionState) && (
        <button
          className="bg-blue-700 absolute bottom-5 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white max-h-10 max-w-52 rounded-md px-5 py-2"
          onClick={handleStartPublishing}
        >
          JOIN
        </button>
      )}
      {connectionState === 'connecting' && (
        <p className="absolute bottom-5 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white max-h-10 max-w-52 rounded-md px-5 py-2">
          connecting...
        </p>
      )}
      {connectionState === 'connected' && (
        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-row">
          <button
            className={`${muted ? 'bg-red-700' : 'bg-gray-800'
              } transition duration-500 text-white max-h-10 max-w-52 rounded-md px-5 py-2`}
            onClick={() => {
              const video = sentVideoRef.current?.srcObject as MediaStream;
              video.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
              setMuted((m) => !m);
            }}
          >
            {muted ? <AiOutlineAudioMuted /> : <AiOutlineAudio />}
          </button>
          <button
            className={`${videoMuted ? 'bg-red-700' : 'bg-gray-800'
              } transition duration-500  ml-2 text-white max-h-10 max-w-52 rounded-md px-5 py-2`}
            onClick={() => {
              const video = sentVideoRef.current?.srcObject as MediaStream;
              video.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
              setVideoMuted((m) => !m);
            }}
          >
            {videoMuted ? <FiVideoOff /> : <FiVideo />}
          </button>
          <button onClick={handleScreenShare} className={`${!!screenShareEnabled ? "bg-gray-800": "bg-red-800" } transition duration-500  ml-2 text-white max-h-10 max-w-52 rounded-md px-5 py-2`}>
          {screenShareEnabled?<MdScreenShare/> : <MdStopScreenShare/>}
          </button>
        </div>
      )}
    </div>
  );
};
