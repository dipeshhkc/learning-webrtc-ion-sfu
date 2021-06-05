import React, { useEffect, useRef, useState } from 'react';

export const Receiver = () => {
  const websocket = useRef<WebSocket>();
  const pcSend = useRef<RTCPeerConnection>();
  const recvVideoRef = useRef<HTMLVideoElement>(null);

  const [connectionState, setConnectionState] = useState<string>();

  const handleStartPublishing = async () => {
    websocket.current = new WebSocket('ws://ec2-18-181-195-202.ap-northeast-1.compute.amazonaws.com:7000/ws');
    // websocket.current = new WebSocket("ws://ec2-54-248-35-65.ap-northeast-1.compute.amazonaws.com:7000/ws");
    pcSend.current = new RTCPeerConnection();

    websocket.current.onopen = () => console.log('connection opened');
    websocket.current.onmessage = async (e) => {
      const response = JSON.parse(e.data);
      if (response.type === 'offer') {
        await pcSend.current?.setRemoteDescription(response);
        const answer = await pcSend.current?.createAnswer();

        if (answer) {
          await pcSend.current?.setLocalDescription(answer);
          await websocket.current?.send(
            JSON.stringify({
              type: 'answer',
              data: answer.sdp,
            })
          );
        }
        console.log('set-remote-description');
      }

      //target=1 -> subscriber(taker)
      if (response.candidate && response.target === 1) {
        pcSend.current?.addIceCandidate(response.candidate);
        console.log('add-ice-candidate');
      }
    };

    pcSend.current.onconnectionstatechange = () => {
      console.log('state: ', pcSend.current?.connectionState);
      setConnectionState(pcSend.current?.connectionState);
    };

    //stream sfu bata aayesi call huncha
    pcSend.current.ontrack = (e) => {
      console.log('streams: ', e.streams);
      if (recvVideoRef.current) {
        recvVideoRef.current.srcObject = e.streams[0];
      }
    };

    pcSend.current.onicecandidate = (event) => {
      if (event.candidate) {
        websocket.current?.send(
          JSON.stringify({
            type: 'tricle',
            data: JSON.stringify({
              target: 1,
              candidates: event.candidate,
            }),
          })
        );
      }
    };
  };

  return (
    <div className="w-full h-full">
      <video className="object-cover h-full w-full" autoPlay ref={recvVideoRef}></video>
      {connectionState != 'connected' && (
        <button
          className="bg-blue-700 absolute -bottom-10 left-1/2 transform -translate-x-1/2 text-white max-h-10 max-w-52 rounded-md px-5 py-2"
          onClick={handleStartPublishing}
        >
          StartViewing
        </button>
      )}
    </div>
  );
};
