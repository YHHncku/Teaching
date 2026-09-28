# Sakura Breeze AR

> "Let the breeze begin with your voice."

Sakura Breeze AR is a cross-device interactive installation built with pure Web Native APIs. An iPhone controller communicates with a MacBook main display, transmitting real-time camera video stream alongside bidirectional data communication.

---

## 🌸 Core Architecture & Principles

This project adheres strictly to Web Native standards and zero-dependency guidelines:

- **WebRTC Native Video Streaming & DataChannel (Phase 4)**:
  - **iPhone Camera &rarr; WebRTC &rarr; MacBook Display**: Streams live iPhone camera video to the MacBook's `<video id="remote-video">` container.
  - **Critical Lifecycle Design**: The camera video track is acquired and attached to the iPhone's `RTCPeerConnection` *before* `createAnswer()` is called, matching the MacBook's `recvonly` video transceiver without requiring renegotiation.
  - **Concurrent RTCDataChannel (`sakura`)**: Preserves the robust JSON-based Offer/Answer lifecycle and automated `HELLO_FROM_IPHONE` &harr; `HELLO_FROM_MAC` handshake.
  - **Zero wrappers**: No PeerJS, Socket.io, simple-peer, or external signaling servers.
  - **Zero STUN/TURN servers required** (`iceServers: []`): Designed for local network and USB tethering between devices.
  - **Strict Constraints**: No microphone, no motion, and no AR petal/butterfly particles in this phase.
- **Full English UI & Messages**: Designed for international and exhibition deployment.
- **Zero Build Step & Framework-Free**: No React, Vue, Angular, or Vite dependencies needed in production.
- **Direct GitHub Pages Deployment**: Fully static native HTML5, CSS3, and modern Vanilla ES6+ JavaScript.
- **USB & Networking Transparency**:
  > **Note**: USB-C is primarily used to establish a local network environment between devices (e.g. Personal Hotspot USB tethering). Camera video and DataChannel messages are transmitted via WebRTC.
  > JavaScript in standard web browsers does not access raw USB hardware directly. WebUSB or Web Serial are not used.
- **Secure Context (HTTPS) Requirement**:
  Web standards strictly require HTTPS (or localhost during development) for camera access and WebRTC. If accessed over insecure HTTP, the app displays:
  `"Please open this website via HTTPS."` without crashing.

---

## 📁 Project Structure

```text
/
├── index.html       # MacBook Main Display (#remote-video, Offer JSON, Diagnostics)
├── phone.html       # iPhone Controller (#local-video preview, Answer JSON, Diagnostics)
├── app.js           # MacApp class (Offer generation, recvonly video transceiver, ontrack handler, DataChannel 'sakura')
├── phone.js         # PhoneApp class (Camera stream capture, track attachment before Answer, ondatachannel)
├── diagnostics.js   # NetworkDiagnostics class (userAgent, protocol, online checking)
├── ar.js            # ARRenderer stub class (ready for Canvas blossom engine in future phase)
├── style.css        # MacBook styling (dark zen aesthetics, live video stream layout, WebRTC card)
├── phone.css        # iPhone mobile styling (touch-optimized camera preview & WebRTC controller)
└── README.md        # Comprehensive documentation & deployment instructions
```

---

## 🔄 Phase 4 Connection & Camera Streaming Flow

1. **MacBook (`index.html`)**:
   - Click **Reset WebRTC** (if starting fresh).
   - Click **Create Offer**.
   - `RTCPeerConnection({ iceServers: [] })` creates DataChannel `"sakura"` and adds a `recvonly` video transceiver (`pc.addTransceiver('video', { direction: 'recvonly' })`).
   - Waits for `iceGatheringState === "complete"`.
   - The pristine local description is serialized directly into `{"type":"offer","sdp":"..."}`.
   - Click **Copy Offer**.

2. **iPhone (`phone.html`)**:
   - Click **Start Camera** to activate the rear camera preview (or simply click **Create Answer**, which automatically activates the camera if not already running).
   - Paste the MacBook's Offer JSON into **1. Paste Offer Signaling JSON**.
   - Click **Create Answer**.
   - The Offer is validated and passed to `pc.setRemoteDescription(offer)`.
   - The camera's active video track is attached to the PeerConnection (assigning it to the video transceiver with direction `sendonly`).
   - `createAnswer()` and `setLocalDescription(answer)` are invoked.
   - Waits for `iceGatheringState === "complete"`.
   - The answer payload `{"type":"answer","sdp":"..."}` appears in **2. Answer Signaling JSON**.
   - Click **Copy Answer**.

3. **MacBook (`index.html`)**:
   - Paste the iPhone's Answer into **2. Paste Answer Signaling JSON**.
   - Click **Connect**.
   - `pc.setRemoteDescription(answer)` establishes the peer connection.
   - `pc.ontrack` fires on MacBook, binding the remote camera stream to `<video id="remote-video">`.
   - Live iPhone camera feed immediately plays on the MacBook display.

4. **Automated Handshake & DataChannel**:
   - When the DataChannel opens, iPhone sends `HELLO_FROM_IPHONE`.
   - MacBook receives `HELLO_FROM_IPHONE` and automatically replies `HELLO_FROM_MAC`.
   - Both devices confirm live bidirectional communication alongside real-time video streaming!

---

## 🔍 Connection Environment Diagnostics

Both `index.html` and `phone.html` instantiate `NetworkDiagnostics` to inspect:

| Property | Source | Expected Value |
| :--- | :--- | :--- |
| **Browser** | `navigator.userAgent` | `Chrome` on MacBook / `Safari` on iPhone |
| **HTTPS** | `location.protocol` | `YES` (`https:`) |
| **Online** | `navigator.onLine` | `YES` |

---

## 🚀 GitHub Pages Deployment

1. Push all files to your GitHub repository root.
2. Go to **Settings** &rarr; **Pages** &rarr; select `Branch: main` and `/ (root)`.
3. Open on MacBook: `https://<your-username>.github.io/<repo-name>/index.html`
4. Open on iPhone: `https://<your-username>.github.io/<repo-name>/phone.html`
