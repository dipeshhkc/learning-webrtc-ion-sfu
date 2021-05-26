import React, { useEffect, useRef, useState } from 'react'

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
        }

        navigator.getUserMedia({
            video: true,
            audio: false,
        }, successCallbcak, console.error);
    }, [])

    const handleStartPublishing = async () => {
        if (!sentVideoRef.current) {
            return;
        }

        websocket.current = new WebSocket("ws://localhost:7000/ws");
        websocket.current.onopen = () => console.log("connection opened")
        websocket.current.onmessage = async (e) => {
            const response = JSON.parse(e.data)
            if (response.type === "answer") {
                await pcSend.current?.setRemoteDescription(response)
                console.log("set-remote-description")
            }

            if (response.candidate && response.target === 0) {
                await pcSend.current?.addIceCandidate(response.candidate);
                console.log("add-ice-candidate");
            }
        }

        pcSend.current = new RTCPeerConnection();
        pcSend.current.onconnectionstatechange = () => {
            console.log("state: ", pcSend.current?.connectionState)
            setConnectionState(pcSend.current?.connectionState);
        }

        //called after adding tracks
        pcSend.current.onicecandidate = (event) => {
            console.log("oniceCandiate Sender Called")
            if (event.candidate) {
                websocket.current?.send(JSON.stringify({
                    type: "tricle",
                    data: JSON.stringify({
                        "target": 0,
                        "candidates": event.candidate
                    })
                }))
            }
        }

        // Before sending the offer to the ion-sfu server over Websockets we first need to add the video and audio stream. 
        // This is where the media device library comes into play to read the video from the camera.
    
        const stream = sentVideoRef.current?.srcObject as MediaStream;
        if (stream) {
            for (const t of stream.getTracks()) {
                console.log("adding tracks...")
                pcSend.current?.addTrack(t, stream);
            }
        }
        console.log("offer created")
        const offer = await pcSend.current.createOffer()
        pcSend.current.setLocalDescription(offer);

        setTimeout(() => {
           
            websocket.current?.send(JSON.stringify({
                "type": "offer",
                "data": offer.sdp,
            }))
        }, 2000)
    }

    return (
        <div>
            <button onClick={handleStartPublishing}>StartPublishing</button>
            <br />
            <video autoPlay ref={sentVideoRef} style={{ width: 200, height: 200, background: "#333" }}></video><br />
            <pre>ConnectionState: {connectionState}</pre>
        </div>

    )
}
