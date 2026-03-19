// ==========================================
// PIXEL CHAT V5 - CORS Fixed, Enhanced
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
    EMOJIS: ['😀','😂','😍','🥳','😎','🤔','👍','❤️','🔥','🎨','✨','💯']
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
    tool: 'draw',
    brushSize: 1,
    showGrid: true,
    failCount: 0,
    autoSwitched: false,
    theme: 'dark',
    soundOn: true,
    history: [],
    maxHistory: 20
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
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + dur);
        } catch(e) {}
      };
    } catch(e) {
      sounds.play = () => {};
    }
  }

  function playSound(type) {
    if (!sounds.play) return;
    const freqs = { message: 800, pixel: 500, join: 1000, error: 250, undo: 400 };
    sounds.play(freqs[type] || 600, 0.1);
  }

  // ==========================================
  // XSS PROTECTION
  // ==========================================
  function detectXSS(text) {
    if (!text) return false;
    return /<[^>]+>|javascript:|on\w+=/i.test(text);
  }

  function xssWarning() {
    console.clear();
    console.log('%c🚨 SECURITY ALERT 🚨', 'color:red;font-size:40px;font-weight:bold');
    console.log('%c🖕 Nice try, script kiddie! 🖕', 'color:orange;font-size:24px');
    console.log('%cYour pathetic XSS attempt failed miserably!', 'color:yellow;font-size:16px');
    console.log('%cAll inputs are sanitized. Go learn real coding! 😂', 'color:lime;font-size:14px');
    console.log('%cIP Logged: ' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256), 'color:red');
  }

  // ==========================================
  // THEME
  // ==========================================
  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem('pc_theme', theme);
    
    const app = document.querySelector('.pc-app');
    if (app) {
      app.classList.remove('theme-light', 'theme-dark', 'theme-neon');
      app.classList.add('theme-' + theme);
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
    state.theme = localStorage.getItem('pc_theme') || 'dark';
    state.soundOn = localStorage.getItem('pc_sound') !== 'false';
    state.server = 1;
    state.apiUrl = SERVERS[1];

    render(container);
    initSounds();
    setTheme(state.theme);

    if (state.username) {
      showApp();
      startPolling();
    }
  }

  // ==========================================
  // RENDER
  // ==========================================
  function render(container) {
    container.innerHTML = `
      <div class="pc-app theme-${state.theme}">
        <!-- LOGIN -->
        <div id="pc-login" class="pc-login">
          <div class="login-card">
            <div class="login-logo">🎨</div>
            <h1>Pixel Chat</h1>
            <p>Draw & Chat Together</p>
            
            <div class="avatar-select">
              <div class="avatar-opt ${state.avatar === 'male' ? 'selected' : ''}" data-avatar="male">👦</div>
              <div class="avatar-opt ${state.avatar === 'female' ? 'selected' : ''}" data-avatar="female">👧</div>
            </div>
            
            <input type="text" id="login-name" placeholder="Nickname (letters only)" maxlength="12">
            <button id="login-btn">Join →</button>
            
            <div class="login-rules">✓ Letters only ✓ Be nice ✓ No spam</div>
          </div>
        </div>

        <!-- MAIN -->
        <div id="pc-main" class="pc-main hidden">
          <header class="pc-header">
            <div class="h-left">
              <span class="h-logo">🎨</span>
              <span class="h-title">PixelChat</span>
            </div>
            <div class="h-center">
              <button class="srv-btn active" data-server="1">S1</button>
              <button class="srv-btn" data-server="2">S2</button>
              <div class="quota-box">
                <div class="quota-fill" id="quota-fill"></div>
                <span id="quota-text">0%</span>
              </div>
            </div>
            <div class="h-right">
              <button class="h-btn" id="theme-btn">🎨</button>
              <button class="h-btn" id="sound-btn">🔊</button>
              <div class="user-info" id="user-info">
                <span id="user-avatar">👦</span>
                <span id="user-name"></span>
              </div>
              <button class="h-btn exit" id="logout-btn">✕</button>
            </div>
          </header>

          <div class="pc-body">
            <!-- CANVAS -->
            <div class="canvas-panel">
              <div class="canvas-tools">
                <div class="tool-row">
                  <button class="tool active" data-tool="draw" title="Draw">✏️</button>
                  <button class="tool" data-tool="erase" title="Eraser">🧹</button>
                  <button class="tool" data-tool="pick" title="Pick Color">💉</button>
                  <button class="tool" data-tool="fill" title="Fill Area">🪣</button>
                </div>
                <div class="tool-row">
                  <button class="brush-btn ${state.brushSize===1?'active':''}" data-size="1">1x</button>
                  <button class="brush-btn ${state.brushSize===2?'active':''}" data-size="2">2x</button>
                  <button class="brush-btn ${state.brushSize===3?'active':''}" data-size="3">3x</button>
                </div>
                <div class="tool-row">
                  <button class="zoom-btn" data-zoom="out">−</button>
                  <span id="zoom-val">100%</span>
                  <button class="zoom-btn" data-zoom="in">+</button>
                </div>
                <div class="tool-row">
                  <label class="grid-chk"><input type="checkbox" id="grid-chk" checked> Grid</label>
                  <button class="undo-btn" id="undo-btn" title="Undo">↩️</button>
                </div>
              </div>

              <div class="canvas-area">
                <div class="canvas-wrap" id="canvas-wrap">
                  <div class="pixel-grid" id="pixel-grid"></div>
                </div>
                <div class="pixel-info" id="pixel-info">Hover for info</div>
              </div>

              <div class="color-bar">
                <div class="cur-color" id="cur-color"></div>
                <div class="palette" id="palette"></div>
              </div>

              <div class="cooldown" id="cooldown"></div>
              
              <div class="canvas-footer">
                <span>🖼️ <span id="px-count">0</span> pixels</span>
                <span>⏰ <span id="px-reset">12</span>h reset</span>
              </div>
            </div>

            <!-- CHAT -->
            <div class="chat-panel">
              <div class="chat-head">
                <span>#<span id="room-name">general</span></span>
                <select id="room-sel">
                  <option value="general">General</option>
                  <option value="art">Art</option>
                  <option value="random">Random</option>
                </select>
              </div>

              <div class="chat-msgs" id="chat-msgs">
                <div class="chat-welcome">👋 Welcome! Be nice.</div>
              </div>

              <div class="chat-status" id="chat-status">
                <span class="status-dot"></span>
                <span class="status-txt">Connecting...</span>
              </div>

              <div class="chat-input-area">
                <div class="emoji-row hidden" id="emoji-row">
                  ${CONFIG.EMOJIS.map(e => `<span class="emo">${e}</span>`).join('')}
                </div>
                <div class="chat-input-row">
                  <button class="emo-btn" id="emo-btn">😀</button>
                  <input type="text" id="msg-input" placeholder="Message..." maxlength="150">
                  <button class="send-btn" id="send-btn">➤</button>
                </div>
              </div>

              <details class="rules-box">
                <summary>📋 Rules</summary>
                <div>• Letters only, no numbers<br>• Be respectful<br>• No links or personal info</div>
              </details>
            </div>
          </div>
        </div>

        <!-- THEME MODAL -->
        <div class="modal hidden" id="theme-modal">
          <div class="modal-box">
            <h3>Theme</h3>
            <button class="theme-pick" data-theme="light">☀️ Light</button>
            <button class="theme-pick" data-theme="dark">🌙 Dark</button>
            <button class="theme-pick" data-theme="neon">💚 Neon</button>
            <button class="modal-close" id="modal-close">Close</button>
          </div>
        </div>

        <!-- TOAST -->
        <div class="toast-box" id="toast-box"></div>
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
      userInfo: document.getElementById('user-info'),
      userAvatar: document.getElementById('user-avatar'),
      userName: document.getElementById('user-name'),
      logoutBtn: document.getElementById('logout-btn'),
      quotaFill: document.getElementById('quota-fill'),
      quotaText: document.getElementById('quota-text'),
      grid: document.getElementById('pixel-grid'),
      canvasWrap: document.getElementById('canvas-wrap'),
      palette: document.getElementById('palette'),
      curColor: document.getElementById('cur-color'),
      cooldown: document.getElementById('cooldown'),
      pixelInfo: document.getElementById('pixel-info'),
      pxCount: document.getElementById('px-count'),
      pxReset: document.getElementById('px-reset'),
      zoomVal: document.getElementById('zoom-val'),
      gridChk: document.getElementById('grid-chk'),
      undoBtn: document.getElementById('undo-btn'),
      roomSel: document.getElementById('room-sel'),
      roomName: document.getElementById('room-name'),
      msgs: document.getElementById('chat-msgs'),
      status: document.getElementById('chat-status'),
      msgInput: document.getElementById('msg-input'),
      sendBtn: document.getElementById('send-btn'),
      emoBtn: document.getElementById('emo-btn'),
      emoRow: document.getElementById('emoji-row'),
      themeBtn: document.getElementById('theme-btn'),
      soundBtn: document.getElementById('sound-btn'),
      themeModal: document.getElementById('theme-modal'),
      modalClose: document.getElementById('modal-close'),
      toastBox: document.getElementById('toast-box')
    };
  }

  function bindEvents() {
    // Avatar
    document.querySelectorAll('.avatar-opt').forEach(a => {
      a.onclick = () => {
        document.querySelectorAll('.avatar-opt').forEach(x => x.classList.remove('selected'));
        a.classList.add('selected');
        state.avatar = a.dataset.avatar;
      };
    });

    // Login
    el.loginBtn.onclick = handleLogin;
    el.loginName.onkeypress = e => { if (e.key === 'Enter') handleLogin(); };

    // Logout
    el.logoutBtn.onclick = handleLogout;

    // Servers
    document.querySelectorAll('.srv-btn').forEach(b => {
      b.onclick = () => switchServer(parseInt(b.dataset.server));
    });

    // Tools
    document.querySelectorAll('.tool').forEach(t => {
      t.onclick = () => {
        document.querySelectorAll('.tool').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        state.tool = t.dataset.tool;
      };
    });

    // Brush size
    document.querySelectorAll('.brush-btn').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('.brush-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        state.brushSize = parseInt(b.dataset.size);
      };
    });

    // Zoom
    document.querySelectorAll('.zoom-btn').forEach(b => {
      b.onclick = () => handleZoom(b.dataset.zoom);
    });

    // Grid
    el.gridChk.onchange = () => {
      state.showGrid = el.gridChk.checked;
      el.grid.classList.toggle('no-grid', !state.showGrid);
    };

    // Undo
    el.undoBtn.onclick = handleUndo;

    // Room
    el.roomSel.onchange = handleRoomChange;

    // Chat
    el.sendBtn.onclick = handleSend;
    el.msgInput.onkeypress = e => { if (e.key === 'Enter') handleSend(); };

    // Emoji
    el.emoBtn.onclick = () => el.emoRow.classList.toggle('hidden');
    el.emoRow.onclick = e => {
      if (e.target.classList.contains('emo')) {
        el.msgInput.value += e.target.textContent;
        el.emoRow.classList.add('hidden');
        el.msgInput.focus();
      }
    };

    // Theme
    el.themeBtn.onclick = () => el.themeModal.classList.remove('hidden');
    el.modalClose.onclick = () => el.themeModal.classList.add('hidden');
    document.querySelectorAll('.theme-pick').forEach(b => {
      b.onclick = () => {
        setTheme(b.dataset.theme);
        el.themeModal.classList.add('hidden');
        toast('Theme: ' + b.dataset.theme);
      };
    });

    // Sound
    el.soundBtn.onclick = () => {
      state.soundOn = !state.soundOn;
      localStorage.setItem('pc_sound', state.soundOn);
      el.soundBtn.textContent = state.soundOn ? '🔊' : '🔇';
      toast(state.soundOn ? 'Sound ON' : 'Sound OFF');
    };

    // Close modals on outside click
    el.themeModal.onclick = e => {
      if (e.target === el.themeModal) el.themeModal.classList.add('hidden');
    };
    document.onclick = e => {
      if (!el.emoBtn.contains(e.target) && !el.emoRow.contains(e.target)) {
        el.emoRow.classList.add('hidden');
      }
    };
  }

  // ==========================================
  // TOAST
  // ==========================================
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    el.toastBox.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2000);
  }

  // ==========================================
  // LOGIN/LOGOUT
  // ==========================================
  function handleLogin() {
    const name = el.loginName.value.trim();
    
    if (detectXSS(name)) {
      xssWarning();
      shake(el.loginName);
      return;
    }
    
    if (!name || name.length < 2 || name.length > 12 || /[^a-zA-Z]/.test(name)) {
      shake(el.loginName);
      toast('Letters only, 2-12 chars!');
      return;
    }

    state.username = name;
    localStorage.setItem('pc_user', name);
    localStorage.setItem('pc_avatar', state.avatar);

    fetch(state.apiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ action: 'setProfile', username: name, avatar: state.avatar })
    }).catch(() => {});

    playSound('join');
    showApp();
    startPolling();
    toast('Welcome ' + name + '!');
  }

  function handleLogout() {
    stopPolling();
    state.username = '';
    state.lastTs = 0;
    state.displayed.clear();
    state.pixels = {};
    state.history = [];
    localStorage.removeItem('pc_user');
    el.main.classList.add('hidden');
    el.login.classList.remove('hidden');
    el.loginName.value = '';
    el.msgs.innerHTML = '<div class="chat-welcome">👋 Welcome!</div>';
    renderGrid();
  }

  function showApp() {
    el.login.classList.add('hidden');
    el.main.classList.remove('hidden');
    el.userName.textContent = state.username;
    el.userAvatar.textContent = state.avatar === 'female' ? '👧' : '👦';
    el.curColor.style.background = state.color;
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
    document.querySelectorAll('.srv-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.server) === num);
    });
    el.msgs.innerHTML = '<div class="sys-msg">Server ' + num + '</div>';
    renderGrid();
    startPolling();
    toast('Server ' + num);
  }

  // ==========================================
  // PALETTE
  // ==========================================
  function renderPalette() {
    el.palette.innerHTML = CONFIG.COLORS.map((c, i) =>
      `<div class="swatch${i===0?' sel':''}" style="background:${c}" data-c="${c}"></div>`
    ).join('');

    el.palette.onclick = e => {
      if (e.target.classList.contains('swatch')) {
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
        e.target.classList.add('sel');
        state.color = e.target.dataset.c;
        el.curColor.style.background = state.color;
      }
    };
    el.curColor.style.background = state.color;
  }

  // ==========================================
  // CANVAS
  // ==========================================
  function renderGrid() {
    el.grid.innerHTML = '';
    el.grid.style.gridTemplateColumns = `repeat(${CONFIG.GRID_SIZE}, 1fr)`;

    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        const px = document.createElement('div');
        px.className = 'px';
        px.dataset.x = x;
        px.dataset.y = y;
        el.grid.appendChild(px);
      }
    }

    el.grid.onmousedown = e => handleCanvasAction(e);
    el.grid.onmousemove = handleCanvasHover;
    el.grid.onmouseleave = () => { el.pixelInfo.textContent = 'Hover for info'; };
  }

  function handleCanvasAction(e) {
    if (!e.target.classList.contains('px')) return;
    const x = parseInt(e.target.dataset.x);
    const y = parseInt(e.target.dataset.y);

    switch (state.tool) {
      case 'pick':
        pickColor(x, y);
        break;
      case 'erase':
        if (state.canPlace) placePixels(x, y, '#FFFFFF');
        break;
      case 'fill':
        if (state.canPlace) floodFill(x, y, state.color);
        break;
      default: // draw
        if (state.canPlace) placePixels(x, y, state.color);
    }
  }

  function handleCanvasHover(e) {
    if (!e.target.classList.contains('px')) return;
    const x = e.target.dataset.x;
    const y = e.target.dataset.y;
    const key = x + '_' + y;
    const info = state.pixels[key];
    el.pixelInfo.textContent = info?.user ? `[${x},${y}] by ${info.user}` : `[${x},${y}]`;
  }

  function pickColor(x, y) {
    const key = x + '_' + y;
    if (state.pixels[key]) {
      state.color = state.pixels[key].color;
      el.curColor.style.background = state.color;
      document.querySelectorAll('.swatch').forEach(s => {
        s.classList.toggle('sel', s.dataset.c === state.color);
      });
      toast('Color picked!');
      playSound('pixel');
    }
  }

  function placePixels(cx, cy, color) {
    state.canPlace = false;
    const cd = 800;
    startCooldown(cd);
    playSound('pixel');

    const placed = [];
    const size = state.brushSize;
    const half = Math.floor(size / 2);

    for (let dy = -half; dy < size - half; dy++) {
      for (let dx = -half; dx < size - half; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < CONFIG.GRID_SIZE && y >= 0 && y < CONFIG.GRID_SIZE) {
          const key = x + '_' + y;
          const oldColor = state.pixels[key]?.color || '#FFFFFF';
          placed.push({ x, y, oldColor });
          updatePixel(x, y, color, state.username);
          
          // Send to server
          fetch(state.apiUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'setPixel', x, y, color, username: state.username })
          }).catch(() => {});
        }
      }
    }

    // Save to history for undo
    if (placed.length > 0) {
      state.history.push(placed);
      if (state.history.length > state.maxHistory) state.history.shift();
    }

    setTimeout(() => { state.canPlace = true; }, cd);
  }

  function floodFill(startX, startY, newColor) {
    const key = startX + '_' + startY;
    const targetColor = state.pixels[key]?.color || '#FFFFFF';
    
    if (targetColor === newColor) return;
    
    state.canPlace = false;
    const cd = 2000;
    startCooldown(cd);
    playSound('pixel');

    const stack = [[startX, startY]];
    const visited = new Set();
    const placed = [];
    let count = 0;
    const maxFill = 100;

    while (stack.length > 0 && count < maxFill) {
      const [x, y] = stack.pop();
      const k = x + '_' + y;
      
      if (visited.has(k)) continue;
      if (x < 0 || x >= CONFIG.GRID_SIZE || y < 0 || y >= CONFIG.GRID_SIZE) continue;
      
      const currentColor = state.pixels[k]?.color || '#FFFFFF';
      if (currentColor !== targetColor) continue;
      
      visited.add(k);
      placed.push({ x, y, oldColor: currentColor });
      updatePixel(x, y, newColor, state.username);
      count++;

      fetch(state.apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'setPixel', x, y, color: newColor, username: state.username })
      }).catch(() => {});

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    if (placed.length > 0) {
      state.history.push(placed);
      if (state.history.length > state.maxHistory) state.history.shift();
    }

    toast(`Filled ${count} pixels`);
    setTimeout(() => { state.canPlace = true; }, cd);
  }

  function handleUndo() {
    if (state.history.length === 0) {
      toast('Nothing to undo');
      return;
    }

    const lastAction = state.history.pop();
    playSound('undo');

    lastAction.forEach(({ x, y, oldColor }) => {
      updatePixel(x, y, oldColor, state.username);
      fetch(state.apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'setPixel', x, y, color: oldColor, username: state.username })
      }).catch(() => {});
    });

    toast('Undone!');
  }

  function updatePixel(x, y, color, user) {
    const idx = y * CONFIG.GRID_SIZE + x;
    const px = el.grid.children[idx];
    if (px) {
      px.style.background = color;
      px.classList.add('pop');
      setTimeout(() => px.classList.remove('pop'), 200);
    }
    state.pixels[x + '_' + y] = { color, user };
  }

  function startCooldown(ms) {
    el.cooldown.style.transition = 'none';
    el.cooldown.style.width = '100%';
    requestAnimationFrame(() => {
      el.cooldown.style.transition = `width ${ms}ms linear`;
      el.cooldown.style.width = '0%';
    });
  }

  function handleZoom(dir) {
    if (dir === 'in' && state.zoom < 2) state.zoom += 0.25;
    if (dir === 'out' && state.zoom > 0.5) state.zoom -= 0.25;
    el.grid.style.transform = `scale(${state.zoom})`;
    el.zoomVal.textContent = Math.round(state.zoom * 100) + '%';
  }

  // ==========================================
  // ROOM
  // ==========================================
  function handleRoomChange() {
    state.room = el.roomSel.value;
    state.lastTs = 0;
    state.displayed.clear();
    el.roomName.textContent = state.room;
    el.msgs.innerHTML = '<div class="sys-msg">#' + state.room + '</div>';
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
      return;
    }

    el.msgInput.value = '';
    el.msgInput.disabled = true;

    try {
      await fetch(state.apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'sendMessage',
          room: state.room,
          username: state.username,
          message: msg,
          avatar: state.avatar
        })
      });
      playSound('message');
      setTimeout(fetchMessages, 500);
    } catch(e) {
      el.msgInput.value = msg;
      toast('Send failed');
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
        handleConnError();
      }
    } catch(e) {
      handleConnError();
    }

    state.fetching = false;
  }

  function handleConnError() {
    state.failCount++;
    setStatus(false);
    if (state.failCount >= 3 && !state.autoSwitched) {
      state.autoSwitched = true;
      toast('Switching server...');
      setTimeout(() => switchServer(state.server === 1 ? 2 : 1), 1000);
    }
  }

  function renderMessages(msgs) {
    msgs.forEach(m => {
      const own = m.username === state.username;
      const div = document.createElement('div');
      div.className = 'msg' + (own ? ' own' : '');
      
      const ava = document.createElement('span');
      ava.className = 'msg-ava ' + (m.avatar || 'male');
      ava.textContent = m.avatar === 'female' ? '👧' : '👦';
      
      const body = document.createElement('div');
      body.className = 'msg-body';
      
      const head = document.createElement('div');
      head.className = 'msg-head';
      
      const name = document.createElement('span');
      name.className = 'msg-name';
      name.textContent = m.username;
      
      const time = document.createElement('span');
      time.className = 'msg-time';
      const mins = Math.floor((Date.now() - m.timestamp) / 60000);
      time.textContent = mins < 1 ? 'now' : mins + 'm';
      
      head.appendChild(name);
      head.appendChild(time);
      
      const text = document.createElement('div');
      text.className = 'msg-text';
      text.textContent = m.message;
      
      body.appendChild(head);
      body.appendChild(text);
      div.appendChild(ava);
      div.appendChild(body);
      
      el.msgs.appendChild(div);
    });
    el.msgs.scrollTop = el.msgs.scrollHeight;
  }

  async function fetchPixels() {
    try {
      const res = await fetch(state.apiUrl + '?action=getPixels');
      const data = await res.json();
      if (data.success) {
        el.pxCount.textContent = data.pixels.length;
        data.pixels.forEach(p => {
          const key = p.x + '_' + p.y;
          if (!state.pixels[key] || state.pixels[key].color !== p.color) {
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
        el.pxCount.textContent = data.totalPixels || 0;
        el.pxReset.textContent = data.hoursUntilReset || 12;
      }
    } catch(e) {}
  }

  async function checkStatus() {
    try {
      const res = await fetch(state.apiUrl + '?action=getStatus', { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (data.success) {
        state.quota = data.quotaUsed || 0;
        el.quotaFill.style.width = state.quota + '%';
        el.quotaText.textContent = state.quota + '%';
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
    checkStatus();
    state.chatTimer = setInterval(fetchMessages, CONFIG.CHAT_POLL);
    state.pixelTimer = setInterval(fetchPixels, CONFIG.PIXEL_POLL);
    setInterval(checkStatus, 30000);
  }

  function stopPolling() {
    clearInterval(state.chatTimer);
    clearInterval(state.pixelTimer);
  }

  // ==========================================
  // UTILS
  // ==========================================
  function setStatus(ok) {
    state.connected = ok;
    el.status.className = 'chat-status ' + (ok ? 'on' : 'off');
    el.status.querySelector('.status-txt').textContent = ok ? 'Connected' : 'Reconnecting...';
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
