/**
 * Sakura Breeze AR - Network Diagnostics
 * Evaluates browser, protocol (HTTPS), and network connectivity.
 * Note: JavaScript cannot directly access USB hardware.
 * USB-C establishes a local IP network (e.g. Ethernet / Hotspot tethering) between devices.
 */
class NetworkDiagnostics {
  constructor(options = {}) {
    this.onStatusChange = options.onStatusChange || null;
    this.initListeners();
  }

  /**
   * Detect the current browser family from userAgent.
   * @returns {string} e.g. "Safari", "Chrome", "Firefox", "Edge", or "Other Browser"
   */
  getBrowser() {
    const ua = navigator.userAgent;
    if (/CriOS/i.test(ua)) {
      return 'Chrome (iOS)';
    }
    if (/FxiOS/i.test(ua)) {
      return 'Firefox (iOS)';
    }
    if (/EdgiOS/i.test(ua) || /Edg\//i.test(ua)) {
      return 'Edge';
    }
    if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
      return 'Chrome';
    }
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua) && !/CriOS/i.test(ua)) {
      return 'Safari';
    }
    if (/Firefox\//i.test(ua)) {
      return 'Firefox';
    }
    return 'Modern Browser';
  }

  /**
   * Check if current protocol is secure (HTTPS or local development)
   * @returns {boolean}
   */
  isHttps() {
    return window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  /**
   * Strict HTTPS check (for GitHub Pages deployment)
   * @returns {boolean}
   */
  isStrictHttps() {
    return window.location.protocol === 'https:';
  }

  /**
   * Check navigator online status
   * @returns {boolean}
   */
  isOnline() {
    return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  }

  /**
   * Get full report
   * @returns {Object}
   */
  getReport() {
    const browser = this.getBrowser();
    const isHttps = this.isHttps();
    const online = this.isOnline();

    return {
      browser,
      protocol: window.location.protocol,
      isHttps,
      isStrictHttps: this.isStrictHttps(),
      online,
      httpsText: isHttps ? 'YES' : 'NO',
      onlineText: online ? 'YES' : 'NO',
      isSecureContext: window.isSecureContext === true
    };
  }

  /**
   * Listen to network status events
   */
  initListeners() {
    window.addEventListener('online', () => {
      if (typeof this.onStatusChange === 'function') {
        this.onStatusChange(this.getReport());
      }
    });

    window.addEventListener('offline', () => {
      if (typeof this.onStatusChange === 'function') {
        this.onStatusChange(this.getReport());
      }
    });
  }
}

// Global exposure for browser environment
if (typeof window !== 'undefined') {
  window.NetworkDiagnostics = NetworkDiagnostics;
}
