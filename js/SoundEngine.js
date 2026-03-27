import { FLAP_AUDIO_BASE64 } from './flapAudio.js';

const CLICK_VOL_KEY = 'flipoff_click_vol';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._initialized = false;
    this._audioBuffer = null;
    this._currentSource = null;

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

  async init() {
    if (this._initialized) return;
    this._initialized = true;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Resume immediately within user gesture (required on iOS)
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      // Play a silent buffer to fully unlock iOS audio
      const silentBuffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const silentSource = this.ctx.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(this.ctx.destination);
      silentSource.start();

      // Decode the embedded audio clip
      const binaryStr = atob(FLAP_AUDIO_BASE64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      // Use copy of buffer since decodeAudioData detaches the original
      this._audioBuffer = await this.ctx.decodeAudioData(bytes.buffer.slice(0));
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
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

  /**
   * Play the full transition sound once.
   * This is a single recorded clip of a split-flap board transition,
   * played once per message change (not per tile).
   */
  playTransition() {
    if (!this.ctx || !this._audioBuffer || this.muted) return;
    this.resume();

    // Stop any currently playing transition sound
    if (this._currentSource) {
      try {
        this._currentSource.stop();
      } catch (e) {
        // ignore if already stopped
      }
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

  /** Get the duration of the transition audio clip in ms */
  getTransitionDuration() {
    if (this._audioBuffer) {
      return this._audioBuffer.duration * 1000;
    }
    return 3800; // fallback
  }

  // Keep this for API compatibility but it now plays the full transition
  scheduleFlaps() {
    this.playTransition();
  }
}
