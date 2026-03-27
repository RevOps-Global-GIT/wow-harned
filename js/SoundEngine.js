import { FLAP_AUDIO_BASE64 } from './flapAudio.js';

const CLICK_VOL_KEY = 'flipoff_click_vol';

// Short MP3 with actual audio energy (not silence!) to force iOS
// audio session from "ambient" (respects mute switch) to "playback"
// (ignores mute switch). A truly silent file does NOT trigger the switch.
const UNLOCK_MP3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRBqpAAAAAAD/+1DEAAAH+AJX9AAAIiMGSz8wAABFgBAAKAAHBAEDPnPggCAIHJKAgGP8oCAJ/y4f/Lh/8uH4IAQBD6gICAYPl3/5c//BAEHwfB8oCCoBh+X//y7///ggCAJwfUBAQDAMf////4IAgCcH1AQEAx/////+CAIAnB9QEBAMP/////ggCAIAfB8=';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._initialized = false;
    this._audioBuffer = null;
    this._currentSource = null;

    try {
      const saved = localStorage.getItem(CLICK_VOL_KEY);
      this.clickVolume = saved !== null ? parseFloat(saved) : 0.15;
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
      // Use pre-unlocked AudioContext from inline script if available
      if (window.__audioCtx) {
        this.ctx = window.__audioCtx;
      } else {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.ctx.resume();
      }

      // Decode the flap MP3
      const binaryStr = atob(FLAP_AUDIO_BASE64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      this.ctx.decodeAudioData(bytes.buffer.slice(0))
        .then(decoded => { this._audioBuffer = decoded; })
        .catch(() => { this._createSyntheticFlap(); });

      // Auto-resume after interruptions
      this.ctx.addEventListener('statechange', () => {
        if (this.ctx.state === 'interrupted' || this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      });
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  _createSyntheticFlap() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 3.5);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let c = 0; c < 25; c++) {
      const t = c / 25;
      const pos = Math.floor(t * t * len * 0.7);
      const cLen = Math.floor(sr * (0.005 + Math.random() * 0.01));
      const amp = 0.3 + 0.5 * (1 - t);
      for (let j = 0; j < cLen && pos + j < len; j++) {
        data[pos + j] += (Math.random() * 2 - 1) * amp * (1 - j / cLen);
      }
    }
    this._audioBuffer = buf;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    // Immediately stop any playing sound when muting
    if (this.muted && this._currentSource) {
      try { this._currentSource.stop(); } catch {}
      this._currentSource = null;
    }
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
      if (this._currentSource === source) this._currentSource = null;
    };
  }

  getTransitionDuration() {
    return this._audioBuffer ? this._audioBuffer.duration * 1000 : 3800;
  }

  scheduleFlaps() {
    this.playTransition();
  }
}
