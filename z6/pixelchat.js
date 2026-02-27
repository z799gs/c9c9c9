// ==========================================
// PIXEL CHAT V3 - Full Featured
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
    ]
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
    isAdmin: false,
    quota: 0,
    zoom: 1,
    tool: 'pixel', // pixel, fill, eyedrop
    showGrid: true,
    hoverPixel: null
  };

  let el = {};

  // ==========================================
  // INIT
  // ==========================================
  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    state.username = localStorage.getItem('pc_user') || '';
    state.avatar = localStorage.getItem('pc_avatar') || 'male';
    state.server = parseInt(localStorage.getItem('pc_server')) || 1;
    state.apiUrl = SERVERS[state.server] || SERVERS[1];

    render(container);

    if (state.username) {
      showApp();
      startPolling();
      checkStatus();
    }
  }

  // ==========================================
  // RENDER
  // ==========================================
  function render(container) {
    container.innerHTML = `
      <div class="pc-app">
        <!-- LOGIN -->
        <div id="pc-login" class="pc-login">
          <div class="login-card">
            <div class="login-header">
              <span class="logo">🎨</span>
              <h1>Pixel Chat</h1>
              <p>Draw & Chat Together</p>
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
            <button id="login-btn">Join</button>
            
            <div class="login-info">
              <div>✓ Letters only, no numbers</div>
              <div>✓ Be respectful to others</div>
              <div>✓ Canvas resets daily</div>
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
            </div>
            
            <div class="header-center">
              <div class="server-switch">
                <button class="server-btn ${state.server===1?'active':''}" data-server="1">Server 1</button>
                <button class="server-btn ${state.server===2?'active':''}" data-server="2">Server 2</button>
              </div>
              <div class="quota-bar">
                <div class="quota-fill" id="quota-fill"></div>
                <span class="quota-text" id="quota-text">0%</span>
              </div>
            </div>
            
            <div class="header-right">
              <div class="user-badge" id="user-badge">
                <span class="user-avatar" id="user-avatar">👦</span>
                <span class="user-name" id="user-name"></span>
              </div>
              <button class="logout-btn" id="logout-btn">Exit</button>
            </div>
          </header>

          <!-- MAIN CONTENT -->
          <div class="pc-content">
            <!-- CANVAS SECTION -->
            <div class="canvas-section">
              <div class="canvas-toolbar">
                <div class="tool-group">
                  <button class="tool-btn active" data-tool="pixel" title="Draw">✏️</button>
                  <button class="tool-btn" data-tool="eyedrop" title="Pick Color">💉</button>
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
                <div class="pixel-info" id="pixel-info">Hover to see info</div>
              </div>

              <div class="canvas-wrapper" id="canvas-wrapper">
                <div class="pixel-canvas" id="pixel-canvas"></div>
              </div>

              <div class="color-section">
                <div class="color-current">
                  <div class="current-color" id="current-color"></div>
                  <span>Selected</span>
                </div>
                <div class="color-palette" id="color-palette"></div>
              </div>

              <div class="cooldown-bar">
                <div class="cooldown-fill" id="cooldown-fill"></div>
              </div>

              <div class="canvas-stats">
                <span>🖼️ <span id="pixel-count">0</span> pixels</span>
                <span>⏰ Reset: <span id="reset-time">24h</span></span>
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
                  <span class="welcome-icon">👋</span>
                  <span>Welcome! Be nice & have fun!</span>
                </div>
              </div>

              <div class="chat-status" id="chat-status">
                <span class="status-dot"></span>
                <span class="status-text">Connecting...</span>
              </div>

              <div class="chat-input">
                <input type="text" id="msg-input" placeholder="Type message..." maxlength="150" autocomplete="off">
                <button id="send-btn">Send</button>
              </div>

              <!-- RULES PANEL -->
              <div class="rules-panel">
                <div class="rules-title">📋 Rules</div>
                <ul>
                  <li>Letters only - no numbers</li>
                  <li>English characters only</li>
                  <li>Be respectful</li>
                  <li>No personal info</li>
                  <li>No links or codes</li>
                  <li>No spam</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
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
      userBadge: document.getElementById('user-badge'),
      userAvatar: document.getElementById('user-avatar'),
      userName: document.getElementById('user-name'),
      logoutBtn: document.getElementById('logout-btn'),
      quotaFill: document.getElementById('quota-fill'),
      quotaText: document.getElementById('quota-text'),
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
      sendBtn: document.getElementById('send-btn')
    };
  }

  function bindEvents() {
    // Avatar select
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

    // Server switch
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

    // Grid toggle
    el.gridToggle.addEventListener('change', () => {
      state.showGrid = el.gridToggle.checked;
      el.canvas.classList.toggle('no-grid', !state.showGrid);
    });

    // Room
    el.roomSelect.addEventListener('change', handleRoomChange);

    // Chat
    el.sendBtn.addEventListener('click', handleSend);
    el.msgInput.addEventListener('keypress', e => { if(e.key==='Enter') handleSend(); });
  }

  // ==========================================
  // LOGIN / LOGOUT
  // ==========================================
  function handleLogin() {
    const name = el.loginName.value.trim();
    if (!name || name.length < 2 || name.length > 12) {
      shake(el.loginName);
      return;
    }
    if (/[^a-zA-Z]/.test(name)) {
      shake(el.loginName);
      alert('Letters only!');
      return;
    }

    state.username = name;
    localStorage.setItem('pc_user', name);
    localStorage.setItem('pc_avatar', state.avatar);

    // Save profile
    fetch(state.apiUrl, {
      method: 'POST', mode: 'no-cors',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ action: 'setProfile', username: name, avatar: state.avatar })
    }).catch(() => {});

    showApp();
    startPolling();
    checkStatus();
  }

  function handleLogout() {
    stopPolling();
    state.username = '';
    state.lastTs = 0;
    state.displayed.clear();
    state.pixels = {};
    state.isAdmin = false;

    localStorage.removeItem('pc_user');

    el.main.classList.add('hidden');
    el.login.classList.remove('hidden');
    el.loginName.value = '';
    el.messages.innerHTML = '<div class="chat-welcome"><span class="welcome-icon">👋</span><span>Welcome!</span></div>';
    renderGrid();
  }

  function showApp() {
    el.login.classList.add('hidden');
    el.main.classList.remove('hidden');
    el.userName.textContent = state.username;
    el.userAvatar.textContent = state.avatar === 'female' ? '👧' : '👦';
    el.userBadge.className = 'user-badge ' + state.avatar;
    el.currentColor.style.background = state.color;
    el.msgInput.focus();
  }

  // ==========================================
  // SERVER SWITCH
  // ==========================================
  function switchServer(num) {
    if (num === state.server) return;
    
    stopPolling();
    state.server = num;
    state.apiUrl = SERVERS[num] || SERVERS[1];
    state.lastTs = 0;
    state.displayed.clear();
    state.pixels = {};
    
    localStorage.setItem('pc_server', num);
    
    document.querySelectorAll('.server-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.server) === num);
    });
    
    el.messages.innerHTML = `<div class="chat-system">Switched to Server ${num}</div>`;
    renderGrid();
    startPolling();
    checkStatus();
  }

  // ==========================================
  // STATUS / QUOTA
  // ==========================================
  async function checkStatus() {
    try {
      const res = await fetch(state.apiUrl + '?action=getStatus');
      const data = await res.json();
      if (data.success) {
        state.quota = data.quotaUsed || 0;
        el.quotaFill.style.width = state.quota + '%';
        el.quotaText.textContent = state.quota + '%';
        el.quotaFill.className = 'quota-fill ' + (state.quota > 80 ? 'high' : (state.quota > 50 ? 'mid' : ''));
        
        // Auto switch if overloaded
        if (data.status === 'overloaded' && state.server === 1) {
          switchServer(2);
        }
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
    el.canvas.addEventListener('mouseleave', () => {
      el.pixelInfo.textContent = 'Hover to see info';
    });
  }

  function handleCanvasClick(e) {
    if (!e.target.classList.contains('pixel')) return;
    
    const x = parseInt(e.target.dataset.x);
    const y = parseInt(e.target.dataset.y);

    if (state.tool === 'eyedrop') {
      const key = x + '_' + y;
      if (state.pixels[key]) {
        state.color = state.pixels[key];
        el.currentColor.style.background = state.color;
        document.querySelectorAll('.color-swatch').forEach(s => {
          s.classList.toggle('selected', s.dataset.color === state.color);
        });
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
    
    if (info && typeof info === 'object') {
      el.pixelInfo.textContent = `[${x},${y}] by ${info.user || '?'}`;
    } else if (info) {
      el.pixelInfo.textContent = `[${x},${y}] ${info}`;
    } else {
      el.pixelInfo.textContent = `[${x},${y}] empty`;
    }
  }

  async function placePixel(x, y, color) {
    state.canPlace = false;
    const cd = state.isAdmin ? 300 : 800;
    startCooldown(cd);

    // Optimistic update
    updatePixel(x, y, color, state.username);

    try {
      await fetch(state.apiUrl, {
        method: 'POST', mode: 'no-cors',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'setPixel', x, y, color, username: state.username })
      });
    } catch(e) {}

    setTimeout(() => { state.canPlace = true; }, cd);
  }

  function updatePixel(x, y, color, user) {
    const idx = y * CONFIG.GRID_SIZE + x;
    const px = el.canvas.children[idx];
    if (px) px.style.background = color;
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
    el.messages.innerHTML = `<div class="chat-system">Joined #${state.room}</div>`;
    fetchMessages();
  }

  // ==========================================
  // CHAT
  // ==========================================
  async function handleSend() {
    const msg = el.msgInput.value.trim();
    if (!msg) return;

    // Admin command
    if (msg.toLowerCase().startsWith('/admin ')) {
      el.msgInput.value = '';
      await tryAdmin(msg.substring(7).trim());
      return;
    }

    el.msgInput.value = '';
    el.msgInput.disabled = true;

    try {
      await fetch(state.apiUrl, {
        method: 'POST', mode: 'no-cors',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'sendMessage',
          room: state.room,
          username: state.username,
          message: msg,
          avatar: state.avatar
        })
      });
      setTimeout(fetchMessages, 400);
    } catch(e) {
      el.msgInput.value = msg;
    }

    el.msgInput.disabled = false;
    el.msgInput.focus();
  }

  async function tryAdmin(code) {
    try {
      await fetch(state.apiUrl, {
        method: 'POST', mode: 'no-cors',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'sendMessage', room: '_admin_', username: state.username, message: '/admin ' + code })
      });
      
      setTimeout(async () => {
        const res = await fetch(state.apiUrl + '?action=getConfig&username=' + encodeURIComponent(state.username));
        const data = await res.json();
        if (data.isAdmin) {
          state.isAdmin = true;
          el.userBadge.classList.add('admin');
          showNotif('👑 Admin granted!');
        } else {
          alert('Invalid code');
        }
      }, 1500);
    } catch(e) {}
  }

  async function fetchMessages() {
    if (state.fetching) return;
    state.fetching = true;

    try {
      const res = await fetch(state.apiUrl + `?action=getMessages&room=${state.room}&since=${state.lastTs}`);
      const data = await res.json();

      if (data.success) {
        setStatus(true);

        const newMsgs = data.messages.filter(m => !state.displayed.has(m.timestamp));
        if (newMsgs.length) {
          renderMessages(newMsgs);
          newMsgs.forEach(m => state.displayed.add(m.timestamp));
          state.lastTs = data.messages[data.messages.length - 1].timestamp;
        }
      }
    } catch(e) {
      setStatus(false);
    }

    state.fetching = false;
  }

  function renderMessages(msgs) {
    msgs.forEach(m => {
      const own = m.username === state.username;
      const div = document.createElement('div');
      div.className = 'chat-msg' + (own ? ' own' : '') + (m.isAdmin ? ' admin' : '');
      
      const avatar = m.avatar === 'female' ? '👧' : '👦';
      const badge = m.isAdmin ? '<span class="admin-tag">★</span>' : '';
      const time = new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      
      div.innerHTML = `
        <div class="msg-avatar ${m.avatar}">${avatar}</div>
        <div class="msg-body">
          <div class="msg-header">
            <span class="msg-name">${esc(m.username)}${badge}</span>
            <span class="msg-time">${time}</span>
          </div>
          <div class="msg-text">${esc(m.message)}</div>
        </div>
      `;
      
      el.messages.appendChild(div);
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
        state.isAdmin = data.isAdmin;
        if (data.isAdmin) el.userBadge.classList.add('admin');
        
        el.pixelCount.textContent = data.totalPixels || 0;
        el.resetTime.textContent = (data.hoursUntilReset || 24) + 'h';
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

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function showNotif(text) {
    const n = document.createElement('div');
    n.className = 'notif';
    n.textContent = text;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
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
