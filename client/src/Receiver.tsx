import React, { useEffect, useRef, useState } from 'react';
import { AiFillPushpin } from 'react-icons/ai';

export const Receiver: React.FC<any> = ({ senderStreamID }) => {
  const websocket = useRef<WebSocket>();
  const pcSend = useRef<RTCPeerConnection>();
  const [streams, setStreams] = useState<MediaStream[]>([]);

  const [pinStream, setPinStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    handleStartPublishing();
  }, []);

  const [connectionState, setConnectionState] = useState<string>();

  const handleStartPublishing = async () => {
    websocket.current = new WebSocket(
      'ws://ec2-18-181-195-202.ap-northeast-1.compute.amazonaws.com:7000/ws'
    );
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
    // pcSend.current.ontrack = (e) => {
    //   console.log('streams: ', e.streams);
    //   if (recvVideoRef.current) {
    //     recvVideoRef.current.srcObject = e.streams[0];
    //   }
    // };
    pcSend.current.ontrack = (e) => {
      console.log('streams: ', e.streams);
      e.streams[0].onremovetrack = () => {
        console.log('onremove track');
        setStreams((s) => s.filter((str) => str.id !== e.streams[0].id));
      };
      setStreams((s) => {
        if (e.streams.length == 1 && e.streams[0].active) {
          if (s.map((s) => s.id).indexOf(e.streams[0].id) === -1) {
            s.push(e.streams[0]);
          }
        }
        return s;
      });
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
    <div className="grid grid-cols-3 gap-x-10 gap-y-10 p-20">
      {connectionState !== 'connected' && (
        <p className="fixed right-1/2 top-1/2 transform translate-x-1/2 -translate-y-1/2 text-white">
          RETREIVING VIDEOS...
        </p>
      )}

      {streams
        .filter((s) => s.id !== senderStreamID && s.active)
        .map((stream, index) => (
          <div
            className={` rounded-3xl overflow-hidden bg-gray-900 group transition duration-500 ${
              pinStream == stream
                ? 'max-h-screen fixed left-0 top-0 h-screen w-screen'
                : 'relative w-full h-full max-h-96'
            }`}
            key={stream.id}
          >
            <Video srcObject={stream} />
            <p className="absolute text-white top-0 left-3">
              FRIEND {index + 1}
            </p>
            <p
              className="cursor-pointer absolute text-white top-1/2 left-1/2 text-2xl hidden group-hover:block "
              onClick={() =>
                pinStream ? setPinStream(null) : setPinStream(stream)
              }
            >
              <AiFillPushpin />
            </p>
          </div>
        ))}
    </div>
  );
};

const Video: React.FC<any> = ({ srcObject }) => {
  const recvVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (srcObject && recvVideoRef.current) {
      recvVideoRef.current.srcObject = srcObject;
    }
  }, [srcObject]);

  if (srcObject.active) {
    return (
      <video
        autoPlay
        ref={recvVideoRef}
        className="object-cover w-full h-full"
      ></video>
    );
  }

  return null;
};
