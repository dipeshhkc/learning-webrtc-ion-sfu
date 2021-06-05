import { useEffect, useRef } from 'react';
import { Modal } from './components/modal';

interface ISingleVideo {
  open: boolean;
  setModalClose: any;
  stream: any;
}
export const SingleVideo = ({ open, setModalClose, stream }: ISingleVideo) => {
  const recvVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stream && recvVideoRef.current) {
      recvVideoRef.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <Modal isOpen={open} title="" onClose={setModalClose} width="7xl">
      <video
        autoPlay
        ref={recvVideoRef}
        className="object-cover w-full h-full"
      ></video>
    </Modal>
  );
};
