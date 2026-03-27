import { Board } from './Board.js';
import { SoundEngine } from './SoundEngine.js';
import { AmbientEngine } from './AmbientEngine.js';
import { MessageRotator } from './MessageRotator.js';
import { KeyboardController } from './KeyboardController.js';
import { SettingsPanel } from './SettingsPanel.js';
import { GRID_COLS, GRID_ROWS } from './constants.js';

// Portrait mobile: fewer cols = bigger tiles/text, more rows = fills screen
const PORTRAIT_COLS = 12;
const PORTRAIT_ROWS = 14;

// Landscape mobile: extra rows for top/bottom breathing room
const LANDSCAPE_MOBILE_COLS = 16;
const LANDSCAPE_MOBILE_ROWS = 10;

function isMobilePortrait() {
  return window.innerWidth <= 600 && window.innerHeight > window.innerWidth;
}

function isMobileLandscape() {
  return window.innerWidth <= 900 && window.innerHeight < window.innerWidth && window.innerHeight <= 500;
}

document.addEventListener('DOMContentLoaded', () => {
  const boardContainer = document.getElementById('board-container');
  const tapHint = document.getElementById('tap-hint');
  const soundEngine = new SoundEngine();

  const portrait = isMobilePortrait();
  const landscape = isMobileLandscape();
  const cols = portrait ? PORTRAIT_COLS : landscape ? LANDSCAPE_MOBILE_COLS : GRID_COLS;
  const rows = portrait ? PORTRAIT_ROWS : landscape ? LANDSCAPE_MOBILE_ROWS : GRID_ROWS;

  const board = new Board(boardContainer, soundEngine, cols, rows);
  const rotator = new MessageRotator(board);
  const ambientEngine = new AmbientEngine(soundEngine);
  const settings = new SettingsPanel(rotator, ambientEngine);
  const keyboard = new KeyboardController(rotator, soundEngine, settings, ambientEngine);

  // Poll for audio unlock from inline <script> in HTML
  let audioInitialized = false;
  const initAudioIfReady = () => {
    if (window.__audioReady && !audioInitialized) {
      audioInitialized = true;
      soundEngine.init();
      if (tapHint) tapHint.classList.add('hidden');
      if (ambientEngine.enabled) {
        setTimeout(() => ambientEngine.start(), 500);
      }
    }
  };
  const pollForAudio = setInterval(() => {
    initAudioIfReady();
    if (audioInitialized) clearInterval(pollForAudio);
  }, 100);

  // Also init audio when any sound toggle is used in settings
  window.__ensureAudioInit = initAudioIfReady;

  // Dynamic tile sizing: fill the viewport
  const resizeTiles = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const c = board.cols;
    const r = board.rows;

    if (isMobilePortrait()) {
      // Portrait: fill as much vertical space as possible
      // Minimal margins so top/bottom asymmetry is barely visible
      const gap = 1;
      const topPad = 60; // matches CSS padding-top for Dynamic Island
      const tileW = Math.floor((vw - (c + 1) * gap) / c);
      const targetH = (vh - topPad) * 0.96;
      const tileH = Math.floor((targetH - (r + 1) * gap) / r);
      board.boardEl.style.setProperty('--tile-size', tileW + 'px');
      board.boardEl.style.setProperty('--tile-h', tileH + 'px');
      board.boardEl.style.setProperty('--tile-gap', gap + 'px');
      // Larger font for portrait — use 55% of tile width
      board.boardEl.style.setProperty('--tile-font', Math.floor(tileW * 0.55) + 'px');
      board.boardEl.classList.add('portrait-mode');
    } else if (vw <= 900 && vh < vw) {
      // Mobile landscape: rectangular tiles, fill both dimensions independently
      const gap = 1;
      const tileW = Math.floor((vw - (c + 1) * gap) / c);
      const tileH = Math.floor((vh * 0.95 - (r + 1) * gap) / r);
      board.boardEl.style.setProperty('--tile-size', tileW + 'px');
      board.boardEl.style.setProperty('--tile-h', tileH + 'px');
      board.boardEl.style.setProperty('--tile-gap', gap + 'px');
      board.boardEl.style.setProperty('--tile-font', Math.floor(Math.min(tileW, tileH) * 0.52) + 'px');
      board.boardEl.classList.remove('portrait-mode');
    } else {
      // Desktop: square tiles, fit both dimensions
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

  // Position accent dots based on actual grid bounding box
  const positionDots = () => {
    const grid = board.boardEl.querySelector('.tile-grid');
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const barLeft = board.boardEl.querySelector('.accent-bar-left');
    const barRight = board.boardEl.querySelector('.accent-bar-right');
    if (!barLeft || !barRight) return;

    const dotSize = isMobilePortrait() ? 10 : 8;
    const halfDot = dotSize / 2;

    if (isMobilePortrait()) {
      // Portrait: dots centered horizontally, overlapping top/bottom grid edges
      const cx = rect.left + rect.width / 2;
      barLeft.style.left = (cx - dotSize - 2) + 'px';
      barLeft.style.top = (rect.top - halfDot) + 'px';
      barLeft.style.transform = 'none';
      barLeft.style.right = 'auto';
      barLeft.style.bottom = 'auto';

      barRight.style.left = (cx - dotSize - 2) + 'px';
      barRight.style.top = (rect.bottom - halfDot) + 'px';
      barRight.style.transform = 'none';
      barRight.style.right = 'auto';
      barRight.style.bottom = 'auto';
    } else if (isMobileLandscape()) {
      // Landscape: dots centered vertically, overlapping left/right grid edges
      // Bar = 2 dots (8px each) + gap (4px) = 20px total
      const barH = dotSize * 2 + 4;
      const cy = rect.top + rect.height / 2;
      barLeft.style.left = (rect.left - halfDot) + 'px';
      barLeft.style.top = (cy - barH / 2) + 'px';
      barLeft.style.transform = 'none';
      barLeft.style.right = 'auto';
      barLeft.style.bottom = 'auto';

      barRight.style.left = (rect.right - halfDot) + 'px';
      barRight.style.top = (cy - barH / 2) + 'px';
      barRight.style.transform = 'none';
      barRight.style.right = 'auto';
      barRight.style.bottom = 'auto';
    }
  };
  // Run after layout settles
  requestAnimationFrame(() => requestAnimationFrame(positionDots));
  window.addEventListener('resize', () => requestAnimationFrame(positionDots));

  // Reload on orientation change to rebuild grid
  window.addEventListener('orientationchange', () => {
    setTimeout(() => location.reload(), 300);
  });

  // Start message rotation
  rotator.start();

  // Pause rotation when tab is hidden (saves battery for desk display)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      rotator.stop();
    } else {
      rotator.start();
    }
  });

  // Swipe navigation on mobile
  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (settings.visible) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Only register horizontal swipes (not vertical scrolls)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) rotator.next(); // swipe left = next
      else rotator.prev(); // swipe right = previous
    }
  }, { passive: true });

  // Tap ripple effect
  document.addEventListener('click', (e) => {
    if (settings.visible) return;
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position:fixed;left:${e.clientX}px;top:${e.clientY}px;
      width:0;height:0;border-radius:50%;
      background:rgba(255,255,255,0.15);
      transform:translate(-50%,-50%);
      pointer-events:none;z-index:9998;
      transition:width 0.4s ease-out,height 0.4s ease-out,opacity 0.4s ease-out;
    `;
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.width = '80px';
      ripple.style.height = '80px';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 500);
  });

  // Double-tap to favorite a quote
  let lastClickTime = 0;
  document.addEventListener('click', (e) => {
    if (settings.visible) return;
    const now = Date.now();
    if (now - lastClickTime < 400) {
      // Double-tap detected
      const isFav = rotator.toggleFavorite();
      // Show heart toast
      const heart = document.createElement('div');
      heart.style.cssText = `
        position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(0);
        font-size:60px;z-index:9999;pointer-events:none;
        transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s;
        color:${isFav ? '#ff4466' : 'rgba(255,255,255,0.3)'};
        text-shadow:0 2px 20px rgba(0,0,0,0.5);
        font-family:-apple-system,sans-serif;
      `;
      heart.textContent = isFav ? '\u2665' : '\u2661';
      document.body.appendChild(heart);
      requestAnimationFrame(() => {
        heart.style.transform = 'translate(-50%,-50%) scale(1)';
      });
      setTimeout(() => {
        heart.style.opacity = '0';
        heart.style.transform = 'translate(-50%,-50%) scale(1.3)';
      }, 600);
      setTimeout(() => heart.remove(), 1000);
      lastClickTime = 0; // reset to prevent triple-tap
    } else {
      lastClickTime = now;
    }
  });

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

  // "Add to Home Screen" banner (iOS + Android)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  const bannerDismissed = localStorage.getItem('flipoff_pwa_banner') === 'dismissed';

  if (isMobile && !isStandalone && !bannerDismissed) {
    const instructions = isIOS
      ? 'Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>'
      : 'Tap <strong>Menu (\u22ee)</strong> then <strong>Add to Home Screen</strong>';
    const iconSvg = isIOS
      ? '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>'
      : '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>';

    const banner = document.createElement('div');
    banner.className = 'ios-banner';
    banner.innerHTML = `
      <div class="ios-banner-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg>
      </div>
      <div class="ios-banner-text">
        For the <strong>best experience</strong>, ${instructions}
      </div>
      <button class="ios-banner-close">&times;</button>
    `;
    document.body.appendChild(banner);

    banner.querySelector('.ios-banner-close').addEventListener('click', (e) => {
      e.stopPropagation();
      banner.classList.add('dismissed');
      localStorage.setItem('flipoff_pwa_banner', 'dismissed');
    });

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      banner.classList.add('dismissed');
    }, 8000);
  }
});
