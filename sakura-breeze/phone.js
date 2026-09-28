/**
 * Sakura Breeze AR - iPhone Controller
 * class PhoneApp
 * Stage 4: iPhone Camera Video Stream + Native WebRTC RTCDataChannel
 * (iPhone Safari <-> MacBook Chrome)
 * Lifecycle-Hardened Implementation
 */

let phoneSessionCounter = 0;

class PhoneApp {
  constructor() {
    this.initialized = false;
    this.sessionId = '-';
    this.currentSessionActive = false;
    this.isCreatingAnswer = false;

    // Camera state
    this.localStream = null;
    this.currentFacingMode = 'environment'; // Default to rear camera on iPhone

    // 1. Status elements
    this.statusBadge = document.getElementById('status-badge');
    this.statusElement = document.getElementById('connection-status');
    this.httpsWarning = document.getElementById('https-warning');
    this.errorBox = document.getElementById('error-diagnostics');

    // 2. Camera & Microphone elements (Phase 5)
    this.localVideo = document.getElementById('local-video');
    this.cameraStatusBadge = document.getElementById('camera-status-badge');
    this.micStatusBadge = document.getElementById('mic-status-badge');
    this.cameraStatus = document.getElementById('camera-status');
    this.cameraPlaceholder = document.getElementById('camera-placeholder');
    this.btnStartCamera = document.getElementById('btn-start-camera');
    this.btnSwitchCamera = document.getElementById('btn-switch-camera');

    // 3. Motion Sensor elements (Phase 6)
    this.btnEnableMotion = document.getElementById('btn-enable-motion');
    this.motionStatusBadge = document.getElementById('motion-status-badge');
    this.motionHint = document.getElementById('motion-hint');
    this.phoneMotionAlpha = document.getElementById('phone-motion-alpha');
    this.phoneMotionBeta = document.getElementById('phone-motion-beta');
    this.phoneMotionGamma = document.getElementById('phone-motion-gamma');
    this.phoneMotionAcc = document.getElementById('phone-motion-acc');
    this.phoneMotionRate = document.getElementById('phone-motion-rate');
    this.phoneMotionPackets = document.getElementById('phone-motion-packets');

    // Motion streaming state
    this.motionActive = false;
    this.motionInterval = null;
    this.orientationListener = null;
    this.motionListener = null;
    this.latestOrientation = { alpha: 0, beta: 0, gamma: 0 };
    this.latestMotion = { accX: 0, accY: 0, accZ: 0, rotAlpha: 0, rotBeta: 0, rotGamma: 0 };
    this.motionPacketsSent = 0;
    this.motionSentTimestamps = [];

    // 4. Diagnostics elements (Phase 2 preserved)
    this.diagBrowser = document.getElementById('diag-browser');
    this.diagHttps = document.getElementById('diag-https');
    this.diagOnline = document.getElementById('diag-online');

    // 4. Signaling Diagnostics elements
    this.sigPayloadType = document.getElementById('sig-payload-type');
    this.sigSdpLength = document.getElementById('sig-sdp-length');
    this.sigFirstLine = document.getElementById('sig-first-line');
    this.sigLastLine = document.getElementById('sig-last-line');
    this.sigLineCount = document.getElementById('sig-line-count');

    // 5. WebRTC Offer elements (Unified ID: offer-sdp)
    this.offerTextarea = document.getElementById('offer-sdp');
    this.btnCreateAnswer = document.getElementById('btn-create-answer');
    this.btnClearOffer = document.getElementById('btn-clear-offer');

    // 6. WebRTC Answer elements (Unified ID: answer-sdp)
    this.answerTextarea = document.getElementById('answer-sdp');
    this.btnCopyAnswer = document.getElementById('btn-copy-answer');
    this.btnClearAnswer = document.getElementById('btn-clear-answer');

    // 7. Reset button
    this.btnResetWebRTC = document.getElementById('btn-reset-webrtc');

    // 8. DataChannel test & message log
    this.messageLog = document.getElementById('datachannel-log');

    // 9. Developer mode / Session Debug indicators
    this.debugSessionId = document.getElementById('debug-session-id');
    this.debugSignalState = document.getElementById('debug-signal-state');
    this.debugLocalDesc = document.getElementById('debug-local-desc');
    this.debugRemoteDesc = document.getElementById('debug-remote-desc');
    this.debugDcState = document.getElementById('debug-dc-state');
    this.debugConnState = document.getElementById('debug-conn-state');
    this.debugIceConnState = document.getElementById('debug-ice-conn-state');
    this.debugIceGatherState = document.getElementById('debug-ice-gather-state');

    // 10. WebRTC connection instances
    this.pc = null;
    this.channel = null;
    this.diagnostics = null;

    this.init();
  }

  /**
   * Initializes application, validates DOM bindings, and binds event listeners once
   */
  init() {
    // Guard against duplicate init execution
    if (this.initialized) return;
    this.initialized = true;

    // Audit & validate all required DOM elements immediately
    this.validateDOMBindings();

    // Initial Connection Status
    this.updateStatus('DISCONNECTED');

    // Initialize Network Diagnostics (Phase 2 preserved)
    if (typeof NetworkDiagnostics !== 'undefined') {
      this.diagnostics = new NetworkDiagnostics({
        onStatusChange: (report) => this.renderDiagnostics(report)
      });
      this.renderDiagnostics(this.diagnostics.getReport());
    }

    // Bind Camera controls
    if (this.btnStartCamera) {
      this.btnStartCamera.addEventListener('click', () => this.startCamera());
    }
    if (this.btnSwitchCamera) {
      this.btnSwitchCamera.addEventListener('click', () => this.switchCamera());
    }

    // Bind WebRTC controls
    if (this.btnCreateAnswer) {
      this.btnCreateAnswer.addEventListener('click', () => this.handleCreateAnswer());
    }
    if (this.btnClearOffer) {
      this.btnClearOffer.addEventListener('click', () => {
        if (this.offerTextarea) this.offerTextarea.value = '';
        this.renderSignalingDiagnostics('none', '');
      });
    }

    if (this.btnCopyAnswer) {
      this.btnCopyAnswer.addEventListener('click', () => {
        const text = this.answerTextarea ? this.answerTextarea.value : '';
        this.copyToClipboard(text, this.btnCopyAnswer, 'Copy Answer');
      });
    }
    if (this.btnClearAnswer) {
      this.btnClearAnswer.addEventListener('click', () => {
        if (this.answerTextarea) this.answerTextarea.value = '';
      });
    }

    if (this.btnResetWebRTC) {
      this.btnResetWebRTC.addEventListener('click', () => this.resetWebRTC());
    }

    // Bind Motion Sensor controls (Phase 6)
    if (this.btnEnableMotion) {
      this.btnEnableMotion.addEventListener('click', () => this.handleEnableMotion());
    }

    this.updateDebugStates();
    console.log('[PhoneApp] Initialized successfully with Phase 6 Camera, Microphone, and Motion sensor support.');
  }

  /**
   * Audits all required DOM element references
   */
  validateDOMBindings() {
    const required = {
      offerTextarea: this.offerTextarea,
      btnCreateAnswer: this.btnCreateAnswer,
      btnClearOffer: this.btnClearOffer,
      answerTextarea: this.answerTextarea,
      btnCopyAnswer: this.btnCopyAnswer,
      btnClearAnswer: this.btnClearAnswer,
      btnResetWebRTC: this.btnResetWebRTC,
      statusElement: this.statusElement,
      statusBadge: this.statusBadge,
      errorBox: this.errorBox,
      messageLog: this.messageLog,
      localVideo: this.localVideo,
      btnStartCamera: this.btnStartCamera,
      micStatusBadge: this.micStatusBadge,
      btnEnableMotion: this.btnEnableMotion,
      motionStatusBadge: this.motionStatusBadge
    };

    let allValid = true;
    for (const [name, el] of Object.entries(required)) {
      if (!el) {
        console.error(`[PhoneApp] Missing DOM element: ${name}`);
        allValid = false;
      }
    }

    if (!allValid) {
      this.handleError(
        'DOM_BINDING_ERROR',
        new Error('Required DOM element missing in phone.html'),
        'CRITICAL: One or more DOM elements were not found. Check console for details.'
      );
    } else {
      console.log('[PhoneApp] All required DOM elements validated successfully.');
    }

    return allValid;
  }

  /**
   * Activates iPhone camera & microphone in a single combined getUserMedia call
   * CRITICAL: localVideo is strictly muted to prevent acoustic feedback.
   */
  async startCamera() {
    this.clearError();
    try {
      if (this.cameraStatus) this.cameraStatus.textContent = 'Requesting camera & microphone access...';
      if (this.btnStartCamera) this.btnStartCamera.disabled = true;

      // Stop existing tracks if any
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
        this.localStream = null;
      }

      // Exact Stage 5 specifications: Camera + Microphone in single request
      const constraints = {
        video: {
          facingMode: {
            ideal: this.currentFacingMode
          },
          width: {
            ideal: 1280
          },
          height: {
            ideal: 720
          },
          frameRate: {
            ideal: 30,
            max: 30
          }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      let stream = null;
      let micAvailable = true;

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (combinedErr) {
        console.warn('[PhoneApp] Combined getUserMedia failed, attempting camera-only fallback:', combinedErr);
        // Fallback: If microphone was denied or unavailable, continue with camera only
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: this.currentFacingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
          micAvailable = false;
        } catch (videoErr) {
          throw videoErr;
        }
      }

      this.localStream = stream;

      // CRITICAL PREVIEW RULE: Muted local preview only, iPhone must NOT play its own microphone!
      if (this.localVideo) {
        this.localVideo.muted = true;
        this.localVideo.srcObject = stream;
        this.localVideo.play().catch(e => console.warn('[PhoneApp] localVideo play caught:', e));
      }

      if (this.cameraPlaceholder) {
        this.cameraPlaceholder.style.display = 'none';
      }

      if (this.cameraStatusBadge) {
        this.cameraStatusBadge.className = 'camera-badge camera-active';
        this.cameraStatusBadge.textContent = 'CAM: ON';
      }

      if (this.micStatusBadge) {
        if (micAvailable && stream.getAudioTracks().length > 0) {
          this.micStatusBadge.className = 'camera-badge camera-active';
          this.micStatusBadge.textContent = 'MIC: ON';
        } else {
          this.micStatusBadge.className = 'camera-badge camera-failed';
          this.micStatusBadge.textContent = 'MIC: OFF';
        }
      }

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack && videoTrack.getSettings ? videoTrack.getSettings() : {};
      const w = settings.width || 1280;
      const h = settings.height || 720;
      const modeText = this.currentFacingMode === 'user' ? 'Front' : 'Back';

      if (this.cameraStatus) {
        if (micAvailable && stream.getAudioTracks().length > 0) {
          this.cameraStatus.textContent = `Camera & Mic Active (${modeText}, ~${w}x${h})`;
        } else {
          this.cameraStatus.textContent = `Microphone unavailable — Camera only mode (${modeText}, ~${w}x${h})`;
        }
      }

      if (this.btnStartCamera) {
        this.btnStartCamera.textContent = 'Camera & Mic Ready';
        this.btnStartCamera.disabled = false;
      }
      if (this.btnSwitchCamera) {
        this.btnSwitchCamera.disabled = false;
      }

      this.logMessage('SYSTEM', `Media active: ${modeText} camera (~${w}x${h}), mic: ${micAvailable ? 'active' : 'unavailable'}.`);
      return stream;
    } catch (err) {
      console.error('[PhoneApp] Failed to start media:', err);
      this.handleError(
        'MEDIA_ACCESS_DENIED',
        err,
        `Media access error: ${err.message || 'Permission denied'}. Please allow camera and microphone access in Safari settings.`
      );
      if (this.cameraStatus) {
        this.cameraStatus.textContent = 'Media access denied or unavailable.';
      }
      if (this.cameraStatusBadge) {
        this.cameraStatusBadge.className = 'camera-badge camera-failed';
        this.cameraStatusBadge.textContent = 'CAM: ERR';
      }
      if (this.micStatusBadge) {
        this.micStatusBadge.className = 'camera-badge camera-failed';
        this.micStatusBadge.textContent = 'MIC: ERR';
      }
      if (this.btnStartCamera) {
        this.btnStartCamera.disabled = false;
        this.btnStartCamera.textContent = 'Retry Camera & Mic';
      }
      return null;
    }
  }

  /**
   * Switches between environment (back) and user (front) camera without disrupting audio
   */
  async switchCamera() {
    this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this.currentFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (newVideoTrack) {
        if (this.localStream) {
          const oldVideoTracks = this.localStream.getVideoTracks();
          oldVideoTracks.forEach(t => {
            this.localStream.removeTrack(t);
            t.stop();
          });
          this.localStream.addTrack(newVideoTrack);
        }

        if (this.pc) {
          const senders = this.pc.getSenders ? this.pc.getSenders() : [];
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
            console.log('[PhoneApp] Replaced video track on RTCRtpSender (audio track unaffected)');
          }
        }

        if (this.localVideo) {
          this.localVideo.muted = true;
          this.localVideo.srcObject = this.localStream;
          this.localVideo.play().catch(e => console.warn('[PhoneApp] localVideo play caught:', e));
        }

        const modeText = this.currentFacingMode === 'user' ? 'Front' : 'Back';
        if (this.cameraStatus) {
          this.cameraStatus.textContent = `Camera Switched (${modeText})`;
        }
        this.logMessage('SYSTEM', `Flipped camera to ${modeText} mode.`);
      }
    } catch (err) {
      console.warn('[PhoneApp] switchCamera error:', err);
    }
  }

  /**
   * Safely detaches all listeners and closes existing peer connection & datachannel
   */
  cleanupPeerConnection() {
    if (this.channel) {
      this.channel.onopen = null;
      this.channel.onclose = null;
      this.channel.onerror = null;
      this.channel.onmessage = null;
      try {
        this.channel.close();
      } catch (_) {}
      this.channel = null;
    }

    // Stop motion sensors if active
    this.stopMotionSensors();

    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.onsignalingstatechange = null;
      this.pc.ondatachannel = null;
      try {
        this.pc.close();
      } catch (_) {}
      this.pc = null;
    }
  }

  /**
   * Resets WebRTC instances, clears payloads, and cleans UI state
   */
  resetWebRTC() {
    console.log('[PhoneApp] Resetting WebRTC state...');
    this.clearError();
    this.cleanupPeerConnection();

    this.sessionId = '-';
    this.currentSessionActive = false;
    this.isCreatingAnswer = false;

    // Stop local media stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.localVideo) {
      this.localVideo.srcObject = null;
    }
    if (this.cameraPlaceholder) {
      this.cameraPlaceholder.style.display = 'flex';
    }
    if (this.cameraStatusBadge) {
      this.cameraStatusBadge.className = 'camera-badge camera-inactive';
      this.cameraStatusBadge.textContent = 'CAM: OFF';
    }
    if (this.micStatusBadge) {
      this.micStatusBadge.className = 'camera-badge camera-inactive';
      this.micStatusBadge.textContent = 'MIC: OFF';
    }
    if (this.cameraStatus) {
      this.cameraStatus.textContent = 'Ready to activate camera & microphone';
    }
    if (this.btnStartCamera) {
      this.btnStartCamera.disabled = false;
      this.btnStartCamera.textContent = 'Start Camera & Mic';
    }
    if (this.btnSwitchCamera) {
      this.btnSwitchCamera.disabled = true;
    }

    // Clear textareas
    if (this.offerTextarea) this.offerTextarea.value = '';
    if (this.answerTextarea) this.answerTextarea.value = '';

    // Reset motion UI state
    this.stopMotionSensors();
    if (this.btnEnableMotion) {
      this.btnEnableMotion.disabled = true;
      this.btnEnableMotion.textContent = 'Enable Motion';
    }
    if (this.motionStatusBadge) {
      this.motionStatusBadge.className = 'motion-badge motion-waiting';
      this.motionStatusBadge.textContent = 'WAITING (DC REQUIRED)';
    }
    if (this.motionHint) {
      this.motionHint.textContent = 'Establish WebRTC connection above first. When DataChannel opens, tap "Enable Motion" to start streaming.';
    }
    if (this.phoneMotionAlpha) this.phoneMotionAlpha.textContent = '0.0°';
    if (this.phoneMotionBeta) this.phoneMotionBeta.textContent = '0.0°';
    if (this.phoneMotionGamma) this.phoneMotionGamma.textContent = '0.0°';
    if (this.phoneMotionAcc) this.phoneMotionAcc.textContent = '0, 0, 0';
    if (this.phoneMotionRate) this.phoneMotionRate.textContent = '0.0 Hz';
    if (this.phoneMotionPackets) this.phoneMotionPackets.textContent = '0';
    this.motionPacketsSent = 0;

    // Clear signaling diagnostics
    this.renderSignalingDiagnostics('none', '');

    // Reset status and buttons
    this.updateStatus('DISCONNECTED');
    if (this.btnCreateAnswer) {
      this.btnCreateAnswer.disabled = false;
      this.btnCreateAnswer.textContent = 'Create Answer';
    }

    this.updateDebugStates();
    this.logMessage('SYSTEM', 'WebRTC state reset. Ready for a fresh connection session.');
  }

  /**
   * Initializes a fresh RTCPeerConnection for iPhone
   */
  initPeerConnection() {
    this.cleanupPeerConnection();

    phoneSessionCounter++;
    this.sessionId = phoneSessionCounter;
    this.currentSessionActive = true;

    // Local USB network - no STUN servers required
    this.pc = new RTCPeerConnection({
      iceServers: []
    });

    // Listen for incoming DataChannel 'sakura' created by MacBook
    this.pc.ondatachannel = (event) => {
      console.log(`[PhoneApp] [Session ${this.sessionId}] ondatachannel received:`, event.channel.label);
      this.channel = event.channel;
      this.setupDataChannel(this.channel);
      this.updateDebugStates();
    };

    // RTCPeerConnection Lifecycle Listeners
    this.pc.onconnectionstatechange = () => {
      this.updateDebugStates();
      const state = this.pc ? this.pc.connectionState : 'closed';
      console.log(`[PhoneApp] [Session ${this.sessionId}] connectionState changed:`, state);
      if (state === 'connected') {
        this.updateStatus('CONNECTED');
      } else if (state === 'connecting') {
        this.updateStatus('CONNECTING');
      } else if (state === 'failed') {
        this.updateStatus('FAILED');
      } else if (state === 'disconnected') {
        this.updateStatus('DISCONNECTED');
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      this.updateDebugStates();
      const iceState = this.pc ? this.pc.iceConnectionState : 'closed';
      console.log(`[PhoneApp] [Session ${this.sessionId}] iceConnectionState changed:`, iceState);
      if (iceState === 'connected' || iceState === 'completed') {
        this.updateStatus('CONNECTED');
      } else if (iceState === 'checking') {
        this.updateStatus('CONNECTING');
      } else if (iceState === 'failed') {
        this.updateStatus('FAILED');
      } else if (iceState === 'disconnected') {
        this.updateStatus('DISCONNECTED');
      }
    };

    this.pc.onicegatheringstatechange = () => {
      this.updateDebugStates();
      console.log(`[PhoneApp] [Session ${this.sessionId}] iceGatheringState changed:`, this.pc ? this.pc.iceGatheringState : 'closed');
    };

    this.pc.onsignalingstatechange = () => {
      this.updateDebugStates();
      console.log(`[PhoneApp] [Session ${this.sessionId}] signalingState changed:`, this.pc ? this.pc.signalingState : 'closed');
    };

    this.updateDebugStates();
  }

  /**
   * Configures event handlers on received RTCDataChannel
   */
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log(`[PhoneApp] [Session ${this.sessionId}] DataChannel opened`);
      this.logMessage('SYSTEM', 'DataChannel "sakura" opened');
      this.updateStatus('CONNECTED');
      this.updateDebugStates();

      // Handshake requirement:
      // iPhone DataChannel open:
      // send: HELLO_FROM_IPHONE
      try {
        channel.send('HELLO_FROM_IPHONE');
        this.logMessage('SENT', 'Sent:\nHELLO_FROM_IPHONE');
      } catch (sendErr) {
        console.error('[PhoneApp] Failed to send HELLO_FROM_IPHONE:', sendErr);
      }

      // Phase 6: Enable Motion button once DataChannel is OPEN
      if (this.btnEnableMotion && !this.motionActive) {
        this.btnEnableMotion.disabled = false;
        this.btnEnableMotion.textContent = 'Enable Motion';
      }
      if (this.motionStatusBadge && !this.motionActive) {
        this.motionStatusBadge.className = 'motion-badge motion-ready';
        this.motionStatusBadge.textContent = 'READY (TAP TO ENABLE)';
      }
      if (this.motionHint && !this.motionActive) {
        this.motionHint.textContent = 'DataChannel connected. Tap "Enable Motion" to start streaming orientation & acceleration.';
      }
    };

    channel.onclose = () => {
      console.log(`[PhoneApp] [Session ${this.sessionId}] DataChannel closed`);
      this.logMessage('SYSTEM', 'DataChannel closed');
      this.stopMotionSensors();
      if (this.btnEnableMotion) {
        this.btnEnableMotion.disabled = true;
        this.btnEnableMotion.textContent = 'Enable Motion';
      }
      if (this.motionStatusBadge) {
        this.motionStatusBadge.className = 'motion-badge motion-waiting';
        this.motionStatusBadge.textContent = 'WAITING (DC REQUIRED)';
      }
      if (this.motionHint) {
        this.motionHint.textContent = 'WebRTC connection disconnected. Re-pair with MacBook to restart streaming.';
      }
      if (this.pc && this.pc.connectionState !== 'connected') {
        this.updateStatus('DISCONNECTED');
      }
      this.updateDebugStates();
    };

    channel.onerror = (err) => {
      console.error(`[PhoneApp] [Session ${this.sessionId}] DataChannel error:`, err);
      this.logMessage('ERROR', `DataChannel error: ${err.message || 'Unknown'}`);
      this.updateDebugStates();
    };

    channel.onmessage = (event) => {
      const data = event.data;
      console.log(`[PhoneApp] [Session ${this.sessionId}] DataChannel onmessage:`, data);

      // Handshake requirement:
      // iPhone receives:
      // Received: HELLO_FROM_MAC
      this.logMessage('RECEIVED', `Received:\n${data}`);
    };
  }

  /**
   * Applies Offer from MacBook, activates Camera track before answer, creates Answer,
   * and outputs pristine JSON payload
   */
  async handleCreateAnswer() {
    this.clearError();

    // Prevent concurrent execution or double-clicks
    if (this.isCreatingAnswer) {
      console.warn('[PhoneApp] Create Answer already in progress. Ignoring duplicate click.');
      return;
    }

    // DOM safety check before start
    if (!this.offerTextarea) {
      throw new Error('DOM_BINDING_ERROR: Offer textarea not found');
    }
    if (!this.answerTextarea) {
      throw new Error('DOM_BINDING_ERROR: Answer textarea not found');
    }

    const raw = this.offerTextarea.value.trim();
    if (!raw) {
      this.handleError('INVALID_PAYLOAD', new Error('Empty payload'), 'Please paste the Offer Signaling JSON from MacBook into Step 1.');
      return;
    }

    // 1. JSON Parse & Validation
    let offer;
    try {
      offer = JSON.parse(raw);
    } catch (err) {
      this.handleError('JSON_PARSE_FAILED', err, 'Failed to parse Offer JSON. Please ensure the full JSON string was copied from MacBook.');
      return;
    }

    if (!offer || offer.type !== 'offer') {
      this.handleError('INVALID_PAYLOAD', new Error('Type is not "offer"'), 'Invalid signaling payload: payload.type must be "offer".');
      return;
    }
    if (typeof offer.sdp !== 'string') {
      this.handleError('INVALID_PAYLOAD', new Error('SDP is not a string'), 'Invalid signaling payload: payload.sdp must be a string.');
      return;
    }
    if (!offer.sdp.startsWith('v=0')) {
      this.handleError('INVALID_PAYLOAD', new Error('SDP does not start with v=0'), 'Invalid signaling payload: payload.sdp must start with "v=0".');
      return;
    }

    // Lock button
    this.isCreatingAnswer = true;
    if (this.btnCreateAnswer) {
      this.btnCreateAnswer.disabled = true;
      this.btnCreateAnswer.textContent = 'Preparing Media & ICE...';
    }

    // Update Signaling Diagnostics for received Offer
    this.renderSignalingDiagnostics(offer.type, offer.sdp);

    try {
      // CRITICAL Phase 5 requirement:
      // Ensure Camera & Microphone stream is active before createAnswer()
      if (!this.localStream || !this.localStream.getVideoTracks().length || this.localStream.getVideoTracks()[0].readyState === 'ended') {
        this.logMessage('SYSTEM', 'Activating camera & microphone before generating Answer...');
        const stream = await this.startCamera();
        if (!stream) {
          throw new Error('Media initialization failed. Please allow camera and microphone access.');
        }
      }

      // 2. Initialize fresh PeerConnection
      this.initPeerConnection();
      this.updateStatus('CONNECTING');
      this.logMessage('SYSTEM', `[Session ${this.sessionId}] Applying Offer from MacBook...`);

      // 3. setRemoteDescription: directly pass offer without modifying SDP!
      try {
        await this.pc.setRemoteDescription(offer);
      } catch (err) {
        this.handleError('SET_REMOTE_DESCRIPTION_FAILED', err, err.message, offer);
        return;
      }
      this.updateDebugStates();

      // 4. Attach iPhone Camera & Microphone Tracks to PeerConnection BEFORE createAnswer!
      const videoTrack = this.localStream.getVideoTracks()[0];
      const audioTrack = this.localStream.getAudioTracks()[0];
      const transceivers = this.pc.getTransceivers ? this.pc.getTransceivers() : [];

      if (videoTrack) {
        const videoTransceiver = transceivers.find(t =>
          (t.receiver && t.receiver.track && t.receiver.track.kind === 'video') ||
          (t.sender && (!t.sender.track || t.sender.track.kind === 'video'))
        );

        if (videoTransceiver && videoTransceiver.sender) {
          await videoTransceiver.sender.replaceTrack(videoTrack);
          videoTransceiver.direction = 'sendonly';
          console.log(`[PhoneApp] Assigned video track to transceiver (direction: sendonly)`);
        } else {
          this.pc.addTrack(videoTrack, this.localStream);
          console.log(`[PhoneApp] Added camera track via pc.addTrack`);
        }
        this.logMessage('SYSTEM', 'Camera video track attached to WebRTC session.');
      }

      if (audioTrack) {
        const audioTransceiver = transceivers.find(t =>
          (t.receiver && t.receiver.track && t.receiver.track.kind === 'audio') ||
          (t.sender && (!t.sender.track || t.sender.track.kind === 'audio'))
        );

        if (audioTransceiver && audioTransceiver.sender) {
          await audioTransceiver.sender.replaceTrack(audioTrack);
          audioTransceiver.direction = 'sendonly';
          console.log(`[PhoneApp] Assigned audio track to transceiver (direction: sendonly)`);
        } else {
          this.pc.addTrack(audioTrack, this.localStream);
          console.log(`[PhoneApp] Added audio track via pc.addTrack`);
        }
        this.logMessage('SYSTEM', 'Microphone audio track attached to WebRTC session.');
      }

      // 5. createAnswer
      let answer;
      try {
        answer = await this.pc.createAnswer();
      } catch (err) {
        this.handleError('CREATE_ANSWER_FAILED', err, err.message);
        return;
      }

      // 6. setLocalDescription
      try {
        await this.pc.setLocalDescription(answer);
      } catch (err) {
        this.handleError('SET_LOCAL_DESCRIPTION_FAILED', err, err.message);
        return;
      }
      this.updateDebugStates();

      // 7. Wait for iceGatheringState === "complete"
      try {
        await this.waitForIceGathering(this.pc);
      } catch (err) {
        this.handleError('ICE_GATHERING_FAILED', err, err.message);
        return;
      }
      this.updateDebugStates();

      // DOM safety check before write
      if (!this.answerTextarea) {
        throw new Error('DOM_BINDING_ERROR: Answer textarea not found');
      }

      // 8. Generate Answer payload directly from browser pc.localDescription without modifying SDP!
      const payload = {
        type: this.pc.localDescription.type,
        sdp: this.pc.localDescription.sdp
      };

      const jsonString = JSON.stringify(payload);
      this.answerTextarea.value = jsonString;

      // Update Signaling Diagnostics for generated Answer
      this.renderSignalingDiagnostics(payload.type, payload.sdp);

      this.logMessage('SYSTEM', `[Session ${this.sessionId}] Answer created with Camera Track & DataChannel. Copy Answer Signaling JSON back to MacBook.`);
    } catch (err) {
      this.handleError('UNKNOWN_ANSWER_ERROR', err, err.message || 'Unexpected error creating answer.');
    } finally {
      if (this.btnCreateAnswer) {
        this.btnCreateAnswer.disabled = false;
        this.btnCreateAnswer.textContent = 'Create Answer';
      }
      this.isCreatingAnswer = false;
    }
  }

  /**
   * Waits for ICE gathering state to complete or times out safely
   */
  waitForIceGathering(pc) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      let timeoutId = null;

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          if (timeoutId) clearTimeout(timeoutId);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);

      // Safe timeout in case of local network interface delays (5000ms max)
      timeoutId = setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        console.warn('[PhoneApp] ICE gathering wait timed out (proceeding with collected candidates).');
        resolve();
      }, 5000);
    });
  }

  /**
   * Copies text to clipboard with button feedback
   */
  async copyToClipboard(text, btnElement, originalText) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (btnElement) {
        btnElement.textContent = 'Copied!';
        setTimeout(() => {
          btnElement.textContent = originalText;
        }, 2000);
      }
    } catch (_) {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (btnElement) {
        btnElement.textContent = 'Copied!';
        setTimeout(() => {
          btnElement.textContent = originalText;
        }, 2000);
      }
    }
  }

  /**
   * Appends formatted message to activity log
   */
  logMessage(type, content) {
    if (!this.messageLog) return;

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type.toLowerCase()}`;

    const time = new Date().toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${time}] [${type}] `;

    const textSpan = document.createElement('span');
    textSpan.className = 'log-text';
    textSpan.textContent = content;

    entry.appendChild(timeSpan);
    entry.appendChild(textSpan);

    this.messageLog.appendChild(entry);
    this.messageLog.scrollTop = this.messageLog.scrollHeight;
  }

  /**
   * Updates Connection Status Badge
   */
  updateStatus(status) {
    if (!this.statusElement || !this.statusBadge) return;

    this.statusElement.textContent = status;
    this.statusBadge.classList.remove('status-disconnected', 'status-connecting', 'status-connected', 'status-failed');

    switch (status) {
      case 'CONNECTED':
        this.statusBadge.classList.add('status-connected');
        break;
      case 'CONNECTING':
        this.statusBadge.classList.add('status-connecting');
        break;
      case 'FAILED':
        this.statusBadge.classList.add('status-failed');
        break;
      case 'DISCONNECTED':
      default:
        this.statusBadge.classList.add('status-disconnected');
        break;
    }
  }

  /**
   * Updates Developer Mode session indicators
   */
  updateDebugStates() {
    if (this.debugSessionId) this.debugSessionId.textContent = this.sessionId;
    if (this.debugSignalState) {
      this.debugSignalState.textContent = this.pc ? this.pc.signalingState : 'closed';
    }
    if (this.debugLocalDesc) {
      this.debugLocalDesc.textContent = this.pc && this.pc.localDescription ? this.pc.localDescription.type : 'none';
    }
    if (this.debugRemoteDesc) {
      this.debugRemoteDesc.textContent = this.pc && this.pc.remoteDescription ? this.pc.remoteDescription.type : 'none';
    }
    if (this.debugDcState) {
      this.debugDcState.textContent = this.channel ? this.channel.readyState : 'none';
    }
    if (this.debugConnState) {
      this.debugConnState.textContent = this.pc ? this.pc.connectionState : 'new';
    }
    if (this.debugIceConnState) {
      this.debugIceConnState.textContent = this.pc ? this.pc.iceConnectionState : 'new';
    }
    if (this.debugIceGatherState) {
      this.debugIceGatherState.textContent = this.pc ? this.pc.iceGatheringState : 'new';
    }
  }

  /**
   * Renders Signaling Diagnostics panel
   */
  renderSignalingDiagnostics(type, sdp) {
    if (!this.sigPayloadType) return;
    this.sigPayloadType.textContent = type;

    if (!sdp) {
      if (this.sigSdpLength) this.sigSdpLength.textContent = '0 chars';
      if (this.sigFirstLine) this.sigFirstLine.textContent = '-';
      if (this.sigLastLine) this.sigLastLine.textContent = '-';
      if (this.sigLineCount) this.sigLineCount.textContent = '0';
      return;
    }

    const lines = sdp.split(/\r?\n/).filter(line => line.length > 0);
    if (this.sigSdpLength) this.sigSdpLength.textContent = `${sdp.length} chars`;
    if (this.sigFirstLine) this.sigFirstLine.textContent = lines[0] || '-';
    if (this.sigLastLine) this.sigLastLine.textContent = lines[lines.length - 1] || '-';
    if (this.sigLineCount) this.sigLineCount.textContent = lines.length;
  }

  /**
   * Clears Error Diagnostics banner
   */
  clearError() {
    if (this.errorBox) {
      this.errorBox.style.display = 'none';
      this.errorBox.textContent = '';
    }
  }

  /**
   * Displays distinct Error Code and diagnostic information
   */
  handleError(code, err, description, payload = null) {
    console.error(`[PhoneApp] [${code}]`, err, {
      description,
      sessionId: this.sessionId,
      signalingState: this.pc ? this.pc.signalingState : 'no-pc',
      payload
    });

    if (this.errorBox) {
      this.errorBox.style.display = 'block';
      this.errorBox.innerHTML = `<strong>[${code}]</strong>: ${description}`;
    }

    this.logMessage('ERROR', `[${code}] ${description}`);
    this.updateStatus('FAILED');
    this.updateDebugStates();
  }

  /**
   * Renders Network Diagnostics (Phase 2 preserved)
   */
  renderDiagnostics(report) {
    if (this.diagBrowser) this.diagBrowser.textContent = report.browser;
    if (this.diagHttps) {
      this.diagHttps.textContent = report.httpsText;
      this.diagHttps.className = `diag-value ${report.isHttps ? 'status-ok' : 'status-warn'}`;
    }
    if (this.diagOnline) {
      this.diagOnline.textContent = report.onlineText;
      this.diagOnline.className = `diag-value ${report.online ? 'status-ok' : 'status-warn'}`;
    }
    if (this.httpsWarning) {
      this.httpsWarning.style.display = report.isHttps ? 'none' : 'block';
    }
  }

  /**
   * =========================================================================
   * Phase 6: Motion Sensor Lifecycle & 30 Hz Telemetry Transmission
   * =========================================================================
   */

  /**
   * Requests device orientation/motion permission (iOS 13+ requirement).
   * Must be executed within a direct user gesture (button click).
   */
  async handleEnableMotion() {
    this.clearError();

    // Check DataChannel state
    if (!this.channel || this.channel.readyState !== 'open') {
      this.handleError(
        'DATACHANNEL_NOT_OPEN',
        new Error('DataChannel not open'),
        'DataChannel "sakura" must be open before enabling motion streaming. Complete pairing first.'
      );
      return;
    }

    if (this.btnEnableMotion) {
      this.btnEnableMotion.disabled = true;
      this.btnEnableMotion.textContent = 'Requesting Permission...';
    }

    try {
      // 1. DeviceOrientation permission (iOS Safari 13+)
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const oriPerm = await DeviceOrientationEvent.requestPermission();
        if (oriPerm !== 'granted') {
          this.handleMotionPermissionDenied('DeviceOrientation permission denied');
          return;
        }
      }

      // 2. DeviceMotion permission (iOS Safari 13+)
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const motPerm = await DeviceMotionEvent.requestPermission();
        if (motPerm !== 'granted') {
          this.handleMotionPermissionDenied('DeviceMotion permission denied');
          return;
        }
      }

      // 3. Start listeners and 30Hz transmission
      this.startMotionSensors();
    } catch (err) {
      console.error('[PhoneApp] Motion permission error:', err);
      this.handleMotionPermissionDenied(err.message || 'Permission request failed');
    }
  }

  /**
   * Handles motion permission denial gracefully
   */
  handleMotionPermissionDenied(reason) {
    if (this.btnEnableMotion) {
      this.btnEnableMotion.disabled = false;
      this.btnEnableMotion.textContent = 'Enable Motion (Retry)';
    }
    if (this.motionStatusBadge) {
      this.motionStatusBadge.className = 'motion-badge motion-denied';
      this.motionStatusBadge.textContent = 'PERMISSION DENIED';
    }
    if (this.motionHint) {
      this.motionHint.textContent = `Motion permission denied (${reason}). In iOS Settings > Safari, ensure Motion & Orientation Access is allowed.`;
    }
    this.logMessage('ERROR', `Motion permission denied: ${reason}`);
  }

  /**
   * Starts deviceorientation and devicemotion listeners and initiates 30Hz transmission loop
   */
  startMotionSensors() {
    if (this.motionActive) return;

    // Clean any residual listeners first
    this.stopMotionSensors();
    this.motionActive = true;

    // Orientation listener
    this.orientationListener = (e) => {
      this.latestOrientation.alpha = e.alpha != null ? e.alpha : 0;
      this.latestOrientation.beta = e.beta != null ? e.beta : 0;
      this.latestOrientation.gamma = e.gamma != null ? e.gamma : 0;
    };
    window.addEventListener('deviceorientation', this.orientationListener, true);

    // Motion listener (safely handles devices with only accelerationIncludingGravity)
    this.motionListener = (e) => {
      const acc = e.acceleration || e.accelerationIncludingGravity || {};
      this.latestMotion.accX = acc.x != null ? acc.x : 0;
      this.latestMotion.accY = acc.y != null ? acc.y : 0;
      this.latestMotion.accZ = acc.z != null ? acc.z : 0;

      const rot = e.rotationRate || {};
      this.latestMotion.rotAlpha = rot.alpha != null ? rot.alpha : 0;
      this.latestMotion.rotBeta = rot.beta != null ? rot.beta : 0;
      this.latestMotion.rotGamma = rot.gamma != null ? rot.gamma : 0;
    };
    window.addEventListener('devicemotion', this.motionListener, true);

    // 30 Hz sampling loop (~33.3ms)
    this.motionInterval = setInterval(() => {
      this.sendMotionPacket();
    }, 33);

    if (this.btnEnableMotion) {
      this.btnEnableMotion.disabled = true;
      this.btnEnableMotion.textContent = 'Streaming Motion (30 Hz)';
    }
    if (this.motionStatusBadge) {
      this.motionStatusBadge.className = 'motion-badge motion-active';
      this.motionStatusBadge.textContent = 'STREAMING (30 Hz)';
    }
    if (this.motionHint) {
      this.motionHint.textContent = 'Streaming 30 Hz real-time orientation & acceleration over DataChannel "sakura".';
    }

    this.logMessage('SYSTEM', 'Motion sensors activated. 30 Hz streaming active.');
  }

  /**
   * Transmits a single 30Hz motion packet over DataChannel "sakura"
   */
  sendMotionPacket() {
    if (!this.motionActive) return;

    if (!this.channel || this.channel.readyState !== 'open') {
      return;
    }

    // Guard against DataChannel buffer congestion
    if (this.channel.bufferedAmount > 65536) {
      return;
    }

    const payload = {
      type: 'motion',
      timestamp: Date.now(),
      orientation: {
        alpha: Number(this.latestOrientation.alpha.toFixed(2)),
        beta: Number(this.latestOrientation.beta.toFixed(2)),
        gamma: Number(this.latestOrientation.gamma.toFixed(2))
      },
      acceleration: {
        x: Number(this.latestMotion.accX.toFixed(3)),
        y: Number(this.latestMotion.accY.toFixed(3)),
        z: Number(this.latestMotion.accZ.toFixed(3))
      },
      rotationRate: {
        alpha: Number(this.latestMotion.rotAlpha.toFixed(2)),
        beta: Number(this.latestMotion.rotBeta.toFixed(2)),
        gamma: Number(this.latestMotion.rotGamma.toFixed(2))
      }
    };

    try {
      this.channel.send(JSON.stringify(payload));
      this.motionPacketsSent++;

      // Update rate calculation (sliding 1-second window)
      const now = performance.now();
      this.motionSentTimestamps.push(now);
      const oneSecAgo = now - 1000;
      while (this.motionSentTimestamps.length > 0 && this.motionSentTimestamps[0] < oneSecAgo) {
        this.motionSentTimestamps.shift();
      }
      const hz = this.motionSentTimestamps.length;

      // Update UI telemetry readouts
      if (this.phoneMotionAlpha) this.phoneMotionAlpha.textContent = `${payload.orientation.alpha.toFixed(1)}°`;
      if (this.phoneMotionBeta) this.phoneMotionBeta.textContent = `${payload.orientation.beta.toFixed(1)}°`;
      if (this.phoneMotionGamma) this.phoneMotionGamma.textContent = `${payload.orientation.gamma.toFixed(1)}°`;
      if (this.phoneMotionAcc) this.phoneMotionAcc.textContent = `${payload.acceleration.x.toFixed(1)}, ${payload.acceleration.y.toFixed(1)}, ${payload.acceleration.z.toFixed(1)}`;
      if (this.phoneMotionRate) this.phoneMotionRate.textContent = `${hz.toFixed(1)} Hz`;
      if (this.phoneMotionPackets) this.phoneMotionPackets.textContent = this.motionPacketsSent;
    } catch (err) {
      console.warn('[PhoneApp] Error sending motion packet:', err);
    }
  }

  /**
   * Cleanly stops motion sensors, clears interval, and detaches listeners
   */
  stopMotionSensors() {
    this.motionActive = false;

    if (this.motionInterval) {
      clearInterval(this.motionInterval);
      this.motionInterval = null;
    }

    if (this.orientationListener) {
      window.removeEventListener('deviceorientation', this.orientationListener, true);
      this.orientationListener = null;
    }

    if (this.motionListener) {
      window.removeEventListener('devicemotion', this.motionListener, true);
      this.motionListener = null;
    }

    this.motionSentTimestamps = [];
    if (this.phoneMotionRate) this.phoneMotionRate.textContent = '0.0 Hz';
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.phoneApp = new PhoneApp();
});
