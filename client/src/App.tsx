import { Sender } from './Sender';
import { Receiver } from "./Receiver";
import { useState } from 'react';

function App() {

  const [senderEnabled, setSenderEnabled] = useState(false);
  const [receiverEnabled, setReceiverEnabled] = useState(false);

  return (
    <div className="App">
      <p>Video Streaming</p>
      <div>
        <button onClick={() => setSenderEnabled(e => !e)}>Enable Sender</button>
        <button onClick={() => setReceiverEnabled(e => !e)}>Enable Receiver</button>
      </div>
      <br />
      <br />
      <br />
      <br />
      <div>
        {senderEnabled && <Sender />}
        {receiverEnabled && <Receiver />}
      </div>
    </div>
  );
}

export default App;
