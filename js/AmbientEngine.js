import { CROWD_MURMUR_BASE64 } from './crowdAudio.js';

const STORAGE_KEY = 'flipoff_ambient';
const AMBIENT_VOL_KEY = 'flipoff_ambient_vol';
const MURMUR_KEY = 'flipoff_murmur';
const MURMUR_VOL_KEY = 'flipoff_murmur_vol';

// Jazz piano: pentatonic + blue notes in multiple octaves
// C Eb F F# G Bb across octaves 3-5
const JAZZ_NOTES = [
  // Octave 3
  130.81, 155.56, 174.61, 185.00, 196.00, 233.08,
  // Octave 4
  261.63, 311.13, 349.23, 369.99, 392.00, 466.16,
  // Octave 5
  523.25, 622.25, 698.46, 739.99, 783.99, 932.33,
];

// Chord voicings (indices into JAZZ_NOTES) for variety
const CHORDS = [
  [0, 3, 7],   // Cm7 low
  [1, 4, 8],   // Eb voicing
  [2, 5, 9],   // F thing
  [6, 9, 13],  // Cm7 mid
  [7, 10, 14], // Eb mid
  [8, 11, 15], // F mid
];

export class AmbientEngine {
  constructor(soundEngine) {
    this.soundEngine = soundEngine;
    this.enabled = this._loadState();
    try {
      const saved = localStorage.getItem(AMBIENT_VOL_KEY);
      this.volume = saved !== null ? parseFloat(saved) : 0.6;
    } catch {
      this.volume = 0.6;
    }
    // Murmur state
    try {
      const mv = localStorage.getItem(MURMUR_KEY);
      this.murmurEnabled = mv === null ? false : mv === 'true';
    } catch { this.murmurEnabled = false; }
    try {
      const mvol = localStorage.getItem(MURMUR_VOL_KEY);
      this.murmurVolume = mvol !== null ? parseFloat(mvol) : 0.4;
    } catch { this.murmurVolume = 0.4; }

    this._running = false;
    this._pianoTimer = null;
    this._noiseSource = null;
    this._masterGain = null;
    this._pianoGain = null;
    this._noiseGain = null;
    this._convolver = null;
    this._chordIndex = 0;
    this._notesSinceChord = 0;
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

  toggleMurmur() {
    this.murmurEnabled = !this.murmurEnabled;
    localStorage.setItem(MURMUR_KEY, String(this.murmurEnabled));

    if (this.murmurEnabled) {
      // Auto-enable ambient if not already running (murmur needs it)
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

  setMurmurVolume(val) {
    this.murmurVolume = val;
    localStorage.setItem(MURMUR_VOL_KEY, String(val));
    if (this._murmurGain) {
      const ctx = this.soundEngine.ctx;
      if (ctx) this._murmurGain.gain.linearRampToValueAtTime(val, ctx.currentTime + 0.1);
    }
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

  start() {
    if (this._running || !this.enabled) return;
    const ctx = this.soundEngine.ctx;
    if (!ctx) return;

    this._running = true;

    // Master gain
    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = 0;
    this._masterGain.connect(ctx.destination);

    // Fade in over 3 seconds
    this._masterGain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 3);

    // Create reverb via convolver
    this._convolver = this._createReverb(ctx);

    // --- Piano chain ---
    this._pianoGain = ctx.createGain();
    this._pianoGain.gain.value = 0.35;
    this._pianoGain.connect(this._convolver);
    this._convolver.connect(this._masterGain);

    // Dry piano path (subtle)
    this._pianoDry = ctx.createGain();
    this._pianoDry.gain.value = 0.08;
    this._pianoDry.connect(this._masterGain);

    // --- Ambient noise chain (terminal/station) ---
    this._noiseGain = ctx.createGain();
    this._noiseGain.gain.value = 0.12;

    // Filtered brown noise = distant terminal rumble
    this._noiseSource = this._createBrownNoise(ctx);
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 400;
    lpf.Q.value = 0.5;

    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 60;

    this._noiseSource.connect(hpf);
    hpf.connect(lpf);
    lpf.connect(this._noiseGain);
    this._noiseGain.connect(this._masterGain);

    // Second noise layer: higher hiss (PA system / ventilation)
    this._hissSource = this._createWhiteNoise(ctx);
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 2000;
    hissFilter.Q.value = 0.3;

    this._hissGain = ctx.createGain();
    this._hissGain.gain.value = 0.015;

    this._hissSource.connect(hissFilter);
    hissFilter.connect(this._hissGain);
    this._hissGain.connect(this._masterGain);

    // Start piano loop
    this._schedulePiano();

    // Start murmur if enabled
    if (this.murmurEnabled) {
      this._startMurmur();
    }
  }

  stop() {
    this._running = false;

    if (this._pianoTimer) {
      clearTimeout(this._pianoTimer);
      this._pianoTimer = null;
    }

    const ctx = this.soundEngine.ctx;
    if (!ctx) return;

    // Fade out
    if (this._masterGain) {
      this._masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      setTimeout(() => {
        try { this._noiseSource?.stop(); } catch {}
        try { this._hissSource?.stop(); } catch {}
        this._murmurSources.forEach(s => { try { s.stop(); } catch {} });
        this._murmurSources = [];
        this._murmurGain = null;
        this._noiseSource = null;
        this._hissSource = null;
        this._masterGain?.disconnect();
        this._masterGain = null;
      }, 2000);
    }
  }

  _schedulePiano() {
    if (!this._running) return;
    const ctx = this.soundEngine.ctx;
    if (!ctx || this.soundEngine.muted) {
      this._pianoTimer = setTimeout(() => this._schedulePiano(), 2000);
      return;
    }

    this._notesSinceChord++;

    // Occasionally play a soft chord
    if (this._notesSinceChord > 6 && Math.random() < 0.2) {
      this._playChord(ctx);
      this._notesSinceChord = 0;
      const next = 3000 + Math.random() * 4000;
      this._pianoTimer = setTimeout(() => this._schedulePiano(), next);
      return;
    }

    // Single note
    this._playNote(ctx, this._pickNote(), 0.08 + Math.random() * 0.12);

    // Variable timing: jazz feel with breathing room
    const next = 800 + Math.random() * 3200;
    this._pianoTimer = setTimeout(() => this._schedulePiano(), next);
  }

  _pickNote() {
    // Bias toward middle octave
    const weights = JAZZ_NOTES.map((_, i) => {
      if (i >= 6 && i <= 11) return 3;  // octave 4: most common
      if (i >= 12) return 1;             // octave 5: occasional sparkle
      return 1.5;                         // octave 3: warm bass
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return JAZZ_NOTES[i];
    }
    return JAZZ_NOTES[7];
  }

  _playNote(ctx, freq, velocity) {
    // Rhodes-like tone: fundamental + slight detune + soft overtone
    const now = ctx.currentTime;
    const duration = 1.5 + Math.random() * 2.5;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.01; // slight detune on overtone

    const osc3 = ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.value = freq * 0.999; // chorus effect

    const noteGain = ctx.createGain();
    // Piano-like envelope: quick attack, gentle decay
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(velocity, now + 0.01);
    noteGain.gain.exponentialRampToValueAtTime(velocity * 0.4, now + 0.3);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.15;

    const chorusGain = ctx.createGain();
    chorusGain.gain.value = 0.3;

    osc1.connect(noteGain);
    osc2.connect(overtoneGain);
    overtoneGain.connect(noteGain);
    osc3.connect(chorusGain);
    chorusGain.connect(noteGain);

    noteGain.connect(this._pianoGain);
    noteGain.connect(this._pianoDry);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
  }

  _playChord(ctx) {
    const chord = CHORDS[this._chordIndex % CHORDS.length];
    this._chordIndex++;

    // Stagger notes slightly for human feel
    chord.forEach((noteIdx, i) => {
      setTimeout(() => {
        this._playNote(ctx, JAZZ_NOTES[noteIdx], 0.04 + Math.random() * 0.06);
      }, i * (40 + Math.random() * 80));
    });
  }

  _createReverb(ctx) {
    // Algorithmic reverb impulse: long tail for spacious terminal feel
    const length = ctx.sampleRate * 3.5;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Exponential decay with diffusion
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  _createBrownNoise(ctx) {
    const bufferSize = ctx.sampleRate * 8;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start();
    return source;
  }

  _createWhiteNoise(ctx) {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start();
    return source;
  }

  // --- Crowd murmur — real coffee shop recording, looped ---

  _startMurmur() {
    const ctx = this.soundEngine.ctx;
    if (!ctx || !this._masterGain) return;

    this._murmurGain = ctx.createGain();
    this._murmurGain.gain.value = 0;
    this._murmurGain.connect(this._masterGain);

    // Fade in over 2 seconds
    this._murmurGain.gain.linearRampToValueAtTime(this.murmurVolume, ctx.currentTime + 2);

    // Decode and loop the real crowd recording
    try {
      const binaryStr = atob(CROWD_MURMUR_BASE64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      ctx.decodeAudioData(bytes.buffer.slice(0))
        .then(buffer => {
          if (!this._murmurGain) return; // stopped before decode finished
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;

          source.connect(this._murmurGain);
          source.start();
          this._murmurSources.push(source);
        })
        .catch(e => console.warn('Murmur decode failed:', e));
    } catch (e) {
      console.warn('Murmur init failed:', e);
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

  // Murmur reverb removed — using real recording now
}
