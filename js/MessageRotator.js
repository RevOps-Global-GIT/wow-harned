import { MESSAGES, MESSAGE_INTERVAL, TOTAL_TRANSITION, GRID_COLS } from './constants.js';
import { THEMES, THEME_KEYS, DEFAULT_THEME_KEYS } from './themes.js';
import { reflowMessage } from './reflow.js';
import { fetchSharedMessages } from './sharedMessages.js';

const MODE_KEY = 'flipoff_mode';
const THEMES_KEY = 'flipoff_enabled_themes';
const SPEED_KEY = 'flipoff_speed';
const SHARED_KEY = 'flipoff_show_shared';

export class MessageRotator {
  constructor(board) {
    this.board = board;
    this.messages = MESSAGES; // custom messages (set by SettingsPanel)
    this.sharedMessages = []; // shared by family via Supabase
    this.currentIndex = -1;
    this._timer = null;
    this._paused = false;

    // Shared messages toggle (default on)
    try {
      const sv = localStorage.getItem(SHARED_KEY);
      this.showShared = sv === null ? true : sv === 'true';
    } catch { this.showShared = true; }

    // Load shared messages from Supabase
    this._loadShared();
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

  setShowShared(val) {
    this.showShared = val;
    localStorage.setItem(SHARED_KEY, String(val));
    this._queue = [];
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

  async _loadShared() {
    const shared = await fetchSharedMessages();
    this.sharedMessages = shared.map(s => s.lines);
    this._queue = []; // reset queue to include new shared messages
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

    // Include shared messages from family if enabled
    const shared = this.showShared ? [...this.sharedMessages] : [];

    const pool = [...themeMessages, ...customMessages, ...shared];
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

  _getGreeting() {
    const hour = new Date().getHours();
    let word;
    if (hour < 12) word = 'MORNING';
    else if (hour < 17) word = 'AFTERNOON';
    else word = 'EVENING';

    const rows = this.board.rows;
    const mid = Math.floor(rows / 2);
    const lines = Array(rows).fill('');
    lines[mid - 2] = 'GOOD';
    lines[mid - 1] = word;
    lines[mid + 1] = 'HARNED';
    lines[mid + 2] = 'WORDS OF';
    lines[mid + 3] = 'WISDOM';
    return lines;
  }

  start() {
    // Show time-aware greeting first
    if (!this._hasStarted) {
      this._hasStarted = true;
      this.board.displayMessage(this._getGreeting());
      this._timer = setTimeout(() => {
        this.next();
        this._timer = setInterval(() => {
          if (!this._paused && !this.board.isTransitioning) {
            this.next();
          }
        }, this._getInterval());
      }, this._getInterval());
      return;
    }

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
    this._currentMsg = msg;
    this.board.displayMessage(msg);
    this._resetAutoRotation();
  }

  prev() {
    const msg = this._nextMessage();
    this._currentMsg = msg;
    this.board.displayMessage(msg);
    this._resetAutoRotation();
  }

  getCurrentMessage() {
    return this._currentMsg || null;
  }

  // Favorites stored in localStorage
  _getFavorites() {
    try {
      const saved = localStorage.getItem('flipoff_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }

  toggleFavorite() {
    if (!this._currentMsg) return false;
    const key = this._currentMsg.filter(l => l.trim()).join('|');
    const favs = this._getFavorites();
    const idx = favs.indexOf(key);
    if (idx >= 0) {
      favs.splice(idx, 1);
      localStorage.setItem('flipoff_favorites', JSON.stringify(favs));
      return false; // unfavorited
    } else {
      favs.push(key);
      localStorage.setItem('flipoff_favorites', JSON.stringify(favs));
      return true; // favorited
    }
  }

  isFavorite() {
    if (!this._currentMsg) return false;
    const key = this._currentMsg.filter(l => l.trim()).join('|');
    return this._getFavorites().includes(key);
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
