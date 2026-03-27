import { Board } from './Board.js';
import { SoundEngine } from './SoundEngine.js';
import { AmbientEngine } from './AmbientEngine.js';
import { MessageRotator } from './MessageRotator.js';
import { KeyboardController } from './KeyboardController.js';
import { SettingsPanel } from './SettingsPanel.js';
import { GRID_COLS, GRID_ROWS } from './constants.js';

// Portrait mobile: fewer cols, more rows for a tall split-flap look
const PORTRAIT_COLS = 12;
const PORTRAIT_ROWS = 12;

function isMobilePortrait() {
  return window.innerWidth <= 600 && window.innerHeight > window.innerWidth;
}

document.addEventListener('DOMContentLoaded', () => {
  const boardContainer = document.getElementById('board-container');
  const tapHint = document.getElementById('tap-hint');
  const soundEngine = new SoundEngine();

  const portrait = isMobilePortrait();
  const cols = portrait ? PORTRAIT_COLS : GRID_COLS;
  const rows = portrait ? PORTRAIT_ROWS : GRID_ROWS;

  const board = new Board(boardContainer, soundEngine, cols, rows);
  const rotator = new MessageRotator(board);
  const ambientEngine = new AmbientEngine(soundEngine);
  const settings = new SettingsPanel(rotator, ambientEngine);
  const keyboard = new KeyboardController(rotator, soundEngine, settings, ambientEngine);

  // DEBUG: visible audio state banner (remove after debugging)
  const dbg = document.createElement('div');
  dbg.id = 'audio-debug';
  dbg.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(255,0,0,0.9);color:#fff;font:12px monospace;padding:6px 10px;z-index:99999;text-align:center;';
  dbg.textContent = 'AUDIO: waiting for tap...';
  document.body.appendChild(dbg);

  // Audio init — uses both event listeners AND polling for inline handlers
  let audioInitialized = false;
  const doInit = (source) => {
    if (audioInitialized) return;
    audioInitialized = true;

    dbg.textContent = `AUDIO: init via ${source}`;
    dbg.style.background = 'rgba(255,165,0,0.9)';

    try {
      soundEngine.init();
      dbg.style.background = 'rgba(0,128,0,0.9)';
      setTimeout(() => {
        dbg.textContent = `AUDIO: ctx=${soundEngine.ctx?.state}, buf=${soundEngine._audioBuffer ? soundEngine._audioBuffer.duration.toFixed(1) + 's' : 'pending'}, muted=${soundEngine.muted}`;
      }, 1000);
      setTimeout(() => { dbg.style.display = 'none'; }, 5000);
    } catch (err) {
      dbg.textContent = `AUDIO ERROR: ${err.message}`;
    }

    if (tapHint) tapHint.classList.add('hidden');
    if (ambientEngine.enabled) {
      setTimeout(() => ambientEngine.start(), 500);
    }
  };

  // Method 1: standard event listeners
  const initFromEvent = (e) => doInit(e.type);
  document.addEventListener('click', initFromEvent);
  document.body.addEventListener('click', initFromEvent);
  document.body.addEventListener('touchend', initFromEvent);
  boardContainer.addEventListener('click', initFromEvent);
  boardContainer.addEventListener('touchend', initFromEvent);
  document.addEventListener('keydown', initFromEvent);

  // Method 2: poll for inline onclick flag (fallback for iOS)
  const pollForTap = setInterval(() => {
    if (window.__userTapped) {
      clearInterval(pollForTap);
      doInit('inline-poll');
    }
  }, 200);

  // Dynamic tile sizing: fill the viewport
  const resizeTiles = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const c = board.cols;
    const r = board.rows;

    if (isMobilePortrait()) {
      // Portrait: width-constrained tiles with taller aspect ratio
      const gap = 2;
      const tileW = Math.floor((vw - (c + 1) * gap) / c);
      // Height: fill ~80% of viewport
      const targetH = vh * 0.82;
      const tileH = Math.floor((targetH - (r + 1) * gap) / r);
      board.boardEl.style.setProperty('--tile-size', tileW + 'px');
      board.boardEl.style.setProperty('--tile-h', tileH + 'px');
      board.boardEl.style.setProperty('--tile-gap', gap + 'px');
      board.boardEl.classList.add('portrait-mode');
    } else {
      // Landscape / desktop: square tiles, fit both dimensions
      const gap = 4;
      const tileByWidth = (vw - (c + 1) * gap) / c;
      const tileByHeight = (vh - (r + 1) * gap) / r;
      const tileSize = Math.floor(Math.min(tileByWidth, tileByHeight));
      board.boardEl.style.setProperty('--tile-size', tileSize + 'px');
      board.boardEl.style.setProperty('--tile-h', tileSize + 'px');
      board.boardEl.style.setProperty('--tile-gap', Math.max(2, Math.floor(tileSize * 0.06)) + 'px');
      board.boardEl.classList.remove('portrait-mode');
    }
  };
  resizeTiles();
  window.addEventListener('resize', resizeTiles);

  // Reload on orientation change to rebuild grid
  window.addEventListener('orientationchange', () => {
    setTimeout(() => location.reload(), 300);
  });

  // Start message rotation
  rotator.start();

  // Hide cursor after 3s of no movement (but not when settings open)
  let cursorTimer;
  const hideCursor = () => {
    if (!settings.visible) document.body.classList.remove('show-cursor');
  };
  const showCursor = () => {
    document.body.classList.add('show-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(hideCursor, 3000);
  };
  document.addEventListener('mousemove', showCursor);

  // iOS "Add to Home Screen" banner
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  const bannerDismissed = localStorage.getItem('flipoff_ios_banner') === 'dismissed';

  if (isIOS && !isStandalone && !bannerDismissed) {
    const banner = document.createElement('div');
    banner.className = 'ios-banner';
    banner.innerHTML = `
      <div class="ios-banner-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
      </div>
      <div class="ios-banner-text">
        For <strong>true fullscreen</strong>, tap Share then <strong>Add to Home Screen</strong>
      </div>
      <button class="ios-banner-close">&times;</button>
    `;
    document.body.appendChild(banner);

    banner.querySelector('.ios-banner-close').addEventListener('click', (e) => {
      e.stopPropagation();
      banner.classList.add('dismissed');
      localStorage.setItem('flipoff_ios_banner', 'dismissed');
    });

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      banner.classList.add('dismissed');
    }, 8000);
  }
});
