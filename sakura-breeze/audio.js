/**
 * Sakura Breeze AR - Audio Analysis Engine
 * class AudioManager
 * Stage 5: iPhone Microphone -> WebRTC Audio Track -> AudioContext AnalyserNode -> windStrength (0-1)
 *
 * CRITICAL SAFETY RULES:
 * 1. DO NOT connect AnalyserNode to audioContext.destination (NEVER play remote audio to prevent acoustic feedback)
 * 2. Purely passive real-time analysis of remote audio stream
 */

class AudioManager {
  constructor(options = {}) {
    this.onUpdate = options.onUpdate || null;
    this.onStatusChange = options.onStatusChange || null;

    this.audioContext = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.stream = null;
    this.timeDomainData = null;
    this.rafId = null;

    // Metrics
    this.rawRMS = 0;
    this.smoothedVolume = 0;
    this.windStrength = 0;

    // Adaptive noise floor calibration
    this.noiseFloor = 0.01;
    this.calibrationSamples = [];
    this.calibrationDurationFrames = 90; // ~1.5s at 60fps
    this.isCalibrating = true;

    // Audio dynamics tuning
    this.sensitivity = 0.14; // RMS level for strong voice
    this.attack = 0.32;      // Fast attack: wind rises promptly when speaking
    this.decay = 0.045;      // Slow decay: wind gently lingers after speaking

    // Status: 'WAITING' | 'RECEIVING' | 'ANALYZING' | 'SUSPENDED' | 'UNAVAILABLE'
    this.status = 'WAITING';
  }

  /**
   * Sets current analysis status and notifies listener
   */
  setStatus(status) {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  /**
   * Lazy-initializes AudioContext on the MacBook
   */
  getAudioContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        console.warn('[AudioManager] Web Audio API is not supported in this browser.');
        this.setStatus('UNAVAILABLE');
        return null;
      }
      this.audioContext = new AudioCtx();
    }
    return this.audioContext;
  }

  /**
   * Resumes AudioContext if suspended by browser autoplay policy
   */
  async resume() {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        console.log('[AudioManager] AudioContext resumed successfully.');
        if (this.stream) {
          this.setStatus('ANALYZING');
        }
      } catch (err) {
        console.warn('[AudioManager] Failed to resume AudioContext:', err);
      }
    }
  }

  /**
   * Attaches remote audio stream received over WebRTC and configures AnalyserNode
   * CRITICAL: Never connects to audioContext.destination!
   */
  attachStream(stream) {
    if (!stream || !stream.getAudioTracks().length) {
      console.warn('[AudioManager] Invalid or empty audio stream received.');
      this.setStatus('UNAVAILABLE');
      return;
    }

    this.stream = stream;
    this.setStatus('RECEIVING');

    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Check if AudioContext is suspended
    if (ctx.state === 'suspended') {
      this.setStatus('SUSPENDED');
    }

    try {
      // Disconnect previous node if any
      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch (_) {}
      }

      // Create stream source
      this.sourceNode = ctx.createMediaStreamSource(stream);

      // Create AnalyserNode
      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.3;

      // Connect source to analyser ONLY!
      // STRICT REQUIREMENT: DO NOT connect to ctx.destination!
      this.sourceNode.connect(this.analyserNode);

      this.timeDomainData = new Float32Array(this.analyserNode.fftSize);

      // Reset noise calibration
      this.calibrationSamples = [];
      this.isCalibrating = true;

      if (ctx.state === 'running') {
        this.setStatus('ANALYZING');
      }

      this.startLoop();
      console.log('[AudioManager] Remote audio stream attached to AnalyserNode. Output strictly muted.');
    } catch (err) {
      console.error('[AudioManager] Error setting up audio analysis pipeline:', err);
      this.setStatus('UNAVAILABLE');
    }
  }

  /**
   * Starts requestAnimationFrame loop for continuous RMS & windStrength computation
   */
  startLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const tick = () => {
      this.analyzeFrame();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Computes RMS, noise-floor subtraction, nonlinear normalization, and attack/decay
   */
  analyzeFrame() {
    if (!this.analyserNode || !this.timeDomainData) return;

    if (this.audioContext && this.audioContext.state === 'running' && this.status === 'SUSPENDED') {
      this.setStatus('ANALYZING');
    }

    this.analyserNode.getFloatTimeDomainData(this.timeDomainData);

    // 1. Compute RMS = sqrt( sum(sample^2) / sampleCount )
    let sumSquares = 0;
    const len = this.timeDomainData.length;
    for (let i = 0; i < len; i++) {
      const s = this.timeDomainData[i];
      sumSquares += s * s;
    }
    const rms = Math.sqrt(sumSquares / len);
    this.rawRMS = Number.isFinite(rms) ? rms : 0;

    // 2. Adaptive noise floor calibration (first ~1.5s)
    if (this.isCalibrating) {
      this.calibrationSamples.push(this.rawRMS);
      if (this.calibrationSamples.length >= this.calibrationDurationFrames) {
        this.calibrationSamples.sort((a, b) => a - b);
        const p25Index = Math.floor(this.calibrationSamples.length * 0.25);
        const baseline = this.calibrationSamples[p25Index] || 0.01;
        this.noiseFloor = Math.max(0.005, Math.min(0.035, baseline * 1.15));
        this.isCalibrating = false;
        console.log(`[AudioManager] Ambient noise floor calibrated: ${this.noiseFloor.toFixed(4)}`);
      }
    }

    // 3. Noise floor subtraction
    const effectiveVolume = Math.max(0, this.rawRMS - this.noiseFloor);

    // 4. Normalized volume
    const normalized = Math.min(1, Math.max(0, effectiveVolume / this.sensitivity));

    // Nonlinear curve: pow(0.75) boosts conversational voice sensitivity
    const targetWind = Math.min(1, Math.max(0, Math.pow(normalized, 0.75)));

    // Smoothed volume for visual reference
    this.smoothedVolume = this.smoothedVolume + (normalized - this.smoothedVolume) * 0.15;

    // 5. Fast attack & Slow decay dynamics
    if (targetWind > this.windStrength) {
      this.windStrength += (targetWind - this.windStrength) * this.attack;
    } else {
      this.windStrength += (targetWind - this.windStrength) * this.decay;
    }

    // Finite clamping (0 - 1)
    this.windStrength = Math.min(1, Math.max(0, Number.isFinite(this.windStrength) ? this.windStrength : 0));
    this.smoothedVolume = Math.min(1, Math.max(0, Number.isFinite(this.smoothedVolume) ? this.smoothedVolume : 0));

    // Dispatch update to UI
    if (this.onUpdate) {
      this.onUpdate({
        rawRMS: this.rawRMS,
        smoothedVolume: this.smoothedVolume,
        windStrength: this.windStrength,
        noiseFloor: this.noiseFloor,
        status: this.status
      });
    }
  }

  /**
   * Resets audio manager, disconnects nodes, and resets values to zero
   */
  reset() {
    console.log('[AudioManager] Resetting audio state...');
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
      this.sourceNode = null;
    }

    this.analyserNode = null;
    this.stream = null;
    this.timeDomainData = null;

    this.rawRMS = 0;
    this.smoothedVolume = 0;
    this.windStrength = 0;
    this.noiseFloor = 0.01;
    this.calibrationSamples = [];
    this.isCalibrating = true;

    this.setStatus('WAITING');

    if (this.onUpdate) {
      this.onUpdate({
        rawRMS: 0,
        smoothedVolume: 0,
        windStrength: 0,
        noiseFloor: 0.01,
        status: 'WAITING'
      });
    }
  }
}

// Export to window
window.AudioManager = AudioManager;
