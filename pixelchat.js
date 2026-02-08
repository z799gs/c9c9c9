const PixelChatApp = (function() {
  'use strict';


  const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycby3c8CfT7ufe2tt9zgQZtxETQdftBy95Fackcy64qjLpGCQ_clhQLsW0qI7j1jNGbJ4/exec',
    CHAT_POLL_INTERVAL: 5000,
    PIXEL_POLL_INTERVAL: 3000,
    GRID_SIZE: 32,
    COLORS: [
      '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
      '#FFFF00', '#FF00FF', '#00FFFF', '#FF8000', '#8000FF',
      '#0080FF', '#FF0080', '#80FF00', '#00FF80', '#808080',
      '#C0C0C0', '#800000', '#008000', '#000080', '#808000',
      '#800080', '#008080', '#FFC0CB', '#FFD700', '#A52A2A'
    ]
  };

  // ==========================================
  // STATE
  // ==========================================
  let state = {
    username: '',
    currentRoom: 'general',
    selectedColor: '#000000',
    lastChatTimestamp: 0,
    displayedTimestamps: new Set(),
    chatTimer: null,
    pixelTimer: null,
    isConnected: false,
    isFetching: false,
    canPlacePixel: true,
    pixels: {}
  };

  let elements = {};

  // ==========================================
  // INIT
  // ==========================================
  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    state.username = localStorage.getItem('pixelChatUsername') || '';
    renderApp(container);

    if (state.username) {
      showMainApp();
      startPolling();
    }
  }

  // ==========================================
  // RENDER
  // ==========================================
  function renderApp(container) {
    container.innerHTML = `
      <div class="pixel-chat-app">
        <!-- Login Screen -->
        <div id="login-screen" class="login-screen">
          <div class="login-box">
            <h2>🎨 Pixel Chat</h2>
            <p>Draw together & chat with friends!</p>
            <input 
              type="text" 
              id="username-input" 
              placeholder="Enter your nickname..."
              maxlength="15"
              autocomplete="off"
            >
            <button id="join-btn">Join</button>
          </div>
        </div>

        <!-- Main App -->
        <div id="main-app" class="hidden">
          <!-- Header -->
          <div class="app-header">
            <div class="app-logo">
              <span>🎨</span> Pixel Chat
            </div>
            <div class="user-info">
              <span class="username-display" id="user-display"></span>
              <button class="logout-btn" id="logout-btn">🚪</button>
            </div>
          </div>

          <!-- Main Container -->
          <div class="main-container">
            <!-- Pixel Art Section -->
            <div class="pixel-section">
              <div class="pixel-header">
                <h3>🖼️ Canvas</h3>
                <span class="pixel-coords" id="pixel-coords">X: - Y: -</span>
              </div>
              
              <div class="canvas-container">
                <div class="pixel-canvas" id="pixel-canvas"></div>
              </div>

              <div class="color-palette" id="color-palette"></div>
              
              <div class="cooldown-bar">
                <div class="cooldown-progress" id="cooldown-bar"></div>
              </div>
            </div>

            <!-- Chat Section -->
            <div class="chat-section">
              <div class="chat-header">
                <span class="chat-room-name">#<span id="room-name">general</span></span>
                <select class="room-select" id="room-select">
                  <option value="general">🏠 General</option>
                  <option value="art">🎨 Art Talk</option>
                  <option value="games">🎮 Games</option>
                  <option value="music">🎵 Music</option>
                </select>
              </div>

              <div class="chat-messages" id="chat-messages">
                <div class="chat-welcome">
                  👋 Welcome! Draw pixels and chat!
                </div>
              </div>

              <div class="chat-status" id="chat-status">
                <span class="status-dot"></span>
                <span class="status-text">Connecting...</span>
              </div>

              <div class="chat-input-area">
                <input 
                  type="text" 
                  id="message-input" 
                  placeholder="Type a message..."
                  maxlength="300"
                  autocomplete="off"
                >
                <button id="send-btn">Send</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    cacheElements();
    bindEvents();
    renderColorPalette();
    renderPixelGrid();
  }

  function cacheElements() {
    elements = {
      loginScreen: document.getElementById('login-screen'),
      mainApp: document.getElementById('main-app'),
      usernameInput: document.getElementById('username-input'),
      joinBtn: document.getElementById('join-btn'),
      userDisplay: document.getElementById('user-display'),
      logoutBtn: document.getElementById('logout-btn'),
      pixelCanvas: document.getElementById('pixel-canvas'),
      colorPalette: document.getElementById('color-palette'),
      pixelCoords: document.getElementById('pixel-coords'),
      cooldownBar: document.getElementById('cooldown-bar'),
      roomSelect: document.getElementById('room-select'),
      roomName: document.getElementById('room-name'),
      chatMessages: document.getElementById('chat-messages'),
      chatStatus: document.getElementById('chat-status'),
      messageInput: document.getElementById('message-input'),
      sendBtn: document.getElementById('send-btn')
    };
  }

  function bindEvents() {
    // Login
    elements.joinBtn.addEventListener('click', handleJoin);
    elements.usernameInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') handleJoin();
    });

    // Logout
    elements.logoutBtn.addEventListener('click', handleLogout);

    // Room change
    elements.roomSelect.addEventListener('change', handleRoomChange);

    // Chat
    elements.sendBtn.addEventListener('click', handleSendMessage);
    elements.messageInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') handleSendMessage();
    });
  }

  // ==========================================
  // COLOR PALETTE
  // ==========================================
  function renderColorPalette() {
    elements.colorPalette.innerHTML = CONFIG.COLORS.map((color, i) => `
      <button 
        class="color-btn ${i === 0 ? 'selected' : ''}" 
        style="background: ${color};"
        data-color="${color}"
      ></button>
    `).join('');

    elements.colorPalette.addEventListener('click', e => {
      if (e.target.classList.contains('color-btn')) {
        document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('selected'));
        e.target.classList.add('selected');
        state.selectedColor = e.target.dataset.color;
      }
    });
  }

  // ==========================================
  // PIXEL GRID
  // ==========================================
  function renderPixelGrid() {
    const grid = elements.pixelCanvas;
    grid.innerHTML = '';

    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        const pixel = document.createElement('div');
        pixel.className = 'pixel';
        pixel.dataset.x = x;
        pixel.dataset.y = y;
        grid.appendChild(pixel);
      }
    }

    grid.addEventListener('click', handlePixelClick);
    grid.addEventListener('mouseover', handlePixelHover);
  }

  function handlePixelHover(e) {
    if (e.target.classList.contains('pixel')) {
      const x = e.target.dataset.x;
      const y = e.target.dataset.y;
      elements.pixelCoords.textContent = `X: ${x} Y: ${y}`;
    }
  }

  function handlePixelClick(e) {
    if (!e.target.classList.contains('pixel')) return;
    if (!state.canPlacePixel) return;

    const x = parseInt(e.target.dataset.x);
    const y = parseInt(e.target.dataset.y);

    placePixel(x, y, state.selectedColor);
  }

  async function placePixel(x, y, color) {
    state.canPlacePixel = false;
    startCooldown();

    // Optimistic update
    updatePixelColor(x, y, color);

    try {
      await fetch(CONFIG.API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setPixel',
          x, y, color,
          username: state.username
        })
      });
    } catch (err) {
      console.error('Pixel error:', err);
    }

    setTimeout(() => {
      state.canPlacePixel = true;
    }, 1000);
  }

  function updatePixelColor(x, y, color) {
    const index = y * CONFIG.GRID_SIZE + x;
    const pixel = elements.pixelCanvas.children[index];
    if (pixel) {
      pixel.style.background = color;
    }
    state.pixels[`${x}_${y}`] = color;
  }

  function startCooldown() {
    elements.cooldownBar.style.width = '100%';
    elements.cooldownBar.style.transition = 'none';
    
    setTimeout(() => {
      elements.cooldownBar.style.transition = 'width 1s linear';
      elements.cooldownBar.style.width = '0%';
    }, 50);
  }

  // ==========================================
  // HANDLERS
  // ==========================================
  function handleJoin() {
    const username = elements.usernameInput.value.trim();
    if (!username || username.length < 2) {
      elements.usernameInput.classList.add('shake');
      setTimeout(() => elements.usernameInput.classList.remove('shake'), 300);
      return;
    }

    state.username = username;
    localStorage.setItem('pixelChatUsername', username);
    
    showMainApp();
    startPolling();
  }

  function handleLogout() {
    stopPolling();
    state.username = '';
    state.lastChatTimestamp = 0;
    state.displayedTimestamps.clear();
    localStorage.removeItem('pixelChatUsername');

    elements.mainApp.classList.add('hidden');
    elements.loginScreen.classList.remove('hidden');
    elements.usernameInput.value = '';
    elements.chatMessages.innerHTML = '<div class="chat-welcome">👋 Welcome! Draw pixels and chat!</div>';
  }

  function handleRoomChange() {
    state.currentRoom = elements.roomSelect.value;
    state.lastChatTimestamp = 0;
    state.displayedTimestamps.clear();
    elements.roomName.textContent = state.currentRoom;
    elements.chatMessages.innerHTML = `<div class="chat-welcome">📍 Joined #${state.currentRoom}</div>`;
    fetchMessages();
  }

  function handleSendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message) return;

    elements.messageInput.value = '';
    elements.messageInput.disabled = true;
    elements.sendBtn.disabled = true;

    sendMessage(message)
      .then(() => setTimeout(fetchMessages, 500))
      .catch(err => {
        elements.messageInput.value = message;
        alert('Failed to send');
      })
      .finally(() => {
        elements.messageInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.focus();
      });
  }

  // ==========================================
  // API CALLS
  // ==========================================
  async function sendMessage(message) {
    await fetch(CONFIG.API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendMessage',
        room: state.currentRoom,
        username: state.username,
        message: message
      })
    });
  }

  async function fetchMessages() {
    if (state.isFetching) return;
    state.isFetching = true;

    try {
      const url = `${CONFIG.API_URL}?action=getMessages&room=${encodeURIComponent(state.currentRoom)}&since=${state.lastChatTimestamp}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.messages) {
        updateConnectionStatus(true);

        const newMessages = data.messages.filter(m => !state.displayedTimestamps.has(m.timestamp));
        
        if (newMessages.length > 0) {
          renderMessages(newMessages);
          newMessages.forEach(m => state.displayedTimestamps.add(m.timestamp));
          state.lastChatTimestamp = data.messages[data.messages.length - 1].timestamp;
        }
      }
    } catch (err) {
      console.error('Chat fetch error:', err);
      updateConnectionStatus(false);
    } finally {
      state.isFetching = false;
    }
  }

  async function fetchPixels() {
    try {
      const url = `${CONFIG.API_URL}?action=getPixels`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.pixels) {
        data.pixels.forEach(p => {
          if (state.pixels[`${p.x}_${p.y}`] !== p.color) {
            updatePixelColor(p.x, p.y, p.color);
          }
        });
      }
    } catch (err) {
      console.error('Pixel fetch error:', err);
    }
  }

  // ==========================================
  // UI UPDATES
  // ==========================================
  function showMainApp() {
    elements.loginScreen.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    elements.userDisplay.textContent = state.username;
    elements.chatMessages.innerHTML = `<div class="chat-welcome">👋 Welcome, ${escapeHtml(state.username)}!</div>`;
    elements.messageInput.focus();
  }

  function renderMessages(messages) {
    messages.forEach(msg => {
      const isOwn = msg.username === state.username;
      const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const el = document.createElement('div');
      el.className = `chat-message ${isOwn ? 'own' : ''}`;
      el.innerHTML = `
        <div class="message-author">
          ${escapeHtml(msg.username)}
          <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.message)}</div>
      `;
      elements.chatMessages.appendChild(el);
    });

    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  function updateConnectionStatus(connected) {
    state.isConnected = connected;
    elements.chatStatus.className = `chat-status ${connected ? 'connected' : 'disconnected'}`;
    elements.chatStatus.querySelector('.status-text').textContent = 
      connected ? 'Connected' : 'Reconnecting...';
  }

  // ==========================================
  // POLLING
  // ==========================================
  function startPolling() {
    fetchMessages();
    fetchPixels();

    state.chatTimer = setInterval(fetchMessages, CONFIG.CHAT_POLL_INTERVAL);
    state.pixelTimer = setInterval(fetchPixels, CONFIG.PIXEL_POLL_INTERVAL);
  }

  function stopPolling() {
    if (state.chatTimer) clearInterval(state.chatTimer);
    if (state.pixelTimer) clearInterval(state.pixelTimer);
    state.chatTimer = null;
    state.pixelTimer = null;
  }

  // ==========================================
  // UTILS
  // ==========================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==========================================
  // PUBLIC API
  // ==========================================
  return {
    init,
    setApiUrl: url => { CONFIG.API_URL = url; }
  };

})();

// Auto init
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('pixel-chat-container');
  if (container) {
    PixelChatApp.init('pixel-chat-container');
  }
});
