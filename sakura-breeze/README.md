# Sakura Breeze AR

> "Let the breeze begin with your voice."

Sakura Breeze AR is a cross-device interactive installation built with pure Web Native APIs. An iPhone controller communicates with a MacBook main display, transforming breath and motion into cherry blossom wind cascades.

---

## 🌸 Core Architecture & Principles

This project adheres strictly to Web Native standards and zero-dependency guidelines:

- **Full English UI & Messages**: Designed for international and production deployment.
- **Zero Build Step & Framework-Free**: No React, Vue, Angular, Vite, or TypeScript compilation required in production.
- **Direct GitHub Pages Deployment**: Fully static native HTML5, CSS3, and modern Vanilla ES6+ JavaScript.
- **USB & Networking Transparency**:
  > **Note**: USB-C is primarily used to establish a network environment between devices (e.g. tethering/local IP routing). Camera, Microphone, and Motion will later be transmitted via WebRTC.
  > JavaScript in standard web browsers does not access raw USB hardware. WebUSB or Web Serial are not used, nor is USB treated as a Camera API.
- **Secure Context (HTTPS) Requirement**:
  Web standards strictly require HTTPS (or localhost during development) for sensor APIs and WebRTC. If accessed over insecure HTTP, the app displays:
  `"Please open this website via HTTPS."` without crashing.
- **Privacy & User Intent**:
  Camera, Microphone, and Device Motion permissions are never requested before the user explicitly taps "Start" on the iPhone controller.

---

## 📁 Project Structure

```text
/
├── index.html       # MacBook Main Display (#app container & environment diagnostics)
├── phone.html       # iPhone Controller (touch interface & environment diagnostics)
├── app.js           # MacApp class (diagnostics integration & AR renderer lifecycle)
├── phone.js         # PhoneApp class (safe start trigger & diagnostics integration)
├── diagnostics.js   # NetworkDiagnostics class (userAgent, protocol, online checking)
├── ar.js            # ARRenderer stub class (ready for Canvas blossom engine)
├── style.css        # MacBook styling (dark zen Japanese aesthetics)
├── phone.css        # iPhone mobile styling (touch & viewport-fit optimized)
└── README.md        # Comprehensive documentation & deployment instructions
```

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
   git commit -m "feat: Sakura Breeze AR USB network diagnostics in full English"
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
