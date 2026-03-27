import { MESSAGES, GRID_ROWS, GRID_COLS } from './constants.js';
import { THEMES, THEME_KEYS, DEFAULT_THEME_KEYS } from './themes.js';
import { shareMessage } from './sharedMessages.js';
import { MUSIC_TRACK_OPTIONS } from './AmbientEngine.js';

const STORAGE_KEY = 'flipoff_messages';
const EDITS_KEY = 'flipoff_theme_edits';

// Theme tile colors - cycle through these
const TILE_COLORS = ['#00aaff', '#FF4D00', '#AA00FF', '#FFCC00', '#00FFCC'];

export class SettingsPanel {
  constructor(rotator, ambientEngine) {
    this.rotator = rotator;
    this.ambientEngine = ambientEngine;
    this.visible = false;
    this._activeTab = 'my-quotes';

    // Load local edits per theme
    this.themeEdits = this._loadEdits();
    this.messages = this._loadCustom();
    this.rotator.messages = this.messages;

    this._buildDOM();
    this._render();
  }

  _loadCustom() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return MESSAGES.map(m => [...m]);
  }

  _saveCustom() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
    this.rotator.messages = this.messages;
    this.rotator._queue = [];
  }

  _loadEdits() {
    try {
      const saved = localStorage.getItem(EDITS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  }

  _saveEdits() {
    localStorage.setItem(EDITS_KEY, JSON.stringify(this.themeEdits));
    this.rotator._queue = [];
  }

  // Get the effective messages for a theme (built-in + local edits)
  _getThemeMessages(key) {
    const edits = this.themeEdits[key];
    if (edits) return edits;
    return THEMES[key] ? THEMES[key].messages.map(m => [...m]) : [];
  }

  _setThemeMessages(key, msgs) {
    this.themeEdits[key] = msgs;
    this._saveEdits();
    // Update the rotator's view of this theme
    if (THEMES[key]) {
      THEMES[key]._localMessages = msgs;
    }
  }

  toggle() {
    this.visible = !this.visible;
    this.panel.classList.toggle('open', this.visible);
    if (this.visible) this._render();
  }

  _buildDOM() {
    this.panel = document.createElement('div');
    this.panel.className = 'settings-panel';
    this.panel.innerHTML = `
      <div class="sp-header">
        <div class="sp-handle"></div>
        <button class="sp-close" title="Close (S)">&times;</button>
      </div>
      <div class="sp-body"></div>
    `;

    this.panel.addEventListener('keydown', e => e.stopPropagation());
    this.panel.querySelector('.sp-close').addEventListener('click', () => this.toggle());
    this.bodyEl = this.panel.querySelector('.sp-body');

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@400;500;600&display=swap');

      .settings-panel {
        position: fixed;
        top: 0;
        right: -400px;
        width: 380px;
        height: 100vh;
        background: #111;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        transition: right 0.25s ease;
        overflow: hidden;
      }
      .settings-panel.open { right: 0; }

      .sp-header {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 12px 20px 8px;
        flex-shrink: 0;
        position: relative;
      }
      .sp-handle {
        position: absolute;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        width: 36px;
        height: 4px;
        background: rgba(255,255,255,0.15);
        border-radius: 2px;
        display: none;
      }
      .sp-close {
        background: none;
        border: none;
        color: rgba(255,255,255,0.4);
        font-size: 22px;
        padding: 0 4px;
        cursor: pointer;
        line-height: 1;
      }
      .sp-close:hover { color: #fff; }

      .sp-body {
        flex: 1;
        overflow-y: auto;
        padding: 0 20px 40px;
        -webkit-overflow-scrolling: touch;
      }
      .sp-body::-webkit-scrollbar { width: 0; }

      /* Section labels - mechanical label tape */
      .section-label {
        font-family: 'Archivo Black', sans-serif;
        font-size: 9px;
        letter-spacing: 2.5px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.2);
        margin: 24px 0 14px;
        padding-left: 2px;
      }
      .section-label:first-child { margin-top: 8px; }

      /* Split line */
      .split-line {
        height: 1px;
        background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent 100%);
        margin: 20px 0;
      }

      /* ===== SOUND MIXER ===== */
      .mixer {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .channel {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 0;
        position: relative;
      }
      .channel + .channel {
        border-top: 1px solid rgba(255,255,255,0.04);
      }

      .channel-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s;
      }
      .channel-icon svg { width: 16px; height: 16px; }
      .channel-icon.off { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.2); }
      .channel-icon.on-blue { background: rgba(0,170,255,0.15); color: #00aaff; }
      .channel-icon.on-cyan { background: rgba(0,255,204,0.12); color: #00ffcc; }
      .channel-icon.on-purple { background: rgba(170,0,255,0.15); color: #aa00ff; }

      .channel-body { flex: 1; min-width: 0; }
      .channel-name {
        font-size: 13px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 2px;
      }
      .channel.off .channel-name { color: rgba(255,255,255,0.3); }
      .channel-sub {
        font-size: 11px;
        color: rgba(255,255,255,0.25);
      }

      /* Fader (volume slider) */
      .fader {
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .fader input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        flex: 1;
        height: 3px;
        background: rgba(255,255,255,0.08);
        border-radius: 1.5px;
        outline: none;
      }
      .fader input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 18px;
        height: 12px;
        background: #fff;
        border-radius: 2px;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .fader input[type="range"]::-moz-range-thumb {
        width: 18px;
        height: 12px;
        background: #fff;
        border-radius: 2px;
        border: none;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .fader-val {
        font-size: 10px;
        font-weight: 600;
        color: rgba(255,255,255,0.3);
        width: 28px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      /* Track selector chips */
      .track-select {
        margin-top: 6px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .track-chip {
        padding: 5px 10px;
        font-size: 10px;
        font-weight: 600;
        color: rgba(255,255,255,0.35);
        background: rgba(255,255,255,0.04);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
        letter-spacing: 0.2px;
        border: none;
      }
      .track-chip:hover { color: rgba(255,255,255,0.6); }
      .track-chip.active {
        color: #fff;
        background: rgba(0,170,255,0.15);
      }

      /* Toggle knob */
      .knob {
        width: 40px;
        height: 22px;
        border-radius: 11px;
        background: rgba(255,255,255,0.06);
        position: relative;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.2s;
      }
      .knob::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: rgba(255,255,255,0.3);
        transition: all 0.2s;
      }
      .knob.on { background: rgba(0,170,255,0.3); }
      .knob.on::after {
        transform: translateX(18px);
        background: #00aaff;
        box-shadow: 0 0 8px rgba(0,170,255,0.4);
      }

      /* ===== SPEED / TEMPO ===== */
      .speed-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 0;
      }
      .speed-label {
        font-size: 11px;
        color: rgba(255,255,255,0.25);
        font-weight: 500;
        width: 48px;
        flex-shrink: 0;
      }
      .speed-label.right { text-align: right; }
      .speed-fader { flex: 1; }
      .speed-fader input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 3px;
        background: rgba(255,255,255,0.08);
        border-radius: 1.5px;
        outline: none;
      }
      .speed-fader input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 18px;
        height: 12px;
        background: #fff;
        border-radius: 2px;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .speed-fader input[type="range"]::-moz-range-thumb {
        width: 18px;
        height: 12px;
        background: #fff;
        border-radius: 2px;
        border: none;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .speed-current {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255,255,255,0.5);
        text-align: center;
        margin-top: 6px;
      }

      /* ===== FAMILY ===== */
      .family-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }
      .family-info { flex: 1; }
      .family-label { font-size: 13px; font-weight: 600; color: #fff; }
      .family-count { font-size: 11px; color: rgba(255,255,255,0.25); margin-top: 2px; }

      /* ===== THEME GRID ===== */
      .theme-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }

      .theme-tile {
        padding: 10px 8px;
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
        text-align: center;
        position: relative;
        overflow: hidden;
        border: none;
      }
      .theme-tile:hover { background: rgba(255,255,255,0.06); }
      .theme-tile.active {
        background: rgba(0,170,255,0.08);
      }
      .theme-tile.active::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--tile-color, #00aaff);
      }

      .theme-name {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,0.5);
        line-height: 1.3;
      }
      .theme-tile.active .theme-name { color: #fff; }
      .theme-tile.off .theme-name { color: rgba(255,255,255,0.2); }

      .theme-count {
        font-size: 9px;
        color: rgba(255,255,255,0.15);
        margin-top: 2px;
        font-variant-numeric: tabular-nums;
      }
      .theme-tile.active .theme-count { color: rgba(255,255,255,0.35); }

      .theme-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #00aaff;
        display: inline-block;
        margin-left: 3px;
        vertical-align: middle;
      }

      /* ===== QUOTE AREA ===== */
      .quote-area { margin-top: 16px; }

      .rotation-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 0;
        margin-bottom: 8px;
      }
      .rotation-label {
        font-size: 12px;
        font-weight: 500;
        color: rgba(255,255,255,0.5);
      }

      /* Swipeable quote container */
      .quote-swipe {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
      }
      .quote-swipe + .quote-swipe {
        border-top: 1px solid rgba(255,255,255,0.04);
      }

      .quote-action-left,
      .quote-action-right {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        flex-direction: column;
        gap: 4px;
      }
      .quote-action-left {
        right: 0;
        background: #ff4466;
      }
      .quote-action-left svg { width: 18px; height: 18px; }
      .quote-action-right {
        left: 0;
        background: #00aaff;
      }
      .quote-action-right svg { width: 18px; height: 18px; }

      .quote-inner {
        position: relative;
        background: #111;
        z-index: 1;
        transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
        padding: 12px 16px;
        cursor: pointer;
        touch-action: pan-y;
      }

      .quote-text {
        font-size: 12px;
        line-height: 1.6;
        color: rgba(255,255,255,0.6);
        font-weight: 400;
      }
      .quote-attr {
        font-size: 11px;
        color: rgba(255,255,255,0.2);
        margin-top: 4px;
        font-weight: 500;
        letter-spacing: 0.3px;
      }

      /* Edit mode */
      .quote-edit-mode {
        padding: 12px 0;
      }
      .quote-edit-mode textarea {
        width: 100%;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: #fff;
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
        line-height: 1.6;
        padding: 12px;
        resize: none;
        box-sizing: border-box;
      }
      .quote-edit-mode textarea:focus {
        outline: none;
        border-color: rgba(0,170,255,0.3);
      }
      .quote-edit-hint {
        font-size: 10px;
        color: rgba(255,255,255,0.15);
        margin-top: 4px;
      }
      .quote-edit-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
        justify-content: flex-end;
      }
      .quote-edit-cancel {
        padding: 8px 16px;
        border-radius: 6px;
        background: none;
        border: none;
        color: rgba(255,255,255,0.4);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .quote-edit-save {
        padding: 8px 20px;
        border-radius: 6px;
        background: rgba(0,170,255,0.15);
        border: none;
        color: #00aaff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
      }
      .quote-edit-save:hover { background: rgba(0,170,255,0.25); }

      .add-quote-btn {
        width: 100%;
        padding: 12px;
        margin-top: 8px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        color: rgba(255,255,255,0.2);
        background: none;
        border: 1px dashed rgba(255,255,255,0.06);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
        text-transform: uppercase;
      }
      .add-quote-btn:hover {
        color: rgba(255,255,255,0.5);
        border-color: rgba(255,255,255,0.15);
      }

      /* Reset */
      .sp-reset-theme {
        padding: 8px 14px;
        background: none;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px;
        color: rgba(255,255,255,0.3);
        font-size: 11px;
        cursor: pointer;
        margin-top: 8px;
      }
      .sp-reset-theme:hover { color: #fff; border-color: rgba(255,255,255,0.2); }

      /* Stats footer */
      .sp-stats {
        text-align: center;
        padding: 20px 0 8px;
        font-size: 10px;
        letter-spacing: 1px;
        color: rgba(255,255,255,0.1);
        text-transform: uppercase;
        font-weight: 600;
      }

      /* Bottom sheet for mobile portrait */
      @media (max-width: 600px) and (orientation: portrait) {
        .settings-panel {
          top: auto;
          bottom: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: 78vh;
          border-radius: 20px 20px 0 0;
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .settings-panel.open {
          right: 0;
          transform: translateY(0);
        }
        .sp-handle { display: block; }
        .sp-header { padding: 12px 20px 8px; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.panel);

    // Double-tap or long-press on body to open settings
    let lastTap = 0;
    let pressTimer = null;

    document.body.addEventListener('touchstart', (e) => {
      if (this.visible) return;
      pressTimer = setTimeout(() => { this.toggle(); }, 600);
    }, { passive: true });

    document.body.addEventListener('touchend', (e) => {
      clearTimeout(pressTimer);
      if (this.visible) return;
      const now = Date.now();
      if (now - lastTap < 350) { this.toggle(); lastTap = 0; }
      else { lastTap = now; }
    }, { passive: true });

    document.body.addEventListener('touchmove', () => { clearTimeout(pressTimer); }, { passive: true });
    document.body.addEventListener('dblclick', (e) => { if (!this.visible) this.toggle(); });
  }

  // Extract readable quote text from a message array
  _quotePreview(msg) {
    const lines = msg.filter(l => l && l.trim());
    const body = lines.filter(l => !l.trim().startsWith('-')).map(l => l.trim()).join(' ');
    const attr = lines.find(l => l.trim().startsWith('-'));
    return { body, attr: attr ? attr.trim() : '' };
  }

  // Convert natural text back into grid format
  _naturalTextToGrid(text, author) {
    let fullText = text.trim().toUpperCase();
    if (author && author.trim()) {
      // Ensure author starts with dash
      let authorText = author.trim();
      if (!authorText.startsWith('-')) authorText = '- ' + authorText;
      authorText = authorText.toUpperCase();
      // We'll add author as separate lines
      fullText = fullText + '\n' + authorText;
    }

    // Word-wrap to GRID_COLS
    const words = fullText.split(/\s+/);
    const wrappedLines = [];
    let currentLine = '';

    for (const word of words) {
      if (word === '\n' || fullText.includes('\n')) {
        // Handle explicit newlines - split on them first
        break;
      }
      if (currentLine.length === 0) {
        currentLine = word;
      } else if ((currentLine + ' ' + word).length <= GRID_COLS) {
        currentLine += ' ' + word;
      } else {
        wrappedLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) wrappedLines.push(currentLine);

    // Re-do with proper newline handling
    const inputLines = fullText.split('\n');
    const result = [];
    for (const inputLine of inputLines) {
      const lineWords = inputLine.trim().split(/\s+/).filter(w => w);
      let cur = '';
      for (const word of lineWords) {
        if (cur.length === 0) {
          cur = word;
        } else if ((cur + ' ' + word).length <= GRID_COLS) {
          cur += ' ' + word;
        } else {
          result.push(cur);
          cur = word;
        }
      }
      if (cur) result.push(cur);
    }

    // Pad to GRID_ROWS, centering vertically with empty line at top
    const lines = ['', ...result];
    while (lines.length < GRID_ROWS) lines.push('');
    return lines.slice(0, GRID_ROWS);
  }

  // Convert grid format to natural readable text
  _gridToNaturalText(msg) {
    const lines = msg.filter(l => l && l.trim());
    const bodyLines = lines.filter(l => !l.trim().startsWith('-'));
    const attrLine = lines.find(l => l.trim().startsWith('-'));

    // Join body lines into flowing text, capitalize naturally
    const rawBody = bodyLines.map(l => l.trim()).join(' ');
    // Sentence case: first letter upper, rest lower
    const body = rawBody.charAt(0).toUpperCase() + rawBody.slice(1).toLowerCase();

    let author = '';
    if (attrLine) {
      const raw = attrLine.trim().replace(/^-\s*/, '');
      // Title case the author name
      author = '- ' + raw.split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
    }

    return { body, author };
  }

  _setupSwipeGesture(swipeContainer, innerEl, onEdit, onDelete) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let isSnapped = false;
    let snapDirection = 0; // -1 left, 0 center, 1 right

    innerEl.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      currentX = 0;
      isDragging = true;
      innerEl.style.transition = 'none';
    }, { passive: true });

    innerEl.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const deltaX = e.touches[0].clientX - startX;

      // If snapped, adjust from snap position
      if (isSnapped) {
        currentX = (snapDirection * 80) + deltaX;
      } else {
        currentX = deltaX;
      }

      // Clamp between -80 and 80
      currentX = Math.max(-80, Math.min(80, currentX));
      innerEl.style.transform = `translateX(${currentX}px)`;
    }, { passive: true });

    innerEl.addEventListener('touchend', () => {
      isDragging = false;
      innerEl.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)';

      const absX = Math.abs(currentX);

      if (absX > 40) {
        // Snap open
        const dir = currentX > 0 ? 1 : -1;
        snapDirection = dir;
        isSnapped = true;
        innerEl.style.transform = `translateX(${dir * 80}px)`;
      } else {
        // Snap back
        snapDirection = 0;
        isSnapped = false;
        innerEl.style.transform = 'translateX(0)';
      }
    }, { passive: true });

    // Clicking on action buttons
    const editAction = swipeContainer.querySelector('.quote-action-right');
    const deleteAction = swipeContainer.querySelector('.quote-action-left');

    if (editAction) {
      editAction.addEventListener('click', () => {
        onEdit();
      });
    }
    if (deleteAction) {
      deleteAction.addEventListener('click', () => {
        onDelete();
      });
    }
  }

  _renderQuoteCard(msg, index, themeKey, messages) {
    const swipeContainer = document.createElement('div');
    swipeContainer.className = 'quote-swipe';

    const { body, attr } = this._quotePreview(msg);

    // Edit action (right side, revealed on swipe right)
    const editAction = document.createElement('div');
    editAction.className = 'quote-action-right';
    editAction.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit';

    // Delete action (left side, revealed on swipe left)
    const deleteAction = document.createElement('div');
    deleteAction.className = 'quote-action-left';
    deleteAction.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete';

    swipeContainer.appendChild(editAction);
    swipeContainer.appendChild(deleteAction);

    // Inner content that slides
    const inner = document.createElement('div');
    inner.className = 'quote-inner';

    const textEl = document.createElement('div');
    textEl.className = 'quote-text';
    textEl.textContent = body;
    inner.appendChild(textEl);

    if (attr) {
      const attrEl = document.createElement('div');
      attrEl.className = 'quote-attr';
      attrEl.textContent = attr;
      inner.appendChild(attrEl);
    }

    swipeContainer.appendChild(inner);

    // Set up swipe gestures
    const onEdit = () => {
      this._enterEditMode(swipeContainer, msg, index, themeKey, messages);
    };
    const onDelete = () => {
      if (messages.length <= 1) return;
      messages.splice(index, 1);
      if (themeKey === 'my-quotes') {
        this._saveCustom();
      } else {
        this._setThemeMessages(themeKey, messages);
      }
      this._render();
    };

    this._setupSwipeGesture(swipeContainer, inner, onEdit, onDelete);

    return swipeContainer;
  }

  _enterEditMode(container, msg, index, themeKey, messages) {
    const { body, author } = this._gridToNaturalText(msg);

    // Replace the swipe container content with edit mode
    container.innerHTML = '';
    container.className = 'quote-edit-mode';

    const bodyTextarea = document.createElement('textarea');
    bodyTextarea.rows = 3;
    bodyTextarea.placeholder = 'Type your quote naturally...';
    bodyTextarea.value = body;
    container.appendChild(bodyTextarea);

    const hint = document.createElement('div');
    hint.className = 'quote-edit-hint';
    hint.textContent = 'Separate author with a dash on a new line';
    container.appendChild(hint);

    const authorTextarea = document.createElement('textarea');
    authorTextarea.rows = 1;
    authorTextarea.placeholder = '- Author name';
    authorTextarea.value = author;
    authorTextarea.style.marginTop = '6px';
    authorTextarea.style.fontStyle = 'italic';
    authorTextarea.style.color = 'rgba(255,255,255,0.5)';
    container.appendChild(authorTextarea);

    const actions = document.createElement('div');
    actions.className = 'quote-edit-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'quote-edit-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._render());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'quote-edit-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const newLines = this._naturalTextToGrid(bodyTextarea.value, authorTextarea.value);
      messages[index] = newLines;
      if (themeKey === 'my-quotes') {
        this._saveCustom();
      } else {
        this._setThemeMessages(themeKey, messages);
      }
      this._render();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    container.appendChild(actions);

    bodyTextarea.focus();
  }

  _render() {
    this.bodyEl.innerHTML = '';

    // ===== SOUND MIXER =====
    const soundLabel = document.createElement('div');
    soundLabel.className = 'section-label';
    soundLabel.textContent = 'Sound';
    this.bodyEl.appendChild(soundLabel);

    const mixer = document.createElement('div');
    mixer.className = 'mixer';

    // 1. Flap Click channel
    const clickOn = this.rotator.board.soundEngine && !this.rotator.board.soundEngine.muted;
    mixer.appendChild(this._renderChannel({
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
      iconClass: clickOn ? 'on-blue' : 'off',
      name: 'Flap Click',
      isOn: clickOn,
      isOff: !clickOn,
      onToggle: () => {
        if (this.rotator.board.soundEngine) {
          this.rotator.board.soundEngine.toggleMute();
          this._render();
        }
      },
      renderBody: (bodyEl) => {
        if (!clickOn) return;
        const vol = this.rotator.board.soundEngine?.clickVolume || 0.8;
        this._appendFader(bodyEl, vol, (v) => {
          if (this.rotator.board.soundEngine) this.rotator.board.soundEngine.setClickVolume(v);
        });
      }
    }));

    // 2. Music channel
    const ambientOn = this.ambientEngine && this.ambientEngine.enabled;
    mixer.appendChild(this._renderChannel({
      iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
      iconClass: ambientOn ? 'on-cyan' : 'off',
      name: 'Music',
      isOn: ambientOn,
      isOff: !ambientOn,
      onToggle: () => {
        if (this.ambientEngine) {
          this.ambientEngine.toggle();
          this._render();
        }
      },
      renderBody: (bodyEl) => {
        if (!ambientOn) return;
        // Track chips
        const trackSelect = document.createElement('div');
        trackSelect.className = 'track-select';
        MUSIC_TRACK_OPTIONS.forEach(opt => {
          const chip = document.createElement('button');
          chip.className = `track-chip${opt.key === this.ambientEngine.musicChoice ? ' active' : ''}`;
          chip.textContent = opt.label;
          chip.addEventListener('click', () => {
            this.ambientEngine.setMusicChoice(opt.key);
            this._render();
          });
          trackSelect.appendChild(chip);
        });
        bodyEl.appendChild(trackSelect);

        // Volume fader
        this._appendFader(bodyEl, this.ambientEngine.volume, (v) => {
          this.ambientEngine.setVolume(v);
        });
      }
    }));

    // 3. Crowd channel
    if (this.ambientEngine) {
      const murmurOn = this.ambientEngine.murmurEnabled;
      mixer.appendChild(this._renderChannel({
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        iconClass: murmurOn ? 'on-purple' : 'off',
        name: 'Crowd',
        isOn: murmurOn,
        isOff: !murmurOn,
        subtitle: murmurOn ? null : 'Train station ambience',
        onToggle: () => {
          this.ambientEngine.toggleMurmur();
          this._render();
        },
        renderBody: (bodyEl) => {
          if (!murmurOn) return;
          this._appendFader(bodyEl, this.ambientEngine.murmurVolume, (v) => {
            this.ambientEngine.setMurmurVolume(v);
          });
        }
      }));
    }

    this.bodyEl.appendChild(mixer);

    // Split line
    this.bodyEl.appendChild(this._splitLine());

    // ===== TEMPO =====
    const tempoLabel = document.createElement('div');
    tempoLabel.className = 'section-label';
    tempoLabel.textContent = 'Tempo';
    this.bodyEl.appendChild(tempoLabel);

    const speedVal = this.rotator.speedMultiplier;
    const speedLabels = { 0.5: 'Fast', 1: 'Normal', 1.5: 'Relaxed', 2: 'Slow', 3: 'Very Slow' };
    const closestLabel = Object.entries(speedLabels).reduce((best, [k, v]) =>
      Math.abs(parseFloat(k) - speedVal) < Math.abs(parseFloat(best[0]) - speedVal) ? [k, v] : best
    );

    const speedRow = document.createElement('div');
    speedRow.className = 'speed-row';

    const fastLabel = document.createElement('span');
    fastLabel.className = 'speed-label';
    fastLabel.textContent = 'Fast';

    const speedFader = document.createElement('div');
    speedFader.className = 'speed-fader';
    const speedInput = document.createElement('input');
    speedInput.type = 'range';
    speedInput.min = '0.5';
    speedInput.max = '3';
    speedInput.step = '0.1';
    speedInput.value = speedVal;
    speedFader.appendChild(speedInput);

    const slowLabel = document.createElement('span');
    slowLabel.className = 'speed-label right';
    slowLabel.textContent = 'Slow';

    speedRow.appendChild(fastLabel);
    speedRow.appendChild(speedFader);
    speedRow.appendChild(slowLabel);
    this.bodyEl.appendChild(speedRow);

    const speedCurrent = document.createElement('div');
    speedCurrent.className = 'speed-current';
    speedCurrent.textContent = closestLabel[1];
    this.bodyEl.appendChild(speedCurrent);

    speedInput.addEventListener('input', () => {
      const val = parseFloat(speedInput.value);
      this.rotator.setSpeed(val);
      const label = Object.entries(speedLabels).reduce((best, [k, v]) =>
        Math.abs(parseFloat(k) - val) < Math.abs(parseFloat(best[0]) - val) ? [k, v] : best
      )[1];
      speedCurrent.textContent = label;
    });

    // Split line
    this.bodyEl.appendChild(this._splitLine());

    // ===== FAMILY =====
    const familyLabel = document.createElement('div');
    familyLabel.className = 'section-label';
    familyLabel.textContent = 'Family';
    this.bodyEl.appendChild(familyLabel);

    const sharedOn = this.rotator.showShared;
    const familyRow = document.createElement('div');
    familyRow.className = 'family-row';

    const familyInfo = document.createElement('div');
    familyInfo.className = 'family-info';
    const familyName = document.createElement('div');
    familyName.className = 'family-label';
    familyName.textContent = 'Shared Quotes';
    const familyCount = document.createElement('div');
    familyCount.className = 'family-count';
    familyCount.textContent = sharedOn ? `${this.rotator.sharedMessages.length} from family` : 'Disabled';
    familyInfo.appendChild(familyName);
    familyInfo.appendChild(familyCount);

    const familyKnob = document.createElement('div');
    familyKnob.className = `knob${sharedOn ? ' on' : ''}`;
    familyKnob.addEventListener('click', () => {
      this.rotator.setShowShared(!this.rotator.showShared);
      this._render();
    });

    familyRow.appendChild(familyInfo);
    familyRow.appendChild(familyKnob);
    this.bodyEl.appendChild(familyRow);

    // Split line
    this.bodyEl.appendChild(this._splitLine());

    // ===== LIBRARY =====
    const libLabel = document.createElement('div');
    libLabel.className = 'section-label';
    libLabel.textContent = 'Library';
    this.bodyEl.appendChild(libLabel);

    // Theme grid
    const themeGrid = document.createElement('div');
    themeGrid.className = 'theme-grid';

    // My Quotes tile
    const myTile = this._renderThemeTile({
      key: 'my-quotes',
      label: 'My Quotes',
      count: this.messages.length,
      color: TILE_COLORS[0],
      isActive: this._activeTab === 'my-quotes',
      inRotation: true, // always in rotation
    });
    themeGrid.appendChild(myTile);

    // Theme tiles
    THEME_KEYS.forEach((k, i) => {
      const isEnabled = this.rotator.enabledThemes.includes(k);
      const tile = this._renderThemeTile({
        key: k,
        label: THEMES[k].label,
        count: this._getThemeMessages(k).length,
        color: TILE_COLORS[(i + 1) % TILE_COLORS.length],
        isActive: this._activeTab === k,
        inRotation: isEnabled,
      });
      themeGrid.appendChild(tile);
    });

    this.bodyEl.appendChild(themeGrid);

    // Quote area for active tab
    const quoteArea = document.createElement('div');
    quoteArea.className = 'quote-area';

    if (this._activeTab === 'my-quotes') {
      // My Quotes content
      this.messages.forEach((msg, i) => {
        quoteArea.appendChild(this._renderQuoteCard(msg, i, 'my-quotes', this.messages));
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'add-quote-btn';
      addBtn.textContent = '+ Add Quote';
      addBtn.addEventListener('click', () => {
        this.messages.push(Array(GRID_ROWS).fill(''));
        this._saveCustom();
        this._render();
        this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
      });
      quoteArea.appendChild(addBtn);
    } else {
      // Theme tab content
      const themeKey = this._activeTab;
      const msgs = this._getThemeMessages(themeKey);
      const isEnabled = this.rotator.enabledThemes.includes(themeKey);

      // Rotation toggle
      const rotToggle = document.createElement('div');
      rotToggle.className = 'rotation-toggle';
      const rotLabel = document.createElement('span');
      rotLabel.className = 'rotation-label';
      rotLabel.textContent = isEnabled ? 'In rotation' : 'Not in rotation';
      const rotKnob = document.createElement('div');
      rotKnob.className = `knob${isEnabled ? ' on' : ''}`;
      rotKnob.addEventListener('click', () => {
        const current = [...this.rotator.enabledThemes];
        const idx = current.indexOf(themeKey);
        if (idx >= 0) { if (current.length > 1) current.splice(idx, 1); }
        else { current.push(themeKey); }
        this.rotator.setEnabledThemes(current);
        this._render();
      });
      rotToggle.appendChild(rotLabel);
      rotToggle.appendChild(rotKnob);
      quoteArea.appendChild(rotToggle);

      // Quote cards
      msgs.forEach((msg, i) => {
        quoteArea.appendChild(this._renderQuoteCard(msg, i, themeKey, msgs));
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'add-quote-btn';
      addBtn.textContent = `+ Add ${THEMES[themeKey]?.label || ''} Quote`;
      addBtn.addEventListener('click', () => {
        msgs.push(Array(GRID_ROWS).fill(''));
        this._setThemeMessages(themeKey, msgs);
        this._render();
        this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
      });
      quoteArea.appendChild(addBtn);

      // Reset to defaults
      if (this.themeEdits[themeKey]) {
        const resetBtn = document.createElement('button');
        resetBtn.className = 'sp-reset-theme';
        resetBtn.textContent = 'Reset to Defaults';
        resetBtn.addEventListener('click', () => {
          delete this.themeEdits[themeKey];
          this._saveEdits();
          this._render();
        });
        quoteArea.appendChild(resetBtn);
      }
    }

    this.bodyEl.appendChild(quoteArea);

    // Stats
    let total = this.messages.length;
    for (const key of this.rotator.enabledThemes) {
      total += this._getThemeMessages(key).length;
    }
    total += this.rotator.showShared ? this.rotator.sharedMessages.length : 0;
    const stats = document.createElement('div');
    stats.className = 'sp-stats';
    stats.textContent = `${total} quotes in rotation`;
    this.bodyEl.appendChild(stats);
  }

  _renderChannel({ iconSvg, iconClass, name, isOn, isOff, subtitle, onToggle, renderBody }) {
    const channel = document.createElement('div');
    channel.className = `channel${isOff ? ' off' : ''}`;

    const icon = document.createElement('div');
    icon.className = `channel-icon ${iconClass}`;
    icon.innerHTML = iconSvg;

    const body = document.createElement('div');
    body.className = 'channel-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'channel-name';
    nameEl.textContent = name;
    body.appendChild(nameEl);

    if (subtitle && isOff) {
      const sub = document.createElement('div');
      sub.className = 'channel-sub';
      sub.textContent = subtitle;
      body.appendChild(sub);
    }

    if (renderBody) renderBody(body);

    const knob = document.createElement('div');
    knob.className = `knob${isOn ? ' on' : ''}`;
    knob.addEventListener('click', onToggle);

    channel.appendChild(icon);
    channel.appendChild(body);
    channel.appendChild(knob);

    return channel;
  }

  _appendFader(parentEl, value, onChange) {
    const fader = document.createElement('div');
    fader.className = 'fader';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.value = value;

    const valEl = document.createElement('span');
    valEl.className = 'fader-val';
    valEl.textContent = Math.round(value * 100) + '%';

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      onChange(v);
      valEl.textContent = Math.round(v * 100) + '%';
    });

    fader.appendChild(input);
    fader.appendChild(valEl);
    parentEl.appendChild(fader);
  }

  _renderThemeTile({ key, label, count, color, isActive, inRotation }) {
    const tile = document.createElement('button');
    tile.style.cssText = `--tile-color: ${color}`;
    let tileClass = 'theme-tile';
    if (isActive) tileClass += ' active';
    if (!inRotation) tileClass += ' off';
    tile.className = tileClass;

    const nameEl = document.createElement('div');
    nameEl.className = 'theme-name';
    nameEl.textContent = label;

    // Blue dot if in rotation (and not the active tab, to keep it clean)
    if (inRotation && key !== 'my-quotes') {
      const dot = document.createElement('span');
      dot.className = 'theme-dot';
      nameEl.appendChild(dot);
    }

    const countEl = document.createElement('div');
    countEl.className = 'theme-count';
    countEl.textContent = count;

    tile.appendChild(nameEl);
    tile.appendChild(countEl);

    tile.addEventListener('click', () => {
      this._activeTab = key;
      this._render();
    });

    return tile;
  }

  _splitLine() {
    const line = document.createElement('div');
    line.className = 'split-line';
    return line;
  }
}
