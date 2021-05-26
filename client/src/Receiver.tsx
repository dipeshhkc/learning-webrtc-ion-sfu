import React, { useEffect, useRef, useState } from 'react';

export const Receiver = () => {
  const websocket = useRef<WebSocket>();
  const pcSend = useRef<RTCPeerConnection>();
  const recvVideoRef = useRef<HTMLVideoElement>(null);

  const [connectionState, setConnectionState] = useState<string>();

  const handleStartPublishing = async () => {
    websocket.current = new WebSocket('ws://localhost:7000/ws');
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
    <div>
      <button onClick={handleStartPublishing}>StartViewing</button> <br />
      <video
        autoPlay
        ref={recvVideoRef}
        style={{ width: 200, height: 200, background: '#333' }}
      ></video>
      <br />
      <pre>ConnectionState: {connectionState}</pre>
    </div>
  );
};
