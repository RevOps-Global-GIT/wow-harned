const CLICK_VOL_KEY = 'flipoff_click_vol';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._initialized = false;

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
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Synchronous resume + silent play to unlock iOS audio
      this.ctx.resume();
      const silent = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = silent;
      src.connect(this.ctx.destination);
      src.start();
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
   * Synthesize a split-flap board transition sound.
   * Creates a rapid series of mechanical clicks using noise bursts
   * with resonant filtering — no external audio files needed.
   */
  playTransition() {
    if (!this.ctx || this.muted) return;
    this.resume();

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = this.clickVolume * 0.6;
    master.connect(ctx.destination);

    // Number of individual flap clicks in the cascade
    const numClicks = 20 + Math.floor(Math.random() * 10);
    const totalDuration = 2.5; // seconds for full cascade

    for (let i = 0; i < numClicks; i++) {
      // Stagger clicks: dense at start, sparse at end
      const t = (i / numClicks);
      const clickTime = now + t * t * totalDuration;

      // Each click: short noise burst through resonant filter
      const bufLen = Math.floor(ctx.sampleRate * (0.008 + Math.random() * 0.012));
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufLen; j++) {
        data[j] = (Math.random() * 2 - 1) * (1 - j / bufLen);
      }

      const source = ctx.createBufferSource();
      source.buffer = buf;

      // Resonant bandpass gives it a wooden/plastic character
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 800 + Math.random() * 2000;
      bp.Q.value = 2 + Math.random() * 6;

      // Volume envelope: louder clicks at the start
      const clickGain = ctx.createGain();
      const amplitude = 0.3 + 0.7 * (1 - t);
      clickGain.gain.setValueAtTime(amplitude, clickTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.03);

      source.connect(bp);
      bp.connect(clickGain);
      clickGain.connect(master);

      source.start(clickTime);
      source.stop(clickTime + 0.05);
    }

    // Subtle tail resonance (the board settling)
    const tailLen = ctx.sampleRate * 0.3;
    const tailBuf = ctx.createBuffer(1, tailLen, ctx.sampleRate);
    const tailData = tailBuf.getChannelData(0);
    for (let i = 0; i < tailLen; i++) {
      tailData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / tailLen, 3);
    }
    const tailSrc = ctx.createBufferSource();
    tailSrc.buffer = tailBuf;
    const tailFilter = ctx.createBiquadFilter();
    tailFilter.type = 'lowpass';
    tailFilter.frequency.value = 600;
    const tailGain = ctx.createGain();
    tailGain.gain.value = 0.15;
    tailSrc.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(master);
    tailSrc.start(now + totalDuration * 0.7);
  }

  getTransitionDuration() {
    return 3800;
  }

  scheduleFlaps() {
    this.playTransition();
  }
}
