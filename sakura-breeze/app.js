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

    // 10. WebRTC connection instances
    this.pc = null;
    this.channel = null;
    this.diagnostics = null;
    this.arRenderer = null;

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
      remoteVideo: this.remoteVideo
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

    // Reset video UI
    this.resetRemoteVideoUI();

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

    // CRITICAL for Phase 4:
    // Add recvonly video transceiver so MacBook Offer advertises video receiving capability
    // This allows iPhone Safari to send its camera video track in the Answer without renegotiation!
    if (this.pc.addTransceiver) {
      try {
        this.pc.addTransceiver('video', { direction: 'recvonly' });
        console.log(`[MacApp] [Session ${this.sessionId}] Added recvonly video transceiver.`);
      } catch (err) {
        console.warn('[MacApp] addTransceiver warning:', err);
      }
    }

    // Listen for remote tracks (iPhone Camera)
    this.pc.ontrack = (event) => {
      console.log(`[MacApp] [Session ${this.sessionId}] ontrack received:`, event.track.kind, event.streams);
      this.handleRemoteTrack(event);
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
   * Handles incoming remote media track from iPhone camera
   */
  handleRemoteTrack(event) {
    if (!this.remoteVideo) return;
    const track = event.track;
    console.log(`[MacApp] [Session ${this.sessionId}] Processing remote ${track.kind} track...`);

    if (event.streams && event.streams[0]) {
      this.remoteVideo.srcObject = event.streams[0];
    } else {
      let inboundStream = this.remoteVideo.srcObject;
      if (!inboundStream || !(inboundStream instanceof MediaStream)) {
        inboundStream = new MediaStream();
        this.remoteVideo.srcObject = inboundStream;
      }
      inboundStream.addTrack(track);
    }

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
      console.log(`[MacApp] Track unmuted`);
      this.remoteVideo.play().catch(err => console.warn('[MacApp] remoteVideo.play() caught:', err));
      onPlayReady();
    };

    track.onended = () => {
      console.log(`[MacApp] Track ended`);
      this.resetRemoteVideoUI();
    };

    this.remoteVideo.play().catch(err => {
      console.warn('[MacApp] Initial remoteVideo.play() error:', err);
    });

    this.logMessage('SYSTEM', `Remote camera track attached (${track.kind}). Streaming live.`);
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

      this.logMessage('SYSTEM', `[Session ${this.sessionId}] Creating Offer with Video & DataChannel capabilities...`);

      let offer;
      try {
        offer = await this.pc.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false
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
      if (this.btnConnect) {
        this.btnConnect.disabled = false;
        this.btnConnect.textContent = 'Connect';
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
