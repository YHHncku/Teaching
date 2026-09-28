/**
 * Sakura Breeze AR - iPhone Controller
 * class PhoneApp
 * Stage 1: Native connection environment & diagnostics
 */
class PhoneApp {
  constructor() {
    this.startButton = document.getElementById('start-button');
    this.actionHint = document.getElementById('action-hint');
    this.httpsWarning = document.getElementById('https-warning');

    this.diagBrowser = document.getElementById('diag-browser');
    this.diagHttps = document.getElementById('diag-https');
    this.diagOnline = document.getElementById('diag-online');

    this.diagnostics = null;
    this.isStarted = false;
    this.init();
  }

  init() {
    // 1. Bind start button event
    // CRITICAL REQUIREMENT:
    // Before this button is clicked:
    // DO NOT request camera
    // DO NOT request microphone
    // DO NOT request motion
    if (this.startButton) {
      this.startButton.addEventListener('click', () => this.handleStart());
    }

    // 2. Initialize Network Diagnostics
    if (typeof NetworkDiagnostics !== 'undefined') {
      this.diagnostics = new NetworkDiagnostics({
        onStatusChange: (report) => this.renderDiagnostics(report)
      });
      this.renderDiagnostics(this.diagnostics.getReport());
    }

    console.log('[PhoneApp] Initialized successfully. Awaiting user interaction.');
  }

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

    // Protocol check: show warning banner if not HTTPS
    if (this.httpsWarning) {
      if (!report.isHttps) {
        this.httpsWarning.style.display = 'block';
      } else {
        this.httpsWarning.style.display = 'none';
      }
    }
  }

  handleStart() {
    if (this.isStarted) return;
    this.isStarted = true;

    // Stage 1: Only change UI state, do not request any permissions yet
    if (this.startButton) {
      this.startButton.classList.add('active');
      this.startButton.disabled = true;
      this.startButton.innerHTML = '<span class="btn-text">Ready</span>';
    }

    if (this.actionHint) {
      this.actionHint.textContent = 'Ready. Awaiting WebRTC transmission link...';
    }

    console.log('[PhoneApp] User clicked start. Ready for next phase.');
  }
}

// Initialize when DOM is ready without crashing
window.addEventListener('DOMContentLoaded', () => {
  try {
    window.phoneApp = new PhoneApp();
  } catch (err) {
    console.error('[PhoneApp] Fatal initialization prevented:', err);
  }
});
