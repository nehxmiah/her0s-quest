// === Firebase Setup ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// === State Management ===
let state = {
  xp: 0,
  level: 1,
  totalXp: 0,
  quests: { physical: [], mental: [], spiritual: [], blights: [] },
  history: {}
};

let user = null;
let currentTab = 'physical';
let chart = null;
let cal = null;
let isSyncing = false;

// === Utility Functions ===
const showLoading = (show = true) => {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.toggle('hidden', !show);
};

const showError = (message, duration = 3000) => {
  const toast = document.getElementById('error-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
};

const getTodayString = () => new Date().toISOString().slice(0, 10);

const sanitizeString = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// === Liquid Background Engine ===
class LiquidEngine {
  constructor() {
    const canvas = document.getElementById('webGLApp');
    if (!canvas) return;
    
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
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
      this.setupResize();
    } catch (error) {
      console.error('WebGL initialization error:', error);
    }
  }

  init() {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        varying vec2 vUv;
        
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float t = uTime * 0.5;
          
          float noise1 = sin(p.x * 3.0 + t) * cos(p.y * 2.0 + t);
          float noise2 = sin(p.y * 4.0 - t * 0.7) * cos(p.x * 3.0 - t * 0.5);
          float noise = (noise1 + noise2 * 0.5) * 0.5 + 0.5;
          
          vec3 color = mix(uColor2, uColor1, noise);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.uniforms.uTime.value += 0.01;
    this.renderer.render(this.scene, this.camera);
  }

  updateTheme(c1, c2) {
    if (this.uniforms && this.uniforms.uColor1 && this.uniforms.uColor2) {
      this.uniforms.uColor1.value.set(...c1);
      this.uniforms.uColor2.value.set(...c2);
    }
  }

  setupResize() {
    window.addEventListener('resize', debounce(() => {
      if (this.renderer) {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    }, 250));
  }
}

const engine = new LiquidEngine();

const themeColors = {
  physical: [[0, 0.95, 1], [0, 0.05, 0.1]],
  mental: [[0.6, 1, 0], [0.1, 0.1, 0]],
  spiritual: [[1, 0.8, 0.2], [0.1, 0.05, 0]],
  blights: [[1, 0.1, 0.1], [0.05, 0, 0]],
  stats: [[0.58, 0.65, 1], [0.05, 0.05, 0.1]]
};

// === UI Functions ===
window.switchTab = (tab) => {
  if (!['physical', 'mental', 'spiritual', 'blights', 'stats'].includes(tab)) return;
  
  currentTab = tab;
  document.body.dataset.theme = tab;

  // Update active button
  document.querySelectorAll('.main-nav button').forEach(btn => {
    const isActive = btn.getAttribute('onclick').includes(`'${tab}'`);
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Update theme colors
  if (themeColors[tab] && engine) {
    engine.updateTheme(...themeColors[tab]);
  }

  // Toggle views
  const titleEl = document.getElementById('view-title');
  const questArea = document.getElementById('quest-area');
  const statsArea = document.getElementById('stats-area');
  
  if (titleEl) titleEl.textContent = tab.toUpperCase();
  if (questArea) questArea.classList.toggle('hidden', tab === 'stats');
  if (statsArea) statsArea.classList.toggle('hidden', tab !== 'stats');

  // Update XP bar aria
  const xpBar = document.querySelector('.xp-bar');
  if (xpBar) xpBar.setAttribute('aria-valuenow', state.xp);

  render();
  if (tab === 'stats') renderStats();
};

window.toggleTask = async (name, baseXp) => {
  if (!name || isNaN(baseXp)) return;
  
  const today = getTodayString();
  
  // Check if already completed
  if (state.history[today]?.[name]?.done) {
    showError("Already completed today!");
    return;
  }

  // Get rating
  const ratingInput = prompt(`Rate "${name}" (1-5 stars):`, "5");
  if (ratingInput === null) return; // User cancelled
  
  const rating = Math.min(5, Math.max(1, parseInt(ratingInput) || 5));
  const earned = Math.round(baseXp * (rating / 5));

  // Update state
  state.xp += earned;
  state.totalXp += earned;
  
  if (!state.history[today]) state.history[today] = {};
  state.history[today][name] = { done: true, rating, xp: earned };

  // Handle level changes
  while (state.xp >= 100) {
    state.level++;
    state.xp -= 100;
    showError(`🎉 Level Up! Now Level ${state.level}`, 2000);
  }
  
  while (state.xp < 0 && state.level > 1) {
    state.level--;
    state.xp += 100;
  }
  
  if (state.xp < 0) state.xp = 0;

  render();
  await syncData();
};

window.addNewQuest = () => {
  const nameInput = document.getElementById('new-name');
  const xpInput = document.getElementById('new-xp');
  
  if (!nameInput || !xpInput) return;
  
  const name = nameInput.value.trim();
  const xp = parseInt(xpInput.value);

  if (!name) {
    showError("Quest name cannot be empty");
    return;
  }
  
  if (isNaN(xp) || xp === 0) {
    showError("XP must be a non-zero number");
    return;
  }

  // Check for duplicates
  const exists = state.quests[currentTab].some(q => q.name === name);
  if (exists) {
    showError("Quest with this name already exists");
    return;
  }

  state.quests[currentTab].push({ name, xp });
  nameInput.value = '';
  xpInput.value = '';
  
  render();
  syncData();
};

window.deleteQuest = (name) => {
  if (!confirm(`Delete quest "${name}"?`)) return;
  
  state.quests[currentTab] = state.quests[currentTab].filter(q => q.name !== name);
  render();
  syncData();
};

async function syncData() {
  if (!user || isSyncing) return;
  
  isSyncing = true;
  
  try {
    await setDoc(doc(db, "users", user.uid), state, { merge: true });
    await setDoc(doc(db, "leaderboard", user.uid), {
      name: user.displayName,
      xp: state.totalXp,
      level: state.level,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Sync error:", error);
    showError("Failed to sync data");
  } finally {
    isSyncing = false;
  }
}

// === Rendering Functions ===
function render() {
  const today = getTodayString();
  const list = document.getElementById('habit-list');
  
  if (!list) return;
  
  list.innerHTML = '';

  if (state.quests[currentTab].length === 0) {
    list.innerHTML = '<div class="empty-state">No quests yet. Add one below!</div>';
    return;
  }

  state.quests[currentTab].forEach(q => {
    const done = state.history[today]?.[q.name]?.done;
    const safeName = sanitizeString(q.name);
    
    const item = document.createElement('div');
    item.className = `habit-item ${done ? 'completed' : ''}`;
    item.setAttribute('role', 'listitem');
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.setAttribute('aria-label', 'Delete quest');
    deleteBtn.onclick = () => deleteQuest(q.name);
    
    const actionBtn = document.createElement('button');
    actionBtn.className = `btn-action ${done ? 'completed' : ''}`;
    actionBtn.disabled = done;
    actionBtn.setAttribute('aria-label', done ? 'Completed' : 'Complete quest');
    actionBtn.innerHTML = done ? '<i class="fas fa-check"></i>' : (q.xp < 0 ? 'FAIL' : 'GO');
    if (!done) {
      actionBtn.onclick = () => toggleTask(q.name, q.xp);
    }
    
    item.innerHTML = `
      <div class="habit-info">
        <span class="habit-name">${safeName}</span>
        <span class="habit-xp">${q.xp > 0 ? '+' : ''}${q.xp} XP</span>
      </div>
      <div class="habit-actions"></div>
    `;
    
    const actionsContainer = item.querySelector('.habit-actions');
    actionsContainer.appendChild(deleteBtn);
    actionsContainer.appendChild(actionBtn);
    
    list.appendChild(item);
  });

  // Update XP display
  const xpFill = document.getElementById('xp-fill');
  const xpText = document.getElementById('xp-text');
  const levelDisplay = document.getElementById('level-display');
  
  if (xpFill) xpFill.style.width = `${Math.min(100, Math.max(0, state.xp))}%`;
  if (xpText) xpText.textContent = `${state.xp} / 100 XP`;
  if (levelDisplay) levelDisplay.textContent = `LVL ${state.level}`;
  
  // Update aria
  const xpBar = document.querySelector('.xp-bar');
  if (xpBar) xpBar.setAttribute('aria-valuenow', state.xp);
}

function renderStats() {
  renderChart();
  renderStreak();
  renderHeatmap();
}

function renderChart() {
  const labels = [];
  const data = [];
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    const dayXp = Object.values(state.history[ds] || {}).reduce((sum, entry) => {
      return entry.done ? sum + Math.abs(entry.xp || 0) : sum;
    }, 0);
    data.push(dayXp);
  }

  if (chart) {
    chart.destroy();
    chart = null;
  }
  
  const ctx = document.getElementById('xpChart');
  if (!ctx) return;
  
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#58a6ff';
  
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'XP Earned',
        data,
        borderColor: accentColor,
        backgroundColor: accentColor.replace(')', ', 0.1)').replace('rgb', 'rgba'),
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y} XP`
          }
        }
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
  let streak = 0;
  const today = getTodayString();
  const hasToday = Object.keys(state.history[today] || {}).length > 0;
  
  if (hasToday) {
    streak = 1;
  }
  
  let checkDate = new Date();
  while (true) {
    checkDate.setDate(checkDate.getDate() - 1);
    const ds = checkDate.toISOString().slice(0, 10);
    
    if (Object.keys(state.history[ds] || {}).length > 0) {
      streak++;
    } else {
      break;
    }
  }

  const streakEl = document.getElementById('streak-info');
  if (streakEl) {
    streakEl.innerHTML = `<i class="fas fa-fire"></i> Streak: ${streak} day${streak !== 1 ? 's' : ''}`;
  }
}

function renderHeatmap() {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(end.getFullYear() - 1);
  const heatmapData = {};

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    const day = state.history[ds] || {};
    
    let totalXp = 0;
    const ratings = [];
    
    Object.values(day).forEach(entry => {
      if (entry.done) {
        totalXp += Math.abs(entry.xp || 0);
        if (entry.rating) ratings.push(entry.rating);
      }
    });

    if (totalXp > 0) {
      const timestamp = Math.floor(d.getTime() / 1000);
      const avgRating = ratings.length 
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) 
        : null;
      heatmapData[timestamp] = totalXp;
    }
  }

  if (cal) {
    try {
      cal.destroy();
    } catch (e) {
      console.warn('Heatmap destroy error:', e);
    }
    cal = null;
  }
  
  const calEl = document.getElementById('cal-heatmap');
  if (!calEl) return;
  
  try {
    cal = new CalHeatmap();
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#58a6ff';
    
    cal.init({
      itemSelector: '#cal-heatmap',
      domain: 'month',
      subDomain: 'day',
      range: 12,
      start,
      data: heatmapData,
      cellSize: 12,
      cellPadding: 3,
      cellRadius: 3,
      domainGutter: 10,
      legend: [20, 50, 100, 200],
      scale: {
        colors: {
          min: '#222',
          max: accentColor
        }
      },
      tooltip: true
    });
  } catch (error) {
    console.error('Heatmap error:', error);
  }
}

// === Authentication ===
onAuthStateChanged(auth, async (u) => {
  user = u;
  
  if (u) {
    showLoading(true);
    
    try {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app-screen').classList.remove('hidden');
      
      const userName = document.getElementById('user-name');
      if (userName) {
        userName.textContent = u.displayName?.split(' ')[0] || 'Hero';
      }

      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const data = snap.data();
        state = { ...state, ...data };
        
        // Validate state structure
        if (!state.quests) state.quests = { physical: [], mental: [], spiritual: [], blights: [] };
        if (!state.history) state.history = {};
        if (typeof state.xp !== 'number') state.xp = 0;
        if (typeof state.level !== 'number') state.level = 1;
        if (typeof state.totalXp !== 'number') state.totalXp = 0;
      }

      // Set default quests if empty
      if (Object.values(state.quests).every(arr => arr.length === 0)) {
        state.quests = {
          physical: [
            { name: "100 Pushups", xp: 20 },
            { name: "30 min Cardio", xp: 15 },
            { name: "Cold Shower", xp: 10 }
          ],
          mental: [
            { name: "Read 10 Pages", xp: 15 },
            { name: "Learn New Skill", xp: 20 },
            { name: "Journal", xp: 10 }
          ],
          spiritual: [
            { name: "Pray/Meditate", xp: 15 },
            { name: "Gratitude Practice", xp: 10 },
            { name: "Help Someone", xp: 20 }
          ],
          blights: [
            { name: "Relapse", xp: -50 },
            { name: "Skip Workout", xp: -20 },
            { name: "Junk Food Binge", xp: -15 }
          ]
        };
        await syncData();
      }

      render();

      // Setup leaderboard listener
      onSnapshot(
        query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(10)),
        (snapshot) => {
          const board = document.getElementById('scoreboard-list');
          if (!board) return;
          
          board.innerHTML = '';
          
          if (snapshot.empty) {
            board.innerHTML = '<div class="empty-state">No players yet</div>';
            return;
          }
          
          snapshot.forEach((docSnap, index) => {
            const data = docSnap.data();
            const item = document.createElement('div');
            item.className = 'habit-item leaderboard-item';
            item.setAttribute('role', 'listitem');
            
            const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
            
            const rank = document.createElement('span');
            rank.className = 'leaderboard-rank';
            rank.textContent = medal;
            
            const name = document.createElement('span');
            name.className = 'leaderboard-name';
            name.textContent = sanitizeString(data.name || 'Anonymous');
            
            const level = document.createElement('span');
            level.className = 'leaderboard-level';
            level.textContent = `Lvl ${data.level || 1}`;
            
            const xp = document.createElement('span');
            xp.className = 'leaderboard-xp';
            xp.textContent = `${data.xp || 0} XP`;
            
            item.appendChild(rank);
            item.appendChild(name);
            item.appendChild(level);
            item.appendChild(xp);
            
            board.appendChild(item);
          });
        },
        (error) => {
          console.error("Leaderboard error:", error);
        }
      );
      
    } catch (error) {
      console.error("Auth error:", error);
      showError("Failed to load user data");
    } finally {
      showLoading(false);
    }
    
  } else {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    showLoading(false);
  }
});

// Login/Logout handlers
const loginBtn = document.getElementById('google-login-btn');
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    try {
      showLoading(true);
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
      showError("Login failed. Please try again.");
      showLoading(false);
    }
  });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to logout?")) {
      try {
        showLoading(true);
        await signOut(auth);
      } catch (error) {
        console.error("Logout error:", error);
        showError("Logout failed");
        showLoading(false);
      }
    }
  });
}

// === Custom Cursor ===
const cursor = document.getElementById('customCursor');
if (cursor) {
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
}

// === Keyboard Navigation ===
document.addEventListener('keydown', (e) => {
  const tabs = ['physical', 'mental', 'spiritual', 'blights', 'stats'];
  const currentIndex = tabs.indexOf(currentTab);
  
  if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
    switchTab(tabs[currentIndex + 1]);
  } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
    switchTab(tabs[currentIndex - 1]);
  }
});

// Initialize
console.log("Hero's Quest initialized ⚔️");