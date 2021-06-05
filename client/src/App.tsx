import { Sender } from './Sender';
import { Receiver } from './Receiver';
import { useState } from 'react';

function App() {
  const [senderEnabled, setSenderEnabled] = useState(false);
  const [receiverEnabled, setReceiverEnabled] = useState(false);

  return (
    <div className="bg-gray-800 min-h-screen">
      <div className="bg-gray-500 w-72 h-72 rounded-full fixed right-10 bottom-10 overflow-hidden z-10">
        {!senderEnabled ? (
          <button
            className="bg-blue-700 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white max-h-10 max-w-52 rounded-md px-5 py-2"
            onClick={() => setSenderEnabled((e) => !e)}
          >
            START STREAMING
          </button>
        ) : (
          <Sender />
        )}
      </div>
      <div className="relative">
        {!receiverEnabled ? (
          <button
            className="bg-blue-700 absolute top-10 left-1/2 transform -translate-x-1/2 text-white max-h-10 max-w-60 rounded-md px-5 py-2"
            onClick={() => setReceiverEnabled((e) => !e)}
          >
            WATCH YOUR FRIENDS
          </button>
        ) : (
          <Receiver />
        )}
      </div>
    </div>
  );
}

export default App;
