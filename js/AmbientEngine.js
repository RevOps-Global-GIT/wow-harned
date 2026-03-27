import { CROWD_MURMUR_BASE64 } from './crowdAudio.js';
import { PIANO_JAZZ_BASE64 } from './pianoAudio.js';
import { AMBIENT_ENO_BASE64, PIANO_SATIE_BASE64 } from './extraAudio.js';

const STORAGE_KEY = 'flipoff_ambient';
const AMBIENT_VOL_KEY = 'flipoff_ambient_vol';
const MURMUR_KEY = 'flipoff_murmur';
const MURMUR_VOL_KEY = 'flipoff_murmur_vol';
const MUSIC_KEY = 'flipoff_music_choice';
const CLICK_VOL_KEY = 'flipoff_click_vol';

// Available music tracks
const MUSIC_TRACKS = {
  'piano-jazz': { label: 'Cafe Piano', getBase64: () => PIANO_JAZZ_BASE64 },
  'piano-satie': { label: 'Contemplative Piano', getBase64: () => PIANO_SATIE_BASE64 },
  'ambient-eno': { label: 'Ambient Pads', getBase64: () => AMBIENT_ENO_BASE64 },
};

export const MUSIC_TRACK_OPTIONS = Object.entries(MUSIC_TRACKS).map(([k, v]) => ({ key: k, label: v.label }));

export class AmbientEngine {
  constructor(soundEngine) {
    this.soundEngine = soundEngine;

    // Version reset: clear old volume prefs so new defaults take effect
    if (localStorage.getItem('flipoff_prefs_v') !== '2') {
      localStorage.removeItem(AMBIENT_VOL_KEY);
      localStorage.removeItem(MURMUR_VOL_KEY);
      localStorage.removeItem(CLICK_VOL_KEY);
      localStorage.setItem('flipoff_prefs_v', '2');
    }

    this.enabled = this._loadState();

    try {
      const saved = localStorage.getItem(AMBIENT_VOL_KEY);
      this.volume = saved !== null ? parseFloat(saved) : 0.10;
    } catch { this.volume = 0.10; }

    try {
      const mv = localStorage.getItem(MURMUR_KEY);
      this.murmurEnabled = mv === null ? false : mv === 'true';
    } catch { this.murmurEnabled = false; }

    try {
      const mvol = localStorage.getItem(MURMUR_VOL_KEY);
      this.murmurVolume = mvol !== null ? parseFloat(mvol) : 0.10;
    } catch { this.murmurVolume = 0.10; }

    try {
      this.musicChoice = localStorage.getItem(MUSIC_KEY) || 'piano-jazz';
    } catch { this.musicChoice = 'piano-jazz'; }

    this._running = false;
    this._masterGain = null;
    this._musicGain = null;
    this._murmurGain = null;
    this._activeSources = [];
    this._crossfadeTimers = [];
  }

  _loadState() {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      return val === null ? false : val === 'true';
    } catch { return false; }
  }

  _saveState() { localStorage.setItem(STORAGE_KEY, String(this.enabled)); }

  setVolume(val) {
    this.volume = val;
    localStorage.setItem(AMBIENT_VOL_KEY, String(val));
    if (this._musicGain) {
      const ctx = this.soundEngine.ctx;
      if (ctx) this._musicGain.gain.linearRampToValueAtTime(val, ctx.currentTime + 0.1);
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

  setMusicChoice(key) {
    this.musicChoice = key;
    localStorage.setItem(MUSIC_KEY, key);
    // Restart with new track if running
    if (this._running) {
      this.stop();
      // Quick crossfade to new track
      setTimeout(() => {
        this._running = false;
        this._masterGain = null;
        this._musicGain = null;
        this._murmurGain = null;
        this._activeSources = [];
        this.enabled = true;
        this.start();
      }, 800);
    }
  }

  async toggleMurmur() {
    this.murmurEnabled = !this.murmurEnabled;
    localStorage.setItem(MURMUR_KEY, String(this.murmurEnabled));
    if (this.murmurEnabled) {
      if (!this._running) {
        // start() will handle starting the murmur since murmurEnabled is now true
        this.enabled = true;
        this._saveState();
        await this.start();
      } else {
        // Already running, just start the murmur layer
        if (this._murmurGain) {
          this._murmurGain.gain.linearRampToValueAtTime(this.murmurVolume, this.soundEngine.ctx.currentTime + 2);
          this._startCrossfadeLoop('murmur', CROWD_MURMUR_BASE64, this._murmurGain);
        }
      }
    } else if (this._running) {
      this._stopLayer('murmur');
    }
    return this.murmurEnabled;
  }

  toggle() {
    this.enabled = !this.enabled;
    this._saveState();
    if (this.enabled) this.start();
    else this.stop();
    return this.enabled;
  }

  _decodeBase64(ctx, base64) {
    return new Promise((resolve, reject) => {
      try {
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        ctx.decodeAudioData(bytes.buffer.slice(0)).then(resolve).catch(reject);
      } catch (e) { reject(e); }
    });
  }

  /**
   * Crossfade loop: plays two overlapping copies of the buffer.
   * When one is about to end, the next starts with a fade-in while
   * the current fades out. This eliminates the gap at the loop point.
   */
  async _startCrossfadeLoop(layerName, base64Data, gainNode) {
    const ctx = this.soundEngine.ctx;
    if (!ctx || !this._masterGain) return;

    try {
      const buffer = await this._decodeBase64(ctx, base64Data);
      const crossfade = 4; // seconds of overlap
      const interval = (buffer.duration - crossfade) * 1000;

      const playOne = () => {
        if (!this._running) return;
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const fadeGain = ctx.createGain();
        fadeGain.gain.setValueAtTime(0, ctx.currentTime);
        fadeGain.gain.linearRampToValueAtTime(1, ctx.currentTime + crossfade);
        fadeGain.gain.setValueAtTime(1, ctx.currentTime + buffer.duration - crossfade);
        fadeGain.gain.linearRampToValueAtTime(0, ctx.currentTime + buffer.duration);

        source.connect(fadeGain);
        fadeGain.connect(gainNode);
        source.start();
        this._activeSources.push({ name: layerName, source, fadeGain });

        source.onended = () => {
          this._activeSources = this._activeSources.filter(s => s.source !== source);
        };
      };

      // Start first copy immediately
      playOne();

      // Schedule overlapping copies
      const timer = setInterval(() => {
        if (!this._running) { clearInterval(timer); return; }
        playOne();
      }, interval);

      this._crossfadeTimers.push({ name: layerName, timer });
    } catch (e) {
      console.warn(`${layerName} decode failed:`, e);
    }
  }

  _stopLayer(layerName) {
    const ctx = this.soundEngine.ctx;
    // Fade out active sources for this layer
    this._activeSources.filter(s => s.name === layerName).forEach(s => {
      if (ctx) {
        s.fadeGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
        setTimeout(() => { try { s.source.stop(); } catch {} }, 1500);
      }
    });
    // Clear timers for this layer
    this._crossfadeTimers.filter(t => t.name === layerName).forEach(t => clearInterval(t.timer));
    this._crossfadeTimers = this._crossfadeTimers.filter(t => t.name !== layerName);
  }

  async start() {
    if (this._running || !this.enabled) return;
    const ctx = this.soundEngine.ctx;
    if (!ctx) return;

    this._running = true;

    // Keep audio session alive when screen locks (iOS)
    // A looping <audio> element prevents Safari from suspending Web Audio
    if (!this._keepAlive) {
      this._keepAlive = document.createElement('audio');
      this._keepAlive.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRBqpAAAAAAD/+1DEAAAH+AJX9AAAIiMGSz8wAABFgBAAKAAHBAEDPnPggCAIHJKAgGP8oCAJ/y4f/Lh/8uH4IAQBD6gICAYPl3/5c//BAEHwfB8oCCoBh+X//y7///ggCAJwfUBAQDAMf////4IAgCcH1AQEAx/////+CAIAnB9QEBAMP/////ggCAIAfB8=';
      this._keepAlive.loop = true;
      this._keepAlive.volume = 0.01;
      this._keepAlive.play().catch(() => {});
    }

    // Master output
    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = 1;
    this._masterGain.connect(ctx.destination);

    // Music gain
    this._musicGain = ctx.createGain();
    this._musicGain.gain.value = 0;
    this._musicGain.connect(this._masterGain);
    this._musicGain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 3);

    // Murmur gain
    this._murmurGain = ctx.createGain();
    this._murmurGain.gain.value = 0;
    this._murmurGain.connect(this._masterGain);
    if (this.murmurEnabled) {
      this._murmurGain.gain.linearRampToValueAtTime(this.murmurVolume, ctx.currentTime + 2);
    }

    // Start music with crossfade loop
    const track = MUSIC_TRACKS[this.musicChoice];
    if (track) {
      this._startCrossfadeLoop('music', track.getBase64(), this._musicGain);
    }

    // Start murmur if enabled
    if (this.murmurEnabled) {
      this._startCrossfadeLoop('murmur', CROWD_MURMUR_BASE64, this._murmurGain);
    }
  }

  stop() {
    this._running = false;
    if (this._keepAlive) {
      this._keepAlive.pause();
      this._keepAlive = null;
    }
    const ctx = this.soundEngine.ctx;

    // Clear all timers
    this._crossfadeTimers.forEach(t => clearInterval(t.timer));
    this._crossfadeTimers = [];

    if (this._masterGain && ctx) {
      this._masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      setTimeout(() => {
        this._activeSources.forEach(s => { try { s.source.stop(); } catch {} });
        this._activeSources = [];
        this._masterGain?.disconnect();
        this._masterGain = null;
        this._musicGain = null;
        this._murmurGain = null;
      }, 2000);
    }
  }
}
