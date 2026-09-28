# Sakura Breeze AR

> "Let the breeze begin with your voice."

Sakura Breeze AR is a cross-device interactive installation built with pure Web Native APIs. An iPhone controller communicates with a MacBook main display, transforming breath and motion into cherry blossom wind cascades.

---

## 🌸 Core Architecture & Principles

This project adheres strictly to Web Native standards and zero-dependency guidelines:

- **WebRTC Native DataChannel (Phase 3)**:
  - Establishes a bidirectional, low-latency `RTCDataChannel` named `"sakura"`.
  - Pure native browser APIs: `RTCPeerConnection`, `RTCDataChannel`, `RTCSessionDescription`, `ICE`.
  - Zero wrappers: No PeerJS, Socket.io, simple-peer, or external signaling servers.
  - Zero STUN/TURN servers required (`iceServers: []`) because MacBook and iPhone communicate across local USB network tethering.
  - Zero Camera, Microphone, Motion, or AR Canvas dependencies at this stage.
- **Full English UI & Messages**: Designed for international and production deployment.
- **Zero Build Step & Framework-Free**: No React, Vue, Angular, Vite, or TypeScript compilation required in production.
- **Direct GitHub Pages Deployment**: Fully static native HTML5, CSS3, and modern Vanilla ES6+ JavaScript.
- **USB & Networking Transparency**:
  > **Note**: USB-C is primarily used to establish a network environment between devices (e.g. tethering/local IP routing). Camera, Microphone, and Motion will later be transmitted via WebRTC.
  > JavaScript in standard web browsers does not access raw USB hardware. WebUSB or Web Serial are not used, nor is USB treated as a Camera API.
- **Secure Context (HTTPS) Requirement**:
  Web standards strictly require HTTPS (or localhost during development) for sensor APIs and WebRTC. If accessed over insecure HTTP, the app displays:
  `"Please open this website via HTTPS."` without crashing.

---

## 📁 Project Structure

```text
/
├── index.html       # MacBook Main Display (#app container, WebRTC Offer, Diagnostics)
├── phone.html       # iPhone Controller (WebRTC Answer, Diagnostics)
├── app.js           # MacApp class (Offer generation, ICE complete wait, DataChannel 'sakura')
├── phone.js         # PhoneApp class (Answer generation, ondatachannel, handshake test)
├── diagnostics.js   # NetworkDiagnostics class (userAgent, protocol, online checking)
├── ar.js            # ARRenderer stub class (ready for Canvas blossom engine)
├── style.css        # MacBook styling (dark zen Japanese aesthetics & WebRTC UI)
├── phone.css        # iPhone mobile styling (touch-optimized WebRTC controller)
└── README.md        # Comprehensive documentation & deployment instructions
```

---

## 🔄 Phase 3 WebRTC RTCDataChannel Connection Flow

1. **MacBook (`index.html`)**:
   - Click **Create Offer**.
   - `RTCPeerConnection({ iceServers: [] })` creates local DataChannel `"sakura"`.
   - Waits for `iceGatheringState === "complete"` before displaying full `pc.localDescription.sdp` in the Offer box.
   - Click **Copy Offer**.

2. **iPhone (`phone.html`)**:
   - Paste the copied Offer into **1. Paste Offer**.
   - Click **Create Answer**.
   - `setRemoteDescription(offer)` and `createAnswer()` are invoked.
   - Waits for `iceGatheringState === "complete"` before displaying full Answer SDP in **2. Answer**.
   - Click **Copy Answer**.

3. **MacBook (`index.html`)**:
   - Paste the iPhone's Answer into **2. Paste Answer**.
   - Click **Connect**.
   - `setRemoteDescription(answer)` establishes peer connection.

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

If `location.protocol !== 'https:'` on a remote host:
- A non-intrusive red security banner appears: `"Please open this website via HTTPS."`
- The application executes smoothly and never crashes.

---

## 🚀 Deploying to GitHub Pages

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: Sakura Breeze AR Phase 3 native WebRTC RTCDataChannel"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository's **Settings** tab.
   - Click **Pages** in the left sidebar.
   - Under **Build and deployment > Branch**, choose `main` branch and `/ (root)` folder.
   - Click **Save**.

3. **Access URLs (HTTPS Enforced)**:
   - **MacBook Main Screen**: `https://<your-username>.github.io/<your-repo-name>/index.html`
   - **iPhone Controller**: `https://<your-username>.github.io/<your-repo-name>/phone.html`
