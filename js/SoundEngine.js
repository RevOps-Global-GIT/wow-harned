import { FLAP_AUDIO_BASE64 } from './flapAudio.js';

const CLICK_VOL_KEY = 'flipoff_click_vol';

// Tiny silent WAV to unlock iOS audio session (bypasses mute switch)
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._initialized = false;
    this._audioBuffer = null;
    this._currentSource = null;
    this._ready = false;

    try {
      const saved = localStorage.getItem(CLICK_VOL_KEY);
      this.clickVolume = saved !== null ? parseFloat(saved) : 0.8;
    } catch {
      this.clickVolume = 0.8;
    }
  }

  setClickVolume(val) {
    this.clickVolume = val;
    localStorage.setItem(CLICK_VOL_KEY, String(val));
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    try {
      // Step 1: Play an HTML Audio element to unlock iOS audio session
      // This makes audio work even when the silent/mute switch is on
      const unlock = new Audio(SILENT_WAV);
      unlock.setAttribute('playsinline', '');
      unlock.play().catch(() => {});

      // Step 2: Create AudioContext synchronously within gesture
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx.resume();

      // Step 3: Play silent buffer through AudioContext to fully unlock it
      const silentBuf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const silentSrc = this.ctx.createBufferSource();
      silentSrc.buffer = silentBuf;
      silentSrc.connect(this.ctx.destination);
      silentSrc.start();

      // Step 4: Decode the flap audio (async, non-blocking)
      const binaryStr = atob(FLAP_AUDIO_BASE64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      this.ctx.decodeAudioData(
        bytes.buffer.slice(0),
        (buf) => {
          this._audioBuffer = buf;
          this._ready = true;
        },
        (e) => {
          console.warn('Flap audio decode failed:', e);
          // Fallback: generate a synthetic click buffer
          this._createSyntheticFlap();
        }
      );
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  /** Fallback: create a synthetic flap sound if MP3 decode fails */
  _createSyntheticFlap() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const duration = 3.5;
    const len = Math.floor(sr * duration);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);

    const numClicks = 25;
    for (let c = 0; c < numClicks; c++) {
      const t = c / numClicks;
      const clickSample = Math.floor(t * t * len * 0.7);
      const clickLen = Math.floor(sr * (0.005 + Math.random() * 0.01));
      const amp = 0.3 + 0.5 * (1 - t);
      for (let j = 0; j < clickLen && clickSample + j < len; j++) {
        data[clickSample + j] += (Math.random() * 2 - 1) * amp * (1 - j / clickLen);
      }
    }

    this._audioBuffer = buf;
    this._ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTransition() {
    if (!this.ctx || !this._audioBuffer || this.muted) return;
    this.resume();

    if (this._currentSource) {
      try { this._currentSource.stop(); } catch {}
    }

    const source = this.ctx.createBufferSource();
    source.buffer = this._audioBuffer;

    const gain = this.ctx.createGain();
    gain.gain.value = this.clickVolume;

    source.connect(gain);
    gain.connect(this.ctx.destination);

    source.start(0);
    this._currentSource = source;

    source.onended = () => {
      if (this._currentSource === source) {
        this._currentSource = null;
      }
    };
  }

  getTransitionDuration() {
    if (this._audioBuffer) {
      return this._audioBuffer.duration * 1000;
    }
    return 3800;
  }

  scheduleFlaps() {
    this.playTransition();
  }
}
