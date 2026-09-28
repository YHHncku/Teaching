/**
 * Sakura Breeze AR - iPhone Controller
 * class PhoneApp
 * Stage 3: Pure WebRTC RTCDataChannel (iPhone Safari <-> MacBook Chrome)
 */
class PhoneApp {
  constructor() {
    // Status elements
    this.statusBadge = document.getElementById('status-badge');
    this.statusElement = document.getElementById('connection-status');
    this.httpsWarning = document.getElementById('https-warning');

    // Diagnostics elements (Phase 2 preserved)
    this.diagBrowser = document.getElementById('diag-browser');
    this.diagHttps = document.getElementById('diag-https');
    this.diagOnline = document.getElementById('diag-online');

    // WebRTC Offer & Answer elements
    this.offerTextarea = document.getElementById('offer-sdp');
    this.btnCreateAnswer = document.getElementById('btn-create-answer');
    this.btnClearOffer = document.getElementById('btn-clear-offer');

    this.answerTextarea = document.getElementById('answer-sdp');
    this.btnCopyAnswer = document.getElementById('btn-copy-answer');
    this.btnClearAnswer = document.getElementById('btn-clear-answer');

    // DataChannel test & message log
    this.messageLog = document.getElementById('datachannel-log');

    // Developer mode / Debug indicators
    this.debugConnState = document.getElementById('debug-conn-state');
    this.debugIceConnState = document.getElementById('debug-ice-conn-state');
    this.debugIceGatherState = document.getElementById('debug-ice-gather-state');
    this.debugSignalState = document.getElementById('debug-signal-state');

    // WebRTC connection instances
    this.pc = null;
    this.channel = null;
    this.diagnostics = null;

    this.init();
  }

  init() {
    // 1. Initial Connection Status
    this.updateStatus('DISCONNECTED');

    // 2. Initialize Network Diagnostics (Phase 2 preserved)
    if (typeof NetworkDiagnostics !== 'undefined') {
      this.diagnostics = new NetworkDiagnostics({
        onStatusChange: (report) => this.renderDiagnostics(report)
      });
      this.renderDiagnostics(this.diagnostics.getReport());
    }

    // 3. Bind WebRTC UI Event Listeners
    if (this.btnCreateAnswer) {
      this.btnCreateAnswer.addEventListener('click', () => this.handleCreateAnswer());
    }
    if (this.btnClearOffer) {
      this.btnClearOffer.addEventListener('click', () => {
        this.offerTextarea.value = '';
      });
    }

    if (this.btnCopyAnswer) {
      this.btnCopyAnswer.addEventListener('click', () => {
        this.copyToClipboard(this.answerTextarea.value, this.btnCopyAnswer, 'Copy Answer');
      });
    }
    if (this.btnClearAnswer) {
      this.btnClearAnswer.addEventListener('click', () => {
        this.answerTextarea.value = '';
      });
    }

    this.updateDebugStates();
    console.log('[PhoneApp] Initialized successfully. Awaiting Offer from MacBook.');
  }

  /**
   * Initializes RTCPeerConnection for iPhone
   */
  initPeerConnection() {
    if (this.pc) {
      try {
        if (this.channel) this.channel.close();
        this.pc.close();
      } catch (e) {
        console.warn('[PhoneApp] Error closing prior peer connection:', e);
      }
    }

    // Local USB network - no STUN servers required
    this.pc = new RTCPeerConnection({
      iceServers: []
    });

    // Listen for incoming DataChannel 'sakura' created by MacBook
    this.pc.ondatachannel = (event) => {
      console.log('[PhoneApp] ondatachannel received:', event.channel.label);
      this.channel = event.channel;
      this.setupDataChannel(this.channel);
    };

    // RTCPeerConnection Lifecycle Listeners
    this.pc.onconnectionstatechange = () => {
      this.updateDebugStates();
      const state = this.pc.connectionState;
      console.log('[PhoneApp] connectionState changed:', state);
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
      console.log('[PhoneApp] iceConnectionState changed:', iceState);
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
      console.log('[PhoneApp] iceGatheringState changed:', this.pc.iceGatheringState);
    };

    this.pc.onsignalingstatechange = () => {
      this.updateDebugStates();
      console.log('[PhoneApp] signalingState changed:', this.pc.signalingState);
    };

    this.updateDebugStates();
  }

  /**
   * Configures event handlers on received RTCDataChannel
   */
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('[PhoneApp] DataChannel opened');
      this.logMessage('SYSTEM', 'DataChannel "sakura" opened');
      this.updateStatus('CONNECTED');

      // Handshake requirement:
      // iPhone DataChannel open 後：
      // send: HELLO_FROM_IPHONE
      try {
        channel.send('HELLO_FROM_IPHONE');
        this.logMessage('SENT', 'Sent:\nHELLO_FROM_IPHONE');
      } catch (sendErr) {
        console.error('[PhoneApp] Failed to send HELLO_FROM_IPHONE:', sendErr);
      }
    };

    channel.onclose = () => {
      console.log('[PhoneApp] DataChannel closed');
      this.logMessage('SYSTEM', 'DataChannel closed');
      if (this.pc && this.pc.connectionState !== 'connected') {
        this.updateStatus('DISCONNECTED');
      }
    };

    channel.onerror = (err) => {
      console.error('[PhoneApp] DataChannel error:', err);
      this.logMessage('ERROR', `DataChannel error: ${err.message || 'Unknown'}`);
    };

    channel.onmessage = (event) => {
      const data = event.data;
      console.log('[PhoneApp] DataChannel onmessage:', data);

      // Handshake requirement:
      // iPhone 收到：
      // Received:
      // HELLO_FROM_MAC
      this.logMessage('RECEIVED', `Received:\n${data}`);
    };
  }

  /**
   * Applies Offer from MacBook, creates Answer, and waits for ICE gathering to complete
   */
  async handleCreateAnswer() {
    const rawOffer = this.offerTextarea.value.trim();
    if (!rawOffer) {
      alert('Please paste the Offer SDP from MacBook into Step 1 first.');
      return;
    }

    try {
      this.initPeerConnection();
      this.updateStatus('CONNECTING');
      this.btnCreateAnswer.disabled = true;
      this.btnCreateAnswer.textContent = 'Gathering ICE...';
      this.logMessage('SYSTEM', 'Applying remote Offer and gathering ICE candidates...');

      // Handle raw SDP string or JSON object
      let sdp = rawOffer;
      try {
        const parsed = JSON.parse(rawOffer);
        if (parsed.sdp) sdp = parsed.sdp;
      } catch (_) {}

      await this.pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: sdp
      }));
      this.updateDebugStates();

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.updateDebugStates();

      // Wait until iceGatheringState === "complete"
      await this.waitForIceGathering(this.pc);
      this.updateDebugStates();

      // Display complete Answer SDP in textarea
      this.answerTextarea.value = this.pc.localDescription.sdp;
      this.btnCreateAnswer.disabled = false;
      this.btnCreateAnswer.textContent = 'Create Answer';
      this.logMessage('SYSTEM', 'Answer created with complete ICE candidates. Copy Answer back to MacBook.');
    } catch (err) {
      console.error('[PhoneApp] Create Answer failed:', err);
      this.updateStatus('FAILED');
      this.btnCreateAnswer.disabled = false;
      this.btnCreateAnswer.textContent = 'Create Answer';
      this.logMessage('ERROR', `Create Answer failed: ${err.message}`);
      alert('Failed to create answer: ' + err.message);
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
   * Clipboard helper with iOS Safari fallback
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
    window.phoneApp = new PhoneApp();
  } catch (err) {
    console.error('[PhoneApp] Fatal initialization prevented:', err);
  }
});
