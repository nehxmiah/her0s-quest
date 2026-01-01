// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ============================================
// FIREBASE CONFIGURATION
// ============================================

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

// ============================================
// APPLICATION STATE
// ============================================

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

// ============================================
// UTILITY FUNCTIONS
// ============================================

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
  const spinner = $('#loading-spinner');
  if (spinner) spinner.classList.toggle('hidden', !show);
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

// ============================================
// LIQUID BACKGROUND ENGINE
// ============================================

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
// NAVIGATION & UI HANDLERS
// ============================================

function switchTab(tab) {
  if (!['physical', 'mental', 'spiritual', 'blights', 'stats', 'shop'].includes(tab)) {
    console.error('Invalid tab:', tab);
    return;
  }

  currentTab = tab;
  document.body.setAttribute('data-theme', tab);
  
  $$('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  if (engine && themeColors[tab]) {
    engine.updateTheme(...themeColors[tab]);
  }

  const titles = {
    physical: 'PHYSICAL QUESTS',
    mental: 'MENTAL QUESTS',
    spiritual: 'SPIRITUAL QUESTS',
    blights: 'BLIGHTS TO AVOID',
    stats: 'STATISTICS',
    shop: 'HERO\'S SHOP'
  };
  
  $('#view-title').textContent = titles[tab];

  $('#quest-area').classList.toggle('hidden', tab === 'stats' || tab === 'shop');
  $('#stats-area').classList.toggle('hidden', tab !== 'stats');
  $('#shop-area').classList.toggle('hidden', tab !== 'shop');

  updateHeader();
  renderQuests();

  if (tab !== 'stats' && tab !== 'shop') {
    loadQuote();
  }
  if (tab === 'stats') renderStats();
  if (tab === 'shop') renderShop();

  if (window.innerWidth <= 768) {
    $('#sidebar').classList.remove('active');
  }
}

$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

$('#sidebar-toggle').addEventListener('click', () => {
  $('#sidebar').classList.toggle('active');
});

document.addEventListener('click', (e) => {
  const sidebar = $('#sidebar');
  const toggle = $('#sidebar-toggle');
  if (window.innerWidth <= 768 && sidebar.classList.contains('active') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
    sidebar.classList.remove('active');
  }
});

// ============================================
// HEADER UPDATES
// ============================================

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

// ============================================
// MOTIVATIONAL QUOTE
// ============================================

async function loadQuote() {
  const box = $('#motivational-quote');
  if (!box) return;

  box.innerHTML = '<div class="quote-skeleton"></div>';

  const fallbackQuotes = [
    { q: "The only way to do great work is to love what you do.", a: "Steve Jobs" },
    { q: "Success is not final, failure is not fatal: it is the courage to continue that counts.", a: "Winston Churchill" },
    { q: "Believe you can and you're halfway there.", a: "Theodore Roosevelt" },
    { q: "The future belongs to those who believe in the beauty of their dreams.", a: "Eleanor Roosevelt" },
    { q: "It does not matter how slowly you go as long as you do not stop.", a: "Confucius" },
    { q: "Everything you've ever wanted is on the other side of fear.", a: "George Addair" },
    { q: "Success is not how high you have climbed, but how you make a positive difference to the world.", a: "Roy T. Bennett" },
    { q: "Don't watch the clock; do what it does. Keep going.", a: "Sam Levenson" },
    { q: "The only impossible journey is the one you never begin.", a: "Tony Robbins" },
    { q: "Small daily improvements are the key to staggering long-term results.", a: "Unknown" },
    { q: "Discipline is choosing between what you want now and what you want most.", a: "Abraham Lincoln" },
    { q: "You don't have to be great to start, but you have to start to be great.", a: "Zig Ziglar" },
    { q: "The difference between who you are and who you want to be is what you do.", a: "Unknown" },
    { q: "Your limitation—it's only your imagination.", a: "Unknown" },
    { q: "Push yourself, because no one else is going to do it for you.", a: "Unknown" },
    { q: "Great things never come from comfort zones.", a: "Unknown" },
    { q: "Dream it. Wish it. Do it.", a: "Unknown" },
  ];

  try {
    const res = await fetch('https://zenquotes.io/api/random');
    if (!res.ok) throw new Error('Quote fetch failed');
    const [quote] = await res.json();
    box.innerHTML = `<p>"${sanitizeInput(quote.q)}"</p><small>— ${sanitizeInput(quote.a)}</small>`;
  } catch (error) {
    console.warn('Failed to load quote from ZenQuotes:', error);
    const randomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    box.innerHTML = `<p>"${sanitizeInput(randomQuote.q)}"</p><small>— ${sanitizeInput(randomQuote.a)}</small>`;
  }
}

// ============================================
// TOGGLE ADD QUEST FORM
// ============================================

$('#toggle-add-quest').addEventListener('click', function() {
  const form = $('#add-quest-form');
  form.classList.toggle('hidden');
  this.classList.toggle('active');
  if (!form.classList.contains('hidden')) {
    $('#new-name').focus();
  }
});

// ============================================
// QUEST MANAGEMENT
// ============================================

function addNewQuest() {
  const nameInput = $('#new-name');
  const xpInput = $('#new-xp');
  const repeatInput = $('#new-repeat');

  const name = nameInput.value.trim();
  const xp = validateXP(xpInput.value);
  const repeat = repeatInput.checked;

  if (!name) return showError('Quest name is required');
  if (xp === null) return showError('XP must be between -100 and 500');
  if (name.length > 50) return showError('Quest name too long (max 50)');
  if (state.quests[currentTab].some(q => q.name === name)) return showError('Duplicate quest name');

  state.quests[currentTab].push({ name, xp, repeat });
  nameInput.value = '';
  xpInput.value = '';
  repeatInput.checked = false;

  renderQuests();
  syncData();

  $('#add-quest-form').classList.add('hidden');
  $('#toggle-add-quest').classList.remove('active');
}

$('#add-quest-btn').addEventListener('click', addNewQuest);
$('#new-name').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addNewQuest();
  }
});

// ============================================
// TASK COMPLETION & RATING
// ============================================

window.toggleTask = function(name, baseXp) {
  const today = getTodayString();
  if (state.history[today]?.[name]?.done) return alert("Already completed today!");

  pendingTask = { name, baseXp };
  $('#modal-quest-name').textContent = `Rate "${sanitizeInput(name)}"`;

  $$('.rating-stars i').forEach(s => {
    s.classList.remove('active', 'fas');
    s.classList.add('far');
  });

  $$('.rating-moods span').forEach(m => m.classList.remove('active'));
  selectedMood = null;
  setRating(5);

  $('#rating-modal').classList.add('active');
};

function setRating(value) {
  $$('.rating-stars i').forEach((star, i) => {
    star.classList.toggle('active', i < value);
    star.classList.toggle('fas', i < value);
    star.classList.toggle('far', i >= value);
  });
}

$$('.rating-stars i').forEach(star => {
  star.addEventListener('click', () => setRating(star.dataset.value));
});

$$('.rating-moods span').forEach(mood => {
  mood.addEventListener('click', () => {
    $$('.rating-moods span').forEach(m => m.classList.remove('active'));
    mood.classList.add('active');
    selectedMood = mood.dataset.mood;
  });
});

$('#confirm-rating').addEventListener('click', async () => {
  if (!pendingTask) return;

  const rating = $$('.rating-stars .active').length;
  if (rating === 0) return showError('Please select a rating');

  const today = getTodayString();
  let streakDays = 1;
  let checkDate = new Date();

  while (streakDays < 365) {
    checkDate.setDate(checkDate.getDate() - 1);
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (state.history[dateStr]?.[pendingTask.name]?.done) streakDays++;
    else break;
  }

  const multiplier = streakDays >= 7 ? 1.5 : 1;
  const earned = Math.round(pendingTask.baseXp * (rating / 5) * multiplier);

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

  playSuccessSound();
  vibrateSuccess();

  while (state.xp >= 100) {
    state.level++;
    state.xp -= 100;
    triggerConfetti();
    playLevelUpSound();
    vibrateLevelUp();
    setTimeout(() => alert(`🎉 LEVEL UP! Now Level ${state.level}! 🎉`), 300);
  }

  closeModal();
  renderQuests();
  await syncData();
});

function closeModal() {
  $('#rating-modal').classList.remove('active');
  pendingTask = null;
  selectedMood = null;
}

$('#cancel-rating').addEventListener('click', closeModal);
$('#rating-modal').addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#rating-modal').classList.contains('active')) closeModal();
});

// ============================================
// RENDER QUESTS
// ============================================

function renderQuests() {
  updateHeader();
  const today = getTodayString();
  const list = $('#habit-list');

  if (!list) return;

  state.quests[currentTab].forEach(quest => {
    if (quest.repeat) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      if (state.history[yesterdayStr]?.[quest.name]?.done && !state.history[today]?.[quest.name]) {
        if (!state.history[today]) state.history[today] = {};
        state.history[today][quest.name] = { done: false };
      }
    }
  });

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
// STATISTICS RENDERING
// ============================================

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
    const dayXP = Object.values(dayHistory).reduce((sum, entry) => entry.done ? sum + (entry.xp || 0) : sum, 0);
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
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f2ff',
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
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
        x: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
      }
    }
  });
}

function renderStreak() {
  const streakEl = $('#streak-info');
  if (!streakEl) return;

  let streak = 0;
  let checkDate = new Date();
  const today = checkDate.toISOString().slice(0, 10);
  if (Object.keys(state.history[today] || {}).length > 0) streak = 1;

  while (streak < 365) {
    checkDate.setDate(checkDate.getDate() - 1);
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (Object.keys(state.history[dateStr] || {}).length > 0) streak++;
    else break;
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
    badgesList.innerHTML = state.badges.map(badge => `<span class="badge" role="listitem">${sanitizeInput(badge)}</span>`).join('');
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
      const dayXP = Object.values(state.history[dateStr] || {}).reduce((sum, entry) => entry.done ? sum + (entry.xp || 0) : sum, 0);
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
// SHOP RENDERING
// ============================================

function renderShop() {
  const shopItems = $('#shop-items');
  if (!shopItems) return;

  const items = [
    { name: 'Wizard Avatar', cost: 100, avatar: '🧙‍♂️', icon: '🔮' },
    { name: 'Knight Avatar', cost: 150, avatar: '⚔️', icon: '🛡️' },
    { name: 'Ninja Avatar', cost: 200, avatar: '🥷', icon: '🗡️' },
    { name: 'Mage Avatar', cost: 250, avatar: '🧙‍♂️', icon: '✨' }
  ];

  shopItems.innerHTML = items.map(item => `
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
  `).join('');
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
// AUTHENTICATION HANDLERS
// ============================================

onAuthStateChanged(auth, async (usr) => {
  user = usr;

  if (usr) {
    try {
      showLoading(true);
      $('#login-screen').classList.add('hidden');
      $('#app-screen').classList.remove('hidden');

      $('#user-name').textContent = usr.displayName?.split(' ')[0] || 'HERO';

      const userDoc = await getDoc(doc(db, "users", usr.uid));
      
      if (userDoc.exists()) {
        state = { ...state, ...userDoc.data() };
      } else {
        state.quests = {
          physical: [{ name: "100 Pushups", xp: 20, repeat: true }, { name: "30min Cardio", xp: 25, repeat: true }],
          mental: [{ name: "Read 10 Pages", xp: 15, repeat: true }, { name: "Learn Something New", xp: 20, repeat: true }],
          spiritual: [{ name: "Meditate 10min", xp: 10, repeat: true }, { name: "Gratitude Journal", xp: 15, repeat: true }],
          blights: [{ name: "Relapse", xp: -50, repeat: false }, { name: "Procrastination", xp: -20, repeat: false }]
        };
        await syncData();
      }

      switchTab('physical');
      renderQuests();

      const leaderboardQuery = query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(10));
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
    showLoading(false);
    $('#login-screen').classList.remove('hidden');
    $('#app-screen').classList.add('hidden');
  }
});

$('#google-login-btn').addEventListener('click', async () => {
  try {
    showLoading(true);
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Login failed:', error);
    let message = 'Login failed. Please try again.';
    if (error.code === 'auth/popup-closed-by-user') message = 'Login cancelled.';
    else if (error.code === 'auth/network-request-failed') message = 'Network error. Please check your connection.';
    showError(message);
  } finally {
    showLoading(false);
  }
});

$('#logout-btn').addEventListener('click', async () => {
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
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const tabs = ['physical', 'mental', 'spiritual', 'blights', 'stats', 'shop'];
    const num = parseInt(e.key);
    if (num >= 1 && num <= tabs.length) {
      e.preventDefault();
      switchTab(tabs[num - 1]);
    }
  }
});

console.log('Hero\'s Quest initialized successfully!');