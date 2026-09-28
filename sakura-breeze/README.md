# Sakura Breeze AR

> "Let the breeze begin with your voice."

Sakura Breeze AR is a cross-device interactive installation built with pure Web Native APIs. An iPhone controller communicates with a MacBook main display, transforming breath and motion into cherry blossom wind cascades.

---

## 🌸 Core Architecture & Principles

This project adheres strictly to Web Native standards and zero-dependency guidelines:

- **WebRTC Native DataChannel (Phase 3 - JSON Signaling Protocol)**:
  - Establishes a bidirectional, low-latency `RTCDataChannel` named `"sakura"`.
  - Pure native browser APIs: `RTCPeerConnection`, `RTCDataChannel`.
  - Zero wrappers: No PeerJS, Socket.io, simple-peer, or external signaling servers.
  - Zero STUN/TURN servers required (`iceServers: []`) because MacBook and iPhone communicate across local USB network tethering.
  - **JSON Signaling Envelope**: Avoids raw SDP textarea line-break corruption (`\r\n` &rarr; `\n`) between Chrome and Safari by exchanging structured JSON objects:
    ```json
    {
      "type": "offer",
      "sdp": "..."
    }
    ```
    and
    ```json
    {
      "type": "answer",
      "sdp": "..."
    }
    ```
  - Zero Camera, Microphone, Motion, or AR Canvas dependencies at this stage.
- **Full English UI & Messages**: Designed for international and production deployment.
- **Zero Build Step & Framework-Free**: No React, Vue, Angular, Vite, or TypeScript compilation required in production.
- **Direct GitHub Pages Deployment**: Fully static native HTML5, CSS3, and modern Vanilla ES6+ JavaScript.
- **USB & Networking Transparency**:
  > **Note**: USB-C is primarily used to establish a local network environment between devices (e.g. Personal Hotspot USB tethering). Camera, Microphone, and Motion will later be transmitted via WebRTC.
  > JavaScript in standard web browsers does not access raw USB hardware. WebUSB or Web Serial are not used.
- **Secure Context (HTTPS) Requirement**:
  Web standards strictly require HTTPS (or localhost during development) for sensor APIs and WebRTC. If accessed over insecure HTTP, the app displays:
  `"Please open this website via HTTPS."` without crashing.

---

## 📁 Project Structure

```text
/
├── index.html       # MacBook Main Display (#app container, Offer JSON, Diagnostics)
├── phone.html       # iPhone Controller (Answer JSON, Diagnostics)
├── app.js           # MacApp class (Offer generation, ICE complete wait, JSON payload, DataChannel 'sakura')
├── phone.js         # PhoneApp class (Answer generation, ondatachannel, JSON payload, handshake test)
├── diagnostics.js   # NetworkDiagnostics class (userAgent, protocol, online checking)
├── ar.js            # ARRenderer stub class (ready for Canvas blossom engine)
├── style.css        # MacBook styling (dark zen aesthetics, JSON textareas, WebRTC UI)
├── phone.css        # iPhone mobile styling (touch-optimized WebRTC controller)
└── README.md        # Comprehensive documentation & deployment instructions
```

---

## 🔄 Phase 3 WebRTC RTCDataChannel Connection Flow (JSON Signaling)

1. **MacBook (`index.html`)**:
   - Click **Reset WebRTC** (if starting fresh).
   - Click **Create Offer**.
   - `RTCPeerConnection({ iceServers: [] })` creates local DataChannel `"sakura"`.
   - Waits for `iceGatheringState === "complete"`.
   - The pristine local description is serialized directly into `{"type":"offer","sdp":"..."}` without modifying SDP line endings or attributes.
   - Click **Copy Offer**.

2. **iPhone (`phone.html`)**:
   - Click **Reset WebRTC** (if starting fresh).
   - Paste the copied Offer into **1. Paste Offer Signaling JSON**.
   - Click **Create Answer**.
   - The JSON is parsed with `JSON.parse()`, validating `type === "offer"` and `sdp.startsWith("v=0")`.
   - The offer object is passed directly to `pc.setRemoteDescription(offer)`.
   - `createAnswer()` and `setLocalDescription(answer)` are invoked.
   - Waits for `iceGatheringState === "complete"`.
   - The answer payload `{"type":"answer","sdp":"..."}` appears in **2. Answer Signaling JSON**.
   - Click **Copy Answer**.

3. **MacBook (`index.html`)**:
   - Paste the iPhone's Answer into **2. Paste Answer Signaling JSON**.
   - Click **Connect**.
   - `pc.setRemoteDescription(answer)` establishes peer connection.

4. **Automated Handshake Test**:
   - When iPhone DataChannel opens &rarr; sends `HELLO_FROM_IPHONE`.
   - MacBook receives `HELLO_FROM_IPHONE` &rarr; displays `Received: HELLO_FROM_IPHONE` and sends `HELLO_FROM_MAC`.
   - iPhone receives `HELLO_FROM_MAC` &rarr; displays `Received: HELLO_FROM_MAC`.
   - Connection status updates to `CONNECTED` on both screens.

---

## 🔍 Connection Environment Diagnostics

Both `index.html` and `phone.html` instantiate `NetworkDiagnostics` to inspect:

| Property | Source | Expected Value |
| :--- | :--- | :--- |
| **Browser** | `navigator.userAgent` | Safari / Chrome / Firefox / Edge |
| **HTTPS** | `location.protocol` / secure context | YES (https:) / NO (http:) |
| **Online** | `navigator.onLine` | YES / NO |

---

## 🚀 Deploying to GitHub Pages

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "fix: WebRTC JSON signaling envelope for Chrome-Safari SDP compatibility"
   git push origin main
   ```

2. **Bypass Mobile / Browser Cache on GitHub Pages**:
   - On iPhone Safari: Settings &rarr; Safari &rarr; Clear History and Website Data, or reload with long press on reload icon &rarr; Request Desktop Website / Reload Without Content Blockers.
   - You can also append a query string when opening the page:
     - `https://<your-username>.github.io/<your-repo-name>/index.html?v=3`
     - `https://<your-username>.github.io/<your-repo-name>/phone.html?v=3`
