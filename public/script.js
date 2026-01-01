import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Config
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

// State
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
let tab = 'physical';
let chart = null;
let pendingQuest = null;
let selectedMood = null;
let isSyncing = false;
let syncTimeout = null;

// Utilities
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const showError = msg => {
  const el = $('error');
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }
};

const showLoading = show => $('loading')?.classList.toggle('hidden', !show);

const sanitize = str => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const validateXP = xp => {
  const n = parseInt(xp);
  return !isNaN(n) && n >= -100 && n <= 500 ? n : null;
};

const vibrate = pattern => {
  if ('vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch(e) {}
  }
};

const confetti = () => {
  if (typeof window.confetti === 'function') {
    window.confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
};

// Background
class BG {
  constructor() {
    try {
      const canvas = $('bg');
      if (!canvas) return;
      
      this.ctx = canvas.getContext('2d');
      this.w = canvas.width = window.innerWidth;
      this.h = canvas.height = window.innerHeight;
      this.time = 0;
      this.color = [0, 242, 255];
      
      this.animate();
      
      window.addEventListener('resize', () => {
        this.w = canvas.width = window.innerWidth;
        this.h = canvas.height = window.innerHeight;
      });
    } catch(e) {
      console.error('BG init failed:', e);
    }
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.ctx) return;
    
    this.time += 0.01;
    
    const grad = this.ctx.createLinearGradient(0, 0, this.w, this.h);
    const [r, g, b] = this.color;
    grad.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
    grad.addColorStop(1, 'rgb(0, 0, 0)');
    
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }
  
  setColor(c) {
    this.color = c;
  }
}

const bg = new BG();

const colors = {
  physical: [0, 242, 255],
  mental: [133, 153, 0],
  spiritual: [212, 175, 55],
  blights: [255, 51, 102],
  stats: [139, 92, 246],
  shop: [255, 165, 0]
};

// Switch Tab
const switchTab = t => {
  tab = t;
  document.body.setAttribute('data-theme', t);
  
  $$('.nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === t);
  });
  
  if (bg) bg.setColor(colors[t] || [0, 242, 255]);
  
  $('title').textContent = t.toUpperCase();
  
  $('quests')?.classList.toggle('hidden', t === 'stats' || t === 'shop');
  $('stats')?.classList.toggle('hidden', t !== 'stats');
  $('shop')?.classList.toggle('hidden', t !== 'shop');
  
  if (t !== 'stats' && t !== 'shop') loadQuote();
  if (t === 'stats') renderStats();
  if (t === 'shop') renderShop();
  
  updateHeader();
  render();
};

// Nav
$$('.nav button').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Header
const updateHeader = () => {
  $('avatar').textContent = state.avatar;
  $('username').textContent = user?.displayName?.split(' ')[0] || 'HERO';
  $('level').textContent = `LVL ${state.level}`;
  $('xp-fill').style.width = `${state.xp}%`;
  $('xp-text').textContent = `${state.xp} / 100 XP`;
  $('gold').textContent = state.gold;
};

// Quote
const loadQuote = async () => {
  const el = $('quote');
  if (!el) return;
  
  const quotes = {
    physical: [
      { q: "The body achieves what the mind believes.", a: "Napoleon Hill" },
      { q: "Take care of your body. It's the only place you have to live.", a: "Jim Rohn" }
    ],
    mental: [
      { q: "Reading is to the mind what exercise is to the body.", a: "Joseph Addison" },
      { q: "The mind is everything. What you think you become.", a: "Buddha" }
    ],
    spiritual: [
      { q: "Peace comes from within. Do not seek it without.", a: "Buddha" },
      { q: "Be still and know.", a: "Psalm 46:10" }
    ],
    blights: [
      { q: "Fall seven times, stand up eight.", a: "Japanese Proverb" },
      { q: "Rock bottom became the solid foundation on which I rebuilt my life.", a: "J.K. Rowling" }
    ]
  };
  
  const list = quotes[tab] || quotes.physical;
  const q = list[Math.floor(Math.random() * list.length)];
  el.innerHTML = `<p>"${q.q}"</p><small>— ${q.a}</small>`;
};

// Add Quest
$('add-btn')?.addEventListener('click', () => {
  const name = $('quest-name').value.trim();
  const xp = validateXP($('quest-xp').value);
  const repeat = $('quest-repeat').checked;
  
  if (!name) {
    showError('Quest name required');
    return;
  }
  
  if (xp === null) {
    showError('XP must be -100 to 500');
    return;
  }
  
  if (state.quests[tab].some(q => q.name === name)) {
    showError('Quest already exists');
    return;
  }
  
  state.quests[tab].push({ name, xp, repeat });
  
  $('quest-name').value = '';
  $('quest-xp').value = '';
  $('quest-repeat').checked = false;
  
  render();
  syncData();
});

// Complete Quest
const completeQuest = (name, xp) => {
  const today = new Date().toISOString().slice(0, 10);
  
  if (state.history[today]?.[name]?.done) {
    alert('Already completed today!');
    return;
  }
  
  pendingQuest = { name, xp };
  
  $('modal-title').textContent = `Rate "${sanitize(name)}"`;
  
  $$('.stars i').forEach(s => {
    s.classList.remove('active', 'fas');
    s.classList.add('far');
  });
  
  $$('.moods span').forEach(m => m.classList.remove('active'));
  
  selectedMood = null;
  setRating(5);
  
  $('modal')?.classList.remove('hidden');
};

const setRating = v => {
  $$('.stars i').forEach((s, i) => {
    const active = i < v;
    s.classList.toggle('active', active);
    s.classList.toggle('fas', active);
    s.classList.toggle('far', !active);
  });
};

// Stars
$$('.stars i').forEach(s => {
  s.addEventListener('click', () => {
    const v = parseInt(s.dataset.value);
    if (!isNaN(v)) setRating(v);
  });
});

// Moods
$$('.moods span').forEach(m => {
  m.addEventListener('click', () => {
    $$('.moods span').forEach(x => x.classList.remove('active'));
    m.classList.add('active');
    selectedMood = m.dataset.mood;
  });
});

// Confirm
$('confirm-btn')?.addEventListener('click', async () => {
  if (!pendingQuest) return;
  
  try {
    const rating = $$('.stars i.active').length || 5;
    const earned = Math.round(pendingQuest.xp * (rating / 5));
    
    const today = new Date().toISOString().slice(0, 10);
    state.xp += earned;
    state.totalXp += earned;
    state.gold += Math.max(0, Math.floor(earned / 10));
    
    if (!state.history[today]) state.history[today] = {};
    state.history[today][pendingQuest.name] = {
      done: true,
      rating,
      mood: selectedMood,
      xp: earned,
      ts: Date.now()
    };
    
    vibrate([100, 50, 100]);
    
    while (state.xp >= 100) {
      state.level++;
      state.xp -= 100;
      confetti();
      vibrate([200, 100, 300]);
      setTimeout(() => alert(`🎉 LEVEL ${state.level}! 🎉`), 200);
    }
    
    closeModal();
    render();
    await syncData();
    
  } catch(e) {
    console.error('Confirm error:', e);
    showError('Failed to save');
  }
});

const closeModal = () => {
  $('modal')?.classList.add('hidden');
  pendingQuest = null;
  selectedMood = null;
};

$('cancel-btn')?.addEventListener('click', closeModal);

// Render Quests
const render = () => {
  updateHeader();
  
  const today = new Date().toISOString().slice(0, 10);
  const list = $('list');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (state.quests[tab].length === 0) {
    list.innerHTML = '<div class="empty"><i class="fas fa-scroll fa-3x"></i><p>No quests yet</p></div>';
    return;
  }
  
  state.quests[tab].forEach(q => {
    const done = state.history[today]?.[q.name]?.done;
    const div = document.createElement('div');
    div.className = `quest-item ${done ? 'done' : ''}`;
    
    const sign = q.xp > 0 ? '+' : '';
    const repeat = q.repeat ? ' 🔄' : '';
    const btnText = done ? '✓' : (q.xp < 0 ? 'FAIL' : 'GO');
    
    div.innerHTML = `
      <span class="quest-name">${sanitize(q.name)} (${sign}${q.xp} XP)${repeat}</span>
      <button class="quest-btn" ${done ? 'disabled' : ''}>
        ${btnText}
      </button>
    `;
    
    if (!done) {
      div.querySelector('.quest-btn').addEventListener('click', () => {
        completeQuest(q.name, q.xp);
      });
    }
    
    list.appendChild(div);
  });
};

// Stats
const renderStats = () => {
  $('total-xp').textContent = state.totalXp.toLocaleString();
  $('level-stat').textContent = state.level;
  $('gold-stat').textContent = state.gold.toLocaleString();
  
  renderChart();
  renderStreak();
  renderBadges();
};

const renderChart = () => {
  const canvas = $('chart');
  if (!canvas) return;
  
  const labels = [];
  const data = [];
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    
    labels.push(ds.slice(5));
    
    const hist = state.history[ds] || {};
    const xp = Object.values(hist).reduce((s, e) => {
      return e.done ? s + (e.xp || 0) : s;
    }, 0);
    
    data.push(xp);
  }
  
  if (chart) chart.destroy();
  
  chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'XP',
        data,
        borderColor: getComputedStyle(document.documentElement)
          .getPropertyValue('--accent') || '#00f2ff',
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
};

const renderStreak = () => {
  const el = $('streak');
  if (!el) return;
  
  let streak = 0;
  let d = new Date();
  const today = d.toISOString().slice(0, 10);
  
  if (Object.keys(state.history[today] || {}).length > 0) {
    streak = 1;
  }
  
  for (let i = 0; i < 365; i++) {
    d.setDate(d.getDate() - 1);
    const ds = d.toISOString().slice(0, 10);
    
    if (Object.keys(state.history[ds] || {}).length > 0) {
      streak++;
    } else {
      break;
    }
  }
  
  el.textContent = streak;
};

const renderBadges = () => {
  const el = $('badges');
  if (!el) return;
  
  const badges = [];
  if (state.totalXp >= 500) badges.push('XP Novice 🅱');
  if (state.totalXp >= 1000) badges.push('XP Master 🏆');
  if (state.level >= 10) badges.push('Level 10 🦸');
  
  state.badges = [...new Set([...state.badges, ...badges])];
  
  if (badges.length === 0) {
    el.innerHTML = '<p class="empty">Complete quests to earn badges</p>';
  } else {
    el.innerHTML = state.badges.map(b => `<span class="badge">${sanitize(b)}</span>`).join('');
  }
};

// Shop
const renderShop = () => {
  const el = $('shop-items');
  if (!el) return;
  
  const items = [
    { name: 'Wizard', cost: 100, avatar: '🧙‍♂️', icon: '🔮' },
    { name: 'Knight', cost: 150, avatar: '⚔️', icon: '🛡️' },
    { name: 'Ninja', cost: 200, avatar: '🥷', icon: '🗡️' },
    { name: 'Mage', cost: 250, avatar: '🧙‍♂️', icon: '✨' }
  ];
  
  el.innerHTML = items.map(i => `
    <div class="shop-item">
      <div class="shop-info">
        <span class="shop-icon">${i.icon}</span>
        <span class="shop-name">${sanitize(i.name)}</span>
        <span class="shop-cost">${i.cost} 🪙</span>
      </div>
      <button class="shop-btn" ${state.gold < i.cost ? 'disabled' : ''} data-avatar="${i.avatar}" data-cost="${i.cost}">
        ${state.gold >= i.cost ? 'Buy' : 'Locked'}
      </button>
    </div>
  `).join('');
  
  $$('.shop-btn').forEach(btn => {
    if (!btn.disabled) {
      btn.addEventListener('click', () => {
        const avatar = btn.dataset.avatar;
        const cost = parseInt(btn.dataset.cost);
        
        if (state.gold >= cost) {
          state.gold -= cost;
          state.avatar = avatar;
          render();
          syncData();
          alert('🎉 Purchase successful!');
          renderShop();
        }
      });
    }
  });
};

// Sync (Debounced)
const syncData = async () => {
  if (!user || isSyncing) return;
  
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    isSyncing = true;
    
    try {
      await setDoc(doc(db, "users", user.uid), state, { merge: true });
      
      await setDoc(doc(db, "leaderboard", user.uid), {
        name: user.displayName || 'Hero',
        xp: state.totalXp,
        level: state.level,
        ts: Date.now()
      });
    } catch(e) {
      console.error('Sync failed:', e);
    } finally {
      isSyncing = false;
    }
  }, 1000);
};

// Auth
onAuthStateChanged(auth, async usr => {
  user = usr;
  
  if (usr) {
    try {
      showLoading(true);
      
      $('login-screen')?.classList.add('hidden');
      $('app')?.classList.remove('hidden');
      
      const userDoc = await getDoc(doc(db, "users", usr.uid));
      
      if (userDoc.exists()) {
        state = { ...state, ...userDoc.data() };
      } else {
        state.quests = {
          physical: [
            { name: "100 Pushups", xp: 20, repeat: true },
            { name: "30min Cardio", xp: 25, repeat: true }
          ],
          mental: [
            { name: "Read 10 Pages", xp: 15, repeat: true }
          ],
          spiritual: [
            { name: "Meditate 10min", xp: 10, repeat: true }
          ],
          blights: [
            { name: "Relapse", xp: -50, repeat: false }
          ]
        };
        await syncData();
      }
      
      render();
      loadQuote();
      
      // Leaderboard
      const q = query(
        collection(db, "leaderboard"),
        orderBy("xp", "desc"),
        limit(10)
      );
      
      onSnapshot(q, snap => {
        const el = $('leaderboard');
        if (!el) return;
        
        if (snap.empty) {
          el.innerHTML = '<p class="empty">No players yet</p>';
          return;
        }
        
        el.innerHTML = '';
        snap.forEach((d, i) => {
          const data = d.data();
          const pos = i + 1;
          const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '';
          
          el.innerHTML += `
            <div class="lb-item">
              <span>${medal} ${pos}. ${sanitize(data.name || 'Hero')} (Lvl ${data.level || 1})</span>
              <span class="lb-xp">${data.xp || 0} XP</span>
            </div>
          `;
        });
      });
      
    } catch(e) {
      console.error('Load failed:', e);
      showError('Failed to load data');
    } finally {
      showLoading(false);
    }
  } else {
    $('login-screen')?.classList.remove('hidden');
    $('app')?.classList.add('hidden');
  }
});

// Login
$('login-btn')?.addEventListener('click', async () => {
  try {
    showLoading(true);
    await signInWithPopup(auth, provider);
  } catch(e) {
    console.error('Login failed:', e);
    showError(e.code === 'auth/popup-closed-by-user' ? 'Login cancelled' : 'Login failed');
  } finally {
    showLoading(false);
  }
});

// Logout
$('logout-btn')?.addEventListener('click', async () => {
  if (confirm('Logout?')) {
    try {
      await signOut(auth);
    } catch(e) {
      showError('Logout failed');
    }
  }
});

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('modal')?.classList.contains('hidden')) {
    closeModal();
  }
});

console.log('Hero\'s Quest ready!');