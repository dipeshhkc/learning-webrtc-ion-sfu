import { Sender } from './Sender';
import { Receiver } from './Receiver';
import { useState } from 'react';

function App() {
  const [senderStreamID, setSenderStreamID] = useState();

  return (
    <div className="bg-gray-800 min-h-screen overflow-auto">
      <div className="bg-gray-500 w-72 h-72 rounded-full fixed right-10 bottom-10 overflow-hidden z-10">
        <Sender setSenderStreamID={setSenderStreamID} />
      </div>
      <div className="relative">
        <Receiver senderStreamID={senderStreamID} />
      </div>
    </div>
  );
}

export default App;
