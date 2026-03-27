import { MESSAGES, GRID_ROWS, GRID_COLS } from './constants.js';
import { THEMES, THEME_KEYS, DEFAULT_THEME_KEYS } from './themes.js';

const STORAGE_KEY = 'flipoff_messages';

export class SettingsPanel {
  constructor(rotator, ambientEngine) {
    this.rotator = rotator;
    this.ambientEngine = ambientEngine;
    this.visible = false;
    this.messages = this._load();

    // Apply saved messages to rotator
    this.rotator.messages = this.messages;

    this._buildDOM();
    this._render();
  }

  _load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return MESSAGES.map(m => [...m]);
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
    this.rotator.messages = this.messages;
    this.rotator._queue = [];
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
        <span class="sp-title">Settings</span>
        <button class="sp-close" title="Close (S)">&times;</button>
      </div>
      <div class="sp-body"></div>
    `;

    this.panel.addEventListener('keydown', e => e.stopPropagation());
    this.panel.querySelector('.sp-close').addEventListener('click', () => this.toggle());
    this.bodyEl = this.panel.querySelector('.sp-body');

    const style = document.createElement('style');
    style.textContent = `
      .settings-panel {
        position: fixed;
        top: 0;
        right: -400px;
        width: 380px;
        height: 100vh;
        background: #1a1a1a;
        border-left: 1px solid rgba(255,255,255,0.08);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
        transition: right 0.25s ease;
        overflow: hidden;
      }
      .settings-panel.open { right: 0; }
      .sp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        flex-shrink: 0;
      }
      .sp-title {
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.2px;
      }
      .sp-close {
        background: none;
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
        padding: 16px;
      }
      .sp-body::-webkit-scrollbar { width: 4px; }
      .sp-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

      /* Section labels */
      .sp-section {
        margin-bottom: 20px;
      }
      .sp-label {
        color: rgba(255,255,255,0.35);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 10px;
      }

      /* Mode selector */
      .sp-modes {
        display: flex;
        gap: 6px;
      }
      .sp-mode-btn {
        flex: 1;
        padding: 10px 8px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        color: rgba(255,255,255,0.5);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s;
      }
      .sp-mode-btn:hover {
        border-color: rgba(255,255,255,0.15);
        color: rgba(255,255,255,0.7);
      }
      .sp-mode-btn.active {
        background: rgba(255,255,255,0.1);
        border-color: rgba(255,255,255,0.25);
        color: #fff;
      }

      /* Theme chips */
      .sp-themes {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .sp-theme-chip {
        padding: 7px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        color: rgba(255,255,255,0.4);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        user-select: none;
      }
      .sp-theme-chip:hover {
        border-color: rgba(255,255,255,0.15);
      }
      .sp-theme-chip.active {
        background: rgba(255,255,255,0.1);
        border-color: rgba(255,255,255,0.3);
        color: #fff;
      }
      .sp-theme-chip .sp-chip-count {
        color: rgba(255,255,255,0.2);
        font-size: 10px;
        margin-left: 4px;
      }
      .sp-theme-chip.active .sp-chip-count {
        color: rgba(255,255,255,0.4);
      }
      .sp-theme-section.disabled {
        opacity: 0.3;
        pointer-events: none;
      }

      /* Custom messages */
      .sp-custom-section.disabled {
        opacity: 0.3;
        pointer-events: none;
      }
      .sp-msg {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
      }
      .sp-msg-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .sp-msg-num {
        color: rgba(255,255,255,0.3);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .sp-msg-del {
        background: none;
        color: rgba(255,255,255,0.2);
        font-size: 11px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .sp-msg-del:hover { color: #ff4444; background: rgba(255,68,68,0.1); }
      .sp-msg textarea {
        width: 100%;
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px;
        color: #fff;
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 12px;
        line-height: 1.6;
        padding: 8px 10px;
        resize: none;
        box-sizing: border-box;
      }
      .sp-msg textarea:focus {
        outline: none;
        border-color: rgba(255,255,255,0.2);
      }
      .sp-msg .sp-hint {
        color: rgba(255,255,255,0.2);
        font-size: 10px;
        margin-top: 4px;
        text-align: right;
      }
      .sp-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .sp-add {
        flex: 1;
        padding: 10px;
        background: #fff;
        color: #000;
        font-size: 13px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
      }
      .sp-add:hover { background: #eee; }
      .sp-reset {
        padding: 10px 14px;
        background: none;
        border: 1px solid rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.4);
        font-size: 12px;
        border-radius: 6px;
        cursor: pointer;
      }
      .sp-reset:hover { color: #fff; border-color: rgba(255,255,255,0.3); }

      /* Ambient toggle */
      .sp-ambient-row {
        display: flex;
      }
      .sp-ambient-toggle {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        color: rgba(255,255,255,0.4);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .sp-ambient-toggle:hover {
        border-color: rgba(255,255,255,0.15);
      }
      .sp-ambient-toggle.active {
        background: rgba(0, 170, 255, 0.08);
        border-color: rgba(0, 170, 255, 0.3);
        color: #fff;
      }
      .sp-ambient-icon {
        display: flex;
        align-items: center;
      }
      .sp-ambient-label {
        flex: 1;
        text-align: left;
      }
      .sp-ambient-key {
        font-size: 10px;
        font-weight: 700;
        color: rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.06);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: inherit;
      }

      /* Sliders */
      .sp-slider-row {
        margin-bottom: 14px;
      }
      .sp-slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .sp-slider-name {
        color: rgba(255,255,255,0.5);
        font-size: 12px;
        font-weight: 500;
      }
      .sp-slider-value {
        color: rgba(255,255,255,0.3);
        font-size: 11px;
        font-weight: 600;
        min-width: 50px;
        text-align: right;
      }
      .sp-slider input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 4px;
        background: rgba(255,255,255,0.08);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }
      .sp-slider input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        background: #fff;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.1s;
      }
      .sp-slider input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.2);
      }
      .sp-slider input[type="range"]::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: #fff;
        border-radius: 50%;
        border: none;
        cursor: pointer;
      }

      /* Divider */
      .sp-divider {
        height: 1px;
        background: rgba(255,255,255,0.06);
        margin: 16px 0;
      }

      /* Stats line */
      .sp-stats {
        color: rgba(255,255,255,0.2);
        font-size: 11px;
        text-align: center;
        padding: 8px 0 4px;
      }

      /* No gear icon — double-tap/long-press/dblclick opens settings */
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.panel);

    // Double-tap or long-press on body to open settings
    let lastTap = 0;
    let pressTimer = null;

    document.body.addEventListener('touchstart', (e) => {
      if (this.visible) return;
      // Long press: 600ms
      pressTimer = setTimeout(() => {
        this.toggle();
      }, 600);
    }, { passive: true });

    document.body.addEventListener('touchend', (e) => {
      clearTimeout(pressTimer);
      if (this.visible) return;
      // Double tap
      const now = Date.now();
      if (now - lastTap < 350) {
        this.toggle();
        lastTap = 0;
      } else {
        lastTap = now;
      }
    }, { passive: true });

    document.body.addEventListener('touchmove', () => {
      clearTimeout(pressTimer);
    }, { passive: true });

    // Desktop: double-click
    document.body.addEventListener('dblclick', (e) => {
      if (this.visible) return;
      this.toggle();
    });
  }

  _createSlider(label, displayValue, min, max, step, value, onChange) {
    const row = document.createElement('div');
    row.className = 'sp-slider-row';

    const header = document.createElement('div');
    header.className = 'sp-slider-header';

    const name = document.createElement('span');
    name.className = 'sp-slider-name';
    name.textContent = label;

    const valEl = document.createElement('span');
    valEl.className = 'sp-slider-value';
    valEl.textContent = displayValue;

    header.appendChild(name);
    header.appendChild(valEl);

    const slider = document.createElement('div');
    slider.className = 'sp-slider';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.addEventListener('input', () => {
      const newLabel = onChange(parseFloat(input.value));
      valEl.textContent = newLabel;
    });

    slider.appendChild(input);
    row.appendChild(header);
    row.appendChild(slider);
    return row;
  }

  _render() {
    const mode = this.rotator.mode;
    const themesDisabled = mode === 'custom';
    const customDisabled = mode === 'themes';

    // Count total quotes in pool
    let themeCount = 0;
    for (const key of this.rotator.enabledThemes) {
      if (THEMES[key]) themeCount += THEMES[key].messages.length;
    }
    const customCount = this.messages.length;
    const totalCount = mode === 'themes' ? themeCount : mode === 'custom' ? customCount : themeCount + customCount;

    this.bodyEl.innerHTML = '';

    // -- Mode selector --
    const modeSection = document.createElement('div');
    modeSection.className = 'sp-section';
    modeSection.innerHTML = `<div class="sp-label">Source</div>`;

    const modes = document.createElement('div');
    modes.className = 'sp-modes';
    [
      { key: 'themes', label: 'Themes Only' },
      { key: 'combined', label: 'Combined' },
      { key: 'custom', label: 'Custom Only' },
    ].forEach(m => {
      const btn = document.createElement('button');
      btn.className = `sp-mode-btn${mode === m.key ? ' active' : ''}`;
      btn.textContent = m.label;
      btn.addEventListener('click', () => {
        this.rotator.setMode(m.key);
        this._render();
      });
      modes.appendChild(btn);
    });
    modeSection.appendChild(modes);
    this.bodyEl.appendChild(modeSection);

    // -- Ambient toggle --
    const ambientSection = document.createElement('div');
    ambientSection.className = 'sp-section';
    ambientSection.innerHTML = `<div class="sp-label">Ambient Sound</div>`;

    const ambientRow = document.createElement('div');
    ambientRow.className = 'sp-ambient-row';

    const ambientToggle = document.createElement('button');
    const ambientOn = this.ambientEngine && this.ambientEngine.enabled;
    ambientToggle.className = `sp-ambient-toggle${ambientOn ? ' active' : ''}`;
    ambientToggle.innerHTML = `
      <span class="sp-ambient-icon">${ambientOn ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'}</span>
      <span class="sp-ambient-label">${ambientOn ? 'Piano Jazz + Terminal' : 'Off'}</span>
      <span class="sp-ambient-key">A</span>
    `;
    ambientToggle.addEventListener('click', () => {
      if (this.ambientEngine) {
        this.ambientEngine.toggle();
        this._render();
      }
    });

    ambientRow.appendChild(ambientToggle);
    ambientSection.appendChild(ambientRow);

    // Murmur toggle
    if (this.ambientEngine) {
      const murmurRow = document.createElement('div');
      murmurRow.className = 'sp-ambient-row';
      murmurRow.style.marginTop = '8px';

      const murmurToggle = document.createElement('button');
      const murmurOn = this.ambientEngine.murmurEnabled;
      murmurToggle.className = `sp-ambient-toggle${murmurOn ? ' active' : ''}`;
      murmurToggle.innerHTML = `
        <span class="sp-ambient-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
        <span class="sp-ambient-label">${murmurOn ? 'Crowd Murmur' : 'Crowd Off'}</span>
      `;
      murmurToggle.addEventListener('click', () => {
        this.ambientEngine.toggleMurmur();
        this._render();
      });

      murmurRow.appendChild(murmurToggle);
      ambientSection.appendChild(murmurRow);
    }

    this.bodyEl.appendChild(ambientSection);

    // -- Sliders section --
    const slidersSection = document.createElement('div');
    slidersSection.className = 'sp-section';
    slidersSection.innerHTML = `<div class="sp-label">Controls</div>`;

    // Speed slider
    const speedVal = this.rotator.speedMultiplier;
    const speedLabels = { 0.5: 'Fast', 1: 'Normal', 1.5: 'Relaxed', 2: 'Slow', 3: 'Very Slow' };
    const closestLabel = Object.entries(speedLabels).reduce((best, [k, v]) =>
      Math.abs(parseFloat(k) - speedVal) < Math.abs(parseFloat(best[0]) - speedVal) ? [k, v] : best
    );
    slidersSection.appendChild(this._createSlider(
      'Rotation Speed',
      closestLabel[1],
      0.5, 3, 0.1, speedVal,
      (val) => {
        this.rotator.setSpeed(val);
        const cl = Object.entries(speedLabels).reduce((best, [k, v]) =>
          Math.abs(parseFloat(k) - val) < Math.abs(parseFloat(best[0]) - val) ? [k, v] : best
        );
        return cl[1];
      }
    ));

    // Click volume slider
    const clickVol = this.rotator.board.soundEngine
      ? this.rotator.board.soundEngine.clickVolume
      : 0.8;
    slidersSection.appendChild(this._createSlider(
      'Click Volume',
      Math.round(clickVol * 100) + '%',
      0, 1, 0.05, clickVol,
      (val) => {
        if (this.rotator.board.soundEngine) {
          this.rotator.board.soundEngine.setClickVolume(val);
        }
        return Math.round(val * 100) + '%';
      }
    ));

    // Ambient volume slider
    if (this.ambientEngine) {
      slidersSection.appendChild(this._createSlider(
        'Ambient Volume',
        Math.round(this.ambientEngine.volume * 100) + '%',
        0, 1, 0.05, this.ambientEngine.volume,
        (val) => {
          this.ambientEngine.setVolume(val);
          return Math.round(val * 100) + '%';
        }
      ));

      // Murmur volume slider
      slidersSection.appendChild(this._createSlider(
        'Murmur Volume',
        Math.round(this.ambientEngine.murmurVolume * 100) + '%',
        0, 1, 0.05, this.ambientEngine.murmurVolume,
        (val) => {
          this.ambientEngine.setMurmurVolume(val);
          return Math.round(val * 100) + '%';
        }
      ));
    }

    this.bodyEl.appendChild(slidersSection);

    // -- Theme chips --
    const themeSection = document.createElement('div');
    themeSection.className = `sp-section sp-theme-section${themesDisabled ? ' disabled' : ''}`;
    themeSection.innerHTML = `<div class="sp-label">Themes</div>`;

    const chips = document.createElement('div');
    chips.className = 'sp-themes';
    THEME_KEYS.forEach(key => {
      const theme = THEMES[key];
      const active = this.rotator.enabledThemes.includes(key);
      const chip = document.createElement('button');
      chip.className = `sp-theme-chip${active ? ' active' : ''}`;
      chip.innerHTML = `${theme.label}<span class="sp-chip-count">${theme.messages.length}</span>`;
      chip.addEventListener('click', () => {
        const current = [...this.rotator.enabledThemes];
        const idx = current.indexOf(key);
        if (idx >= 0) {
          if (current.length > 1) current.splice(idx, 1);
        } else {
          current.push(key);
        }
        this.rotator.setEnabledThemes(current);
        this._render();
      });
      chips.appendChild(chip);
    });
    themeSection.appendChild(chips);
    this.bodyEl.appendChild(themeSection);

    // -- Divider --
    const div = document.createElement('div');
    div.className = 'sp-divider';
    this.bodyEl.appendChild(div);

    // -- Custom messages --
    const customSection = document.createElement('div');
    customSection.className = `sp-section sp-custom-section${customDisabled ? ' disabled' : ''}`;
    customSection.innerHTML = `<div class="sp-label">Custom Messages</div>`;

    this.messages.forEach((msg, i) => {
      const card = document.createElement('div');
      card.className = 'sp-msg';

      const header = document.createElement('div');
      header.className = 'sp-msg-header';

      const num = document.createElement('span');
      num.className = 'sp-msg-num';
      num.textContent = `Custom ${i + 1}`;

      const del = document.createElement('button');
      del.className = 'sp-msg-del';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (this.messages.length <= 1) return;
        this.messages.splice(i, 1);
        this._save();
        this._render();
      });

      header.appendChild(num);
      if (this.messages.length > 1) header.appendChild(del);

      const textarea = document.createElement('textarea');
      textarea.rows = GRID_ROWS;
      textarea.value = msg.join('\n');
      textarea.spellcheck = false;
      textarea.addEventListener('input', () => {
        const lines = textarea.value.split('\n');
        while (lines.length < GRID_ROWS) lines.push('');
        this.messages[i] = lines.slice(0, GRID_ROWS);
        this._save();
      });

      const hint = document.createElement('div');
      hint.className = 'sp-hint';
      hint.textContent = `${GRID_ROWS} rows, ${GRID_COLS} chars max`;

      card.appendChild(header);
      card.appendChild(textarea);
      card.appendChild(hint);
      customSection.appendChild(card);
    });

    const actions = document.createElement('div');
    actions.className = 'sp-actions';

    const addBtn = document.createElement('button');
    addBtn.className = 'sp-add';
    addBtn.textContent = '+ Add Message';
    addBtn.addEventListener('click', () => {
      this.messages.push(Array(GRID_ROWS).fill(''));
      this._save();
      this._render();
      this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'sp-reset';
    resetBtn.textContent = 'Reset All';
    resetBtn.addEventListener('click', () => {
      this.messages = MESSAGES.map(m => [...m]);
      localStorage.removeItem(STORAGE_KEY);
      this.rotator.messages = this.messages;
      this.rotator.setMode('combined');
      this.rotator.setEnabledThemes([...DEFAULT_THEME_KEYS]);
      this.rotator._queue = [];
      this._render();
    });

    actions.appendChild(addBtn);
    actions.appendChild(resetBtn);
    customSection.appendChild(actions);
    this.bodyEl.appendChild(customSection);

    // -- Stats --
    const stats = document.createElement('div');
    stats.className = 'sp-stats';
    stats.textContent = `${totalCount} quotes in rotation`;
    this.bodyEl.appendChild(stats);
  }
}
