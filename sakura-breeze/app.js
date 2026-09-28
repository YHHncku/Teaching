/**
 * Sakura Breeze AR - MacBook Main Screen
 * class MacApp
 * Stage 3: Robust Native WebRTC JSON Signaling (MacBook Chrome <-> iPhone Safari)
 */
class MacApp {
  constructor() {
    // 1. Status elements
    this.statusBadge = document.getElementById('status-badge');
    this.statusElement = document.getElementById('connection-status');
    this.arStatusElement = document.getElementById('ar-status');
    this.httpsWarning = document.getElementById('https-warning');
    this.dcStateBadge = document.getElementById('dc-state-badge');
    this.errorBox = document.getElementById('error-diagnostics');

    // 2. Diagnostics elements (Phase 2 preserved)
    this.diagBrowser = document.getElementById('diag-browser');
    this.diagHttps = document.getElementById('diag-https');
    this.diagOnline = document.getElementById('diag-online');

    // 3. Signaling Diagnostics elements
    this.sigPayloadType = document.getElementById('sig-payload-type');
    this.sigSdpLength = document.getElementById('sig-sdp-length');
    this.sigFirstLine = document.getElementById('sig-first-line');
    this.sigLastLine = document.getElementById('sig-last-line');
    this.sigLineCount = document.getElementById('sig-line-count');

    // 4. WebRTC Offer elements (Unified ID: offer-sdp)
    this.offerTextarea = document.getElementById('offer-sdp');
    this.btnCreateOffer = document.getElementById('btn-create-offer');
    this.btnCopyOffer = document.getElementById('btn-copy-offer');
    this.btnClearOffer = document.getElementById('btn-clear-offer');

    // 5. WebRTC Answer elements (Unified ID: answer-sdp)
    this.answerTextarea = document.getElementById('answer-sdp');
    this.btnConnect = document.getElementById('btn-connect');
    this.btnClearAnswer = document.getElementById('btn-clear-answer');

    // 6. Reset button
    this.btnResetWebRTC = document.getElementById('btn-reset-webrtc');

    // 7. DataChannel test & message log
    this.messageLog = document.getElementById('datachannel-log');
    this.customMsgInput = document.getElementById('custom-msg-input');
    this.btnSendMsg = document.getElementById('btn-send-msg');

    // 8. Developer mode / Debug indicators
    this.debugConnState = document.getElementById('debug-conn-state');
    this.debugIceConnState = document.getElementById('debug-ice-conn-state');
    this.debugIceGatherState = document.getElementById('debug-ice-gather-state');
    this.debugSignalState = document.getElementById('debug-signal-state');

    // 9. WebRTC connection instances
    this.pc = null;
    this.channel = null;
    this.diagnostics = null;
    this.arRenderer = null;

    this.init();
  }

  /**
   * Initializes application, validates DOM bindings, and binds event listeners
   */
  init() {
    // Audit & validate all required DOM elements immediately
    this.validateDOMBindings();

    // Initial Connection Status
    this.updateStatus('DISCONNECTED');

    // Initialize AR Renderer (Phase 1 preserved)
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

    // Bind all Event Listeners
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
    console.log('[MacApp] Initialized successfully with audited DOM bindings.');
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
      messageLog: this.messageLog
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
   * Safely detaches listeners and closes existing peer connection & datachannel
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

    // Clear textareas
    if (this.offerTextarea) this.offerTextarea.value = '';
    if (this.answerTextarea) this.answerTextarea.value = '';

    // Clear signaling diagnostics
    this.renderSignalingDiagnostics('none', '');

    // Reset status and badges
    this.updateStatus('DISCONNECTED');
    if (this.dcStateBadge) this.dcStateBadge.textContent = 'channel: sakura';
    if (this.customMsgInput) this.customMsgInput.disabled = true;
    if (this.btnSendMsg) this.btnSendMsg.disabled = true;

    this.updateDebugStates();
    this.logMessage('SYSTEM', 'WebRTC state reset. Ready for a fresh connection session.');
  }

  /**
   * Initializes a fresh RTCPeerConnection and RTCDataChannel
   */
  initPeerConnection() {
    this.cleanupPeerConnection();

    // Local USB network - no STUN servers required
    this.pc = new RTCPeerConnection({
      iceServers: []
    });

    // Create DataChannel 'sakura'
    this.channel = this.pc.createDataChannel('sakura');
    this.setupDataChannel(this.channel);

    // RTCPeerConnection Lifecycle Listeners
    this.pc.onconnectionstatechange = () => {
      this.updateDebugStates();
      const state = this.pc.connectionState;
      console.log('[MacApp] connectionState changed:', state);
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
      const iceState = this.pc.iceConnectionState;
      console.log('[MacApp] iceConnectionState changed:', iceState);
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
      console.log('[MacApp] iceGatheringState changed:', this.pc.iceGatheringState);
    };

    this.pc.onsignalingstatechange = () => {
      this.updateDebugStates();
      console.log('[MacApp] signalingState changed:', this.pc.signalingState);
    };

    this.updateDebugStates();
  }

  /**
   * Configures event handlers on RTCDataChannel
   */
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('[MacApp] DataChannel "sakura" opened');
      this.logMessage('SYSTEM', 'DataChannel "sakura" opened successfully');
      this.updateStatus('CONNECTED');
      if (this.dcStateBadge) this.dcStateBadge.textContent = 'channel: sakura (OPEN)';
      if (this.customMsgInput) this.customMsgInput.disabled = false;
      if (this.btnSendMsg) this.btnSendMsg.disabled = false;
    };

    channel.onclose = () => {
      console.log('[MacApp] DataChannel "sakura" closed');
      this.logMessage('SYSTEM', 'DataChannel "sakura" closed');
      if (this.dcStateBadge) this.dcStateBadge.textContent = 'channel: sakura (CLOSED)';
      if (this.customMsgInput) this.customMsgInput.disabled = true;
      if (this.btnSendMsg) this.btnSendMsg.disabled = true;
      if (this.pc && this.pc.connectionState !== 'connected') {
        this.updateStatus('DISCONNECTED');
      }
    };

    channel.onerror = (err) => {
      console.error('[MacApp] DataChannel error:', err);
      this.logMessage('ERROR', `DataChannel error: ${err.message || 'Unknown error'}`);
    };

    channel.onmessage = (event) => {
      const data = event.data;
      console.log('[MacApp] DataChannel onmessage:', data);

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
   * Generates Offer, waits for ICE gathering to complete, outputs pristine JSON payload
   */
  async handleCreateOffer() {
    this.clearError();

    // DOM safety check before start
    if (!this.offerTextarea) {
      throw new Error('DOM_BINDING_ERROR: Offer textarea not found');
    }

    try {
      this.initPeerConnection();
      this.updateStatus('CONNECTING');
      if (this.btnCreateOffer) {
        this.btnCreateOffer.disabled = true;
        this.btnCreateOffer.textContent = 'Gathering ICE...';
      }
      this.logMessage('SYSTEM', 'Creating Offer and gathering local ICE candidates...');

      let offer;
      try {
        offer = await this.pc.createOffer();
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

      this.logMessage('SYSTEM', 'Offer created. Copy Offer Signaling JSON to iPhone.');
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
   * Applies Answer Signaling JSON from iPhone
   */
  async handleConnect() {
    this.clearError();

    // DOM safety check
    if (!this.answerTextarea) {
      throw new Error('DOM_BINDING_ERROR: Answer textarea not found');
    }

    const raw = this.answerTextarea.value.trim();
    if (!raw) {
      this.handleError('INVALID_PAYLOAD', new Error('Empty payload'), 'Please paste the Answer Signaling JSON from iPhone.');
      return;
    }

    if (!this.pc || !this.pc.localDescription) {
      this.handleError('INVALID_PAYLOAD', new Error('Missing local offer'), 'Please click "Create Offer" before connecting with an Answer.');
      return;
    }

    // 1. JSON Parse
    let answer;
    try {
      answer = JSON.parse(raw);
    } catch (err) {
      this.handleError('JSON_PARSE_FAILED', err, 'Failed to parse JSON string. Ensure you copied the full JSON from iPhone.');
      return;
    }

    // 2. Validate payload
    if (!answer || answer.type !== 'answer') {
      this.handleError('INVALID_PAYLOAD', new Error('Invalid type'), 'Invalid signaling payload: expected type="answer".');
      return;
    }
    if (typeof answer.sdp !== 'string') {
      this.handleError('INVALID_PAYLOAD', new Error('Missing sdp string'), 'Invalid signaling payload: payload.sdp must be a string.');
      return;
    }
    if (!answer.sdp.startsWith('v=0')) {
      this.handleError('INVALID_PAYLOAD', new Error('SDP does not start with v=0'), 'Invalid signaling payload: payload.sdp must start with "v=0".');
      return;
    }

    // Update Signaling Diagnostics for received Answer
    this.renderSignalingDiagnostics(answer.type, answer.sdp);

    // 3. setRemoteDescription directly without modifying SDP
    try {
      this.updateStatus('CONNECTING');
      if (this.btnConnect) {
        this.btnConnect.disabled = true;
        this.btnConnect.textContent = 'Connecting...';
      }
      this.logMessage('SYSTEM', 'Applying Answer from iPhone...');

      await this.pc.setRemoteDescription(answer);
      this.updateDebugStates();

      this.logMessage('SYSTEM', 'Remote Answer applied. Establishing peer connection...');
    } catch (err) {
      this.handleError('SET_REMOTE_DESCRIPTION_FAILED', err, err.message, answer);
    } finally {
      if (this.btnConnect) {
        this.btnConnect.disabled = false;
        this.btnConnect.textContent = 'Connect';
      }
    }
  }

  /**
   * Sends custom message over DataChannel
   */
  sendCustomMessage() {
    if (!this.channel || this.channel.readyState !== 'open') {
      alert('DataChannel is not open yet.');
      return;
    }

    const text = this.customMsgInput ? this.customMsgInput.value.trim() : '';
    if (!text) return;

    try {
      this.channel.send(text);
      this.logMessage('SENT', `Sent:\n${text}`);
      if (this.customMsgInput) this.customMsgInput.value = '';
    } catch (err) {
      console.error('[MacApp] Send message failed:', err);
      this.logMessage('ERROR', `Failed to send: ${err.message}`);
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

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);

      // Safe timeout (3.5s) to prevent indefinite hang on restricted networks
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 3500);
    });
  }

  /**
   * Clipboard helper with fallback
   */
  async copyToClipboard(text, btnElement, defaultLabel) {
    if (!text) {
      alert('No JSON content to copy.');
      return;
    }

    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (_) {}

    if (!copied) {
      try {
        const temp = document.createElement('textarea');
        temp.value = text;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.focus();
        temp.select();
        copied = document.execCommand('copy');
        document.body.removeChild(temp);
      } catch (_) {}
    }

    if (btnElement) {
      btnElement.textContent = copied ? 'Copied!' : 'Select & Copy';
      setTimeout(() => {
        btnElement.textContent = defaultLabel;
      }, 2000);
    }
  }

  /**
   * Updates UI Connection Status
   * Values: DISCONNECTED, CONNECTING, CONNECTED, FAILED
   */
  updateStatus(status) {
    if (this.statusElement) {
      this.statusElement.textContent = status;
    }
    if (this.statusBadge) {
      this.statusBadge.className = `status-badge status-${status.toLowerCase()}`;
    }
  }

  /**
   * Updates Debug states in real time
   */
  updateDebugStates() {
    if (!this.pc) {
      if (this.debugConnState) this.debugConnState.textContent = 'new';
      if (this.debugIceConnState) this.debugIceConnState.textContent = 'new';
      if (this.debugIceGatherState) this.debugIceGatherState.textContent = 'new';
      if (this.debugSignalState) this.debugSignalState.textContent = 'stable';
      return;
    }

    if (this.debugConnState) this.debugConnState.textContent = this.pc.connectionState || 'new';
    if (this.debugIceConnState) this.debugIceConnState.textContent = this.pc.iceConnectionState || 'new';
    if (this.debugIceGatherState) this.debugIceGatherState.textContent = this.pc.iceGatheringState || 'new';
    if (this.debugSignalState) this.debugSignalState.textContent = this.pc.signalingState || 'stable';
  }

  /**
   * Updates Signaling Diagnostics panel
   */
  renderSignalingDiagnostics(type, sdp) {
    const diag = extractSdpDiagnostics(type, sdp);
    if (this.sigPayloadType) this.sigPayloadType.textContent = diag.type;
    if (this.sigSdpLength) this.sigSdpLength.textContent = `${diag.length} chars`;
    if (this.sigFirstLine) this.sigFirstLine.textContent = diag.firstLine;
    if (this.sigLastLine) this.sigLastLine.textContent = diag.lastLine;
    if (this.sigLineCount) this.sigLineCount.textContent = `${diag.lineCount}`;
  }

  /**
   * Dedicated Error Handler
   */
  handleError(code, error, userMessage, payload) {
    this.updateStatus('FAILED');
    console.error(`[${code}]`, error.name || 'Error', error.message || error);
    if (payload && payload.sdp) {
      const diag = extractSdpDiagnostics(payload.type, payload.sdp);
      console.error('Payload Details:', {
        type: payload.type,
        sdpLength: diag.length,
        firstLine: diag.firstLine,
        lastLine: diag.lastLine,
        lineCount: diag.lineCount
      });
    }

    if (this.errorBox) {
      this.errorBox.style.display = 'block';
      this.errorBox.innerHTML = `<strong>[${escapeHtml(code)}]</strong> ${escapeHtml(userMessage || error.message)}`;
    }
    this.logMessage('ERROR', `[${code}] ${userMessage || error.message}`);
  }

  clearError() {
    if (this.errorBox) {
      this.errorBox.style.display = 'none';
      this.errorBox.innerHTML = '';
    }
  }

  /**
   * Logs activity into the on-screen log box
   */
  logMessage(type, message) {
    if (!this.messageLog) return;

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type.toLowerCase()}`;

    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${escapeHtml(message)}`;

    this.messageLog.appendChild(entry);
    this.messageLog.scrollTop = this.messageLog.scrollHeight;
  }

  /**
   * NetworkDiagnostics integration (Phase 2 preserved)
   */
  renderDiagnostics(report) {
    if (!report) return;

    if (this.diagBrowser) {
      this.diagBrowser.textContent = report.browser;
    }
    if (this.diagHttps) {
      this.diagHttps.textContent = report.httpsText;
      this.diagHttps.className = `diag-value ${report.isHttps ? 'status-ok' : 'status-err'}`;
    }
    if (this.diagOnline) {
      this.diagOnline.textContent = report.onlineText;
      this.diagOnline.className = `diag-value ${report.online ? 'status-ok' : 'status-err'}`;
    }
    if (this.httpsWarning) {
      this.httpsWarning.style.display = report.isHttps ? 'none' : 'block';
    }
  }
}

function extractSdpDiagnostics(type, sdp) {
  if (typeof sdp !== 'string' || !sdp) {
    return {
      type: type || 'none',
      length: 0,
      firstLine: '-',
      lastLine: '-',
      lineCount: 0
    };
  }
  const lines = sdp.split(/\r\n|\r|\n/).filter(line => line.length > 0);
  return {
    type: type || 'none',
    length: sdp.length,
    firstLine: lines.length > 0 ? lines[0] : '-',
    lastLine: lines.length > 0 ? lines[lines.length - 1] : '-',
    lineCount: lines.length
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Safe DOM initialization
window.addEventListener('DOMContentLoaded', () => {
  try {
    window.macApp = new MacApp();
  } catch (err) {
    console.error('[MacApp] Fatal initialization prevented:', err);
  }
});
