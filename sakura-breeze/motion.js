/**
 * Sakura Breeze AR - Motion Telemetry & Normalization Engine
 * class MotionManager
 * Phase 6: iPhone Motion Sensors -> RTCDataChannel "sakura" -> MacBook MotionManager
 *
 * Responsibilities:
 * 1. Ingests 30Hz JSON motion telemetry packets from iPhone via WebRTC RTCDataChannel "sakura".
 * 2. Safely handles missing/null values from iOS Safari DeviceOrientation & DeviceMotion events.
 * 3. Applies low-pass smoothing (Exponential Moving Average) with proper 0-360° angular wrapping.
 * 4. Normalizes pitch, roll, yaw, and computes tilt magnitude & dynamic shake intensity.
 * 5. Computes live sample frequency (Hz) and packet statistics.
 * 6. Invokes callbacks for UI rendering and future Sakura petal physics.
 */

class MotionManager {
  /**
   * @param {Object} options
   * @param {Function} [options.onMotionUpdate] - Callback invoked with normalized motion metrics
   * @param {Function} [options.onStatusChange] - Callback invoked with motion streaming status
   * @param {number} [options.smoothingFactor=0.25] - Low-pass filter alpha (0: stiff, 1: instant)
   */
  constructor(options = {}) {
    this.onMotionUpdate = options.onMotionUpdate || null;
    this.onStatusChange = options.onStatusChange || null;
    this.smoothingFactor = typeof options.smoothingFactor === 'number' ? options.smoothingFactor : 0.28;

    // Stream status: 'WAITING' | 'STREAMING' | 'STALE' | 'DISCONNECTED'
    this.status = 'WAITING';

    // Packet tracking & Hz calculation
    this.packetCount = 0;
    this.lastPacketTime = 0;
    this.packetTimestamps = [];
    this.currentHz = 0;
    this.staleTimeout = null;

    // Raw sensor values
    this.raw = {
      alpha: 0, // Yaw: 0 to 360
      beta: 0,  // Pitch: -180 to 180
      gamma: 0, // Roll: -90 to 90
      accX: 0,
      accY: 0,
      accZ: 0,
      rotAlpha: 0,
      rotBeta: 0,
      rotGamma: 0
    };

    // Smoothed values (Low-pass filtered)
    this.smoothed = {
      alpha: 0,
      beta: 0,
      gamma: 0,
      accX: 0,
      accY: 0,
      accZ: 0
    };

    // Normalized values
    this.normalized = {
      pitch: 0,         // -1 (backward tilt) to +1 (forward tilt)
      roll: 0,          // -1 (left tilt) to +1 (right tilt)
      yaw: 0,           // 0 to 1 (normalized heading)
      tiltMagnitude: 0, // 0 (flat) to 1 (extreme tilt)
      shakeIntensity: 0 // 0 (still) to 1 (active shake/gesture)
    };

    // Acceleration delta for shake detection
    this.prevAcc = { x: 0, y: 0, z: 0 };
    this.initialized = false;
  }

  /**
   * Ingests motion telemetry packet received over DataChannel
   * @param {string|Object} data - Raw JSON string or parsed object
   */
  handleMessage(data) {
    let payload = data;
    if (typeof data === 'string') {
      try {
        payload = JSON.parse(data);
      } catch (err) {
        console.warn('[MotionManager] Failed to parse motion message:', err);
        return;
      }
    }

    if (!payload || payload.type !== 'motion') {
      return;
    }

    const now = performance.now();
    this.packetCount++;

    // Track sample frequency (Hz) using sliding window
    this.packetTimestamps.push(now);
    // Keep timestamps from the last 1000ms
    const oneSecondAgo = now - 1000;
    while (this.packetTimestamps.length > 0 && this.packetTimestamps[0] < oneSecondAgo) {
      this.packetTimestamps.shift();
    }
    this.currentHz = this.packetTimestamps.length;
    this.lastPacketTime = now;

    // Update status to STREAMING
    if (this.status !== 'STREAMING') {
      this.updateStatus('STREAMING');
    }

    // Schedule stale detection watchdog
    if (this.staleTimeout) clearTimeout(this.staleTimeout);
    this.staleTimeout = setTimeout(() => {
      if (this.status === 'STREAMING') {
        this.updateStatus('STALE');
        this.currentHz = 0;
        this.emitUpdate();
      }
    }, 2000);

    // Extract & sanitize orientation safely (handling nulls)
    const ori = payload.orientation || {};
    const rawAlpha = this.sanitizeNumber(ori.alpha, 0);
    const rawBeta = this.sanitizeNumber(ori.beta, 0);
    const rawGamma = this.sanitizeNumber(ori.gamma, 0);

    // Extract & sanitize acceleration safely
    const acc = payload.acceleration || {};
    const rawAccX = this.sanitizeNumber(acc.x, 0);
    const rawAccY = this.sanitizeNumber(acc.y, 0);
    const rawAccZ = this.sanitizeNumber(acc.z, 0);

    // Extract rotationRate safely
    const rot = payload.rotationRate || {};
    const rotAlpha = this.sanitizeNumber(rot.alpha, 0);
    const rotBeta = this.sanitizeNumber(rot.beta, 0);
    const rotGamma = this.sanitizeNumber(rot.gamma, 0);

    this.raw = {
      alpha: rawAlpha,
      beta: rawBeta,
      gamma: rawGamma,
      accX: rawAccX,
      accY: rawAccY,
      accZ: rawAccZ,
      rotAlpha,
      rotBeta,
      rotGamma
    };

    // First sample initialization
    if (!this.initialized) {
      this.smoothed.alpha = rawAlpha;
      this.smoothed.beta = rawBeta;
      this.smoothed.gamma = rawGamma;
      this.smoothed.accX = rawAccX;
      this.smoothed.accY = rawAccY;
      this.smoothed.accZ = rawAccZ;
      this.prevAcc = { x: rawAccX, y: rawAccY, z: rawAccZ };
      this.initialized = true;
    } else {
      const k = this.smoothingFactor;

      // Smooth Pitch (Beta: -180 to 180)
      this.smoothed.beta += k * (rawBeta - this.smoothed.beta);

      // Smooth Roll (Gamma: -90 to 90)
      this.smoothed.gamma += k * (rawGamma - this.smoothed.gamma);

      // Smooth Yaw (Alpha: 0 to 360 with angular wrapping)
      let diffAlpha = (rawAlpha - this.smoothed.alpha + 540) % 360 - 180;
      this.smoothed.alpha = (this.smoothed.alpha + k * diffAlpha + 360) % 360;

      // Smooth Acceleration
      this.smoothed.accX += k * (rawAccX - this.smoothed.accX);
      this.smoothed.accY += k * (rawAccY - this.smoothed.accY);
      this.smoothed.accZ += k * (rawAccZ - this.smoothed.accZ);
    }

    // Normalization
    // Pitch: normal mobile portrait upright is ~90deg beta; clamp -90 to +90 as -1 to +1
    const clampedBeta = Math.max(-90, Math.min(90, this.smoothed.beta));
    this.normalized.pitch = Number((clampedBeta / 90).toFixed(3));

    // Roll: clamp -90 to +90 as -1 to +1
    const clampedGamma = Math.max(-90, Math.min(90, this.smoothed.gamma));
    this.normalized.roll = Number((clampedGamma / 90).toFixed(3));

    // Yaw: 0 to 1
    this.normalized.yaw = Number((this.smoothed.alpha / 360).toFixed(3));

    // Tilt magnitude: 0 (level) to 1 (tilted 90 degrees or more)
    const tiltMag = Math.sqrt(
      this.normalized.pitch * this.normalized.pitch +
      this.normalized.roll * this.normalized.roll
    );
    this.normalized.tiltMagnitude = Number(Math.min(1, tiltMag).toFixed(3));

    // Dynamic Shake / Jerk calculation
    const deltaX = rawAccX - this.prevAcc.x;
    const deltaY = rawAccY - this.prevAcc.y;
    const deltaZ = rawAccZ - this.prevAcc.z;
    const jerk = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
    this.prevAcc = { x: rawAccX, y: rawAccY, z: rawAccZ };

    // Decay previous shake and inject new jerk if significant
    const rawShake = jerk > 2.5 ? Math.min(1, (jerk - 2.5) / 12) : 0;
    this.normalized.shakeIntensity = Number(
      Math.min(1, Math.max(0, this.normalized.shakeIntensity * 0.82 + rawShake * 0.18)).toFixed(3)
    );

    this.emitUpdate();
  }

  /**
   * Helper to safely sanitize numbers from sensors
   */
  sanitizeNumber(val, fallback = 0) {
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
      return fallback;
    }
    return val;
  }

  /**
   * Updates internal streaming status and notifies listener
   */
  updateStatus(newStatus) {
    this.status = newStatus;
    if (this.onStatusChange) {
      this.onStatusChange(this.status);
    }
  }

  /**
   * Emits latest motion update to listener
   */
  emitUpdate() {
    if (this.onMotionUpdate) {
      this.onMotionUpdate(this.getState());
    }
  }

  /**
   * Returns current snapshot of all motion telemetry
   */
  getState() {
    return {
      status: this.status,
      hz: this.currentHz,
      packetCount: this.packetCount,
      raw: { ...this.raw },
      smoothed: { ...this.smoothed },
      normalized: { ...this.normalized }
    };
  }

  /**
   * Resets all state and statistics
   */
  reset() {
    if (this.staleTimeout) {
      clearTimeout(this.staleTimeout);
      this.staleTimeout = null;
    }

    this.packetCount = 0;
    this.lastPacketTime = 0;
    this.packetTimestamps = [];
    this.currentHz = 0;
    this.initialized = false;

    this.raw = {
      alpha: 0,
      beta: 0,
      gamma: 0,
      accX: 0,
      accY: 0,
      accZ: 0,
      rotAlpha: 0,
      rotBeta: 0,
      rotGamma: 0
    };

    this.smoothed = {
      alpha: 0,
      beta: 0,
      gamma: 0,
      accX: 0,
      accY: 0,
      accZ: 0
    };

    this.normalized = {
      pitch: 0,
      roll: 0,
      yaw: 0,
      tiltMagnitude: 0,
      shakeIntensity: 0
    };

    this.updateStatus('WAITING');
    this.emitUpdate();
  }
}

// Attach to window for script inclusion
if (typeof window !== 'undefined') {
  window.MotionManager = MotionManager;
}
