import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBDTTyEWFBam2EEWK4X2VV5E-wUJx10V38",
  authDomain: "her0s-quest.firebaseapp.com",
  projectId: "her0s-quest",
  storageBucket: "her0s-quest.firebasestorage.app",
  messagingSenderId: "120264562008",
  appId: "1:120264562008:web:69365314951dc05980812d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Application State
let state = {
  xp: 0,
  level: 1,
  totalXp: 0,
  gold: 0,
  avatar: '🦸‍♂️',
  badges: [],
  quests: { physical: [], mental: [], spiritual: [], blights: [] },
  history: {}
};

let user = null;
let currentTab = 'physical';
let chart = null;
let cal = null;
let pendingTask = null;
let selectedMood = null;
let isSyncing = false;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showError(message, containerId = 'login-error') {
  const errorEl = document.getElementById(containerId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 5000);
  }
}

function showLoading(show = true) {
  document.getElementById('loading-spinner')?.classList.toggle('hidden', !show);
}

function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

function validateXP(xp) {
  const num = parseInt(xp);
  return !isNaN(num) && num >= -100 && num <= 500 ? num : null;
}

// ============================================
// LIQUID BACKGROUND ENGINE
// ============================================

class LiquidEngine {
  constructor() {
    try {
      const canvas = document.getElementById('webGLApp');
      if (!canvas) throw new Error('Canvas not found');
      
      this.renderer = new THREE.WebGLRenderer({ 
        canvas, 
        antialias: true,
        alpha: true 
      });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      
      this.uniforms = {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Vector3(0, 0.95, 1) },
        uColor2: { value: new THREE.Vector3(0, 0.05, 0.1) }
      };
      
      this.init();
      this.handleResize();
    } catch (error) {
      console.error('WebGL initialization failed:', error);
    }
  }

  init() {
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying vec2 vUv;
      
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float t = uTime * 0.5;
        float noise = sin(p.x * 3.0 + t) * cos(p.y * 2.0 + t) + sin(t * 0.5);
        vec3 color = mix(uColor1, uColor2, noise * 0.5 + 0.5);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.scene.add(new THREE.Mesh(geometry, material));
    
    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.uniforms.uTime.value += 0.01;
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  updateTheme(c1, c2) {
    this.uniforms.uColor1.value.set(...c1);
    this.uniforms.uColor2.value.set(...c2);
  }
}

let engine;
try {
  engine = new LiquidEngine();
} catch (error) {
  console.error('Failed to initialize liquid engine:', error);
}

const themeColors = {
  physical: [[0, 0.95, 1], [0, 0.05, 0.1]],
  mental: [[0.6, 1, 0], [0.1, 0.1, 0]],
  spiritual: [[0.83, 0.68, 0.21], [0.1, 0, 0.1]],
  blights: [[1, 0.1, 0.1], [0.05, 0, 0]],
  stats: [[0.5, 0.3, 0.9], [0.1, 0.05, 0.15]],
  shop: [[1, 0.65, 0], [0.15, 0.1, 0]]
};

// ============================================
// EFFECTS & FEEDBACK
// ============================================

function vibrate(pattern) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration failed:', e);
    }
  }
}

function vibrateSuccess() {
  vibrate([100, 50, 100]);
}

function vibrateLevelUp() {
  vibrate([200, 100, 300, 100, 500]);
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00f2ff', '#d4af37', '#ff3366', '#859900']
    });
  }
}

function playSound(url) {
  try {
    const audio = new Audio(url);
    audio.volume = 0.3;
    audio.play().catch(e => console.warn('Audio play failed:', e));
  } catch (e) {
    console.warn('Audio creation failed:', e);
  }
}

function playLevelUpSound() {
  playSound('https://www.orangefreesounds.com/wp-content/uploads/2016/09/Level-up-sound-effect.mp3');
}

function playSuccessSound() {
  playSound('https://www.orangefreesounds.com/wp-content/uploads/2014/08/Success-sound-effect.mp3');
}

// ============================================
// NAVIGATION
// ============================================

window.switchTab = (tab) => {
  if (!['physical', 'mental', 'spiritual', 'blights', 'stats', 'shop'].includes(tab)) {
    console.error('Invalid tab:', tab);
    return;
  }

  currentTab = tab;
  document.body.setAttribute('data-theme', tab);
  
  // Update nav buttons
  document.querySelectorAll('.main-nav button').forEach(btn => {
    const isActive = btn.onclick && btn.onclick.toString().includes(tab);
    btn.classList.toggle('active', isActive);
  });

  // Update theme
  if (engine && themeColors[tab]) {
    engine.updateTheme(...themeColors[tab]);
  }

  // Update title
  const titleEl = document.getElementById('view-title');
  if (titleEl) titleEl.textContent = tab.toUpperCase();

  // Toggle sections
  const questArea = document.getElementById('quest-area');
  const statsArea = document.getElementById('stats-area');
  const shopArea = document.getElementById('shop-area');

  if (questArea) questArea.classList.toggle('hidden', tab === 'stats' || tab === 'shop');
  if (statsArea) statsArea.classList.toggle('hidden', tab !== 'stats');
  if (shopArea) shopArea.classList.toggle('hidden', tab !== 'shop');

  updateHeader();
  render();

  // Load content based on tab
  if (tab !== 'stats' && tab !== 'shop') {
    loadQuote();
  }
  if (tab === 'stats') renderStats();
  if (tab === 'shop') renderShop();
};

// ============================================
// HEADER UPDATES
// ============================================

function updateHeader() {
  const dateEl = document.getElementById('current-date');
  const pageEl = document.getElementById('current-page');
  const goldEl = document.getElementById('gold');
  const avatarEl = document.getElementById('avatar');
  const levelEl = document.getElementById('level-display');
  const xpFillEl = document.getElementById('xp-fill');
  const xpTextEl = document.getElementById('xp-text');
  const xpBar = document.querySelector('.xp-bar');

  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  if (pageEl) pageEl.textContent = currentTab.toUpperCase();
  if (goldEl) goldEl.textContent = state.gold;
  if (avatarEl) avatarEl.textContent = state.avatar;
  if (levelEl) levelEl.textContent = `LVL ${state.level}`;

  if (xpFillEl) xpFillEl.style.width = `${state.xp}%`;
  if (xpTextEl) xpTextEl.textContent = `${state.xp} / 100 XP`;
  if (xpBar) {
    xpBar.setAttribute('aria-valuenow', state.xp);
  }
}

// ============================================
// MOTIVATIONAL QUOTE
// ============================================

async function loadQuote() {
  const box = document.getElementById('motivational-quote');
  if (!box) return;

  box.innerHTML = '<div class="quote-skeleton"></div>';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('https://zenquotes.io/api/random', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Quote fetch failed');

    const [quote] = await res.json();
    box.innerHTML = `<p>"${sanitizeInput(quote.q)}"</p><small>— ${sanitizeInput(quote.a)}</small>`;
  } catch (error) {
    console.warn('Failed to load quote:', error);
    box.innerHTML = `<p>"Keep pushing forward."</p><small>— Your Future Self</small>`;
  }
}

// ============================================
// QUEST MANAGEMENT
// ============================================

window.addNewQuest = () => {
  const nameInput = document.getElementById('new-name');
  const xpInput = document.getElementById('new-xp');
  const repeatInput = document.getElementById('new-repeat');

  if (!nameInput || !xpInput || !repeatInput) return;

  const name = nameInput.value.trim();
  const xp = validateXP(xpInput.value);
  const repeat = repeatInput.checked;

  if (!name) {
    showError('Quest name is required');
    nameInput.focus();
    return;
  }

  if (xp === null) {
    showError('XP must be between -100 and 500');
    xpInput.focus();
    return;
  }

  if (name.length > 50) {
    showError('Quest name is too long (max 50 characters)');
    return;
  }

  // Check for duplicates
  if (state.quests[currentTab].some(q => q.name === name)) {
    showError('A quest with this name already exists');
    return;
  }

  state.quests[currentTab].push({ name, xp, repeat });

  // Clear inputs
  nameInput.value = '';
  xpInput.value = '';
  repeatInput.checked = false;

  render();
  syncData();
};

// ============================================
// TASK COMPLETION & RATING
// ============================================

window.toggleTask = (name, baseXp) => {
  const today = new Date().toISOString().slice(0, 10);
  
  if (state.history[today]?.[name]?.done) {
    alert("Already completed today!");
    return;
  }

  pendingTask = { name, baseXp };
  
  const modalTitle = document.getElementById('modal-quest-name');
  if (modalTitle) modalTitle.textContent = `Rate "${sanitizeInput(name)}"`;

  // Reset stars
  document.querySelectorAll('.stars i').forEach(s => {
    s.classList.remove('active', 'fas');
    s.classList.add('far');
  });

  // Reset moods
  document.querySelectorAll('.moods span').forEach(m => {
    m.classList.remove('active');
  });

  selectedMood = null;
  setRating(5);

  const modal = document.getElementById('rating-modal');
  if (modal) {
    modal.classList.add('active');
    // Focus first star for accessibility
    modal.querySelector('.stars i')?.focus();
  }
};

function setRating(value) {
  document.querySelectorAll('.stars i').forEach((star, i) => {
    const isActive = i < value;
    star.classList.toggle('active', isActive);
    star.classList.toggle('fas', isActive);
    star.classList.toggle('far', !isActive);
  });
}

// Star click handlers
document.querySelectorAll('.stars i').forEach(star => {
  star.addEventListener('click', () => {
    const value = parseInt(star.dataset.value);
    if (!isNaN(value)) setRating(value);
  });

  // Keyboard support
  star.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      star.click();
    }
  });
});

// Mood handlers
document.querySelectorAll('.moods span').forEach(mood => {
  mood.addEventListener('click', () => {
    document.querySelectorAll('.moods span').forEach(m => m.classList.remove('active'));
    mood.classList.add('active');
    selectedMood = mood.dataset.mood;
  });

  // Keyboard support
  mood.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      mood.click();
    }
  });
});

// Confirm rating
document.getElementById('confirm-rating')?.addEventListener('click', async () => {
  if (!pendingTask) return;

  try {
    const rating = document.querySelectorAll('.stars i.active').length || 5;

    // Calculate streak multiplier
    let streakDays = 1;
    let checkDate = new Date();
    
    while (streakDays < 365) { // Prevent infinite loop
      checkDate.setDate(checkDate.getDate() - 1);
      const dateStr = checkDate.toISOString().slice(0, 10);
      
      if (state.history[dateStr]?.[pendingTask.name]?.done) {
        streakDays++;
      } else {
        break;
      }
    }

    const multiplier = streakDays >= 7 ? 1.5 : 1;
    const earned = Math.round(pendingTask.baseXp * (rating / 5) * multiplier);

    // Update state
    const today = new Date().toISOString().slice(0, 10);
    state.xp += earned;
    state.totalXp += earned;
    state.gold += Math.max(0, Math.floor(earned / 10));

    if (!state.history[today]) state.history[today] = {};
    state.history[today][pendingTask.name] = {
      done: true,
      rating,
      mood: selectedMood,
      xp: earned,
      timestamp: Date.now()
    };

    // Effects
    playSuccessSound();
    vibrateSuccess();

    // Level up check
    while (state.xp >= 100) {
      state.level++;
      state.xp -= 100;
      
      triggerConfetti();
      playLevelUpSound();
      vibrateLevelUp();
      
      setTimeout(() => {
        alert(`🎉 LEVEL UP! Now Level ${state.level}! 🎉`);
      }, 300);
    }

    closeModal();
    render();
    await syncData();

  } catch (error) {
    console.error('Error confirming rating:', error);
    showError('Failed to save quest completion');
  }
});

function closeModal() {
  const modal = document.getElementById('rating-modal');
  if (modal) modal.classList.remove('active');
  pendingTask = null;
  selectedMood = null;
}

document.getElementById('cancel-rating')?.addEventListener('click', closeModal);

document.getElementById('rating-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'rating-modal') closeModal();
});

// ============================================
// RENDER QUESTS
// ============================================

function render() {
  updateHeader();

  const today = new Date().toISOString().slice(0, 10);
  const list = document.getElementById('habit-list');
  
  if (!list) return;

  // Reset daily quests from yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  state.quests[currentTab].forEach(quest => {
    if (quest.repeat && 
        state.history[yesterdayStr]?.[quest.name]?.done && 
        !state.history[today]?.[quest.name]) {
      if (!state.history[today]) state.history[today] = {};
      state.history[today][quest.name] = { done: false };
    }
  });

  // Render quest list
  list.innerHTML = '';

  if (state.quests[currentTab].length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-scroll fa-3x"></i>
        <p>No quests yet. Add your first quest below!</p>
      </div>
    `;
    return;
  }

  state.quests[currentTab].forEach(quest => {
    const done = state.history[today]?.[quest.name]?.done;
    const questEl = document.createElement('div');
    questEl.className = `habit-item ${done ? 'completed' : ''}`;
    questEl.role = 'listitem';

    const xpSign = quest.xp > 0 ? '+' : '';
    const repeatIcon = quest.repeat ? ' 🔄' : '';
    const buttonText = done ? '✓' : (quest.xp < 0 ? 'FAIL' : 'GO');

    questEl.innerHTML = `
      <span>${sanitizeInput(quest.name)} (${xpSign}${quest.xp} XP)${repeatIcon}</span>
      <button 
        class="btn-plus" 
        onclick="toggleTask('${sanitizeInput(quest.name)}', ${quest.xp})" 
        ${done ? 'disabled' : ''}
        aria-label="${done ? 'Completed' : 'Complete quest'}"
      >
        ${buttonText}
      </button>
    `;

    list.appendChild(questEl);
  });
}

// ============================================
// STATISTICS
// ============================================

function renderStats() {
  // Update stat cards
  document.getElementById('total-xp-stat').textContent = state.totalXp.toLocaleString();
  document.getElementById('level-stat').textContent = state.level;
  document.getElementById('gold-stat').textContent = state.gold.toLocaleString();
  
  renderXPChart();
  renderHeatmap();
  renderStreak();
  renderBadges();
  setupWeeklyReport();
}

function renderXPChart() {
  const canvas = document.getElementById('xpChart');
  if (!canvas) return;

  const labels = [];
  const data = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    
    labels.push(dateStr.slice(5));
    
    const dayHistory = state.history[dateStr] || {};
    const dayXP = Object.values(dayHistory).reduce((sum, entry) => {
      return entry.done ? sum + (entry.xp || 0) : sum;
    }, 0);
    
    data.push(dayXP);
  }

  if (chart) chart.destroy();

  chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'XP Earned',
        data,
        borderColor: getComputedStyle(document.documentElement)
          .getPropertyValue('--accent').trim() || '#00f2ff',
        backgroundColor: 'rgba(0, 242, 255, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#fff' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        x: {
          ticks: { color: '#fff' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }
      }
    }
  });
}

function renderHeatmap() {
  const container = document.getElementById('cal-heatmap');
  if (!container) return;

  try {
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(end.getFullYear() - 1);

    const heatmapData = {};

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayHistory = state.history[dateStr] || {};

      let totalXP = 0;
      const ratings = [];

      Object.values(dayHistory).forEach(entry => {
        if (entry.done) {
          totalXP += Math.abs(entry.xp || 0);
          if (entry.rating) ratings.push(entry.rating);
        }
      });

      if (totalXP > 0) {
        const timestamp = Math.floor(d.getTime() / 1000);
        heatmapData[timestamp] = {
          v: totalXP,
          r: ratings.length > 0 
            ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) 
            : null
        };
      }
    }

    if (cal) {
      try {
        cal.destroy();
      } catch (e) {
        console.warn('Failed to destroy previous heatmap:', e);
      }
    }

    cal = new CalHeatmap();
    cal.init({
      itemSelector: '#cal-heatmap',
      domain: 'month',
      subDomain: 'day',
      range: 13,
      start: start,
      data: heatmapData,
      cellSize: 14,
      cellPadding: 3,
      domainGutter: 15,
      legend: [20, 50, 100, 200],
      scale: {
        colors: {
          min: '#222',
          max: getComputedStyle(document.documentElement)
            .getPropertyValue('--accent').trim() || '#00f2ff'
        }
      },
      tooltip: true
    });

  } catch (error) {
    console.error('Failed to render heatmap:', error);
    container.innerHTML = '<p>Failed to load heatmap</p>';
  }
}

function renderStreak() {
  const streakEl = document.getElementById('streak-info');
  const streakStatEl = document.getElementById('streak-stat');
  if (!streakEl) return;

  let streak = 0;
  let checkDate = new Date();

  // Check today first
  const today = checkDate.toISOString().slice(0, 10);
  if (Object.keys(state.history[today] || {}).length > 0) {
    streak = 1;
  }

  // Check previous days
  while (streak < 365) { // Prevent infinite loop
    checkDate.setDate(checkDate.getDate() - 1);
    const dateStr = checkDate.toISOString().slice(0, 10);
    
    if (Object.keys(state.history[dateStr] || {}).length > 0) {
      streak++;
    } else {
      break;
    }
  }

  streakEl.textContent = `${streak} day${streak !== 1 ? 's' : ''} strong! Keep it going! 🔥`;
  if (streakStatEl) streakStatEl.textContent = streak;
}

function renderBadges() {
  const badgesList = document.getElementById('badges-list');
  if (!badgesList) return;

  const badges = [];
  
  if (state.totalXp >= 500) badges.push('XP Novice 🏅');
  if (state.totalXp >= 1000) badges.push('XP Master 🏆');
  if (state.totalXp >= 5000) badges.push('Legendary ⭐');
  if (state.level >= 10) badges.push('Level 10 Hero 🦸');
  if (state.level >= 25) badges.push('Level 25 Champion 👑');

  state.badges = [...new Set([...state.badges, ...badges])];

  if (badges.length === 0) {
    badgesList.innerHTML = '<p class="empty-state">Complete quests to earn badges!</p>';
  } else {
    badgesList.innerHTML = state.badges
      .map(badge => `<span class="badge" role="listitem">${sanitizeInput(badge)}</span>`)
      .join('');
  }
}

function setupWeeklyReport() {
  const reportBtn = document.getElementById('weekly-report');
  if (!reportBtn) return;

  reportBtn.onclick = () => {
    let report = '📊 WEEKLY REPORT\n' + '='.repeat(30) + '\n\n';
    let totalXP = 0;

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      
      const dayXP = Object.values(state.history[dateStr] || {}).reduce((sum, entry) => {
        return entry.done ? sum + (entry.xp || 0) : sum;
      }, 0);
      
      totalXP += dayXP;
      report += `${date.toLocaleDateString()}: ${dayXP} XP\n`;
    }

    report += '\n' + '='.repeat(30);
    report += `\n\nTotal XP: ${totalXP}`;
    report += `\nCurrent Level: ${state.level}`;
    report += `\nTotal Gold: ${state.gold} 🪙`;

    alert(report);
  };
}

// ============================================
// SHOP
// ============================================

function renderShop() {
  const shopItems = document.getElementById('shop-items');
  if (!shopItems) return;

  const items = [
    { name: 'Wizard Avatar', cost: 100, avatar: '🧙‍♂️', icon: '🔮' },
    { name: 'Knight Avatar', cost: 150, avatar: '⚔️', icon: '🛡️' },
    { name: 'Ninja Avatar', cost: 200, avatar: '🥷', icon: '🗡️' },
    { name: 'Mage Avatar', cost: 250, avatar: '🧝‍♂️', icon: '✨' }
  ];

  shopItems.innerHTML = items
    .map(item => `
      <div class="shop-item" role="listitem">
        <div class="shop-item-info">
          <span class="shop-item-icon">${item.icon}</span>
          <span class="shop-item-name">${sanitizeInput(item.name)}</span>
          <span class="shop-item-cost">${item.cost} 🪙</span>
        </div>
        <button 
          onclick="buyItem('${item.avatar}', ${item.cost})"
          class="btn-primary btn-shop"
          ${state.gold < item.cost ? 'disabled' : ''}
          aria-label="Buy ${item.name}"
        >
          ${state.gold >= item.cost ? 'Buy' : 'Locked'}
        </button>
      </div>
    `)
    .join('');
}

window.buyItem = (avatar, cost) => {
  if (state.gold >= cost) {
    state.gold -= cost;
    state.avatar = avatar;
    
    render();
    syncData();
    
    playSuccessSound();
    alert('🎉 Purchase successful! Avatar updated!');
    
    renderShop(); // Refresh shop
  } else {
    alert('❌ Not enough gold! Complete more quests to earn gold.');
  }
};

// ============================================
// DATA SYNCHRONIZATION
// ============================================

async function syncData() {
  if (!user || isSyncing) return;

  isSyncing = true;
  
  try {
    await setDoc(doc(db, "users", user.uid), state, { merge: true });
    
    await setDoc(doc(db, "leaderboard", user.uid), {
      name: user.displayName || 'Hero',
      xp: state.totalXp,
      level: state.level,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Sync failed:', error);
    showError('Failed to sync data. Changes may not be saved.');
  } finally {
    isSyncing = false;
  }
}

// ============================================
// AUTHENTICATION
// ============================================

onAuthStateChanged(auth, async (usr) => {
  user = usr;

  if (usr) {
    try {
      showLoading(true);

      document.getElementById('login-screen')?.classList.add('hidden');
      document.getElementById('app-screen')?.classList.remove('hidden');

      const userNameEl = document.getElementById('user-name');
      if (userNameEl) {
        userNameEl.textContent = usr.displayName?.split(' ')[0] || 'HERO';
      }

      // Load user data
      const userDoc = await getDoc(doc(db, "users", usr.uid));
      
      if (userDoc.exists()) {
        state = { ...state, ...userDoc.data() };
      } else {
        // Initialize default quests for new users
        state.quests = {
          physical: [
            { name: "100 Pushups", xp: 20, repeat: true },
            { name: "30min Cardio", xp: 25, repeat: true }
          ],
          mental: [
            { name: "Read 10 Pages", xp: 15, repeat: true },
            { name: "Learn Something New", xp: 20, repeat: true }
          ],
          spiritual: [
            { name: "Meditate 10min", xp: 10, repeat: true },
            { name: "Gratitude Journal", xp: 15, repeat: true }
          ],
          blights: [
            { name: "Relapse", xp: -50, repeat: false },
            { name: "Procrastination", xp: -20, repeat: false }
          ]
        };
        await syncData();
      }

      render();

      // Setup leaderboard listener
      const leaderboardQuery = query(
        collection(db, "leaderboard"),
        orderBy("xp", "desc"),
        limit(10)
      );

      onSnapshot(leaderboardQuery, (snapshot) => {
        const scoreboard = document.getElementById('scoreboard-list');
        if (!scoreboard) return;

        if (snapshot.empty) {
          scoreboard.innerHTML = '<p class="empty-state">No players yet. Be the first!</p>';
          return;
        }

        scoreboard.innerHTML = '';
        snapshot.forEach((doc, index) => {
          const data = doc.data();
          const position = index + 1;
          const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
          
          scoreboard.innerHTML += `
            <div class="habit-item leaderboard-item" role="listitem">
              <span>${medal} ${position}. ${sanitizeInput(data.name || 'Hero')} (Lvl ${data.level || 1})</span>
              <span class="leaderboard-xp">${data.xp || 0} XP</span>
            </div>
          `;
        });
      });

    } catch (error) {
      console.error('Failed to load user data:', error);
      showError('Failed to load your data. Please try again.');
    } finally {
      showLoading(false);
    }

  } else {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app-screen')?.classList.add('hidden');
  }
});

// Login handler
document.getElementById('google-login-btn')?.addEventListener('click', async () => {
  try {
    showLoading(true);
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Login failed:', error);
    let message = 'Login failed. Please try again.';
    
    if (error.code === 'auth/popup-closed-by-user') {
      message = 'Login cancelled.';
    } else if (error.code === 'auth/network-request-failed') {
      message = 'Network error. Please check your connection.';
    }
    
    showError(message);
  } finally {
    showLoading(false);
  }
});

// Logout handler
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to logout?')) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
      showError('Logout failed. Please try again.');
    }
  }
});

// ============================================
// CUSTOM CURSOR
// ============================================

document.addEventListener('mousemove', (e) => {
  const cursor = document.getElementById('customCursor');
  if (cursor && window.matchMedia('(pointer: fine)').matches) {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  }
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  // Close modal on Escape
  if (e.key === 'Escape') {
    const modal = document.getElementById('rating-modal');
    if (modal && modal.classList.contains('active')) {
      closeModal();
    }
  }

  // Quick navigation (Alt + number)
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const tabs = ['physical', 'mental', 'spiritual', 'blights', 'stats', 'shop'];
    const num = parseInt(e.key);
    if (num >= 1 && num <= tabs.length) {
      e.preventDefault();
      window.switchTab(tabs[num - 1]);
    }
  }
});

// ============================================
// INITIALIZATION
// ============================================

console.log('Hero\'s Quest initialized successfully!');