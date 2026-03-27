import { CROWD_MURMUR_BASE64 } from './crowdAudio.js';
import { PIANO_JAZZ_BASE64 } from './pianoAudio.js';

const STORAGE_KEY = 'flipoff_ambient';
const AMBIENT_VOL_KEY = 'flipoff_ambient_vol';
const MURMUR_KEY = 'flipoff_murmur';
const MURMUR_VOL_KEY = 'flipoff_murmur_vol';

export class AmbientEngine {
  constructor(soundEngine) {
    this.soundEngine = soundEngine;
    this.enabled = this._loadState();
    try {
      const saved = localStorage.getItem(AMBIENT_VOL_KEY);
      this.volume = saved !== null ? parseFloat(saved) : 0.6;
    } catch { this.volume = 0.6; }

    try {
      const mv = localStorage.getItem(MURMUR_KEY);
      this.murmurEnabled = mv === null ? false : mv === 'true';
    } catch { this.murmurEnabled = false; }
    try {
      const mvol = localStorage.getItem(MURMUR_VOL_KEY);
      this.murmurVolume = mvol !== null ? parseFloat(mvol) : 0.5;
    } catch { this.murmurVolume = 0.5; }

    this._running = false;
    this._masterGain = null;
    this._pianoSource = null;
    this._pianoGain = null;
    this._murmurSource = null;
    this._murmurGain = null;
    this._murmurSources = [];
  }

  _loadState() {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      return val === null ? false : val === 'true';
    } catch { return false; }
  }

  _saveState() {
    localStorage.setItem(STORAGE_KEY, String(this.enabled));
  }

  setVolume(val) {
    this.volume = val;
    localStorage.setItem(AMBIENT_VOL_KEY, String(val));
    if (this._masterGain) {
      const ctx = this.soundEngine.ctx;
      if (ctx) this._masterGain.gain.linearRampToValueAtTime(val, ctx.currentTime + 0.1);
    }
  }

  setMurmurVolume(val) {
    this.murmurVolume = val;
    localStorage.setItem(MURMUR_VOL_KEY, String(val));
    if (this._murmurGain) {
      const ctx = this.soundEngine.ctx;
      if (ctx) this._murmurGain.gain.linearRampToValueAtTime(val, ctx.currentTime + 0.1);
    }
  }

  toggleMurmur() {
    this.murmurEnabled = !this.murmurEnabled;
    localStorage.setItem(MURMUR_KEY, String(this.murmurEnabled));

    if (this.murmurEnabled) {
      if (!this._running) {
        this.enabled = true;
        this._saveState();
        this.start();
      }
      if (this._running) {
        this._startMurmur();
      }
    } else if (this._running) {
      this._stopMurmur();
    }

    return this.murmurEnabled;
  }

  toggle() {
    this.enabled = !this.enabled;
    this._saveState();
    if (this.enabled) {
      this.start();
    } else {
      this.stop();
    }
    return this.enabled;
  }

  // Decode base64 audio into an AudioBuffer
  _decodeBase64(ctx, base64) {
    return new Promise((resolve, reject) => {
      try {
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        ctx.decodeAudioData(bytes.buffer.slice(0))
          .then(resolve)
          .catch(reject);
      } catch (e) { reject(e); }
    });
  }

  async start() {
    if (this._running || !this.enabled) return;
    const ctx = this.soundEngine.ctx;
    if (!ctx) return;

    this._running = true;

    // Master gain with fade-in
    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = 0;
    this._masterGain.connect(ctx.destination);
    this._masterGain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 3);

    // --- Piano jazz (real recording, looped) ---
    try {
      const pianoBuffer = await this._decodeBase64(ctx, PIANO_JAZZ_BASE64);
      this._pianoGain = ctx.createGain();
      this._pianoGain.gain.value = 0.7;
      this._pianoGain.connect(this._masterGain);

      this._pianoSource = ctx.createBufferSource();
      this._pianoSource.buffer = pianoBuffer;
      this._pianoSource.loop = true;
      this._pianoSource.connect(this._pianoGain);
      this._pianoSource.start();
    } catch (e) {
      console.warn('Piano decode failed:', e);
    }

    // Start murmur if enabled
    if (this.murmurEnabled) {
      this._startMurmur();
    }
  }

  stop() {
    this._running = false;

    const ctx = this.soundEngine.ctx;
    if (!ctx) return;

    if (this._masterGain) {
      this._masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      setTimeout(() => {
        try { this._pianoSource?.stop(); } catch {}
        this._murmurSources.forEach(s => { try { s.stop(); } catch {} });
        this._murmurSources = [];
        this._pianoSource = null;
        this._murmurGain = null;
        this._masterGain?.disconnect();
        this._masterGain = null;
      }, 2000);
    }
  }

  // --- Crowd murmur (real recording, looped) ---

  async _startMurmur() {
    const ctx = this.soundEngine.ctx;
    if (!ctx || !this._masterGain) return;

    this._murmurGain = ctx.createGain();
    this._murmurGain.gain.value = 0;
    this._murmurGain.connect(this._masterGain);
    this._murmurGain.gain.linearRampToValueAtTime(this.murmurVolume, ctx.currentTime + 2);

    try {
      const buffer = await this._decodeBase64(ctx, CROWD_MURMUR_BASE64);
      if (!this._murmurGain) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this._murmurGain);
      source.start();
      this._murmurSources.push(source);
    } catch (e) {
      console.warn('Murmur decode failed:', e);
    }
  }

  _stopMurmur() {
    if (this._murmurGain) {
      const ctx = this.soundEngine.ctx;
      if (ctx) {
        this._murmurGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      }
      setTimeout(() => {
        this._murmurSources.forEach(s => { try { s.stop(); } catch {} });
        this._murmurSources = [];
        this._murmurGain?.disconnect();
        this._murmurGain = null;
      }, 2000);
    }
  }
}
