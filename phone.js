/**
 * Sakura Breeze AR - iPhone Controller
 * class PhoneApp
 * Stage 3: Robust Native WebRTC JSON Signaling (iPhone Safari <-> MacBook Chrome)
 * Lifecycle-Hardened Implementation
 */

let phoneSessionCounter = 0;

class PhoneApp {
  constructor() {
    this.initialized = false;
    this.sessionId = '-';
    this.currentSessionActive = false;
    this.isCreatingAnswer = false;

    // 1. Status elements
    this.statusBadge = document.getElementById('status-badge');
    this.statusElement = document.getElementById('connection-status');
    this.httpsWarning = document.getElementById('https-warning');
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
    this.btnCreateAnswer = document.getElementById('btn-create-answer');
    this.btnClearOffer = document.getElementById('btn-clear-offer');

    // 5. WebRTC Answer elements (Unified ID: answer-sdp)
    this.answerTextarea = document.getElementById('answer-sdp');
    this.btnCopyAnswer = document.getElementById('btn-copy-answer');
    this.btnClearAnswer = document.getElementById('btn-clear-answer');

    // 6. Reset button
    this.btnResetWebRTC = document.getElementById('btn-reset-webrtc');

    // 7. DataChannel test & message log
    this.messageLog = document.getElementById('datachannel-log');

    // 8. Developer mode / Session Debug indicators
    this.debugSessionId = document.getElementById('debug-session-id');
    this.debugSignalState = document.getElementById('debug-signal-state');
    this.debugLocalDesc = document.getElementById('debug-local-desc');
    this.debugRemoteDesc = document.getElementById('debug-remote-desc');
    this.debugDcState = document.getElementById('debug-dc-state');
    this.debugConnState = document.getElementById('debug-conn-state');
    this.debugIceConnState = document.getElementById('debug-ice-conn-state');
    this.debugIceGatherState = document.getElementById('debug-ice-gather-state');

    // 9. WebRTC connection instances
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

    // Bind all Event Listeners exactly once
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

    this.updateDebugStates();
    console.log('[PhoneApp] Initialized successfully with hardened lifecycle controls.');
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
      messageLog: this.messageLog
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

    // Clear textareas
    if (this.offerTextarea) this.offerTextarea.value = '';
    if (this.answerTextarea) this.answerTextarea.value = '';

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
    };

    channel.onclose = () => {
      console.log(`[PhoneApp] [Session ${this.sessionId}] DataChannel closed`);
      this.logMessage('SYSTEM', 'DataChannel closed');
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
   * Applies Offer from MacBook, creates Answer, and outputs pristine JSON payload
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
      this.btnCreateAnswer.textContent = 'Gathering ICE...';
    }

    // Update Signaling Diagnostics for received Offer
    this.renderSignalingDiagnostics(offer.type, offer.sdp);

    try {
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

      // 4. createAnswer
      let answer;
      try {
        answer = await this.pc.createAnswer();
      } catch (err) {
        this.handleError('CREATE_ANSWER_FAILED', err, err.message);
        return;
      }

      // 5. setLocalDescription
      try {
        await this.pc.setLocalDescription(answer);
      } catch (err) {
        this.handleError('SET_LOCAL_DESCRIPTION_FAILED', err, err.message);
        return;
      }
      this.updateDebugStates();

      // 6. Wait for iceGatheringState === "complete"
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

      // 7. Generate Answer payload directly from browser pc.localDescription without modifying SDP!
      const payload = {
        type: this.pc.localDescription.type,
        sdp: this.pc.localDescription.sdp
      };

      const jsonString = JSON.stringify(payload);
      this.answerTextarea.value = jsonString;

      // Update Signaling Diagnostics for generated Answer
      this.renderSignalingDiagnostics(payload.type, payload.sdp);

      this.logMessage('SYSTEM', `[Session ${this.sessionId}] Answer created. Copy Answer Signaling JSON back to MacBook.`);
    } catch (err) {
      this.handleError('UNKNOWN_ANSWER_ERROR', err, 'Unexpected error creating answer.');
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
   * Clipboard helper with iOS Safari fallback
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
   * Updates Debug and Session states in real time
   */
  updateDebugStates() {
    // Session ID
    if (this.debugSessionId) {
      this.debugSessionId.textContent = this.sessionId ? `${this.sessionId}` : '-';
    }

    // Signaling State
    const signalState = this.pc ? this.pc.signalingState : 'stable';
    if (this.debugSignalState) {
      this.debugSignalState.textContent = signalState;
    }

    // Local & Remote Description Types
    const localType = this.pc && this.pc.localDescription ? this.pc.localDescription.type : 'none';
    if (this.debugLocalDesc) {
      this.debugLocalDesc.textContent = localType;
    }

    const remoteType = this.pc && this.pc.remoteDescription ? this.pc.remoteDescription.type : 'none';
    if (this.debugRemoteDesc) {
      this.debugRemoteDesc.textContent = remoteType;
    }

    // DataChannel State
    const dcState = this.channel ? this.channel.readyState : 'none';
    if (this.debugDcState) {
      this.debugDcState.textContent = dcState;
    }

    // PeerConnection Connection States
    if (this.debugConnState) {
      this.debugConnState.textContent = this.pc ? (this.pc.connectionState || 'new') : 'new';
    }
    if (this.debugIceConnState) {
      this.debugIceConnState.textContent = this.pc ? (this.pc.iceConnectionState || 'new') : 'new';
    }
    if (this.debugIceGatherState) {
      this.debugIceGatherState.textContent = this.pc ? (this.pc.iceGatheringState || 'new') : 'new';
    }
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
    console.error(`[PhoneApp] [${code}]`, error.name || 'Error', error.message || error);
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
    this.updateDebugStates();
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

// Safe DOM initialization exactly once
window.addEventListener('DOMContentLoaded', () => {
  try {
    if (!window.phoneApp) {
      window.phoneApp = new PhoneApp();
    }
  } catch (err) {
    console.error('[PhoneApp] Fatal initialization prevented:', err);
  }
});
