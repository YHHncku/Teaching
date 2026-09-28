/**
 * Sakura Breeze AR - MacBook Main Screen
 * class MacApp
 * Stage 4: iPhone Camera Video Stream + Native WebRTC RTCDataChannel
 * (MacBook Chrome <-> iPhone Safari)
 * Lifecycle-Hardened Implementation
 */

let macSessionCounter = 0;

class MacApp {
  constructor() {
    this.initialized = false;
    this.sessionId = '-';
    this.currentSessionActive = false;
    this.isConnecting = false;

    // 1. Status elements
    this.statusBadge = document.getElementById('status-badge');
    this.statusElement = document.getElementById('connection-status');
    this.arStatusElement = document.getElementById('ar-status');
    this.httpsWarning = document.getElementById('https-warning');
    this.dcStateBadge = document.getElementById('dc-state-badge');
    this.errorBox = document.getElementById('error-diagnostics');

    // 2. Video elements (Phase 4)
    this.remoteVideo = document.getElementById('remote-video');
    this.videoStreamBadge = document.getElementById('video-stream-badge');
    this.videoStatus = document.getElementById('video-status');
    this.videoPlaceholder = document.getElementById('video-placeholder');
    this.videoRes = document.getElementById('video-res');
    this.videoTrackState = document.getElementById('video-track-state');
    this.videoTrackKind = document.getElementById('video-track-kind');

    // 2.1 Microphone & Audio Analysis elements (Phase 5)
    this.micStatusBadge = document.getElementById('mic-status-badge');
    this.micStatusText = document.getElementById('mic-status-text');
    this.btnEnableAudio = document.getElementById('btn-enable-audio');
    this.audioRawRms = document.getElementById('audio-raw-rms');
    this.audioSmoothed = document.getElementById('audio-smoothed');
    this.audioWindStrength = document.getElementById('audio-wind-strength');
    this.audioNoiseFloor = document.getElementById('audio-noise-floor');
    this.windMeterBar = document.getElementById('wind-meter-bar');
    this.windMeterValue = document.getElementById('wind-meter-value');

    // 2.2 Motion Sensor elements (Phase 6)
    this.motionStatusBadge = document.getElementById('motion-status-badge');
    this.motionStatusText = document.getElementById('motion-status-text');
    this.horizonBubble = document.getElementById('horizon-bubble');
    this.motionBubbleRoll = document.getElementById('motion-bubble-roll');
    this.motionBubblePitch = document.getElementById('motion-bubble-pitch');
    this.motionTiltBar = document.getElementById('motion-tilt-bar');
    this.motionTiltVal = document.getElementById('motion-tilt-val');
    this.motionShakeBar = document.getElementById('motion-shake-bar');
    this.motionShakeVal = document.getElementById('motion-shake-val');
    this.motionRate = document.getElementById('motion-rate');
    this.motionPackets = document.getElementById('motion-packets');
    this.motionRoll = document.getElementById('motion-roll');
    this.motionPitch = document.getElementById('motion-pitch');
    this.motionYaw = document.getElementById('motion-yaw');
    this.motionNormPitch = document.getElementById('motion-norm-pitch');
    this.motionNormRoll = document.getElementById('motion-norm-roll');
    this.motionAccelXyz = document.getElementById('motion-accel-xyz');

    // 3. Diagnostics elements (Phase 2 preserved)
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
    this.btnCreateOffer = document.getElementById('btn-create-offer');
    this.btnCopyOffer = document.getElementById('btn-copy-offer');
    this.btnClearOffer = document.getElementById('btn-clear-offer');

    // 6. WebRTC Answer elements (Unified ID: answer-sdp)
    this.answerTextarea = document.getElementById('answer-sdp');
    this.btnConnect = document.getElementById('btn-connect');
    this.btnClearAnswer = document.getElementById('btn-clear-answer');

    // 7. Reset button
    this.btnResetWebRTC = document.getElementById('btn-reset-webrtc');

    // 8. DataChannel test & message log
    this.messageLog = document.getElementById('datachannel-log');
    this.customMsgInput = document.getElementById('custom-msg-input');
    this.btnSendMsg = document.getElementById('btn-send-msg');

    // 9. Developer mode / Session Debug indicators
    this.debugSessionId = document.getElementById('debug-session-id');
    this.debugSignalState = document.getElementById('debug-signal-state');
    this.debugLocalDesc = document.getElementById('debug-local-desc');
    this.debugRemoteDesc = document.getElementById('debug-remote-desc');
    this.debugDcState = document.getElementById('debug-dc-state');
    this.debugConnState = document.getElementById('debug-conn-state');
    this.debugIceConnState = document.getElementById('debug-ice-conn-state');
    this.debugIceGatherState = document.getElementById('debug-ice-gather-state');
    this.debugMicState = document.getElementById('debug-mic-state');
    this.debugMicRms = document.getElementById('debug-mic-rms');
    this.debugMicSmoothed = document.getElementById('debug-mic-smoothed');
    this.debugMicWind = document.getElementById('debug-mic-wind');
    this.debugMotionState = document.getElementById('debug-motion-state');
    this.debugMotionHz = document.getElementById('debug-motion-hz');
    this.debugMotionRoll = document.getElementById('debug-motion-roll');
    this.debugMotionPitch = document.getElementById('debug-motion-pitch');

    // 10. WebRTC & Audio & Motion instances
    this.pc = null;
    this.channel = null;
    this.diagnostics = null;
    this.arRenderer = null;
    this.audioManager = null;
    this.motionManager = null;
    this.remoteVideoStream = null;
    this.remoteAudioStream = null;
    this.videoTransceiver = null;
    this.audioTransceiver = null;

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
    this.resetRemoteVideoUI();

    // Initialize AudioManager (Stage 5)
    if (typeof AudioManager !== 'undefined') {
      this.audioManager = new AudioManager({
        onUpdate: (data) => this.renderAudioMetrics(data),
        onStatusChange: (status) => this.renderAudioStatus(status)
      });
      console.log('[MacApp] AudioManager initialized.');
    } else {
      console.warn('[MacApp] AudioManager not loaded.');
    }

    if (this.btnEnableAudio) {
      this.btnEnableAudio.addEventListener('click', async () => {
        if (this.audioManager) {
          await this.audioManager.resume();
        }
      });
    }

    // Initialize MotionManager (Phase 6)
    if (typeof MotionManager !== 'undefined') {
      this.motionManager = new MotionManager({
        onMotionUpdate: (data) => this.renderMotionMetrics(data),
        onStatusChange: (status) => this.renderMotionStatus(status)
      });
      console.log('[MacApp] MotionManager initialized.');
    } else {
      console.warn('[MacApp] MotionManager not loaded.');
    }

    // Initialize AR Renderer (Phase 1 stub preserved)
    if (typeof ARRenderer !== 'undefined') {
      try {
        this.arRenderer = new ARRenderer();
        if (this.arStatusElement && typeof this.arRenderer.getStatus === 'function') {
          this.arStatusElement.textContent = this.arRenderer.getStatus();
        }
      } catch (err) {
        console.warn('[MacApp] ARRenderer init safe fallback:', err);
      }
    }

    // Initialize Network Diagnostics (Phase 2 preserved)
    if (typeof NetworkDiagnostics !== 'undefined') {
      this.diagnostics = new NetworkDiagnostics({
        onStatusChange: (report) => this.renderDiagnostics(report)
      });
      this.renderDiagnostics(this.diagnostics.getReport());
    }

    // Bind all Event Listeners exactly once
    if (this.btnCreateOffer) {
      this.btnCreateOffer.addEventListener('click', () => this.handleCreateOffer());
    }
    if (this.btnCopyOffer) {
      this.btnCopyOffer.addEventListener('click', () => {
        const text = this.offerTextarea ? this.offerTextarea.value : '';
        this.copyToClipboard(text, this.btnCopyOffer, 'Copy Offer');
      });
    }
    if (this.btnClearOffer) {
      this.btnClearOffer.addEventListener('click', () => {
        if (this.offerTextarea) this.offerTextarea.value = '';
        this.renderSignalingDiagnostics('none', '');
      });
    }

    if (this.btnConnect) {
      this.btnConnect.addEventListener('click', () => this.handleConnect());
    }
    if (this.btnClearAnswer) {
      this.btnClearAnswer.addEventListener('click', () => {
        if (this.answerTextarea) this.answerTextarea.value = '';
      });
    }

    if (this.btnResetWebRTC) {
      this.btnResetWebRTC.addEventListener('click', () => this.resetWebRTC());
    }

    if (this.btnSendMsg) {
      this.btnSendMsg.addEventListener('click', () => this.sendCustomMessage());
    }
    if (this.customMsgInput) {
      this.customMsgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.sendCustomMessage();
        }
      });
    }

    this.updateDebugStates();
    console.log('[MacApp] Initialized successfully with Phase 4 WebRTC Camera Video and DataChannel.');
  }

  /**
   * Audits all required DOM element references
   */
  validateDOMBindings() {
    const required = {
      offerTextarea: this.offerTextarea,
      btnCreateOffer: this.btnCreateOffer,
      btnCopyOffer: this.btnCopyOffer,
      btnClearOffer: this.btnClearOffer,
      answerTextarea: this.answerTextarea,
      btnConnect: this.btnConnect,
      btnClearAnswer: this.btnClearAnswer,
      btnResetWebRTC: this.btnResetWebRTC,
      statusElement: this.statusElement,
      statusBadge: this.statusBadge,
      errorBox: this.errorBox,
      messageLog: this.messageLog,
      remoteVideo: this.remoteVideo,
      // Phase 5 Audio Elements
      micStatusBadge: this.micStatusBadge,
      micStatusText: this.micStatusText,
      btnEnableAudio: this.btnEnableAudio,
      audioRawRms: this.audioRawRms,
      audioSmoothed: this.audioSmoothed,
      audioWindStrength: this.audioWindStrength,
      audioNoiseFloor: this.audioNoiseFloor,
      windMeterBar: this.windMeterBar,
      windMeterValue: this.windMeterValue,
      debugMicState: this.debugMicState,
      debugMicRms: this.debugMicRms,
      debugMicSmoothed: this.debugMicSmoothed,
      debugMicWind: this.debugMicWind,
      // Phase 6 Motion Elements
      motionStatusBadge: this.motionStatusBadge,
      motionStatusText: this.motionStatusText,
      horizonBubble: this.horizonBubble,
      motionBubbleRoll: this.motionBubbleRoll,
      motionBubblePitch: this.motionBubblePitch,
      motionTiltBar: this.motionTiltBar,
      motionTiltVal: this.motionTiltVal,
      motionShakeBar: this.motionShakeBar,
      motionShakeVal: this.motionShakeVal,
      motionRate: this.motionRate,
      motionPackets: this.motionPackets,
      motionRoll: this.motionRoll,
      motionPitch: this.motionPitch,
      motionYaw: this.motionYaw,
      motionNormPitch: this.motionNormPitch,
      motionNormRoll: this.motionNormRoll,
      motionAccelXyz: this.motionAccelXyz,
      debugMotionState: this.debugMotionState,
      debugMotionHz: this.debugMotionHz,
      debugMotionRoll: this.debugMotionRoll,
      debugMotionPitch: this.debugMotionPitch
    };

    let allValid = true;
    for (const [name, el] of Object.entries(required)) {
      if (!el) {
        console.error(`[MacApp] Missing DOM element: ${name}`);
        allValid = false;
      }
    }

    if (!allValid) {
      this.handleError(
        'DOM_BINDING_ERROR',
        new Error('Required DOM element missing in index.html'),
        'CRITICAL: One or more DOM elements were not found. Check console for details.'
      );
    } else {
      console.log('[MacApp] All required DOM elements validated successfully.');
    }

    return allValid;
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

    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.onsignalingstatechange = null;
      this.pc.ondatachannel = null;
      this.pc.ontrack = null;
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
    console.log('[MacApp] Resetting WebRTC state...');
    this.clearError();
    this.cleanupPeerConnection();

    this.sessionId = '-';
    this.currentSessionActive = false;
    this.isConnecting = false;

    // Reset video UI & streams
    if (this.remoteVideoStream) {
      try {
        this.remoteVideoStream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      this.remoteVideoStream = null;
    }
    this.resetRemoteVideoUI();

    // Reset audio analysis & stream
    if (this.remoteAudioStream) {
      try {
        this.remoteAudioStream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      this.remoteAudioStream = null;
    }
    if (this.audioManager) {
      this.audioManager.reset();
    }
    this.renderAudioMetrics({
      rawRMS: 0,
      smoothedVolume: 0,
      windStrength: 0,
      noiseFloor: 0.01,
      status: 'WAITING'
    });
    this.renderAudioStatus('WAITING');

    // Reset motion manager (Phase 6)
    if (this.motionManager) {
      this.motionManager.reset();
    }
    this.renderMotionStatus('WAITING');

    // Clear textareas
    if (this.offerTextarea) this.offerTextarea.value = '';
    if (this.answerTextarea) this.answerTextarea.value = '';

    // Clear signaling diagnostics
    this.renderSignalingDiagnostics('none', '');

    // Reset status and buttons
    this.updateStatus('DISCONNECTED');
    if (this.btnConnect) {
      this.btnConnect.disabled = false;
      this.btnConnect.textContent = 'Connect';
    }
    if (this.btnCreateOffer) {
      this.btnCreateOffer.disabled = false;
      this.btnCreateOffer.textContent = 'Create Offer';
    }
    if (this.dcStateBadge) this.dcStateBadge.textContent = 'channel: sakura';
    if (this.customMsgInput) this.customMsgInput.disabled = true;
    if (this.btnSendMsg) this.btnSendMsg.disabled = true;

    this.updateDebugStates();
    this.logMessage('SYSTEM', 'WebRTC state reset. Ready for a fresh connection session.');
  }

  /**
   * Resets remote video presentation elements
   */
  resetRemoteVideoUI() {
    if (this.remoteVideo) {
      this.remoteVideo.srcObject = null;
    }
    if (this.videoPlaceholder) {
      this.videoPlaceholder.style.display = 'flex';
    }
    if (this.videoStreamBadge) {
      this.videoStreamBadge.className = 'stream-badge stream-waiting';
      this.videoStreamBadge.textContent = 'AWAITING STREAM';
    }
    if (this.videoStatus) {
      this.videoStatus.textContent = 'Connect iPhone with Step 1 & 2 below to receive camera feed';
    }
    if (this.videoRes) this.videoRes.textContent = '-';
    if (this.videoTrackState) this.videoTrackState.textContent = 'Waiting';
    if (this.videoTrackKind) this.videoTrackKind.textContent = 'video';
  }

  /**
   * Initializes a fresh RTCPeerConnection and RTCDataChannel for an Offer session
   */
  initPeerConnection() {
    this.cleanupPeerConnection();

    macSessionCounter++;
    this.sessionId = macSessionCounter;
    this.currentSessionActive = true;

    // Local USB network - no STUN servers required
    this.pc = new RTCPeerConnection({
      iceServers: []
    });

    // Create DataChannel 'sakura'
    this.channel = this.pc.createDataChannel('sakura');
    this.setupDataChannel(this.channel);

    // CRITICAL for Stage 5:
    // Add recvonly video and audio transceivers so MacBook Offer advertises both receiving capabilities
    if (this.pc.addTransceiver) {
      try {
        this.videoTransceiver = this.pc.addTransceiver('video', { direction: 'recvonly' });
        this.audioTransceiver = this.pc.addTransceiver('audio', { direction: 'recvonly' });
        console.log(`[MacApp] [Session ${this.sessionId}] Added recvonly video and audio transceivers.`);
      } catch (err) {
        console.warn('[MacApp] addTransceiver warning:', err);
      }
    }

    // Listen for remote tracks (Differentiate video and audio)
    this.pc.ontrack = (event) => {
      console.log(`[MacApp] [Session ${this.sessionId}] ontrack received: ${event.track.kind}`);
      if (event.track.kind === 'video') {
        this.handleRemoteVideoTrack(event);
      } else if (event.track.kind === 'audio') {
        this.handleRemoteAudioTrack(event);
      }
    };

    // RTCPeerConnection Lifecycle Listeners
    this.pc.onconnectionstatechange = () => {
      this.updateDebugStates();
      const state = this.pc ? this.pc.connectionState : 'closed';
      console.log(`[MacApp] [Session ${this.sessionId}] connectionState changed:`, state);
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
      console.log(`[MacApp] [Session ${this.sessionId}] iceConnectionState changed:`, iceState);
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
      console.log(`[MacApp] [Session ${this.sessionId}] iceGatheringState changed:`, this.pc ? this.pc.iceGatheringState : 'closed');
    };

    this.pc.onsignalingstatechange = () => {
      this.updateDebugStates();
      console.log(`[MacApp] [Session ${this.sessionId}] signalingState changed:`, this.pc ? this.pc.signalingState : 'closed');
    };

    this.updateDebugStates();
  }

  /**
   * Handles incoming remote video track from iPhone camera
   */
  handleRemoteVideoTrack(event) {
    if (!this.remoteVideo) return;
    const track = event.track;
    console.log(`[MacApp] [Session ${this.sessionId}] Processing remote video track...`);

    // Strictly separate video track: do NOT mix with audio track
    this.remoteVideoStream = new MediaStream([track]);
    this.remoteVideo.muted = true;
    this.remoteVideo.srcObject = this.remoteVideoStream;

    const onPlayReady = () => {
      if (this.videoPlaceholder) this.videoPlaceholder.style.display = 'none';
      if (this.videoStreamBadge) {
        this.videoStreamBadge.className = 'stream-badge stream-active';
        this.videoStreamBadge.textContent = 'STREAMING LIVE';
      }
      const width = this.remoteVideo.videoWidth || 0;
      const height = this.remoteVideo.videoHeight || 0;
      if (this.videoRes && width > 0) {
        this.videoRes.textContent = `${width}x${height}`;
      }
      if (this.videoTrackState) {
        this.videoTrackState.textContent = 'Active (Live)';
      }
      if (this.videoTrackKind) {
        this.videoTrackKind.textContent = track.kind;
      }
      if (this.videoStatus) {
        this.videoStatus.textContent = `iPhone Camera Live (${width}x${height})`;
      }
    };

    this.remoteVideo.onloadedmetadata = onPlayReady;
    this.remoteVideo.onplaying = onPlayReady;

    track.onunmute = () => {
      console.log(`[MacApp] Video track unmuted`);
      this.remoteVideo.play().catch(err => console.warn('[MacApp] remoteVideo.play() caught:', err));
      onPlayReady();
    };

    track.onended = () => {
      console.log(`[MacApp] Video track ended`);
      this.resetRemoteVideoUI();
    };

    this.remoteVideo.play().catch(err => {
      console.warn('[MacApp] Initial remoteVideo.play() error:', err);
    });

    this.logMessage('SYSTEM', `Remote camera track attached (${track.kind}). Streaming live.`);
  }

  /**
   * Handles incoming remote audio track from iPhone microphone
   * CRITICAL: Do NOT play to speakers or attach to <audio>/<video> elements!
   * Purely routed to AudioManager for real-time RMS wind analysis.
   */
  handleRemoteAudioTrack(event) {
    const track = event.track;
    console.log(`[MacApp] [Session ${this.sessionId}] Processing remote audio track (ANALYSIS ONLY)...`);

    // Dedicated audio stream for analysis only
    this.remoteAudioStream = new MediaStream([track]);

    if (this.audioManager) {
      this.audioManager.attachStream(this.remoteAudioStream);
    }

    track.onunmute = () => {
      console.log('[MacApp] Remote audio track unmuted.');
      if (this.audioManager) {
        this.audioManager.attachStream(this.remoteAudioStream);
      }
    };

    track.onended = () => {
      console.log('[MacApp] Remote audio track ended.');
      if (this.audioManager) {
        this.audioManager.reset();
      }
    };

    this.logMessage('SYSTEM', 'Remote microphone track received. Real-time wind analysis active.');
  }

  /**
   * Renders real-time audio metrics from AudioManager
   */
  renderAudioMetrics(data) {
    if (this.audioRawRms) this.audioRawRms.textContent = data.rawRMS.toFixed(3);
    if (this.audioSmoothed) this.audioSmoothed.textContent = data.smoothedVolume.toFixed(2);
    if (this.audioWindStrength) this.audioWindStrength.textContent = data.windStrength.toFixed(2);
    if (this.audioNoiseFloor) this.audioNoiseFloor.textContent = data.noiseFloor.toFixed(3);

    if (this.windMeterBar) {
      const pct = Math.min(100, Math.max(0, data.windStrength * 100));
      this.windMeterBar.style.width = `${pct.toFixed(1)}%`;
    }
    if (this.windMeterValue) {
      this.windMeterValue.textContent = data.windStrength.toFixed(2);
    }

    // Developer mode indicators
    if (this.debugMicState) this.debugMicState.textContent = data.status;
    if (this.debugMicRms) this.debugMicRms.textContent = data.rawRMS.toFixed(3);
    if (this.debugMicSmoothed) this.debugMicSmoothed.textContent = data.smoothedVolume.toFixed(2);
    if (this.debugMicWind) this.debugMicWind.textContent = data.windStrength.toFixed(2);
  }

  /**
   * Renders audio status badge and user guidance
   */
  renderAudioStatus(status) {
    if (this.micStatusBadge) {
      this.micStatusBadge.textContent = status;
      this.micStatusBadge.className = `mic-badge mic-${status.toLowerCase()}`;
    }

    if (this.micStatusText) {
      switch (status) {
        case 'ANALYZING':
          this.micStatusText.textContent = 'Acoustic stream active — Real-time wind analysis running.';
          break;
        case 'SUSPENDED':
          this.micStatusText.textContent = 'AudioContext suspended by browser. Click "Enable Audio Analysis" to resume.';
          break;
        case 'RECEIVING':
          this.micStatusText.textContent = 'Microphone track received. Initializing analyser pipeline...';
          break;
        case 'UNAVAILABLE':
          this.micStatusText.textContent = 'Microphone unavailable or denied on iPhone (Camera-only mode).';
          break;
        case 'WAITING':
        default:
          this.micStatusText.textContent = 'Awaiting audio stream from iPhone';
          break;
      }
    }

    if (this.btnEnableAudio) {
      this.btnEnableAudio.style.display = (status === 'SUSPENDED') ? 'inline-block' : 'none';
    }

    if (this.debugMicState) {
      this.debugMicState.textContent = status;
    }
  }

  /**
   * =========================================================================
   * Phase 6: Motion Sensor Telemetry Rendering & Horizon Bubble Physics
   * =========================================================================
   */

  /**
   * Renders real-time motion metrics from MotionManager
   */
  renderMotionMetrics(data) {
    if (!data) return;

    // 1. Attitude bubble position in 2D horizon gauge
    // Roll (-90 to +90) -> X translation (-38px to +38px)
    // Pitch (-90 to +90) -> Y translation (-38px to +38px)
    if (this.horizonBubble) {
      const rollDeg = data.smoothed.gamma || 0;
      const pitchDeg = data.smoothed.beta || 0;
      const x = Math.max(-38, Math.min(38, (rollDeg / 90) * 38));
      const y = Math.max(-38, Math.min(38, (pitchDeg / 90) * 38));
      this.horizonBubble.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }

    if (this.motionBubbleRoll) this.motionBubbleRoll.textContent = `${(data.smoothed.gamma || 0).toFixed(1)}°`;
    if (this.motionBubblePitch) this.motionBubblePitch.textContent = `${(data.smoothed.beta || 0).toFixed(1)}°`;

    // 2. Bars for Tilt Angle and Dynamic Shake
    if (this.motionTiltBar) {
      const tiltPct = Math.min(100, Math.max(0, (data.normalized.tiltMagnitude || 0) * 100));
      this.motionTiltBar.style.width = `${tiltPct.toFixed(1)}%`;
    }
    if (this.motionTiltVal) {
      this.motionTiltVal.textContent = (data.normalized.tiltMagnitude || 0).toFixed(2);
    }

    if (this.motionShakeBar) {
      const shakePct = Math.min(100, Math.max(0, (data.normalized.shakeIntensity || 0) * 100));
      this.motionShakeBar.style.width = `${shakePct.toFixed(1)}%`;
    }
    if (this.motionShakeVal) {
      this.motionShakeVal.textContent = (data.normalized.shakeIntensity || 0).toFixed(2);
    }

    // 3. Frequency & packets
    if (this.motionRate) this.motionRate.textContent = `${(data.hz || 0).toFixed(1)} Hz`;
    if (this.motionPackets) this.motionPackets.textContent = data.packetCount || 0;

    // 4. Detailed telemetry readouts
    if (this.motionRoll) this.motionRoll.textContent = `${(data.smoothed.gamma || 0).toFixed(1)}°`;
    if (this.motionPitch) this.motionPitch.textContent = `${(data.smoothed.beta || 0).toFixed(1)}°`;
    if (this.motionYaw) this.motionYaw.textContent = `${(data.smoothed.alpha || 0).toFixed(1)}°`;
    if (this.motionNormPitch) this.motionNormPitch.textContent = (data.normalized.pitch || 0).toFixed(2);
    if (this.motionNormRoll) this.motionNormRoll.textContent = (data.normalized.roll || 0).toFixed(2);

    if (this.motionAccelXyz) {
      const ax = (data.raw.accX || 0).toFixed(1);
      const ay = (data.raw.accY || 0).toFixed(1);
      const az = (data.raw.accZ || 0).toFixed(1);
      this.motionAccelXyz.textContent = `${ax}, ${ay}, ${az}`;
    }

    // 5. Developer diagnostics grid
    if (this.debugMotionState) this.debugMotionState.textContent = data.status || 'WAITING';
    if (this.debugMotionHz) this.debugMotionHz.textContent = `${(data.hz || 0).toFixed(1)} Hz`;
    if (this.debugMotionRoll) this.debugMotionRoll.textContent = `${(data.smoothed.gamma || 0).toFixed(1)}°`;
    if (this.debugMotionPitch) this.debugMotionPitch.textContent = `${(data.smoothed.beta || 0).toFixed(1)}°`;
  }

  /**
   * Renders motion status badge and guidance
   */
  renderMotionStatus(status) {
    if (this.motionStatusBadge) {
      this.motionStatusBadge.textContent = status;
      this.motionStatusBadge.className = `motion-badge motion-${status.toLowerCase()}`;
    }

    if (this.motionStatusText) {
      switch (status) {
        case 'STREAMING':
          this.motionStatusText.textContent = 'Active 30 Hz orientation and acceleration telemetry stream connected.';
          break;
        case 'STALE':
          this.motionStatusText.textContent = 'Motion telemetry paused or waiting for iPhone sensor activity.';
          break;
        case 'DISCONNECTED':
          this.motionStatusText.textContent = 'DataChannel closed. Motion telemetry inactive.';
          break;
        case 'WAITING':
        default:
          this.motionStatusText.textContent = 'Awaiting 30 Hz motion telemetry stream from iPhone (Click "Enable Motion" on iPhone).';
          break;
      }
    }

    if (this.debugMotionState) {
      this.debugMotionState.textContent = status;
    }
  }

  /**
   * Configures event handlers on RTCDataChannel
   */
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log(`[MacApp] [Session ${this.sessionId}] DataChannel "sakura" opened`);
      this.logMessage('SYSTEM', 'DataChannel "sakura" opened successfully');
      this.updateStatus('CONNECTED');
      if (this.dcStateBadge) this.dcStateBadge.textContent = 'channel: sakura (OPEN)';
      if (this.customMsgInput) this.customMsgInput.disabled = false;
      if (this.btnSendMsg) this.btnSendMsg.disabled = false;
      this.updateDebugStates();
    };

    channel.onclose = () => {
      console.log(`[MacApp] [Session ${this.sessionId}] DataChannel "sakura" closed`);
      this.logMessage('SYSTEM', 'DataChannel "sakura" closed');
      if (this.motionManager) {
        this.motionManager.updateStatus('DISCONNECTED');
      }
      if (this.dcStateBadge) this.dcStateBadge.textContent = 'channel: sakura (CLOSED)';
      if (this.customMsgInput) this.customMsgInput.disabled = true;
      if (this.btnSendMsg) this.btnSendMsg.disabled = true;
      if (this.pc && this.pc.connectionState !== 'connected') {
        this.updateStatus('DISCONNECTED');
      }
      this.updateDebugStates();
    };

    channel.onerror = (err) => {
      console.error(`[MacApp] [Session ${this.sessionId}] DataChannel error:`, err);
      this.logMessage('ERROR', `DataChannel error: ${err.message || 'Unknown error'}`);
      this.updateDebugStates();
    };

    channel.onmessage = (event) => {
      const data = event.data;

      // Phase 6: Intercept high-frequency motion packets (30 Hz)
      // Route directly to MotionManager without spamming chat message log
      if (typeof data === 'string' && data.startsWith('{"type":"motion"')) {
        if (this.motionManager) {
          this.motionManager.handleMessage(data);
        }
        return;
      }

      console.log(`[MacApp] [Session ${this.sessionId}] DataChannel onmessage:`, data);

      // Display Received message
      this.logMessage('RECEIVED', `Received:\n${data}`);

      // Handshake requirement:
      // When MacBook receives: HELLO_FROM_IPHONE
      // MacBook replies: HELLO_FROM_MAC
      if (data === 'HELLO_FROM_IPHONE') {
        try {
          channel.send('HELLO_FROM_MAC');
          this.logMessage('SENT', 'Sent:\nHELLO_FROM_MAC');
        } catch (sendErr) {
          console.error('[MacApp] Failed to send HELLO_FROM_MAC:', sendErr);
        }
      }
    };
  }

  /**
   * Generates Offer, waits for ICE gathering to complete, preserves this.pc instance
   */
  async handleCreateOffer() {
    this.clearError();

    // DOM safety check before start
    if (!this.offerTextarea) {
      throw new Error('DOM_BINDING_ERROR: Offer textarea not found');
    }

    try {
      // Create a fresh peer connection session
      this.initPeerConnection();
      this.updateStatus('CONNECTING');

      if (this.btnCreateOffer) {
        this.btnCreateOffer.disabled = true;
        this.btnCreateOffer.textContent = 'Gathering ICE...';
      }
      if (this.btnConnect) {
        this.btnConnect.disabled = false;
        this.btnConnect.textContent = 'Connect';
      }

      this.logMessage('SYSTEM', `[Session ${this.sessionId}] Creating Offer with Video, Audio & DataChannel capabilities...`);

      let offer;
      try {
        offer = await this.pc.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: true
        });
      } catch (err) {
        this.handleError('CREATE_OFFER_FAILED', err, 'Failed to create local offer.');
        return;
      }

      try {
        await this.pc.setLocalDescription(offer);
      } catch (err) {
        this.handleError('SET_LOCAL_DESCRIPTION_FAILED', err, 'Failed to set local description.');
        return;
      }
      this.updateDebugStates();

      // Wait until iceGatheringState === "complete"
      try {
        await this.waitForIceGathering(this.pc);
      } catch (err) {
        this.handleError('ICE_GATHERING_FAILED', err, 'ICE candidate gathering failed.');
        return;
      }
      this.updateDebugStates();

      // DOM safety check before write
      if (!this.offerTextarea) {
        throw new Error('DOM_BINDING_ERROR: Offer textarea not found');
      }

      // Directly use browser generated pc.localDescription without modifying SDP!
      const payload = {
        type: this.pc.localDescription.type,
        sdp: this.pc.localDescription.sdp
      };

      // Output JSON string
      const jsonString = JSON.stringify(payload);
      this.offerTextarea.value = jsonString;

      // Update Signaling Diagnostics
      this.renderSignalingDiagnostics(payload.type, payload.sdp);

      console.log(`[MacApp] Offer session ready. Session ID: ${this.sessionId}, signalingState: ${this.pc.signalingState}`);
      this.logMessage('SYSTEM', `Session ${this.sessionId} ready. Copy Offer Signaling JSON to iPhone. Do not reset before Answer is applied.`);
    } catch (err) {
      this.handleError('CREATE_OFFER_FAILED', err, err.message);
    } finally {
      if (this.btnCreateOffer) {
        this.btnCreateOffer.disabled = false;
        this.btnCreateOffer.textContent = 'Create Offer';
      }
    }
  }

  /**
   * Applies Answer Signaling JSON from iPhone to the EXACT SAME PeerConnection instance
   */
  async handleConnect() {
    this.clearError();

    // Prevent concurrent execution or double-clicks
    if (this.isConnecting) {
      console.warn('[MacApp] Connect already in progress. Ignoring duplicate click.');
      return;
    }

    // 1. Session & PeerConnection Validation
    if (!this.pc) {
      this.handleError(
        'OFFER_SESSION_LOST',
        new Error('PeerConnection instance not found'),
        'OFFER_SESSION_LOST: Create a new Offer before applying Answer.'
      );
      return;
    }

    if (!this.pc.localDescription) {
      this.handleError(
        'OFFER_SESSION_LOST',
        new Error('Local description is null'),
        'OFFER_SESSION_LOST: Local offer description is missing. Please create Offer first.'
      );
      return;
    }

    // CRITICAL: Guard against false alarm if negotiation was already completed
    if (this.pc.signalingState === 'stable' &&
        this.pc.localDescription && this.pc.localDescription.type === 'offer' &&
        this.pc.remoteDescription && this.pc.remoteDescription.type === 'answer') {
      console.log('[MacApp] Negotiation already complete. WebRTC connection is active.');
      if (this.btnConnect) {
        this.btnConnect.disabled = true;
        this.btnConnect.textContent = 'Connected';
      }
      return;
    }

    if (this.pc.signalingState !== 'have-local-offer') {
      this.handleError(
        'INVALID_SIGNALING_STATE',
        new Error(`Invalid signalingState: ${this.pc.signalingState}`),
        `INVALID_SIGNALING_STATE: Expected "have-local-offer" but current state is "${this.pc.signalingState}". Do not click Reset or Create Offer while waiting for Answer.`
      );
      return;
    }

    if (!this.answerTextarea) {
      throw new Error('DOM_BINDING_ERROR: Answer textarea not found');
    }

    const raw = this.answerTextarea.value.trim();
    if (!raw) {
      this.handleError('INVALID_PAYLOAD', new Error('Empty payload'), 'Please paste the Answer Signaling JSON from iPhone into Step 2.');
      return;
    }

    // 2. JSON Parse & Validation
    let answer;
    try {
      answer = JSON.parse(raw);
    } catch (err) {
      this.handleError('JSON_PARSE_FAILED', err, 'Failed to parse Answer JSON. Ensure the entire JSON string was copied from iPhone.');
      return;
    }

    if (!answer || answer.type !== 'answer') {
      this.handleError('INVALID_PAYLOAD', new Error('Type is not "answer"'), 'Invalid signaling payload: payload.type must be "answer".');
      return;
    }
    if (typeof answer.sdp !== 'string') {
      this.handleError('INVALID_PAYLOAD', new Error('SDP is not a string'), 'Invalid signaling payload: payload.sdp must be a string.');
      return;
    }
    if (!answer.sdp.startsWith('v=0')) {
      this.handleError('INVALID_PAYLOAD', new Error('SDP does not start with v=0'), 'Invalid signaling payload: payload.sdp must start with "v=0".');
      return;
    }

    // Lock UI during connect
    this.isConnecting = true;
    if (this.btnConnect) {
      this.btnConnect.disabled = true;
      this.btnConnect.textContent = 'Connecting...';
    }

    // Update Signaling Diagnostics for received Answer
    this.renderSignalingDiagnostics(answer.type, answer.sdp);

    try {
      this.updateStatus('CONNECTING');
      this.logMessage('SYSTEM', `[Session ${this.sessionId}] Applying Answer on RTCPeerConnection (signalingState: ${this.pc.signalingState})...`);

      // 3. setRemoteDescription: directly pass answer without modifying SDP!
      try {
        await this.pc.setRemoteDescription(answer);
      } catch (err) {
        this.handleError('SET_REMOTE_DESCRIPTION_FAILED', err, err.message, answer);
        return;
      }
      this.updateDebugStates();

      console.log(`[MacApp] [Session ${this.sessionId}] setRemoteDescription success! signalingState: ${this.pc.signalingState}`);
      this.logMessage('SYSTEM', `[Session ${this.sessionId}] Remote Answer applied successfully! WebRTC peer connection establishing...`);
    } catch (err) {
      this.handleError('UNKNOWN_CONNECT_ERROR', err, 'Unexpected error applying answer.');
    } finally {
      this.isConnecting = false;
      if (this.pc && this.pc.signalingState === 'stable' && this.pc.remoteDescription && this.pc.remoteDescription.type === 'answer') {
        if (this.btnConnect) {
          this.btnConnect.disabled = true;
          this.btnConnect.textContent = 'Connected';
        }
      } else {
        if (this.btnConnect) {
          this.btnConnect.disabled = false;
          this.btnConnect.textContent = 'Connect';
        }
      }
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
        console.warn('[MacApp] ICE gathering wait timed out (proceeding with collected candidates).');
        resolve();
      }, 5000);
    });
  }

  /**
   * Sends custom text message over DataChannel
   */
  sendCustomMessage() {
    if (!this.channel || this.channel.readyState !== 'open') {
      alert('DataChannel is not open yet.');
      return;
    }
    if (!this.customMsgInput) return;
    const msg = this.customMsgInput.value.trim();
    if (!msg) return;

    try {
      this.channel.send(msg);
      this.logMessage('SENT', `Sent:\n${msg}`);
      this.customMsgInput.value = '';
    } catch (err) {
      console.error('[MacApp] Failed to send message:', err);
      this.logMessage('ERROR', `Send failed: ${err.message}`);
    }
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
    console.error(`[MacApp] [${code}]`, err, {
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
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.macApp = new MacApp();
});
