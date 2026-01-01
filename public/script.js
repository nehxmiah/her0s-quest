import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ============================================
   FIREBASE CONFIGURATION
   ============================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBDTTyEWFBam2EEWK4X2VV5E-wUJx10V38",
  authDomain: "her0s-quest.firebaseapp.com",
  projectId: "her0s-quest",
  storageBucket: "her0s-quest.firebasestorage.app",
  messagingSenderId: "120264562008",
  appId: "1:120264562008:web:69365314951dc05980812d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/* ============================================
   APPLICATION STATE
   ============================================ */

let state = {
  xp: 0,
  level: 1,
  totalXp: 0,
  gold: 0,
  avatar: '🦸‍♂️',
  badges: [],
  quests: {
    physical: [],
    mental: [],
    spiritual: [],
    blights: []
  },
  history: {}
};

let user = null;
let currentTab = 'physical';
let chart = null;
let pendingTask = null;
let selectedMood = null;
let isSyncing = false;

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function showError(message, containerId = 'login-error') {
  const errorEl = $(containerId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 5000);
  }
}

function showLoading(show = true) {
  $('#loading-spinner')?.classList.toggle('hidden', !show);
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

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

/* ============================================
   LIQUID BACKGROUND ENGINE
   ============================================ */

class LiquidEngine {
  constructor() {
    try {
      const canvas = $('#webGLApp');
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
  blights: [[1, 0.1, 0.1], [0.05, 0, 0]]
};

/* ============================================
   EFFECTS & FEEDBACK
   ============================================ */

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

/* ============================================
   NAVIGATION & UI
   ============================================ */

function switchTab(tab) {
  if (!['physical', 'mental', 'spiritual', 'blights', 'stats', 'shop'].includes(tab)) {
    console.error('Invalid tab:', tab);
    return;
  }

  currentTab = tab;
  document.body.setAttribute('data-theme', tab);
  
  // Update nav buttons
  $$('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
  });

  // Update theme
  if (engine && themeColors[tab]) {
    engine.updateTheme(...themeColors[tab]);
  }

  // Update title
  const titles = {
    physical: 'PHYSICAL QUESTS',
    mental: 'MENTAL QUESTS',
    spiritual: 'SPIRITUAL QUESTS',
    blights: 'BLIGHTS TO AVOID',
    stats: 'STATISTICS',
    shop: 'HERO\'S SHOP'
  };
  
  const titleEl = $('#view-title');
  if (titleEl) titleEl.textContent = titles[tab];

  // Toggle sections
  const questArea = $('#quest-area');
  const statsArea = $('#stats-area');
  const shopArea = $('#shop-area');

  if (questArea) questArea.classList.toggle('hidden', tab === 'stats' || tab === 'shop');
  if (statsArea) statsArea.classList.toggle('hidden', tab !== 'stats');
  if (shopArea) shopArea.classList.toggle('hidden', tab !== 'shop');

  updateHeader();
  renderQuests();

  // Load content based on tab
  if (tab !== 'stats' && tab !== 'shop') {
    loadQuote();
  }
  if (tab === 'stats') renderStats();
  if (tab === 'shop') renderShop();

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    $('#sidebar')?.classList.remove('active');
  }
}

// Setup nav buttons
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Setup sidebar toggle
$('#sidebar-toggle')?.addEventListener('click', () => {
  $('#sidebar')?.classList.toggle('active');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
  const sidebar = $('#sidebar');
  const toggle = $('#sidebar-toggle');
  
  if (window.innerWidth <= 768 && 
      sidebar?.classList.contains('active') &&
      !sidebar.contains(e.target) &&
      !toggle?.contains(e.target)) {
    sidebar.classList.remove('active');
  }
});

/* ============================================
   HEADER UPDATES
   ============================================ */

function updateHeader() {
  const dateEl = $('#current-date');
  const goldEl = $('#gold');
  const avatarEl = $('#avatar');
  const levelEl = $('#level-display');
  const xpFillEl = $('#xp-fill');
  const xpTextEl = $('#xp-text');
  const xpBar = $('.xp-bar');

  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  if (goldEl) goldEl.textContent = state.gold;
  if (avatarEl) avatarEl.textContent = state.avatar;
  if (levelEl) levelEl.textContent = `LVL ${state.level}`;

  if (xpFillEl) xpFillEl.style.width = `${state.xp}%`;
  if (xpTextEl) xpTextEl.textContent = `${state.xp} / 100 XP`;
  if (xpBar) {
    xpBar.setAttribute('aria-valuenow', state.xp);
  }
}

/* ============================================
   MOTIVATIONAL QUOTE
   ============================================ */

async function loadQuote() {
  const box = $('#motivational-quote');
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

/* ============================================
   TOGGLE ADD QUEST FORM
   ============================================ */

$('#toggle-add-quest')?.addEventListener('click', function() {
  const form = $('#add-quest-form');
  const isHidden = form?.classList.contains('hidden');
  
  form?.classList.toggle('hidden');
  this.classList.toggle('active');
  
  if (isHidden) {
    // Focus on quest name input when opening
    $('#new-name')?.focus();
  }
});

/* ============================================
   QUEST MANAGEMENT
   ============================================ */

function addNewQuest() {
  const nameInput = $('#new-name');
  const xpInput = $('#new-xp');
  const repeatInput = $('#new-repeat');

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

  renderQuests();
  syncData();

  // Close form and show success feedback
  $('#add-quest-form')?.classList.add('hidden');
  $('#toggle-add-quest')?.classList.remove('active');
}

// Setup add quest button
$('#add-quest-btn')?.addEventListener('click', addNewQuest);

// Allow Enter key to add quest
$('#new-name')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addNewQuest();
  }
});

/* ============================================
   TASK COMPLETION & RATING
   ============================================ */

function toggleTask(name, baseXp) {
  const today = getTodayString();
  
  if (state.history[today]?.[name]?.done) {
    alert("Already completed today!");
    return;
  }

  pendingTask = { name, baseXp };
  
  const modalTitle = $('#modal-quest-name');
  if (modalTitle) modalTitle.textContent = `Rate "${sanitizeInput(name)}"`;

  // Reset stars
  $$('.rating-stars i').forEach(s => {
    s.classList.remove('active', 'fas');
    s.classList.add('far');
  });

  // Reset moods
  $$('.rating-moods span').forEach(m => {
    m.classList.remove('active');
  });

  selectedMood = null;
  setRating(5);

  const modal = $('#rating-modal');
  if (modal) {
    modal.classList.add('active');
    // Focus first star for accessibility
    modal.querySelector('.rating-stars i')?.focus();
  }
}

function setRating(value) {
  $$('.rating-stars i').forEach((star, i) => {
    const isActive = i < value;
    star.classList.toggle('active', isActive);
    star.classList.toggle('fas', isActive);
    star.classList.toggle('far', !isActive);
  });
}

// Star click handlers
$$('.rating-stars i').forEach(star => {
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
$$('.rating-moods span').forEach(mood => {
  mood.addEventListener('click', () => {
    $$('.rating-moods span').forEach(m => m.classList.remove('active'));
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
$('#confirm-rating')?.addEventListener('click', async () => {
  if (!pendingTask) return;

  try {
    const rating = $$('.rating-stars i.active').length || 5;

    // Calculate streak multiplier
    let streakDays = 1;
    let checkDate = new Date();
    
    while (streakDays < 365) {
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
    const today = getTodayString();
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
    renderQuests();
    await syncData();

  } catch (error) {
    console.error('Error confirming rating:', error);
    showError('Failed to save quest completion');
  }
});

function closeModal() {
  const modal = $('#rating-modal');
  if (modal) modal.classList.remove('active');
  pendingTask = null;
  selectedMood = null;
}

$('#cancel-rating')?.addEventListener('click', closeModal);

$('#rating-modal')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) closeModal();
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = $('#rating-modal');
    if (modal && modal.classList.contains('active')) {
      closeModal();
    }
  }
});

/* ============================================
   RENDER QUESTS
   ============================================ */

function renderQuests() {
  updateHeader();

  const today = getTodayString();
  const list = $('#habit-list');
  
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
        <p>No quests yet. Add your first quest using the + button above!</p>
      </div>
    `;
    return;
  }

  state.quests[currentTab].forEach(quest => {
    const done = state.history[today]?.[quest.name]?.done;
    const questEl = document.createElement('div');
    questEl.className = `quest-item ${done ? 'completed' : ''}`;
    questEl.role = 'listitem';

    const xpSign = quest.xp > 0 ? '+' : '';
    const buttonText = done ? '✓' : (quest.xp < 0 ? 'FAIL' : 'GO');

    questEl.innerHTML = `
      <div class="quest-info">
        <div class="quest-name">${sanitizeInput(quest.name)}</div>
        <div class="quest-details">
          <span class="quest-xp">${xpSign}${quest.xp} XP</span>
          ${quest.repeat ? '<span class="quest-repeat">🔄 Daily</span>' : ''}
        </div>
      </div>
      <button 
        class="btn-quest-action" 
        onclick="window.toggleTask('${sanitizeInput(quest.name)}', ${quest.xp})" 
        ${done ? 'disabled' : ''}
        aria-label="${done ? 'Completed' : 'Complete quest'}"
      >
        ${buttonText}
      </button>
    `;

    list.appendChild(questEl);
  });
}

// Make toggleTask globally available
window.toggleTask = toggleTask;

/* ============================================
   STATISTICS
   ============================================ */

function renderStats() {
  renderXPChart();
  renderStreak();
  renderBadges();
  setupWeeklyReport();
}

function renderXPChart() {
  const canvas = $('#xpChart');
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
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
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

function renderStreak() {
  const streakEl = $('#streak-info');
  if (!streakEl) return;

  let streak = 0;
  let checkDate = new Date();

  // Check today first
  const today = checkDate.toISOString().slice(0, 10);
  if (Object.keys(state.history[today] || {}).length > 0) {
    streak = 1;
  }

  // Check previous days
  while (streak < 365) {
    checkDate.setDate(checkDate.getDate() - 1);
    const dateStr = checkDate.toISOString().slice(0, 10);
    
    if (Object.keys(state.history[dateStr] || {}).length > 0) {
      streak++;
    } else {
      break;
    }
  }

  streakEl.innerHTML = `
    <div class="streak-number">${streak}</div>
    <div class="streak-label">Day${streak !== 1 ? 's' : ''} Streak</div>
  `;
}

function renderBadges() {
  const badgesList = $('#badges-list');
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
  const reportBtn = $('#weekly-report');
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

/* ============================================
   SHOP
   ============================================ */

function renderShop() {
  const shopItems = $('#shop-items');
  if (!shopItems) return;

  const items = [
    { name: 'Wizard Avatar', cost: 100, avatar: '🧙‍♂️', icon: '🔮' },
    { name: 'Knight Avatar', cost: 150, avatar: '⚔️', icon: '🛡️' },
    { name: 'Ninja Avatar', cost: 200, avatar: '🥷', icon: '🗡️' },
    { name: 'Mage Avatar', cost: 250, avatar: '🧙‍♂️', icon: '✨' }
  ];

  shopItems.innerHTML = items
    .map(item => `
      <div class="shop-item glass" role="listitem">
        <div class="shop-item-header">
          <span class="shop-item-icon">${item.icon}</span>
          <div class="shop-item-info">
            <div class="shop-item-name">${sanitizeInput(item.name)}</div>
            <div class="shop-item-cost">${item.cost} 🪙</div>
          </div>
        </div>
        <button 
          onclick="buyItem('${item.avatar}', ${item.cost})"
          class="btn-primary"
          ${state.gold < item.cost ? 'disabled' : ''}
          aria-label="Buy ${item.name}"
        >
          ${state.gold >= item.cost ? 'Buy Now' : 'Locked'}
        </button>
      </div>
    `)
    .join('');
}

window.buyItem = (avatar, cost) => {
  if (state.gold >= cost) {
    state.gold -= cost;
    state.avatar = avatar;
    
    updateHeader();
    syncData();
    
    playSuccessSound();
    alert('🎉 Purchase successful! Avatar updated!');
    
    renderShop();
  } else {
    alert('❌ Not enough gold! Complete more quests to earn gold.');
  }
};

/* ============================================
   DATA SYNCHRONIZATION
   ============================================ */

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

/* ============================================
   AUTHENTICATION
   ============================================ */

onAuthStateChanged(auth, async (usr) => {
  user = usr;

  if (usr) {
    try {
      showLoading(true);

      $('#login-screen')?.classList.add('hidden');
      $('#app-screen')?.classList.remove('hidden');

      const userNameEl = $('#user-name');
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

      // Initialize UI
      switchTab('physical');
      renderQuests();

      // Setup leaderboard listener
      const leaderboardQuery = query(
        collection(db, "leaderboard"),
        orderBy("xp", "desc"),
        limit(10)
      );

      onSnapshot(leaderboardQuery, (snapshot) => {
        const scoreboard = $('#scoreboard-list');
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
            <div class="leaderboard-item" role="listitem">
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
    $('#login-screen')?.classList.remove('hidden');
    $('#app-screen')?.classList.add('hidden');
  }
});

// Login handler
$('#google-login-btn')?.addEventListener('click', async () => {
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
$('#logout-btn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to logout?')) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
      showError('Logout failed. Please try again.');
    }
  }
});

/* ============================================
   KEYBOARD SHORTCUTS
   ============================================ */

document.addEventListener('keydown', (e) => {
  // Quick navigation (Alt + number)
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const tabs = ['physical', 'mental', 'spiritual', 'blights', 'stats', 'shop'];
    const num = parseInt(e.key);
    if (num >= 1 && num <= tabs.length) {
      e.preventDefault();
      switchTab(tabs[num - 1]);
    }
  }
});

/* ============================================
   INITIALIZATION
   ============================================ */

console.log('Hero\'s Quest initialized successfully!');