import { Sender } from './Sender';
import { Receiver } from './Receiver';
import { useState } from 'react';

function App() {
  const [senderEnabled, setSenderEnabled] = useState(false);
  const [receiverEnabled, setReceiverEnabled] = useState(false);

  return (
    <div className="bg-gray-800">
      <div className="grid grid-cols-2 items-center gap-x-2 h-screen mx-5">
        <div className="bg-gray-500 min-w-full h-128 rounded-3xl flex flex-col relative">
          {!senderEnabled ? (
            <button
              className="bg-blue-700 absolute -top-10 left-1/2 transform -translate-x-1/2 text-white max-h-10 max-w-52 rounded-md px-5 py-2"
              onClick={() => setSenderEnabled((e) => !e)}
            >
              ENABLE SENDER
            </button>
          ) : (
            <Sender />
          )}
        </div>
        <div className="bg-gray-500 min-w-full h-128 rounded-3xl flex flex-col relative">
          {!receiverEnabled ? (
            <button
              className="bg-blue-700 absolute -top-10 left-1/2 transform -translate-x-1/2 text-white max-h-10 max-w-52 rounded-md px-5 py-2"
              onClick={() => setReceiverEnabled((e) => !e)}
            >
              ENABLE RECIEVER
            </button>
          ) : (
            <Receiver />
          )}
        </div>
      </div>
      <div></div>
    </div>
  );
}

export default App;
