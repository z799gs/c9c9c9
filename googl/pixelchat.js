// ==========================================
// PIXEL CHAT - FINAL VERSION
// ==========================================

const PixelChatApp = (function() {
  'use strict';

  const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycby_DeW_6VNTNJRjrAyObiHxNlbfO-ixuoCDFz-iSh3z0p7akfrdoJZIBT0-vdcQrs3u/exec',
    CHAT_POLL_INTERVAL: 5000,
    PIXEL_POLL_INTERVAL: 3000,
    GRID_SIZE: 64,
    COLORS: [
      '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
      '#FFFF00', '#FF00FF', '#00FFFF', '#FF8000', '#8000FF',
      '#0080FF', '#FF0080', '#80FF00', '#00FF80', '#808080',
      '#C0C0C0', '#800000', '#008000', '#000080', '#808000',
      '#800080', '#008080', '#FFC0CB', '#FFD700', '#A52A2A',
      '#4B0082', '#EE82EE', '#FA8072', '#7FFFD4', '#D2691E',
      '#DC143C', '#00CED1', '#9400D3', '#FF1493', '#1E90FF'
    ]
  };

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
    pixels: {},
    isAdmin: false,
    totalPixels: 0,
    daysUntilReset: 7
  };

  let elements = {};

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    state.username = localStorage.getItem('pixelChatUsername') || '';
    // Don't auto-load admin status - will be checked from server
    state.isAdmin = false;
    
    renderApp(container);

    if (state.username) {
      showMainApp();
      startPolling();
      // Check admin status from server only
      checkServerStatus();
    }
  }

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
            <button id="join-btn">Join Canvas</button>
            <div class="login-info">
              <span>🖼️ 64x64 collaborative canvas</span>
              <span>⏰ Resets every 7 days</span>
            </div>
          </div>
        </div>

        <!-- Main App -->
        <div id="main-app" class="hidden">
          <!-- Header -->
          <div class="app-header">
            <div class="app-logo">
              <span>🎨</span> Pixel Chat
            </div>
            <div class="header-stats">
              <div class="stat-item">
                <span class="stat-icon">🖼️</span>
                <span id="stat-pixels">0</span> pixels
              </div>
              <div class="stat-item">
                <span class="stat-icon">⏰</span>
                Reset in <span id="stat-days">7</span>d
              </div>
            </div>
            <div class="user-info">
              <span class="username-display" id="user-display"></span>
              <button class="logout-btn" id="logout-btn" title="Logout">🚪</button>
            </div>
          </div>

          <!-- Main Container -->
          <div class="main-container">
            <!-- Pixel Art Section -->
            <div class="pixel-section">
              <div class="pixel-header">
                <h3>🖼️ Canvas</h3>
                <div class="pixel-info">
                  <span class="pixel-coords" id="pixel-coords">Hover to see coordinates</span>
                </div>
              </div>
              
              <div class="canvas-container">
                <div class="pixel-canvas" id="pixel-canvas"></div>
              </div>

              <div class="tools-section">
                <div class="color-label">Select Color:</div>
                <div class="color-palette" id="color-palette"></div>
                
                <div class="cooldown-container">
                  <div class="cooldown-label">Cooldown:</div>
                  <div class="cooldown-bar">
                    <div class="cooldown-progress" id="cooldown-bar"></div>
                  </div>
                </div>
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
                  <option value="random">💬 Random</option>
                </select>
              </div>

              <div class="chat-messages" id="chat-messages">
                <div class="chat-welcome">
                  <div class="welcome-icon">👋</div>
                  <div class="welcome-text">Welcome to Pixel Chat!</div>
                  <div class="welcome-rules">Be respectful • No spam • Have fun!</div>
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
      statPixels: document.getElementById('stat-pixels'),
      statDays: document.getElementById('stat-days'),
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
    elements.joinBtn.addEventListener('click', handleJoin);
    elements.usernameInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleJoin();
    });

    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.roomSelect.addEventListener('change', handleRoomChange);

    elements.sendBtn.addEventListener('click', handleSendMessage);
    elements.messageInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleSendMessage();
    });
  }

  // ==========================================
  // SERVER STATUS CHECK (Fixed - no auto admin)
  // ==========================================
  async function checkServerStatus() {
    try {
      const url = CONFIG.API_URL + '?action=getConfig&username=' + encodeURIComponent(state.username);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        // Update stats
        if (data.totalPixels !== undefined) {
          state.totalPixels = data.totalPixels;
          elements.statPixels.textContent = formatNumber(data.totalPixels);
        }
        
        if (data.daysUntilReset !== undefined) {
          state.daysUntilReset = data.daysUntilReset;
          elements.statDays.textContent = data.daysUntilReset;
          
          if (data.daysUntilReset <= 1) {
            elements.statDays.parentElement.classList.add('warning');
          }
        }
        
        // Only set admin if server confirms
        if (data.isAdmin === true) {
          setAdminStatus(true);
        }
      }
    } catch (e) {
      console.log('Status check failed');
    }
  }

  function setAdminStatus(isAdmin) {
    state.isAdmin = isAdmin;
    
    if (isAdmin && elements.userDisplay) {
      elements.userDisplay.classList.add('admin');
    } else if (elements.userDisplay) {
      elements.userDisplay.classList.remove('admin');
    }
  }

  function showAdminNotification() {
    const notification = document.createElement('div');
    notification.className = 'admin-notification';
    notification.innerHTML = '<span class="notif-icon">👑</span><span class="notif-text">Admin Access Granted!</span>';
    document.body.appendChild(notification);
    
    setTimeout(function() { 
      notification.classList.add('fade-out');
      setTimeout(function() { notification.remove(); }, 500);
    }, 2500);
  }

  // ==========================================
  // COLOR PALETTE
  // ==========================================
  function renderColorPalette() {
    let html = '';
    for (let i = 0; i < CONFIG.COLORS.length; i++) {
      const color = CONFIG.COLORS[i];
      const selected = i === 0 ? 'selected' : '';
      html += '<button class="color-btn ' + selected + '" style="background: ' + color + ';" data-color="' + color + '" title="' + color + '"></button>';
    }
    elements.colorPalette.innerHTML = html;

    elements.colorPalette.addEventListener('click', function(e) {
      if (e.target.classList.contains('color-btn')) {
        const btns = document.querySelectorAll('.color-btn');
        for (let i = 0; i < btns.length; i++) {
          btns[i].classList.remove('selected');
        }
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
    grid.style.gridTemplateColumns = 'repeat(' + CONFIG.GRID_SIZE + ', 1fr)';

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
    grid.addEventListener('mouseout', function() {
      elements.pixelCoords.textContent = 'Hover to see coordinates';
    });
  }

  function handlePixelHover(e) {
    if (e.target.classList.contains('pixel')) {
      const x = e.target.dataset.x;
      const y = e.target.dataset.y;
      const color = state.pixels[x + '_' + y] || 'empty';
      elements.pixelCoords.textContent = 'X: ' + x + ', Y: ' + y + ' [' + color + ']';
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
    
    const cooldownTime = state.isAdmin ? 300 : 600;
    startCooldown(cooldownTime);

    updatePixelColor(x, y, color);

    try {
      await fetch(CONFIG.API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setPixel',
          x: x,
          y: y,
          color: color,
          username: state.username
        })
      });
    } catch (err) {
      // Silent fail
    }

    setTimeout(function() {
      state.canPlacePixel = true;
    }, cooldownTime);
  }

  function updatePixelColor(x, y, color) {
    const index = y * CONFIG.GRID_SIZE + x;
    const pixel = elements.pixelCanvas.children[index];
    if (pixel) {
      pixel.style.background = color;
    }
    state.pixels[x + '_' + y] = color;
  }

  function startCooldown(duration) {
    elements.cooldownBar.style.width = '100%';
    elements.cooldownBar.style.transition = 'none';
    
    setTimeout(function() {
      elements.cooldownBar.style.transition = 'width ' + duration + 'ms linear';
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
      setTimeout(function() { elements.usernameInput.classList.remove('shake'); }, 300);
      return;
    }

    if (username.length > 15) {
      alert('Username too long (max 15 characters)');
      return;
    }

    state.username = username;
    state.isAdmin = false; // Reset admin status
    localStorage.setItem('pixelChatUsername', username);
    localStorage.removeItem('pixelChatAdmin'); // Clear any stored admin status
    
    showMainApp();
    startPolling();
    checkServerStatus();
  }

  function handleLogout() {
    stopPolling();
    state.username = '';
    state.lastChatTimestamp = 0;
    state.displayedTimestamps.clear();
    state.isAdmin = false;
    state.pixels = {};
    
    localStorage.removeItem('pixelChatUsername');
    localStorage.removeItem('pixelChatAdmin');

    elements.mainApp.classList.add('hidden');
    elements.loginScreen.classList.remove('hidden');
    elements.usernameInput.value = '';
    elements.userDisplay.classList.remove('admin');
    
    // Reset chat
    elements.chatMessages.innerHTML = '<div class="chat-welcome"><div class="welcome-icon">👋</div><div class="welcome-text">Welcome to Pixel Chat!</div><div class="welcome-rules">Be respectful • No spam • Have fun!</div></div>';
    
    // Reset canvas
    renderPixelGrid();
  }

  function handleRoomChange() {
    state.currentRoom = elements.roomSelect.value;
    state.lastChatTimestamp = 0;
    state.displayedTimestamps.clear();
    elements.roomName.textContent = state.currentRoom;
    elements.chatMessages.innerHTML = '<div class="chat-system">📍 Joined #' + state.currentRoom + '</div>';
    fetchMessages();
  }

  async function handleSendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message) return;

    // Check for admin command
    if (message.toLowerCase().startsWith('/admin ')) {
      elements.messageInput.value = '';
      await tryAdminLogin(message.substring(7).trim());
      return;
    }

    elements.messageInput.value = '';
    elements.messageInput.disabled = true;
    elements.sendBtn.disabled = true;

    try {
      await sendMessage(message);
      setTimeout(fetchMessages, 500);
    } catch (err) {
      elements.messageInput.value = message;
    }
    
    elements.messageInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.messageInput.focus();
  }

  async function tryAdminLogin(code) {
    try {
      // Send admin command
      await fetch(CONFIG.API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendMessage',
          room: '_admin_',
          username: state.username,
          message: '/admin ' + code
        })
      });
      
      // Wait and verify from server
      setTimeout(async function() {
        try {
          const url = CONFIG.API_URL + '?action=getConfig&username=' + encodeURIComponent(state.username);
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.success && data.isAdmin === true) {
            setAdminStatus(true);
            showAdminNotification();
          } else {
            alert('Invalid admin code');
          }
        } catch (e) {
          alert('Could not verify. Try refreshing the page.');
        }
      }, 2000);
      
    } catch (e) {
      alert('Error. Please try again.');
    }
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
      const url = CONFIG.API_URL + '?action=getMessages&room=' + encodeURIComponent(state.currentRoom) + '&since=' + state.lastChatTimestamp;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.messages) {
        updateConnectionStatus(true);

        const newMessages = [];
        for (let i = 0; i < data.messages.length; i++) {
          if (!state.displayedTimestamps.has(data.messages[i].timestamp)) {
            newMessages.push(data.messages[i]);
          }
        }
        
        if (newMessages.length > 0) {
          renderMessages(newMessages);
          for (let i = 0; i < newMessages.length; i++) {
            state.displayedTimestamps.add(newMessages[i].timestamp);
          }
          state.lastChatTimestamp = data.messages[data.messages.length - 1].timestamp;
        }
      }
    } catch (err) {
      updateConnectionStatus(false);
    }
    
    state.isFetching = false;
  }

  async function fetchPixels() {
    try {
      const url = CONFIG.API_URL + '?action=getPixels';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.pixels) {
        // Update stats
        elements.statPixels.textContent = formatNumber(data.pixels.length);
        
        for (let i = 0; i < data.pixels.length; i++) {
          const p = data.pixels[i];
          const key = p.x + '_' + p.y;
          if (state.pixels[key] !== p.color) {
            updatePixelColor(p.x, p.y, p.color);
          }
        }
      }
    } catch (err) {
      // Silent
    }
  }

  // ==========================================
  // UI UPDATES
  // ==========================================
  function showMainApp() {
    elements.loginScreen.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    elements.userDisplay.textContent = state.username;
    
    elements.chatMessages.innerHTML = '<div class="chat-system">👋 Welcome, ' + escapeHtml(state.username) + '!</div>';
    elements.messageInput.focus();
  }

  function renderMessages(messages) {
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isOwn = msg.username === state.username;
      const isAdminMsg = msg.isAdmin === true;
      const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const el = document.createElement('div');
      el.className = 'chat-message' + (isOwn ? ' own' : '') + (isAdminMsg ? ' admin-message' : '');
      
      const adminBadge = isAdminMsg ? '<span class="admin-badge">ADMIN</span>' : '';
      
      el.innerHTML = '<div class="message-author">' + escapeHtml(msg.username) + adminBadge + '<span class="message-time">' + time + '</span></div><div class="message-content">' + escapeHtml(msg.message) + '</div>';
      elements.chatMessages.appendChild(el);
    }

    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  function updateConnectionStatus(connected) {
    state.isConnected = connected;
    elements.chatStatus.className = 'chat-status ' + (connected ? 'connected' : 'disconnected');
    elements.chatStatus.querySelector('.status-text').textContent = connected ? 'Connected' : 'Reconnecting...';
  }

  // ==========================================
  // POLLING
  // ==========================================
  function startPolling() {
    fetchMessages();
    fetchPixels();

    state.chatTimer = setInterval(fetchMessages, CONFIG.CHAT_POLL_INTERVAL);
    state.pixelTimer = setInterval(fetchPixels, CONFIG.PIXEL_POLL_INTERVAL);
    
    // Refresh stats every 30 seconds
    setInterval(checkServerStatus, 30000);
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
  
  function formatNumber(num) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  }

  return {
    init: init,
    setApiUrl: function(url) { CONFIG.API_URL = url; }
  };

})();

// Auto init
document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('pixel-chat-container');
  if (container) {
    PixelChatApp.init('pixel-chat-container');
  }
});