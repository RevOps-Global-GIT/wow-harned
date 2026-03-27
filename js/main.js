import { Board } from './Board.js';
import { SoundEngine } from './SoundEngine.js';
import { AmbientEngine } from './AmbientEngine.js';
import { MessageRotator } from './MessageRotator.js';
import { KeyboardController } from './KeyboardController.js';
import { SettingsPanel } from './SettingsPanel.js';

document.addEventListener('DOMContentLoaded', () => {
  const boardContainer = document.getElementById('board-container');
  const tapHint = document.getElementById('tap-hint');
  const soundEngine = new SoundEngine();
  const board = new Board(boardContainer, soundEngine);
  const rotator = new MessageRotator(board);
  const ambientEngine = new AmbientEngine(soundEngine);
  const settings = new SettingsPanel(rotator, ambientEngine);
  const keyboard = new KeyboardController(rotator, soundEngine, settings, ambientEngine);

  // Initialize audio on first user interaction
  let audioInitialized = false;
  const initAudio = async () => {
    if (audioInitialized) return;
    audioInitialized = true;
    await soundEngine.init();
    soundEngine.resume();
    if (tapHint) tapHint.classList.add('hidden');

    // Start ambient if enabled
    if (ambientEngine.enabled) {
      ambientEngine.start();
    }

    document.removeEventListener('click', initAudio);
    document.removeEventListener('keydown', initAudio);
  };
  document.addEventListener('click', initAudio);
  document.addEventListener('keydown', initAudio);

  // Dynamic tile sizing: fill the viewport
  const resizeTiles = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cols = board.cols;
    const rows = board.rows;
    const gap = 4;
    const tileByWidth = (vw - (cols + 1) * gap) / cols;
    const tileByHeight = (vh - (rows + 1) * gap) / rows;
    const tileSize = Math.floor(Math.min(tileByWidth, tileByHeight));
    board.boardEl.style.setProperty('--tile-size', tileSize + 'px');
    board.boardEl.style.setProperty('--tile-gap', Math.max(2, Math.floor(tileSize * 0.06)) + 'px');
  };
  resizeTiles();
  window.addEventListener('resize', resizeTiles);

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
  // Only show on iOS Safari when NOT already running as standalone PWA
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
