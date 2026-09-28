/**
 * Sakura Breeze AR - MacBook Main Screen
 * class MacApp
 * Stage 3: Pure WebRTC RTCDataChannel (MacBook Chrome <-> iPhone Safari)
 */
class MacApp {
  constructor() {
    // Status elements
    this.statusBadge = document.getElementById('status-badge');
    this.statusElement = document.getElementById('connection-status');
    this.arStatusElement = document.getElementById('ar-status');
    this.httpsWarning = document.getElementById('https-warning');
    this.dcStateBadge = document.getElementById('dc-state-badge');

    // Diagnostics elements (Phase 2 preserved)
    this.diagBrowser = document.getElementById('diag-browser');
    this.diagHttps = document.getElementById('diag-https');
    this.diagOnline = document.getElementById('diag-online');

    // WebRTC Offer elements
    this.offerTextarea = document.getElementById('offer-sdp');
    this.btnCreateOffer = document.getElementById('btn-create-offer');
    this.btnCopyOffer = document.getElementById('btn-copy-offer');
    this.btnClearOffer = document.getElementById('btn-clear-offer');

    // WebRTC Answer elements
    this.answerTextarea = document.getElementById('answer-sdp');
    this.btnConnect = document.getElementById('btn-connect');
    this.btnClearAnswer = document.getElementById('btn-clear-answer');

    // DataChannel test & message log
    this.messageLog = document.getElementById('datachannel-log');
    this.customMsgInput = document.getElementById('custom-msg-input');
    this.btnSendMsg = document.getElementById('btn-send-msg');

    // Developer mode / Debug indicators
    this.debugConnState = document.getElementById('debug-conn-state');
    this.debugIceConnState = document.getElementById('debug-ice-conn-state');
    this.debugIceGatherState = document.getElementById('debug-ice-gather-state');
    this.debugSignalState = document.getElementById('debug-signal-state');

    // WebRTC connection instances
    this.pc = null;
    this.channel = null;
    this.diagnostics = null;
    this.arRenderer = null;

    this.init();
  }

  init() {
    // 1. Initial Connection Status
    this.updateStatus('DISCONNECTED');

    // 2. Initialize AR Renderer (Phase 1 preserved)
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

    // 3. Initialize Network Diagnostics (Phase 2 preserved)
    if (typeof NetworkDiagnostics !== 'undefined') {
      this.diagnostics = new NetworkDiagnostics({
        onStatusChange: (report) => this.renderDiagnostics(report)
      });
      this.renderDiagnostics(this.diagnostics.getReport());
    }

    // 4. Bind WebRTC UI Event Listeners
    if (this.btnCreateOffer) {
      this.btnCreateOffer.addEventListener('click', () => this.handleCreateOffer());
    }
    if (this.btnCopyOffer) {
      this.btnCopyOffer.addEventListener('click', () => {
        this.copyToClipboard(this.offerTextarea.value, this.btnCopyOffer, 'Copy Offer');
      });
    }
    if (this.btnClearOffer) {
      this.btnClearOffer.addEventListener('click', () => {
        this.offerTextarea.value = '';
      });
    }

    if (this.btnConnect) {
      this.btnConnect.addEventListener('click', () => this.handleConnect());
    }
    if (this.btnClearAnswer) {
      this.btnClearAnswer.addEventListener('click', () => {
        this.answerTextarea.value = '';
      });
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
    console.log('[MacApp] Initialized successfully. Ready for WebRTC.');
  }

  /**
   * Initializes RTCPeerConnection and RTCDataChannel
   */
  initPeerConnection() {
    if (this.pc) {
      try {
        if (this.channel) this.channel.close();
        this.pc.close();
      } catch (e) {
        console.warn('[MacApp] Error closing prior peer connection:', e);
      }
    }

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
   * Generates Offer and waits for ICE gathering to complete before displaying full SDP
   */
  async handleCreateOffer() {
    try {
      this.initPeerConnection();
      this.updateStatus('CONNECTING');
      this.btnCreateOffer.disabled = true;
      this.btnCreateOffer.textContent = 'Gathering ICE...';
      this.logMessage('SYSTEM', 'Creating Offer and gathering local ICE candidates...');

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.updateDebugStates();

      // Wait until iceGatheringState === "complete"
      await this.waitForIceGathering(this.pc);
      this.updateDebugStates();

      // Display complete SDP
      this.offerTextarea.value = this.pc.localDescription.sdp;
      this.btnCreateOffer.disabled = false;
      this.btnCreateOffer.textContent = 'Create Offer';
      this.logMessage('SYSTEM', 'Offer created with complete ICE candidates. Copy Offer to iPhone.');
    } catch (err) {
      console.error('[MacApp] createOffer failed:', err);
      this.updateStatus('FAILED');
      this.btnCreateOffer.disabled = false;
      this.btnCreateOffer.textContent = 'Create Offer';
      this.logMessage('ERROR', `Create Offer failed: ${err.message}`);
    }
  }

  /**
   * Applies Answer SDP from iPhone
   */
  async handleConnect() {
    const rawAnswer = this.answerTextarea.value.trim();
    if (!rawAnswer) {
      alert('Please paste the Answer SDP from iPhone into Step 2 first.');
      return;
    }

    if (!this.pc || !this.pc.localDescription) {
      alert('Please click "Create Offer" before connecting with an Answer.');
      return;
    }

    try {
      this.updateStatus('CONNECTING');
      this.btnConnect.disabled = true;
      this.btnConnect.textContent = 'Connecting...';
      this.logMessage('SYSTEM', 'Applying Answer from iPhone...');

      // Handle raw SDP string or JSON object
      let sdp = rawAnswer;
      try {
        const parsed = JSON.parse(rawAnswer);
        if (parsed.sdp) sdp = parsed.sdp;
      } catch (_) {}

      await this.pc.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: sdp
      }));

      this.updateDebugStates();
      this.btnConnect.disabled = false;
      this.btnConnect.textContent = 'Connect';
      this.logMessage('SYSTEM', 'Remote Answer applied. Establishing peer connection...');
    } catch (err) {
      console.error('[MacApp] setRemoteDescription failed:', err);
      this.updateStatus('FAILED');
      this.btnConnect.disabled = false;
      this.btnConnect.textContent = 'Connect';
      this.logMessage('ERROR', `Connect failed: ${err.message}`);
      alert('Failed to connect: ' + err.message);
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

    const text = this.customMsgInput.value.trim();
    if (!text) return;

    try {
      this.channel.send(text);
      this.logMessage('SENT', `Sent:\n${text}`);
      this.customMsgInput.value = '';
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

      // Safe timeout (3s) to prevent indefinite hang on restricted networks
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 3000);
    });
  }

  /**
   * Clipboard helper with fallback
   */
  async copyToClipboard(text, btnElement, defaultLabel) {
    if (!text) {
      alert('No SDP content to copy.');
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
