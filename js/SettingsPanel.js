import { MESSAGES, GRID_ROWS, GRID_COLS } from './constants.js';
import { THEMES, THEME_KEYS, DEFAULT_THEME_KEYS } from './themes.js';
import { shareMessage } from './sharedMessages.js';

const STORAGE_KEY = 'flipoff_messages';
const EDITS_KEY = 'flipoff_theme_edits';

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
        position: relative;
      }
      .sp-title { color: #fff; font-size: 15px; font-weight: 600; letter-spacing: -0.2px; }
      .sp-close { background: none; color: rgba(255,255,255,0.4); font-size: 22px; padding: 0 4px; cursor: pointer; line-height: 1; }
      .sp-close:hover { color: #fff; }
      .sp-body { flex: 1; overflow-y: auto; padding: 16px; }
      .sp-body::-webkit-scrollbar { width: 4px; }
      .sp-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      .sp-section { margin-bottom: 20px; }
      .sp-label { color: rgba(255,255,255,0.35); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
      .sp-ambient-row { display: flex; }
      .sp-ambient-toggle {
        display: flex; align-items: center; gap: 10px; width: 100%;
        padding: 12px 14px; background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
        color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer; transition: all 0.15s;
      }
      .sp-ambient-toggle:hover { border-color: rgba(255,255,255,0.15); }
      .sp-ambient-toggle.active { background: rgba(0,170,255,0.08); border-color: rgba(0,170,255,0.3); color: #fff; }
      .sp-ambient-icon { display: flex; align-items: center; }
      .sp-ambient-label { flex: 1; text-align: left; }
      .sp-ambient-key { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 3px; }
      .sp-slider-row { margin-bottom: 14px; }
      .sp-slider-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .sp-slider-name { color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 500; }
      .sp-slider-value { color: rgba(255,255,255,0.3); font-size: 11px; font-weight: 600; min-width: 50px; text-align: right; }
      .sp-slider input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; outline: none; cursor: pointer; }
      .sp-slider input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: #fff; border-radius: 50%; cursor: pointer; }
      .sp-slider input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; background: #fff; border-radius: 50%; border: none; cursor: pointer; }
      .sp-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 16px 0; }
      .sp-stats { color: rgba(255,255,255,0.2); font-size: 11px; text-align: center; padding: 8px 0 4px; }

      /* Tab bar */
      .sp-tabs {
        display: flex;
        overflow-x: auto;
        gap: 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        margin: 0 -16px 12px;
        padding: 0 16px;
        flex-shrink: 0;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .sp-tabs::-webkit-scrollbar { display: none; }
      .sp-tab {
        padding: 10px 14px;
        color: rgba(255,255,255,0.35);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      .sp-tab:hover { color: rgba(255,255,255,0.6); }
      .sp-tab.active { color: #fff; border-bottom-color: #00aaff; }
      .sp-tab .sp-tab-count {
        color: rgba(255,255,255,0.2);
        font-size: 10px;
        margin-left: 3px;
      }
      .sp-tab.active .sp-tab-count { color: rgba(255,255,255,0.4); }

      /* Quote cards */
      .sp-quote {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 8px;
      }
      .sp-quote-text {
        color: rgba(255,255,255,0.7);
        font-size: 12px;
        line-height: 1.5;
        margin-bottom: 6px;
      }
      .sp-quote-attr {
        color: rgba(255,255,255,0.3);
        font-size: 11px;
        font-style: italic;
      }
      .sp-quote-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        justify-content: flex-end;
      }
      .sp-quote-btn {
        background: none;
        color: rgba(255,255,255,0.25);
        font-size: 11px;
        cursor: pointer;
        padding: 3px 8px;
        border-radius: 4px;
        transition: all 0.15s;
      }
      .sp-quote-btn:hover { color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.06); }
      .sp-quote-btn.delete:hover { color: #ff4444; background: rgba(255,68,68,0.1); }
      .sp-quote-btn.share:hover { color: #00aaff; background: rgba(0,170,255,0.1); }

      /* Edit mode */
      .sp-quote textarea {
        width: 100%; background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
        color: #fff; font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 12px; line-height: 1.6; padding: 8px 10px;
        resize: none; box-sizing: border-box;
      }
      .sp-quote textarea:focus { outline: none; border-color: rgba(255,255,255,0.2); }
      .sp-quote .sp-hint { color: rgba(255,255,255,0.2); font-size: 10px; margin-top: 4px; text-align: right; }

      /* Add button */
      .sp-add-quote {
        width: 100%; padding: 10px;
        background: rgba(255,255,255,0.04); border: 1px dashed rgba(255,255,255,0.1);
        border-radius: 8px; color: rgba(255,255,255,0.3);
        font-size: 12px; font-weight: 600; cursor: pointer;
        transition: all 0.15s; margin-top: 8px;
      }
      .sp-add-quote:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.2); }

      /* Reset */
      .sp-reset-theme {
        padding: 8px 14px; background: none;
        border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
        color: rgba(255,255,255,0.3); font-size: 11px; cursor: pointer; margin-top: 8px;
      }
      .sp-reset-theme:hover { color: #fff; border-color: rgba(255,255,255,0.2); }

      /* Bottom sheet for mobile portrait */
      @media (max-width: 600px) and (orientation: portrait) {
        .settings-panel {
          top: auto; bottom: 0; left: 0; right: 0;
          width: 100%; height: 80vh;
          border-left: none; border-top: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px 16px 0 0;
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .settings-panel.open { right: 0; transform: translateY(0); }
        .sp-header { padding: 12px 20px; }
        .sp-header::before {
          content: ''; position: absolute; top: 8px; left: 50%;
          transform: translateX(-50%); width: 36px; height: 4px;
          background: rgba(255,255,255,0.2); border-radius: 2px;
        }
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
    input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value;
    input.addEventListener('input', () => { valEl.textContent = onChange(parseFloat(input.value)); });
    slider.appendChild(input);
    row.appendChild(header);
    row.appendChild(slider);
    return row;
  }

  // Extract readable quote text from a message array
  _quotePreview(msg) {
    const lines = msg.filter(l => l && l.trim());
    const body = lines.filter(l => !l.trim().startsWith('-')).map(l => l.trim()).join(' ');
    const attr = lines.find(l => l.trim().startsWith('-'));
    return { body, attr: attr ? attr.trim() : '' };
  }

  _renderQuoteCard(msg, index, themeKey, messages) {
    const card = document.createElement('div');
    card.className = 'sp-quote';
    const { body, attr } = this._quotePreview(msg);

    // Display mode (default)
    const textEl = document.createElement('div');
    textEl.className = 'sp-quote-text';
    textEl.textContent = body;
    card.appendChild(textEl);

    if (attr) {
      const attrEl = document.createElement('div');
      attrEl.className = 'sp-quote-attr';
      attrEl.textContent = attr;
      card.appendChild(attrEl);
    }

    const actions = document.createElement('div');
    actions.className = 'sp-quote-actions';

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'sp-quote-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      card.innerHTML = '';
      const textarea = document.createElement('textarea');
      textarea.rows = GRID_ROWS;
      textarea.value = msg.join('\n');
      textarea.spellcheck = false;
      card.appendChild(textarea);

      const hint = document.createElement('div');
      hint.className = 'sp-hint';
      hint.textContent = `${GRID_ROWS} rows, ${GRID_COLS} chars max`;
      card.appendChild(hint);

      const saveRow = document.createElement('div');
      saveRow.className = 'sp-quote-actions';
      const saveBtn = document.createElement('button');
      saveBtn.className = 'sp-quote-btn';
      saveBtn.textContent = 'Save';
      saveBtn.style.color = '#00aaff';
      saveBtn.addEventListener('click', () => {
        const lines = textarea.value.split('\n');
        while (lines.length < GRID_ROWS) lines.push('');
        messages[index] = lines.slice(0, GRID_ROWS);
        if (themeKey === 'my-quotes') {
          this._saveCustom();
        } else {
          this._setThemeMessages(themeKey, messages);
        }
        this._render();
      });
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'sp-quote-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => this._render());
      saveRow.appendChild(cancelBtn);
      saveRow.appendChild(saveBtn);
      card.appendChild(saveRow);
      textarea.focus();
    });
    actions.appendChild(editBtn);

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'sp-quote-btn share';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', async () => {
      const name = prompt('Your name (so family knows who shared it):');
      if (!name) return;
      shareBtn.textContent = '...';
      const ok = await shareMessage(msg, name);
      shareBtn.textContent = ok ? 'Shared!' : 'Failed';
      if (ok) this.rotator._loadShared();
      setTimeout(() => { shareBtn.textContent = 'Share'; }, 2000);
    });
    actions.appendChild(shareBtn);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'sp-quote-btn delete';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (messages.length <= 1) return;
      messages.splice(index, 1);
      if (themeKey === 'my-quotes') {
        this._saveCustom();
      } else {
        this._setThemeMessages(themeKey, messages);
      }
      this._render();
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    return card;
  }

  _render() {
    this.bodyEl.innerHTML = '';

    // -- Sound section --
    const soundSection = document.createElement('div');
    soundSection.className = 'sp-section';
    soundSection.innerHTML = '<div class="sp-label">Sound</div>';

    // Flap click toggle
    const clickOn = this.rotator.board.soundEngine && !this.rotator.board.soundEngine.muted;
    const clickRow = this._createToggleRow(
      clickOn,
      clickOn ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
      clickOn ? 'Flap Click' : 'Flap Click Off',
      () => { if (this.rotator.board.soundEngine) { this.rotator.board.soundEngine.toggleMute(); this._render(); } }
    );
    soundSection.appendChild(clickRow);

    // Ambient toggle
    const ambientOn = this.ambientEngine && this.ambientEngine.enabled;
    const ambientRow = this._createToggleRow(
      ambientOn,
      ambientOn ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
      ambientOn ? 'Piano Jazz' : 'Piano Off',
      () => { if (this.ambientEngine) { this.ambientEngine.toggle(); this._render(); } }
    );
    ambientRow.style.marginTop = '8px';
    soundSection.appendChild(ambientRow);

    // Murmur toggle
    if (this.ambientEngine) {
      const murmurOn = this.ambientEngine.murmurEnabled;
      const murmurRow = this._createToggleRow(
        murmurOn,
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        murmurOn ? 'Crowd Murmur' : 'Crowd Off',
        () => { this.ambientEngine.toggleMurmur(); this._render(); }
      );
      murmurRow.style.marginTop = '8px';
      soundSection.appendChild(murmurRow);
    }

    this.bodyEl.appendChild(soundSection);

    // -- Controls section --
    const ctrlSection = document.createElement('div');
    ctrlSection.className = 'sp-section';
    ctrlSection.innerHTML = '<div class="sp-label">Controls</div>';

    const speedVal = this.rotator.speedMultiplier;
    const speedLabels = { 0.5: 'Fast', 1: 'Normal', 1.5: 'Relaxed', 2: 'Slow', 3: 'Very Slow' };
    const closestLabel = Object.entries(speedLabels).reduce((best, [k, v]) =>
      Math.abs(parseFloat(k) - speedVal) < Math.abs(parseFloat(best[0]) - speedVal) ? [k, v] : best
    );
    ctrlSection.appendChild(this._createSlider('Rotation Speed', closestLabel[1], 0.5, 3, 0.1, speedVal, (val) => {
      this.rotator.setSpeed(val);
      return Object.entries(speedLabels).reduce((best, [k, v]) =>
        Math.abs(parseFloat(k) - val) < Math.abs(parseFloat(best[0]) - val) ? [k, v] : best
      )[1];
    }));

    // Family shared toggle
    const sharedOn = this.rotator.showShared;
    const sharedRow = this._createToggleRow(
      sharedOn,
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      sharedOn ? `Family Quotes (${this.rotator.sharedMessages.length})` : 'Family Quotes Off',
      () => { this.rotator.setShowShared(!this.rotator.showShared); this._render(); }
    );
    ctrlSection.appendChild(sharedRow);

    this.bodyEl.appendChild(ctrlSection);

    // -- Divider --
    const div = document.createElement('div');
    div.className = 'sp-divider';
    this.bodyEl.appendChild(div);

    // -- Quote Library with tabs --
    const libSection = document.createElement('div');
    libSection.className = 'sp-section';
    libSection.innerHTML = '<div class="sp-label">Quote Library</div>';

    // Tab bar
    const tabs = document.createElement('div');
    tabs.className = 'sp-tabs';

    const allTabs = [
      { key: 'my-quotes', label: 'My Quotes', count: this.messages.length },
      ...THEME_KEYS.map(k => ({
        key: k,
        label: THEMES[k].label,
        count: this._getThemeMessages(k).length,
        enabled: this.rotator.enabledThemes.includes(k),
      })),
    ];

    allTabs.forEach(t => {
      const tab = document.createElement('button');
      tab.className = `sp-tab${this._activeTab === t.key ? ' active' : ''}`;
      const countHtml = `<span class="sp-tab-count">${t.count}</span>`;
      const dotHtml = t.enabled === false ? ' <span style="color:rgba(255,255,255,0.15)">off</span>' : '';
      tab.innerHTML = t.label + countHtml + dotHtml;
      tab.addEventListener('click', () => {
        this._activeTab = t.key;
        this._render();
      });
      tabs.appendChild(tab);
    });

    libSection.appendChild(tabs);

    // Tab content
    const content = document.createElement('div');

    if (this._activeTab === 'my-quotes') {
      // My Quotes tab
      this.messages.forEach((msg, i) => {
        content.appendChild(this._renderQuoteCard(msg, i, 'my-quotes', this.messages));
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'sp-add-quote';
      addBtn.textContent = '+ Add Quote';
      addBtn.addEventListener('click', () => {
        this.messages.push(Array(GRID_ROWS).fill(''));
        this._saveCustom();
        this._render();
        this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
      });
      content.appendChild(addBtn);
    } else {
      // Theme tab
      const themeKey = this._activeTab;
      const msgs = this._getThemeMessages(themeKey);
      const isEnabled = this.rotator.enabledThemes.includes(themeKey);

      // Enable/disable toggle for this theme
      const toggleRow = this._createToggleRow(
        isEnabled,
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
        isEnabled ? 'In Rotation' : 'Not in Rotation',
        () => {
          const current = [...this.rotator.enabledThemes];
          const idx = current.indexOf(themeKey);
          if (idx >= 0) { if (current.length > 1) current.splice(idx, 1); }
          else { current.push(themeKey); }
          this.rotator.setEnabledThemes(current);
          this._render();
        }
      );
      toggleRow.style.marginBottom = '12px';
      content.appendChild(toggleRow);

      msgs.forEach((msg, i) => {
        content.appendChild(this._renderQuoteCard(msg, i, themeKey, msgs));
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'sp-add-quote';
      addBtn.textContent = `+ Add ${THEMES[themeKey]?.label || ''} Quote`;
      addBtn.addEventListener('click', () => {
        msgs.push(Array(GRID_ROWS).fill(''));
        this._setThemeMessages(themeKey, msgs);
        this._render();
        this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
      });
      content.appendChild(addBtn);

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
        content.appendChild(resetBtn);
      }
    }

    libSection.appendChild(content);
    this.bodyEl.appendChild(libSection);

    // -- Stats --
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

  _createToggleRow(active, iconSvg, label, onClick) {
    const row = document.createElement('div');
    row.className = 'sp-ambient-row';
    const btn = document.createElement('button');
    btn.className = `sp-ambient-toggle${active ? ' active' : ''}`;
    btn.innerHTML = `
      <span class="sp-ambient-icon">${iconSvg}</span>
      <span class="sp-ambient-label">${label}</span>
    `;
    btn.addEventListener('click', onClick);
    row.appendChild(btn);
    return row;
  }
}
