// ========================================
// FIREBASE IMPORTS & CONFIGURATION
// ========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// ========================================
// STATE MANAGEMENT
// ========================================
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
let pendingQuest = null;
let selectedMood = null;
let isSyncing = false;
let syncTimeout = null;

// ========================================
// DOM UTILITIES
// ========================================
const $ = id => document.getElementById(id);
const $$ = selector => document.querySelectorAll(selector);

const showError = message => {
  const errorEl = $('error');
  if (!errorEl) return;
  
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  setTimeout(() => errorEl.classList.add('hidden'), 4000);
};

const showLoading = show => {
  $('loading')?.classList.toggle('hidden', !show);
};

const sanitize = str => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const validateXP = xp => {
  const number = parseInt(xp);
  return !isNaN(number) && number >= -100 && number <= 500 ? number : null;
};

const vibrate = pattern => navigator.vibrate?.(pattern);

const triggerConfetti = () => {
  window.confetti?.({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
};

// ========================================
// ANIMATED BACKGROUND
// ========================================
class AnimatedBackground {
  constructor() {
    const canvas = $('bg');
    if (!canvas) return;
    
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width = window.innerWidth;
    this.height = canvas.height = window.innerHeight;
    this.time = 0;
    this.color = [0, 242, 255]; // Cyan default
    this.particles = [];
    
    // Create particles
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5
      });
    }
    
    this.animate();
    
    window.addEventListener('resize', () => {
      this.width = canvas.width = window.innerWidth;
      this.height = canvas.height = window.innerHeight;
    });
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.ctx) return;
    
    this.time += 0.01;
    
    // Create animated gradient
    const gradient = this.ctx.createLinearGradient(
      0, 
      0, 
      this.width * Math.cos(this.time * 0.5), 
      this.height * Math.sin(this.time * 0.5)
    );
    const [red, green, blue] = this.color;
    gradient.addColorStop(0, `rgb(${red}, ${green}, ${blue})`);
    gradient.addColorStop(1, 'rgb(0, 0, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw and update particles
    this.particles.forEach(particle => {
      // Update position
      particle.x += particle.speedX;
      particle.y += particle.speedY;
      
      // Wrap around screen
      if (particle.x < 0) particle.x = this.width;
      if (particle.x > this.width) particle.x = 0;
      if (particle.y < 0) particle.y = this.height;
      if (particle.y > this.height) particle.y = 0;
      
      // Draw particle
      this.ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${0.3 + Math.sin(this.time * 2 + particle.x) * 0.3})`;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }
  
  setColor(colorArray) {
    this.color = colorArray;
  }
}

const background = new AnimatedBackground();

// Theme colors for each tab
const THEME_COLORS = {
  physical: [0, 242, 255],    // Cyan
  mental: [133, 153, 0],      // Olive
  spiritual: [212, 175, 55],  // Gold
  blights: [255, 51, 102],    // Red
  stats: [139, 92, 246],      // Purple
  shop: [255, 165, 0]         // Orange
};

// ========================================
// TAB SWITCHING
// ========================================
const switchTab = tabName => {
  currentTab = tabName;
  document.body.setAttribute('data-theme', tabName);
  
  // Update active nav button
  $$('.nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update background color
  if (background) {
    background.setColor(THEME_COLORS[tabName] || [0, 242, 255]);
  }
  
  // Update page title
  $('title').textContent = tabName.toUpperCase();
  
  // Show/hide appropriate sections
  $('quests')?.classList.toggle('hidden', tabName === 'stats' || tabName === 'shop');
  $('stats')?.classList.toggle('hidden', tabName !== 'stats');
  $('shop')?.classList.toggle('hidden', tabName !== 'shop');
  
  // Load content for current tab
  if (tabName !== 'stats' && tabName !== 'shop') {
    loadQuote();
  }
  if (tabName === 'stats') {
    renderStats();
  }
  if (tabName === 'shop') {
    renderShop();
  }
  
  updateHeader();
  renderQuestList();
};

// Initialize navigation
$$('.nav button').forEach(button => {
  button.addEventListener('click', () => {
    switchTab(button.dataset.tab);
  });
});

// ========================================
// HEADER UPDATES
// ========================================
const updateHeader = () => {
  $('avatar').textContent = state.avatar;
  $('username').textContent = user?.displayName?.split(' ')[0] || 'HERO';
  $('level').textContent = `LVL ${state.level}`;
  $('xp-fill').style.width = `${state.xp}%`;
  $('xp-text').textContent = `${state.xp} / 100 XP`;
  $('gold').textContent = state.gold;
};

// ========================================
// MOTIVATIONAL QUOTES
// ========================================
const QUOTES = {
  physical: [
    { quote: "The body achieves what the mind believes.", author: "Napoleon Hill" },
    { quote: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" }
  ],
  mental: [
    { quote: "Reading is to the mind what exercise is to the body.", author: "Joseph Addison" },
    { quote: "The mind is everything. What you think you become.", author: "Buddha" }
  ],
  spiritual: [
    { quote: "Peace comes from within. Do not seek it without.", author: "Buddha" },
    { quote: "Be still and know.", author: "Psalm 46:10" }
  ],
  blights: [
    { quote: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
    { quote: "Rock bottom became the solid foundation on which I rebuilt my life.", author: "J.K. Rowling" }
  ]
};

const loadQuote = () => {
  const quoteEl = $('quote');
  if (!quoteEl) return;
  
  const quoteList = QUOTES[currentTab] || QUOTES.physical;
  const randomQuote = quoteList[Math.floor(Math.random() * quoteList.length)];
  
  quoteEl.innerHTML = `
    <p>"${randomQuote.quote}"</p>
    <small>— ${randomQuote.author}</small>
  `;
};

// ========================================
// ADD NEW QUEST
// ========================================
$('add-btn')?.addEventListener('click', () => {
  const questName = $('quest-name').value.trim();
  const questXP = validateXP($('quest-xp').value);
  const isRepeating = $('quest-repeat').checked;
  
  // Validation
  if (!questName) {
    showError('Quest name required');
    return;
  }
  
  if (questXP === null) {
    showError('XP must be between -100 and 500');
    return;
  }
  
  if (state.quests[currentTab].some(quest => quest.name === questName)) {
    showError('Quest already exists');
    return;
  }
  
  // Add quest to state
  state.quests[currentTab].push({ 
    name: questName, 
    xp: questXP, 
    repeat: isRepeating 
  });
 
  // Clear form
  $('quest-name').value = '';
  $('quest-xp').value = '';
  $('quest-repeat').checked = false;
  // Add this line at the end of your addNewQuest() function
toggleAddPanel();
  renderQuestList();
  syncDataToFirebase();
});

// ========================================
// COMPLETE QUEST (SHOW MODAL)
// ========================================
const completeQuest = (questName, questXP) => {
  const today = new Date().toISOString().slice(0, 10);
  
  // Check if already completed today
  if (state.history[today]?.[questName]?.done) {
    alert('Already completed today!');
    return;
  }
  
  pendingQuest = { name: questName, xp: questXP };
  
  // Update modal title
  $('modal-title').textContent = `Rate "${sanitize(questName)}"`;
  
  // Reset stars
  $$('.stars i').forEach(star => {
    star.classList.remove('active', 'fas');
    star.classList.add('far');
  });
  
  // Reset moods
  $$('.moods span').forEach(mood => mood.classList.remove('active'));
  
  selectedMood = null;
  setStarRating(5); // Default to 5 stars
  
  $('modal')?.classList.remove('hidden');
};

const setStarRating = value => {
  $$('.stars i').forEach((star, index) => {
    const isActive = index < value;
    star.classList.toggle('active', isActive);
    star.classList.toggle('fas', isActive);
    star.classList.toggle('far', !isActive);
  });
};

// Star click handlers
$$('.stars i').forEach(star => {
  star.addEventListener('click', () => {
    const value = parseInt(star.dataset.value);
    if (!isNaN(value)) setStarRating(value);
  });
});

// Mood click handlers
$$('.moods span').forEach(moodEl => {
  moodEl.addEventListener('click', () => {
    $$('.moods span').forEach(m => m.classList.remove('active'));
    moodEl.classList.add('active');
    selectedMood = moodEl.dataset.mood;
  });
});

// ========================================
// CONFIRM QUEST COMPLETION
// ========================================
$('confirm-btn')?.addEventListener('click', async () => {
  if (!pendingQuest) return;
  
  try {
    const starRating = $$('.stars i.active').length || 5;
    const earnedXP = Math.round(pendingQuest.xp * (starRating / 5));
    
    const today = new Date().toISOString().slice(0, 10);
    
    // Update state
    state.xp += earnedXP;
    state.totalXp += earnedXP;
    state.gold += Math.max(0, Math.floor(earnedXP / 10));
    const multiplier = 1 / (1 + (state.level * 0.05));
    const fairEarnedXP = Math.round(earnedXP * multiplier);
    
    // Record in history
    if (!state.history[today]) state.history[today] = {};
    state.history[today][pendingQuest.name] = {
      done: true,
      rating: starRating,
      mood: selectedMood,
      xp: earnedXP,
      timestamp: Date.now()
    };
    
    vibrate([100, 50, 100]);
    
    // Check for level up
    while (state.xp >= 100) {
      state.level++;
      state.xp -= 100;
      triggerConfetti();
      vibrate([200, 100, 300]);
      setTimeout(() => alert(`🎉 LEVEL ${state.level}! 🎉`), 200);
    }
    
    closeModal();
    renderQuestList();
    await syncDataToFirebase();
    
  } catch (error) {
    console.error('Failed to confirm quest:', error);
    showError('Failed to save progress');
  }
});

const closeModal = () => {
  $('modal')?.classList.add('hidden');
  pendingQuest = null;
  selectedMood = null;
};

$('cancel-btn')?.addEventListener('click', closeModal);

// Close modal on Escape key
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('modal')?.classList.contains('hidden')) {
    closeModal();
  }
});

// ========================================
// RENDER QUEST LIST
// ========================================
const renderQuestList = () => {
  updateHeader();
  
  const today = new Date().toISOString().slice(0, 10);
  const listEl = $('list');
  if (!listEl) return;
  
  listEl.innerHTML = '';
  
  const questList = state.quests[currentTab];
  
  if (questList.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <i class="fas fa-scroll fa-3x"></i>
        <p>No quests yet</p>
      </div>
    `;
    return;
  }
  
  questList.forEach(quest => {
    const isCompleted = state.history[today]?.[quest.name]?.done;
    const questDiv = document.createElement('div');
    questDiv.className = `quest-item ${isCompleted ? 'done' : ''}`;
    
    const xpSign = quest.xp > 0 ? '+' : '';
    const repeatIcon = quest.repeat ? ' 🔄' : '';
    const buttonText = isCompleted ? '✓' : (quest.xp < 0 ? 'FAIL' : 'GO');
    
    questDiv.innerHTML = `
      <span class="quest-name">${sanitize(quest.name)} (${xpSign}${quest.xp} XP)${repeatIcon}</span>
      <button class="quest-btn" ${isCompleted ? 'disabled' : ''}>
        ${buttonText}
      </button>
    `;
    
    if (!isCompleted) {
      questDiv.querySelector('.quest-btn').addEventListener('click', () => {
        completeQuest(quest.name, quest.xp);
      });
    }
    
    listEl.appendChild(questDiv);
  });
};

// ========================================
// STATS PAGE
// ========================================
const renderStats = () => {
  $('total-xp').textContent = state.totalXp.toLocaleString();
  $('level-stat').textContent = state.level;
  $('gold-stat').textContent = state.gold.toLocaleString();
  
  renderProgressChart();
  renderStreak();
  renderBadges();
};

const renderProgressChart = () => {
  const canvas = $('chart');
  if (!canvas) return;
  
  const labels = [];
  const data = [];
  
  // Get last 7 days of data
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().slice(0, 10);
    
    labels.push(dateString.slice(5)); // MM-DD format
    
    const dayHistory = state.history[dateString] || {};
    const dayXP = Object.values(dayHistory).reduce((sum, entry) => {
      return entry.done ? sum + (entry.xp || 0) : sum;
    }, 0);
    
    data.push(dayXP);
  }
  
  // Destroy existing chart
  if (chart) chart.destroy();
  
  // Create new chart
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
  const streakEl = $('streak');
  if (!streakEl) return;
  
  let streak = 0;
  const currentDate = new Date();
  const today = currentDate.toISOString().slice(0, 10);
  
  // Check if user did anything today
  if (Object.keys(state.history[today] || {}).length > 0) {
    streak = 1;
  }
  
  // Count consecutive days backwards
  for (let i = 1; i < 365; i++) {
    currentDate.setDate(currentDate.getDate() - 1);
    const dateString = currentDate.toISOString().slice(0, 10);
    
    if (Object.keys(state.history[dateString] || {}).length > 0) {
      streak++;
    } else {
      break;
    }
  }
  
  streakEl.textContent = streak;
};

const renderBadges = () => {
  const badgesEl = $('badges');
  if (!badgesEl) return;
  
  const earnedBadges = [];
  
  // Badge criteria
  if (state.totalXp >= 500) earnedBadges.push('XP Novice 🅱');
  if (state.totalXp >= 1000) earnedBadges.push('XP Master 🏆');
  if (state.level >= 10) earnedBadges.push('Level 10 🦸');
  
  // Merge with existing badges (no duplicates)
  state.badges = [...new Set([...state.badges, ...earnedBadges])];
  
  if (state.badges.length === 0) {
    badgesEl.innerHTML = '<p class="empty">Complete quests to earn badges</p>';
  } else {
    badgesEl.innerHTML = state.badges
      .map(badge => `<span class="badge">${sanitize(badge)}</span>`)
      .join('');
  }
};

// ========================================
// SHOP PAGE
// ========================================
const renderShop = () => {
  const shopEl = $('shop-items');
  if (!shopEl) return;
  
  const shopItems = [
    { name: 'Wizard', cost: 100, avatar: '🧙‍♂️', icon: '🔮' },
    { name: 'Knight', cost: 150, avatar: '⚔️', icon: '🛡️' },
    { name: 'Ninja', cost: 200, avatar: '🥷', icon: '🗡️' },
    { name: 'Mage', cost: 250, avatar: '🧙‍♂️', icon: '✨' }
  ];
  
  shopEl.innerHTML = shopItems.map(item => `
    <div class="shop-item">
      <div class="shop-info">
        <span class="shop-icon">${item.icon}</span>
        <span class="shop-name">${sanitize(item.name)}</span>
        <span class="shop-cost">${item.cost} 🪙</span>
      </div>
      <button class="shop-btn" 
        ${state.gold < item.cost ? 'disabled' : ''} 
        data-avatar="${item.avatar}" 
        data-cost="${item.cost}">
        ${state.gold >= item.cost ? 'Buy' : 'Locked'}
      </button>
    </div>
  `).join('');
  
  // Add purchase handlers
  $$('.shop-btn').forEach(button => {
    if (!button.disabled) {
      button.addEventListener('click', () => {
        const avatar = button.dataset.avatar;
        const cost = parseInt(button.dataset.cost);
        
        if (state.gold >= cost) {
          state.gold -= cost;
          state.avatar = avatar;
          renderQuestList();
          syncDataToFirebase();
          alert('🎉 Purchase successful!');
          renderShop();
        }
      });
    }
  });
};

// ========================================
// FIREBASE SYNC (DEBOUNCED)
// ========================================
const syncDataToFirebase = async () => {
  if (!user || isSyncing) return;
  
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    isSyncing = true;
    
    try {
      // Save user data
      await setDoc(doc(db, "users", user.uid), state, { merge: true });
      
      // Update leaderboard
      await setDoc(doc(db, "leaderboard", user.uid), {
        name: user.displayName || 'Hero',
        xp: state.totalXp,
        level: state.level,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Firebase sync failed:', error);
    } finally {
      isSyncing = false;
    }
  }, 1000);
};

// ========================================
// AUTHENTICATION
// ========================================
onAuthStateChanged(auth, async currentUser => {
  user = currentUser;
  
  if (currentUser) {
    try {
      showLoading(true);
      
      $('login-screen')?.classList.add('hidden');
      $('app')?.classList.remove('hidden');
      
      // Load user data from Firestore
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      
      if (userDoc.exists()) {
        state = { ...state, ...userDoc.data() };
      } else {
        // New user - set up default quests
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
        await syncDataToFirebase();
      }
      
      renderQuestList();
      loadQuote();
      
      // Set up leaderboard listener
      const leaderboardQuery = query(
        collection(db, "leaderboard"),
        orderBy("xp", "desc"),
        limit(10)
      );
      
      onSnapshot(leaderboardQuery, snapshot => {
        const leaderboardEl = $('leaderboard');
        if (!leaderboardEl) return;
        
        if (snapshot.empty) {
          leaderboardEl.innerHTML = '<p class="empty">No players yet</p>';
          return;
        }
        
        leaderboardEl.innerHTML = '';
        snapshot.forEach((docSnapshot, index) => {
          const playerData = docSnapshot.data();
          const position = index + 1;
          const medal = position === 1 ? '🥇' : 
                       position === 2 ? '🥈' : 
                       position === 3 ? '🥉' : '';
          
          leaderboardEl.innerHTML += `
            <div class="lb-item">
              <span>${medal} ${position}. ${sanitize(playerData.name || 'Hero')} (Lvl ${playerData.level || 1})</span>
              <span class="lb-xp">${playerData.xp || 0} XP</span>
            </div>
          `;
        });
      });
      
    } catch (error) {
      console.error('Failed to load user data:', error);
      showError('Failed to load data');
    } finally {
      showLoading(false);
    }
  } else {
    // User logged out
    $('login-screen')?.classList.remove('hidden');
    $('app')?.classList.add('hidden');
  }
});

// Login button handler
$('login-btn')?.addEventListener('click', async () => {
  try {
    showLoading(true);
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Login failed:', error);
    const errorMessage = error.code === 'auth/popup-closed-by-user' 
      ? 'Login cancelled' 
      : 'Login failed';
    showError(errorMessage);
  } finally {
    showLoading(false);
  }
});

// Logout button handler
$('logout-btn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to logout?')) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
      showError('Logout failed');
    }
  }
});

// Add this function to script.js
window.toggleAddPanel = () => {
    const panel = document.getElementById('add-panel');
    const btn = document.getElementById('toggle-add-btn');
    
    panel.classList.toggle('hidden');
    
    // Optional: Rotate the icon when open
    const icon = btn.querySelector('i');
    icon.style.transform = panel.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(45deg)';
    icon.style.transition = 'transform 0.3s ease';
};
/// Ensure the Add Panel starts hidden
document.getElementById('add-panel')?.classList.add('hidden');

// 1. Toggle Button Logic
// Make sure you have a button with id="toggle-add-btn" in your HTML
document.getElementById('toggle-add-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('add-panel');
    panel.classList.toggle('hidden');
});

// 2. Start Redemption (Login) Button Fix
// This ensures the button works even if Firebase is slow to load
document.getElementById('google-login-btn')?.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
    }
});
// Add to the bottom of script.js
$('toggle-panel-btn')?.addEventListener('click', () => {
    const panel = $('add-panel');
    const isHidden = panel.classList.toggle('hidden');
    
    // Optional: Change button text based on state
    $('toggle-panel-btn').innerHTML = isHidden 
        ? '<i class="fas fa-plus-circle"></i> ADD NEW QUEST' 
        : '<i class="fas fa-times-circle"></i> CLOSE';
});
// ========================================
// INITIALIZATION COMPLETE
// ========================================
console.log('🎮 Hero\'s Quest initialized and ready!');