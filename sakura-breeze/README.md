# Sakura Breeze AR

> "Let the breeze begin with your voice."

Sakura Breeze AR is a cross-device interactive installation built with pure Web Native APIs. An iPhone controller communicates with a MacBook main display, transmitting real-time camera video stream, microphone audio analysis into wind strength (`0.0 - 1.0`), and bidirectional DataChannel messaging.

---

## 🌸 Core Architecture & Principles

This project adheres strictly to Web Native standards and zero-dependency guidelines:

- **WebRTC Native Video Streaming & Audio Analysis (Stage 5)**:
  - **iPhone Media Stream &rarr; WebRTC &rarr; MacBook Display**: Streams live iPhone camera video to `<video id="remote-video">` while routing remote microphone audio to `AudioManager` (`audio.js`) for real-time RMS wind analysis.
  - **Strict Acoustic Safety (NO SPEAKER PLAYBACK)**: The MacBook never plays the iPhone microphone through its speakers. AnalyserNode is connected only to the media stream source, **never** to `audioContext.destination`, completely eliminating acoustic feedback loops. Local iPhone preview is also strictly muted.
  - **Critical Lifecycle Design**: Both camera video and microphone audio tracks are acquired in a single `getUserMedia` call on iPhone and attached to the `RTCPeerConnection` *before* `createAnswer()` is called, matching the MacBook's `recvonly` video & audio transceivers without requiring renegotiation.
  - **Concurrent RTCDataChannel (`sakura`)**: Preserves the robust JSON-based Offer/Answer lifecycle and automated `HELLO_FROM_IPHONE` &harr; `HELLO_FROM_MAC` handshake.
  - **Zero wrappers**: No PeerJS, Socket.io, simple-peer, or external signaling servers.
  - **Zero STUN/TURN servers required** (`iceServers: []`): Designed for local network and USB tethering between devices.
  - **Strict Constraints**: No canvas petal/butterfly particles, device orientation, or WebGL in this phase.
- **Full English UI & Messages**: Designed for international and exhibition deployment.
- **Zero Build Step & Framework-Free**: No React, Vue, Angular, or Vite dependencies needed in production.
- **Direct GitHub Pages Deployment**: Fully static native HTML5, CSS3, and modern Vanilla ES6+ JavaScript.
- **USB & Networking Transparency**:
  > **Note**: USB-C is primarily used to establish a local network environment between devices (e.g. Personal Hotspot USB tethering). Camera video, microphone audio, and DataChannel messages are transmitted via WebRTC.
  > Web browsers do not access raw USB hardware directly.
- **Secure Context (HTTPS) Requirement**:
  Web standards strictly require HTTPS (or localhost during development) for camera and microphone access. If accessed over insecure HTTP, the app displays a clear warning banner.

---

## 📁 Project Structure

```text
/
├── index.html       # MacBook Main Display (#remote-video, Wind Meter, Offer JSON, Diagnostics)
├── phone.html       # iPhone Controller (#local-video preview, Answer JSON, Diagnostics)
├── app.js           # MacApp class (Offer generation, recvonly transceivers, ontrack separation)
├── audio.js         # AudioManager class (Web Audio AnalyserNode, RMS, noise floor, windStrength)
├── phone.js         # PhoneApp class (Combined camera & mic stream, track attachment, fallback)
├── diagnostics.js   # NetworkDiagnostics class (userAgent, protocol, online checking)
├── ar.js            # ARRenderer stub class (ready for Canvas blossom engine in future phase)
├── style.css        # MacBook styling (dark zen aesthetics, live video & audio analysis card)
├── phone.css        # iPhone mobile styling (touch-optimized camera/mic preview & WebRTC controller)
├── metadata.json    # AI Studio sandbox configuration (camera + microphone permissions)
└── README.md        # Comprehensive documentation & deployment instructions
```

---

## 🎙️ AudioManager & Wind Analysis Architecture (`audio.js`)

```text
iPhone Safari
  Camera  ───────────────┐
                         │
  Microphone ──────────┐ │
                       ↓ ↓
                     WebRTC (Audio + Video tracks)
                       │
                       ↓
                    MacBook
                  ┌────┴────┐
                  ↓         ↓
          <video id="remote-video">  MediaStreamAudioSourceNode
          (Muted video display)              │
                                             ↓
                                       AnalyserNode (fftSize: 512)
                                             │
                                             ↓
                                   FloatTimeDomainData
                                             │
                                             ↓
                                      RMS Computation
                                             │
                                             ↓
                               Adaptive Noise Floor Subtraction
                                             │
                                             ↓
                               Nonlinear Normalization (pow 0.75)
                                             │
                                             ↓
                                Fast Attack (0.32) & Slow Decay (0.045)
                                             │
                                             ↓
                                   windStrength (0.0 - 1.0)
```

### 1. RMS Calculation
Samples are extracted using `analyserNode.getFloatTimeDomainData()`:
$$\text{RMS} = \sqrt{\frac{1}{N} \sum_{i=0}^{N-1} s_i^2}$$

### 2. Adaptive Noise Floor
- Initial baseline: `0.010`.
- During the first 90 frames (~1.5s), ambient RMS values are collected to establish the environment noise floor:
  $$\text{noiseFloor} = \text{clamp}(0.005, 0.035, \text{P}_{25} \times 1.15)$$
- Effective volume is computed as:
  $$\text{effectiveVolume} = \max(0, \text{rawRMS} - \text{noiseFloor})$$

### 3. Nonlinear Normalization & Sensitivity
Because normal conversational speech produces RMS values far below 1.0 (typically 0.03–0.15):
- Normalized volume:
  $$\text{normalized} = \text{clamp}(0, 1, \frac{\text{effectiveVolume}}{\text{sensitivity}}), \quad \text{sensitivity} = 0.14$$
- Nonlinear curve boosting conversational responsiveness:
  $$\text{targetWind} = \text{clamp}(0, 1, \text{normalized}^{0.75})$$

### 4. Fast Attack & Slow Decay Dynamics
- When voice begins (`targetWind > currentWind`):
  $$\text{currentWind} \mathrel{+}= (\text{targetWind} - \text{currentWind}) \times 0.32$$
  *(Wind rises rapidly within a few frames)*
- When voice pauses or ceases (`targetWind \le currentWind`):
  $$\text{currentWind} \mathrel{+}= (\text{targetWind} - \text{currentWind}) \times 0.045$$
  *(Wind gently and smoothly subsides)*

### 5. Expected Testing Values
- **Quiet / Ambient**: `windStrength ≈ 0.00 – 0.05`
- **Conversational voice** (saying "櫻花" or speaking naturally): `windStrength ≈ 0.15 – 0.50`
- **Louder voice**: `windStrength ≈ 0.50 – 0.80`
- **Strong blow / loud shout**: `windStrength ≈ 0.80 – 1.00`

---

## 🔄 Step-by-Step Connection & Test Procedure

1. **MacBook (`index.html`)**:
   - Click **Reset WebRTC** to ensure a fresh session.
   - Click **Create Offer**.
   - `RTCPeerConnection` creates DataChannel `"sakura"` and adds both `recvonly` video & audio transceivers.
   - Click **Copy Offer**.

2. **iPhone (`phone.html`)**:
   - Paste Offer into **1. Paste Offer Signaling JSON**.
   - Click **Start Camera & Mic** (or directly click **Create Answer**, which activates both devices).
   - Safari prompts for Camera & Microphone permissions &rarr; Allow both.
   - Click **Copy Answer**.

3. **MacBook (`index.html`)**:
   - Paste Answer into **2. Paste Answer Signaling JSON**.
   - Click **Connect**.
   - Status updates to **CONNECTED**.
   - Camera: **STREAMING LIVE** (video plays on `#remote-video`).
   - Microphone: **ANALYZING** (real-time wind strength meter responds).
   - *(Note: If browser autoplay policy suspends AudioContext, click **Enable Audio Analysis**)*.

4. **Acoustic Wind Testing**:
   - **Quiet**: Keep quiet &rarr; `Wind ≈ 0.00 – 0.04`.
   - **Speech**: Say "櫻花" &rarr; Wind rises promptly to `~0.30 - 0.50`.
   - **Continuous speech**: Wind stays elevated.
   - **Stop speaking**: Wind decays slowly and smoothly back to calm.
   - **Loud speech**: Wind reaches `0.60 – 0.90`.
   - **Zero Acoustic Feedback**: No sound comes out of the MacBook speaker.

---

## 🚀 GitHub Pages Deployment

1. Push all files to your GitHub repository root.
2. Go to **Settings** &rarr; **Pages** &rarr; select `Branch: main` and `/ (root)`.
3. Open on MacBook: `https://<your-username>.github.io/<repo-name>/index.html`
4. Open on iPhone: `https://<your-username>.github.io/<repo-name>/phone.html`
