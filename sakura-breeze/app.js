/**
 * Sakura Breeze AR - MacBook Main Screen
 * class MacApp
 * Stage 1: Native connection environment & diagnostics
 */
class MacApp {
  constructor() {
    this.statusElement = document.getElementById('connection-status');
    this.arStatusElement = document.getElementById('ar-status');
    this.httpsWarning = document.getElementById('https-warning');

    this.diagBrowser = document.getElementById('diag-browser');
    this.diagHttps = document.getElementById('diag-https');
    this.diagOnline = document.getElementById('diag-online');

    this.arRenderer = null;
    this.diagnostics = null;
    this.init();
  }

  init() {
    // 1. Connection status initialization
    this.updateStatus('WAITING FOR IPHONE');

    // 2. Initialize AR Renderer
    if (typeof ARRenderer !== 'undefined') {
      try {
        this.arRenderer = new ARRenderer();
        if (this.arStatusElement && typeof this.arRenderer.getStatus === 'function') {
          this.arStatusElement.textContent = this.arRenderer.getStatus();
        }
      } catch (err) {
        console.warn('[MacApp] ARRenderer init failed safely:', err);
      }
    }

    // 3. Initialize Network Diagnostics
    if (typeof NetworkDiagnostics !== 'undefined') {
      this.diagnostics = new NetworkDiagnostics({
        onStatusChange: (report) => this.renderDiagnostics(report)
      });
      this.renderDiagnostics(this.diagnostics.getReport());
    }

    console.log('[MacApp] Initialized successfully. Status: WAITING FOR IPHONE');
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

    // Protocol check: show warning if not HTTPS
    if (this.httpsWarning) {
      if (!report.isHttps) {
        this.httpsWarning.style.display = 'block';
      } else {
        this.httpsWarning.style.display = 'none';
      }
    }
  }

  updateStatus(status) {
    if (this.statusElement) {
      this.statusElement.textContent = status;
    }
  }
}

// Initialize when DOM is ready without crashing
window.addEventListener('DOMContentLoaded', () => {
  try {
    window.macApp = new MacApp();
  } catch (err) {
    console.error('[MacApp] Fatal initialization prevented:', err);
  }
});
