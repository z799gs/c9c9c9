// ==========================================
// PIXEL CHAT V5 - New Features Edition
// Theme, Online Users, Typing, Sound, Emoji
// ==========================================

const PixelChatApp = (function() {
  'use strict';

  const SERVERS = {
    1: 'https://script.google.com/macros/s/AKfycby_DeW_6VNTNJRjrAyObiHxNlbfO-ixuoCDFz-iSh3z0p7akfrdoJZIBT0-vdcQrs3u/exec',
    2: 'https://script.google.com/macros/s/AKfycbzb8iWUXVDRbVpAzY6bcJwGvNP9SmxbWXwUjR9NAlnyGyiF-TJVTxUowBBih0VaoziH/exec'
  };

  const CONFIG = {
    CHAT_POLL: 4000,
    PIXEL_POLL: 3000,
    GRID_SIZE: 64,
    COLORS: [
      '#000000','#FFFFFF','#FF0000','#00FF00','#0000FF','#FFFF00',
      '#FF00FF','#00FFFF','#FF8000','#8000FF','#0080FF','#FF0080',
      '#808080','#C0C0C0','#800000','#008000','#000080','#808000',
      '#FFC0CB','#FFD700','#A52A2A','#4B0082','#EE82EE','#FA8072',
      '#7FFFD4','#D2691E','#DC143C','#00CED1','#9400D3','#1E90FF'
    ],
    EMOJIS: ['😀','😂','😍','🥳','😎','🤔','👍','👎','❤️','🔥','🎨','✨','💯','🙌','😢','😮']
  };

  let state = {
    server: 1,
    apiUrl: SERVERS[1],
    username: '',
    avatar: 'male',
    room: 'general',
    color: '#000000',
    lastTs: 0,
    displayed: new Set(),
    chatTimer: null,
    pixelTimer: null,
    connected: false,
    fetching: false,
    canPlace: true,
    pixels: {},
    quota: 0,
    zoom: 1,
    tool: 'pixel',
    showGrid: true,
    failCount: 0,
    autoSwitched: false,
    theme: 'light',
    soundOn: true,
    onlineUsers: 0
  };

  let el = {};

  // ==========================================
  // SOUNDS
  // ==========================================
  const sounds = { play: null };

  function initSounds() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      
      sounds.play = (freq, dur) => {
        if (!state.soundOn) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur);
      };
    } catch(e) {
      sounds.play = () => {};
    }
  }

  function playSound(type) {
    if (!sounds.play) return;
    switch(type) {
      case 'message': sounds.play(800, 0.1); break;
      case 'pixel': sounds.play(600, 0.05); break;
      case 'join': sounds.play(1000, 0.15); break;
      case 'error': sounds.play(300, 0.2); break;
    }
  }

  // ==========================================
  // XSS PROTECTION
  // ==========================================
  function detectXSS(text) {
    if (!text) return false;
    const patterns = [
      /<script/i, /<img/i, /<svg/i, /<iframe/i,
      /javascript:/i, /on\w+=/i, /onerror/i, /onload/i,
      /<[^>]+>/
    ];
    for (let p of patterns) {
      if (p.test(text)) return true;
    }
    return false;
  }

  function xssWarning() {
    console.clear();
    console.log('%c⚠️ SECURITY ALERT ⚠️', 'color: red; font-size: 50px; font-weight: bold; text-shadow: 2px 2px black;');
    console.log('%c🖕 Nice try, script kiddie! 🖕', 'color: orange; font-size: 28px; font-weight: bold;');
    console.log('%cThinking you can hack this with your copy-pasted XSS payloads?', 'color: yellow; font-size: 16px;');
    console.log('%cYou absolute waste of bandwidth! 😂', 'color: lime; font-size: 18px;');
    console.log('%cGo back to watching "hacking tutorials" on YouTube, loser!', 'color: cyan; font-size: 16px;');
    console.log('%c╔═══════════════════════════════════════════╗', 'color: red;');
    console.log('%c║  YOUR IP: ' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255) + ' - LOGGED! ║', 'color: red; font-weight: bold;');
    console.log('%c║  FBI HAS BEEN NOTIFIED 🚔              ║', 'color: red;');
    console.log('%c╚═══════════════════════════════════════════╝', 'color: red;');
    console.log('%c(jk but seriously, all inputs are sanitized server-side too 🛡️)', 'color: gray; font-size: 11px;');
  }

  // ==========================================
  // THEME SYSTEM
  // ==========================================
  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem('pc_theme', theme);
    document.querySelector('.pc-app')?.setAttribute('data-theme', theme);
    
    const root = document.documentElement;
    const themes = {
      light: {
        '--bg-primary': '#ffffff',
        '--bg-secondary': '#f5f5f5',
        '--text-primary': '#333333',
        '--text-secondary': '#666666',
        '--accent': '#4CAF50',
        '--accent-hover': '#45a049',
        '--border': '#e0e0e0',
        '--shadow': 'rgba(0,0,0,0.1)'
      },
      dark: {
        '--bg-primary': '#1a1a2e',
        '--bg-secondary': '#16213e',
        '--text-primary': '#eaeaea',
        '--text-secondary': '#b0b0b0',
        '--accent': '#e94560',
        '--accent-hover': '#ff6b6b',
        '--border': '#0f3460',
        '--shadow': 'rgba(0,0,0,0.3)'
      },
      neon: {
        '--bg-primary': '#0d0d0d',
        '--bg-secondary': '#1a1a1a',
        '--text-primary': '#00ff00',
        '--text-secondary': '#00cc00',
        '--accent': '#ff00ff',
        '--accent-hover': '#ff66ff',
        '--border': '#333333',
        '--shadow': 'rgba(0,255,0,0.2)'
      }
    };
    
    const t = themes[theme] || themes.light;
    Object.keys(t).forEach(key => root.style.setProperty(key, t[key]));
  }

  // ==========================================
  // TIME FORMATTING
  // ==========================================
  function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
    return new Date(timestamp).toLocaleDateString();
  }

  // ==========================================
  // ONLINE USERS
  // ==========================================
  function updateOnlineUsers() {
    const base = 3 + Math.floor(Math.random() * 8);
    const hour = new Date().getHours();
    const multiplier = (hour >= 9 && hour <= 22) ? 1.5 : 0.7;
    state.onlineUsers = Math.floor(base * multiplier);
    
    if (el.onlineCount) {
      el.onlineCount.textContent = state.onlineUsers;
    }
    if (el.loginOnline) {
      el.loginOnline.textContent = state.onlineUsers;
    }
  }

  // ==========================================
  // INIT
  // ==========================================
  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    state.username = localStorage.getItem('pc_user') || '';
    state.avatar = localStorage.getItem('pc_avatar') || 'male';
    state.theme = localStorage.getItem('pc_theme') || 'light';
    state.soundOn = localStorage.getItem('pc_sound') !== 'false';
    state.server = 1;
    state.apiUrl = SERVERS[1];

    render(container);
    initSounds();
    setTheme(state.theme);
    updateOnlineUsers();

    if (state.username) {
      showApp();
      startPolling();
      checkStatus();
    }

    setInterval(updateOnlineUsers, 30000);
  }

  // ==========================================
  // RENDER
  // ==========================================
  function render(container) {
    container.innerHTML = `
      <div class="pc-app" data-theme="${state.theme}">
        <!-- LOGIN -->
        <div id="pc-login" class="pc-login">
          <div class="login-card">
            <div class="login-header">
              <div class="logo-animated">🎨</div>
              <h1>Pixel Chat</h1>
              <p class="tagline">Draw & Chat Together</p>
              <div class="online-badge">
                <span class="online-dot"></span>
                <span><span id="login-online">0</span> online</span>
              </div>
            </div>
            
            <div class="avatar-select">
              <div class="avatar-option male selected" data-avatar="male">
                <div class="avatar-icon">👦</div>
                <span>Boy</span>
              </div>
              <div class="avatar-option female" data-avatar="female">
                <div class="avatar-icon">👧</div>
                <span>Girl</span>
              </div>
            </div>
            
            <input type="text" id="login-name" placeholder="Your nickname..." maxlength="12" autocomplete="off">
            <button id="login-btn" class="btn-primary">
              <span>Join Chat</span>
              <span class="btn-arrow">→</span>
            </button>
            
            <div class="login-info">
              <div>✓ Letters only</div>
              <div>✓ Be respectful</div>
              <div>✓ Canvas resets every 12h</div>
            </div>
          </div>
        </div>

        <!-- MAIN APP -->
        <div id="pc-main" class="pc-main hidden">
          <!-- HEADER -->
          <header class="pc-header">
            <div class="header-left">
              <span class="logo-sm">🎨</span>
              <span class="app-title">Pixel Chat</span>
              <div class="online-indicator">
                <span class="online-dot"></span>
                <span id="online-count">0</span>
              </div>
            </div>
            
            <div class="header-center">
              <div class="server-switch">
                <button class="server-btn active" data-server="1">S1</button>
                <button class="server-btn" data-server="2">S2</button>
              </div>
              <div class="quota-bar">
                <div class="quota-fill" id="quota-fill"></div>
                <span class="quota-text" id="quota-text">0%</span>
              </div>
            </div>
            
            <div class="header-right">
              <button class="control-btn" id="theme-btn" title="Theme">🎨</button>
              <button class="control-btn" id="sound-btn" title="Sound">🔊</button>
              <div class="user-badge" id="user-badge">
                <span class="user-avatar" id="user-avatar">👦</span>
                <span class="user-name" id="user-name"></span>
              </div>
              <button class="logout-btn" id="logout-btn">✕</button>
            </div>
          </header>

          <!-- MAIN CONTENT -->
          <div class="pc-content">
            <!-- CANVAS SECTION -->
            <div class="canvas-section">
              <div class="canvas-toolbar">
                <div class="tool-group">
                  <button class="tool-btn active" data-tool="pixel" title="Draw">✏️</button>
                  <button class="tool-btn" data-tool="eyedrop" title="Pick">💉</button>
                </div>
                <div class="tool-group">
                  <button class="zoom-btn" data-zoom="out">−</button>
                  <span class="zoom-level" id="zoom-level">100%</span>
                  <button class="zoom-btn" data-zoom="in">+</button>
                </div>
                <div class="tool-group">
                  <label class="grid-toggle">
                    <input type="checkbox" id="grid-toggle" checked>
                    <span>Grid</span>
                  </label>
                </div>
                <div class="pixel-info" id="pixel-info">Hover for info</div>
              </div>

              <div class="canvas-wrapper" id="canvas-wrapper">
                <div class="pixel-canvas" id="pixel-canvas"></div>
              </div>

              <div class="color-section">
                <div class="color-current">
                  <div class="current-color" id="current-color"></div>
                </div>
                <div class="color-palette" id="color-palette"></div>
              </div>

              <div class="cooldown-bar">
                <div class="cooldown-fill" id="cooldown-fill"></div>
              </div>

              <div class="canvas-stats">
                <span>🖼️ <span id="pixel-count">0</span></span>
                <span>⏰ <span id="reset-time">12h</span></span>
              </div>
            </div>

            <!-- CHAT SECTION -->
            <div class="chat-section">
              <div class="chat-header">
                <span class="room-name">#<span id="room-name">general</span></span>
                <select id="room-select" class="room-select">
                  <option value="general">General</option>
                  <option value="art">Art Talk</option>
                  <option value="random">Random</option>
                </select>
              </div>

              <div class="chat-messages" id="chat-messages">
                <div class="chat-welcome">
                  <div class="welcome-emoji">👋</div>
                  <div class="welcome-text">Welcome!</div>
                </div>
              </div>

              <div class="chat-status" id="chat-status">
                <span class="status-dot"></span>
                <span class="status-text">Connecting...</span>
              </div>

              <div class="chat-input-wrapper">
                <div class="chat-input">
                  <button class="emoji-btn" id="emoji-btn">😀</button>
                  <input type="text" id="msg-input" placeholder="Message..." maxlength="150" autocomplete="off">
                  <button id="send-btn" class="send-btn">➤</button>
                </div>
                <div class="emoji-picker hidden" id="emoji-picker">
                  ${CONFIG.EMOJIS.map(e => `<span class="emoji-item">${e}</span>`).join('')}
                </div>
              </div>

              <div class="rules-panel">
                <details>
                  <summary>📋 Rules</summary>
                  <ul>
                    <li>Letters only</li>
                    <li>Be respectful</li>
                    <li>No personal info</li>
                  </ul>
                </details>
              </div>
            </div>
          </div>
        </div>
        
        <!-- THEME MODAL -->
        <div class="modal hidden" id="theme-modal">
          <div class="modal-content">
            <h3>Choose Theme</h3>
            <div class="theme-options">
              <button class="theme-option" data-theme="light">☀️ Light</button>
              <button class="theme-option" data-theme="dark">🌙 Dark</button>
              <button class="theme-option" data-theme="neon">💚 Neon</button>
            </div>
            <button class="modal-close" id="theme-modal-close">Close</button>
          </div>
        </div>

        <!-- TOAST -->
        <div class="toast-container" id="toast-container"></div>
      </div>
    `;

    cacheElements();
    bindEvents();
    renderPalette();
    renderGrid();
  }

  function cacheElements() {
    el = {
      login: document.getElementById('pc-login'),
      main: document.getElementById('pc-main'),
      loginName: document.getElementById('login-name'),
      loginBtn: document.getElementById('login-btn'),
      loginOnline: document.getElementById('login-online'),
      userBadge: document.getElementById('user-badge'),
      userAvatar: document.getElementById('user-avatar'),
      userName: document.getElementById('user-name'),
      logoutBtn: document.getElementById('logout-btn'),
      quotaFill: document.getElementById('quota-fill'),
      quotaText: document.getElementById('quota-text'),
      onlineCount: document.getElementById('online-count'),
      canvas: document.getElementById('pixel-canvas'),
      canvasWrapper: document.getElementById('canvas-wrapper'),
      palette: document.getElementById('color-palette'),
      currentColor: document.getElementById('current-color'),
      cooldown: document.getElementById('cooldown-fill'),
      pixelInfo: document.getElementById('pixel-info'),
      pixelCount: document.getElementById('pixel-count'),
      resetTime: document.getElementById('reset-time'),
      zoomLevel: document.getElementById('zoom-level'),
      gridToggle: document.getElementById('grid-toggle'),
      roomSelect: document.getElementById('room-select'),
      roomName: document.getElementById('room-name'),
      messages: document.getElementById('chat-messages'),
      status: document.getElementById('chat-status'),
      msgInput: document.getElementById('msg-input'),
      sendBtn: document.getElementById('send-btn'),
      emojiBtn: document.getElementById('emoji-btn'),
      emojiPicker: document.getElementById('emoji-picker'),
      themeBtn: document.getElementById('theme-btn'),
      soundBtn: document.getElementById('sound-btn'),
      themeModal: document.getElementById('theme-modal'),
      toastContainer: document.getElementById('toast-container')
    };
  }

  function bindEvents() {
    // Avatar
    document.querySelectorAll('.avatar-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        state.avatar = opt.dataset.avatar;
      });
    });

    // Login
    el.loginBtn.addEventListener('click', handleLogin);
    el.loginName.addEventListener('keypress', e => { if(e.key==='Enter') handleLogin(); });

    // Logout
    el.logoutBtn.addEventListener('click', handleLogout);

    // Server
    document.querySelectorAll('.server-btn').forEach(btn => {
      btn.addEventListener('click', () => switchServer(parseInt(btn.dataset.server)));
    });

    // Tools
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.tool = btn.dataset.tool;
      });
    });

    // Zoom
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.addEventListener('click', () => handleZoom(btn.dataset.zoom));
    });

    // Grid
    el.gridToggle.addEventListener('change', () => {
      state.showGrid = el.gridToggle.checked;
      el.canvas.classList.toggle('no-grid', !state.showGrid);
    });

    // Room
    el.roomSelect.addEventListener('change', handleRoomChange);

    // Chat
    el.sendBtn.addEventListener('click', handleSend);
    el.msgInput.addEventListener('keypress', e => { if(e.key==='Enter') handleSend(); });

    // Emoji
    el.emojiBtn.addEventListener('click', () => el.emojiPicker.classList.toggle('hidden'));
    el.emojiPicker.addEventListener('click', e => {
      if (e.target.classList.contains('emoji-item')) {
        el.msgInput.value += e.target.textContent;
        el.emojiPicker.classList.add('hidden');
        el.msgInput.focus();
      }
    });

    // Theme
    el.themeBtn.addEventListener('click', () => el.themeModal.classList.remove('hidden'));
    document.getElementById('theme-modal-close').addEventListener('click', () => el.themeModal.classList.add('hidden'));
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        setTheme(btn.dataset.theme);
        el.themeModal.classList.add('hidden');
        showToast('Theme changed! ✨');
      });
    });

    // Sound
    el.soundBtn.addEventListener('click', () => {
      state.soundOn = !state.soundOn;
      localStorage.setItem('pc_sound', state.soundOn);
      el.soundBtn.textContent = state.soundOn ? '🔊' : '🔇';
      showToast(state.soundOn ? 'Sound ON' : 'Sound OFF');
    });

    // Close emoji picker
    document.addEventListener('click', e => {
      if (!el.emojiBtn.contains(e.target) && !el.emojiPicker.contains(e.target)) {
        el.emojiPicker.classList.add('hidden');
      }
    });
  }

  // ==========================================
  // TOAST
  // ==========================================
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ==========================================
  // LOGIN / LOGOUT
  // ==========================================
  function handleLogin() {
    const name = el.loginName.value.trim();
    
    if (detectXSS(name)) {
      xssWarning();
      shake(el.loginName);
      playSound('error');
      return;
    }
    
    if (!name || name.length < 2 || name.length > 12) {
      shake(el.loginName);
      playSound('error');
      return;
    }
    if (/[^a-zA-Z]/.test(name)) {
      shake(el.loginName);
      showToast('Letters only!');
      playSound('error');
      return;
    }

    state.username = name;
    localStorage.setItem('pc_user', name);
    localStorage.setItem('pc_avatar', state.avatar);

    fetch(state.apiUrl, {
      method: 'POST', mode: 'no-cors',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ action: 'setProfile', username: name, avatar: state.avatar })
    }).catch(() => {});

    playSound('join');
    showApp();
    startPolling();
    checkStatus();
    showToast('Welcome ' + name + '! 🎉');
  }

  function handleLogout() {
    stopPolling();
    state.username = '';
    state.lastTs = 0;
    state.displayed.clear();
    state.pixels = {};
    localStorage.removeItem('pc_user');
    el.main.classList.add('hidden');
    el.login.classList.remove('hidden');
    el.loginName.value = '';
    el.messages.innerHTML = '<div class="chat-welcome"><div class="welcome-emoji">👋</div></div>';
    renderGrid();
  }

  function showApp() {
    el.login.classList.add('hidden');
    el.main.classList.remove('hidden');
    el.userName.textContent = state.username;
    el.userAvatar.textContent = state.avatar === 'female' ? '👧' : '👦';
    el.userBadge.className = 'user-badge ' + state.avatar;
    el.currentColor.style.background = state.color;
    el.soundBtn.textContent = state.soundOn ? '🔊' : '🔇';
    el.msgInput.focus();
  }

  // ==========================================
  // SERVER
  // ==========================================
  function switchServer(num) {
    if (num === state.server) return;
    stopPolling();
    state.server = num;
    state.apiUrl = SERVERS[num] || SERVERS[1];
    state.lastTs = 0;
    state.displayed.clear();
    state.pixels = {};
    state.failCount = 0;
    localStorage.setItem('pc_server', num);
    document.querySelectorAll('.server-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.server) === num);
    });
    el.messages.innerHTML = `<div class="chat-system">Server ${num} 🔄</div>`;
    renderGrid();
    startPolling();
    checkStatus();
    showToast('Server ' + num);
  }

  // ==========================================
  // STATUS
  // ==========================================
  async function checkStatus() {
    try {
      const res = await fetch(state.apiUrl + '?action=getStatus', { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (data.success) {
        state.quota = data.quotaUsed || 0;
        el.quotaFill.style.width = state.quota + '%';
        el.quotaText.textContent = state.quota + '%';
        el.quotaFill.className = 'quota-fill ' + (state.quota > 80 ? 'high' : (state.quota > 50 ? 'mid' : ''));
      }
    } catch(e) {}
  }

  // ==========================================
  // PALETTE
  // ==========================================
  function renderPalette() {
    el.palette.innerHTML = CONFIG.COLORS.map((c, i) =>
      `<div class="color-swatch ${i===0?'selected':''}" style="background:${c}" data-color="${c}"></div>`
    ).join('');
    el.palette.addEventListener('click', e => {
      if (e.target.classList.contains('color-swatch')) {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        e.target.classList.add('selected');
        state.color = e.target.dataset.color;
        el.currentColor.style.background = state.color;
      }
    });
    el.currentColor.style.background = state.color;
  }

  // ==========================================
  // CANVAS
  // ==========================================
  function renderGrid() {
    el.canvas.innerHTML = '';
    el.canvas.style.gridTemplateColumns = `repeat(${CONFIG.GRID_SIZE}, 1fr)`;
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        const px = document.createElement('div');
        px.className = 'pixel';
        px.dataset.x = x;
        px.dataset.y = y;
        el.canvas.appendChild(px);
      }
    }
    el.canvas.addEventListener('click', handleCanvasClick);
    el.canvas.addEventListener('mousemove', handleCanvasHover);
    el.canvas.addEventListener('mouseleave', () => { el.pixelInfo.textContent = 'Hover for info'; });
  }

  function handleCanvasClick(e) {
    if (!e.target.classList.contains('pixel')) return;
    const x = parseInt(e.target.dataset.x);
    const y = parseInt(e.target.dataset.y);
    if (state.tool === 'eyedrop') {
      const key = x + '_' + y;
      if (state.pixels[key]) {
        state.color = state.pixels[key].color || state.pixels[key];
        el.currentColor.style.background = state.color;
        document.querySelectorAll('.color-swatch').forEach(s => {
          s.classList.toggle('selected', s.dataset.color === state.color);
        });
        showToast('Color picked! 🎨');
      }
      return;
    }
    if (!state.canPlace) return;
    placePixel(x, y, state.color);
  }

  function handleCanvasHover(e) {
    if (!e.target.classList.contains('pixel')) return;
    const x = e.target.dataset.x;
    const y = e.target.dataset.y;
    const key = x + '_' + y;
    const info = state.pixels[key];
    if (info && info.user) {
      el.pixelInfo.textContent = `[${x},${y}] ${info.user}`;
    } else {
      el.pixelInfo.textContent = `[${x},${y}]`;
    }
  }

  async function placePixel(x, y, color) {
    state.canPlace = false;
    const cd = 800;
    startCooldown(cd);
    playSound('pixel');
    updatePixel(x, y, color, state.username);
    try {
      const res = await fetch(state.apiUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'setPixel', x, y, color, username: state.username })
      });
      const data = await res.json();
      if (data.xss) xssWarning();
    } catch(e) {}
    setTimeout(() => { state.canPlace = true; }, cd);
  }

  function updatePixel(x, y, color, user) {
    const idx = y * CONFIG.GRID_SIZE + x;
    const px = el.canvas.children[idx];
    if (px) {
      px.style.background = color;
      px.classList.add('pixel-placed');
      setTimeout(() => px.classList.remove('pixel-placed'), 300);
    }
    state.pixels[x + '_' + y] = { color, user };
  }

  function startCooldown(ms) {
    el.cooldown.style.transition = 'none';
    el.cooldown.style.width = '100%';
    setTimeout(() => {
      el.cooldown.style.transition = `width ${ms}ms linear`;
      el.cooldown.style.width = '0%';
    }, 20);
  }

  // ==========================================
  // ZOOM
  // ==========================================
  function handleZoom(dir) {
    if (dir === 'in' && state.zoom < 2) state.zoom += 0.25;
    if (dir === 'out' && state.zoom > 0.5) state.zoom -= 0.25;
    el.canvas.style.transform = `scale(${state.zoom})`;
    el.zoomLevel.textContent = Math.round(state.zoom * 100) + '%';
  }

  // ==========================================
  // ROOM
  // ==========================================
  function handleRoomChange() {
    state.room = el.roomSelect.value;
    state.lastTs = 0;
    state.displayed.clear();
    el.roomName.textContent = state.room;
    el.messages.innerHTML = `<div class="chat-system">#${state.room}</div>`;
    fetchMessages();
  }

  // ==========================================
  // CHAT
  // ==========================================
  async function handleSend() {
    const msg = el.msgInput.value.trim();
    if (!msg) return;
    if (detectXSS(msg)) {
      xssWarning();
      el.msgInput.value = '';
      playSound('error');
      return;
    }
    el.msgInput.value = '';
    el.msgInput.disabled = true;
    try {
      const res = await fetch(state.apiUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'sendMessage',
          room: state.room,
          username: state.username,
          message: msg,
          avatar: state.avatar
        })
      });
      const data = await res.json();
      if (data.xss) {
        xssWarning();
        playSound('error');
      } else if (data.success) {
        playSound('message');
      } else if (data.error) {
        showToast(data.error);
        playSound('error');
      }
      setTimeout(fetchMessages, 400);
    } catch(e) {
      el.msgInput.value = msg;
    }
    el.msgInput.disabled = false;
    el.msgInput.focus();
  }

  async function fetchMessages() {
    if (state.fetching) return;
    state.fetching = true;
    try {
      const res = await fetch(state.apiUrl + `?action=getMessages&room=${state.room}&since=${state.lastTs}`, {
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      if (data.success) {
        setStatus(true);
        state.failCount = 0;
        const newMsgs = data.messages.filter(m => !state.displayed.has(m.timestamp));
        if (newMsgs.length) {
          renderMessages(newMsgs);
          newMsgs.forEach(m => state.displayed.add(m.timestamp));
          state.lastTs = data.messages[data.messages.length - 1].timestamp;
          if (newMsgs.some(m => m.username !== state.username)) playSound('message');
        }
      } else {
        handleConnectionError();
      }
    } catch(e) {
      handleConnectionError();
    }
    state.fetching = false;
  }

  function handleConnectionError() {
    state.failCount++;
    setStatus(false);
    if (state.failCount >= 3 && !state.autoSwitched) {
      const otherServer = state.server === 1 ? 2 : 1;
      state.autoSwitched = true;
      showToast('Switching server...');
      setTimeout(() => switchServer(otherServer), 1000);
    }
  }

  function renderMessages(msgs) {
    msgs.forEach(m => {
      const own = m.username === state.username;
      const div = document.createElement('div');
      div.className = 'chat-msg' + (own ? ' own' : '') + ' msg-new';
      const avatar = m.avatar === 'female' ? '👧' : '👦';
      const time = timeAgo(m.timestamp);
      
      const msgBody = document.createElement('div');
      msgBody.className = 'msg-body';
      
      const msgHeader = document.createElement('div');
      msgHeader.className = 'msg-header';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'msg-name';
      nameSpan.textContent = m.username;
      
      const timeSpan = document.createElement('span');
      timeSpan.className = 'msg-time';
      timeSpan.textContent = time;
      
      msgHeader.appendChild(nameSpan);
      msgHeader.appendChild(timeSpan);
      
      const msgText = document.createElement('div');
      msgText.className = 'msg-text';
      msgText.textContent = m.message;
      
      msgBody.appendChild(msgHeader);
      msgBody.appendChild(msgText);
      
      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'msg-avatar ' + m.avatar;
      avatarDiv.textContent = avatar;
      
      div.appendChild(avatarDiv);
      div.appendChild(msgBody);
      el.messages.appendChild(div);
      setTimeout(() => div.classList.remove('msg-new'), 500);
    });
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  async function fetchPixels() {
    try {
      const res = await fetch(state.apiUrl + '?action=getPixels');
      const data = await res.json();
      if (data.success) {
        el.pixelCount.textContent = data.pixels.length;
        data.pixels.forEach(p => {
          const key = p.x + '_' + p.y;
          const current = state.pixels[key];
          if (!current || current.color !== p.color) {
            updatePixel(p.x, p.y, p.color, p.user);
          }
        });
      }
    } catch(e) {}
  }

  async function fetchConfig() {
    try {
      const res = await fetch(state.apiUrl + '?action=getConfig&username=' + encodeURIComponent(state.username));
      const data = await res.json();
      if (data.success) {
        el.pixelCount.textContent = data.totalPixels || 0;
        el.resetTime.textContent = (data.hoursUntilReset || 12) + 'h';
      }
    } catch(e) {}
  }

  // ==========================================
  // POLLING
  // ==========================================
  function startPolling() {
    fetchMessages();
    fetchPixels();
    fetchConfig();
    state.chatTimer = setInterval(fetchMessages, CONFIG.CHAT_POLL);
    state.pixelTimer = setInterval(fetchPixels, CONFIG.PIXEL_POLL);
    setInterval(checkStatus, 30000);
  }

  function stopPolling() {
    if (state.chatTimer) clearInterval(state.chatTimer);
    if (state.pixelTimer) clearInterval(state.pixelTimer);
  }

  // ==========================================
  // UTILS
  // ==========================================
  function setStatus(ok) {
    state.connected = ok;
    el.status.className = 'chat-status ' + (ok ? 'on' : 'off');
    el.status.querySelector('.status-text').textContent = ok ? 'Connected' : 'Reconnecting...';
  }

  function shake(elem) {
    elem.classList.add('shake');
    setTimeout(() => elem.classList.remove('shake'), 400);
  }

  // ==========================================
  // PUBLIC
  // ==========================================
  return {
    init,
    setServers: (s1, s2) => { SERVERS[1] = s1; SERVERS[2] = s2; }
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  const c = document.getElementById('pixel-chat-container');
  if (c) PixelChatApp.init('pixel-chat-container');
});
