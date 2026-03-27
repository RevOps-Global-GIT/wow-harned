import { MESSAGES, MESSAGE_INTERVAL, TOTAL_TRANSITION, GRID_COLS } from './constants.js';
import { THEMES, THEME_KEYS, DEFAULT_THEME_KEYS } from './themes.js';
import { reflowMessage } from './reflow.js';

const MODE_KEY = 'flipoff_mode';
const THEMES_KEY = 'flipoff_enabled_themes';
const SPEED_KEY = 'flipoff_speed';

export class MessageRotator {
  constructor(board) {
    this.board = board;
    this.messages = MESSAGES; // custom messages (set by SettingsPanel)
    this.currentIndex = -1;
    this._timer = null;
    this._paused = false;
    this._queue = [];

    // Load mode: 'themes', 'custom', 'combined'
    this.mode = localStorage.getItem(MODE_KEY) || 'combined';

    // Load speed multiplier (0.5 = fast, 1 = default, 3 = slow)
    try {
      const saved = localStorage.getItem(SPEED_KEY);
      this.speedMultiplier = saved ? parseFloat(saved) : 1;
    } catch {
      this.speedMultiplier = 1;
    }

    // Load enabled themes
    try {
      const saved = localStorage.getItem(THEMES_KEY);
      this.enabledThemes = saved ? JSON.parse(saved) : [...DEFAULT_THEME_KEYS];
    } catch {
      this.enabledThemes = [...THEME_KEYS];
    }
  }

  setMode(mode) {
    this.mode = mode;
    localStorage.setItem(MODE_KEY, mode);
    this._queue = [];
    this.currentIndex = -1;
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
    localStorage.setItem(SPEED_KEY, String(multiplier));
    this._resetAutoRotation();
  }

  _getInterval() {
    return (MESSAGE_INTERVAL + TOTAL_TRANSITION) * this.speedMultiplier;
  }

  setEnabledThemes(themes) {
    this.enabledThemes = themes;
    localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
    this._queue = [];
  }

  _getPool() {
    const themeMessages = [];
    if (this.mode === 'themes' || this.mode === 'combined') {
      for (const key of this.enabledThemes) {
        if (THEMES[key]) {
          themeMessages.push(...THEMES[key].messages);
        }
      }
    }

    const customMessages = [];
    if (this.mode === 'custom' || this.mode === 'combined') {
      customMessages.push(...this.messages);
    }

    const pool = [...themeMessages, ...customMessages];
    return pool.length > 0 ? pool : MESSAGES;
  }

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  _reflow(msg) {
    // Only reflow if grid differs from the default 16-col format
    if (this.board.cols >= GRID_COLS) return msg;
    return reflowMessage(msg, this.board.cols, this.board.rows);
  }

  _nextMessage() {
    if (this._queue.length === 0) {
      this._queue = this._shuffle(this._getPool());
    }
    return this._reflow(this._queue.pop());
  }

  start() {
    this.next();
    this._timer = setInterval(() => {
      if (!this._paused && !this.board.isTransitioning) {
        this.next();
      }
    }, this._getInterval());
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  next() {
    const msg = this._nextMessage();
    this.board.displayMessage(msg);
    this._resetAutoRotation();
  }

  prev() {
    // For prev, just show another random one
    const msg = this._nextMessage();
    this.board.displayMessage(msg);
    this._resetAutoRotation();
  }

  _resetAutoRotation() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = setInterval(() => {
        if (!this._paused && !this.board.isTransitioning) {
          this.next();
        }
      }, this._getInterval());
    }
  }
}
