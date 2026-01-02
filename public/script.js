// script.js - Core JavaScript for Hero's Quest self-improvement app
// This file manages state, UI rendering, user interactions, and data persistence using Firebase.
// For personal use: set daily goals in various categories, rate performance, track financials, and manage negative blights.
// Structure: Class-based for organization, with methods for init, events, rendering, and logic.

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class HerosQuest {
  constructor() {
    // Firebase config (for personal use; replace with your project if needed)
    this.firebaseConfig = {
      apiKey: "AIzaSyBDTTyEWFBam2EEWK4X2VV5E-wUJx10V38",
      authDomain: "her0s-quest.firebaseapp.com",
      projectId: "her0s-quest",
      storageBucket: "her0s-quest.firebasestorage.app",
      messagingSenderId: "120264562008",
      appId: "1:120264562008:web:69365314951dc05980812d"
    };

    // App state for tracking progress across categories
    this.state = {
      user: null,
      currentTab: 'home',
      quests: [], // Array of quests: {id, name, xp, category, targetCategory? (for blight)}
      dailyLogs: {}, // {date: {category: {id: {rating, earnedXp}}, totalXp}}
      xp: 0,
      level: 1,
      categories: { physical: 0, mental: 0, spiritual: 0, motivation: 0 },
      financial: { balance: 0, income: 0, expenses: 0 },
      blightDamage: 0,
      pendingDelete: null,
      pendingComplete: null
    };

    // Chart instance
    this.chart = null;

    this.init();
  }

  async init() {
    this.app = initializeApp(this.firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.provider = new GoogleAuthProvider();

    this.setupEventListeners();
    this.handleAuth();
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Add quest modal
    document.getElementById('open-add-modal').addEventListener('click', () => this.toggleModal('add-modal', true));
    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', () => this.toggleModal('add-modal', false)));

    // Category change for add form
    document.getElementById('quest-category').addEventListener('change', (e) => {
      const value = e.target.value;
      document.getElementById('target-category-group').classList.toggle('hidden', value !== 'blight');
      const xpInput = document.getElementById('quest-xp');
      if (value === 'financial') {
        xpInput.min = -500;
        xpInput.value = 0;
      } else {
        xpInput.min = 10;
        xpInput.value = 50;
      }
    });

    // Add quest submission
    document.getElementById('add-quest-form').addEventListener('submit', (e) => this.handleAddQuest(e));

    // Delete confirmation
    document.getElementById('confirm-delete').addEventListener('click', () => this.executeDelete());
    document.getElementById('cancel-delete').addEventListener('click', () => this.toggleModal('confirm-modal', false));

    // Rating modal
    document.querySelectorAll('.rating-stars i').forEach(star => {
      star.addEventListener('click', () => this.setRating(parseInt(star.dataset.value)));
    });
    document.getElementById('confirm-rating').addEventListener('click', () => this.confirmRating());
    document.getElementById('cancel-rating').addEventListener('click', () => this.toggleModal('rating-modal', false));

    // Auth
    document.getElementById('google-login-btn').addEventListener('click', () => signInWithPopup(this.auth, this.provider));
    document.getElementById('logout-btn').addEventListener('click', () => signOut(this.auth));
  }

  handleAuth() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.state.user = user;
        await this.syncData();
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        this.switchTab('home');
      } else {
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
      }
    });
  }

  async syncData() {
    const userDoc = await getDoc(doc(this.db, "users", this.state.user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      this.state.quests = data.quests || this.state.quests;
      this.state.dailyLogs = data.dailyLogs || this.state.dailyLogs;
      this.state.xp = data.xp || this.state.xp;
      this.state.level = data.level || this.state.level;
      this.state.categories = data.categories || this.state.categories;
      this.state.financial = data.financial || this.state.financial;
      this.state.blightDamage = data.blightDamage || this.state.blightDamage;
    } else {
      await setDoc(doc(this.db, "users", this.state.user.uid), this.state);
    }
    this.renderAll();
  }

  switchTab(tabId) {
    this.state.currentTab = tabId;
    document.body.setAttribute('data-theme', tabId);

    const titles = {
      home: 'HOME',
      stats: 'STATS',
      calendar: 'CALENDAR',
      motivation: 'MOTIVATION',
      spiritual: 'SPIRITUAL',
      physical: 'PHYSICAL',
      mental: 'MENTAL',
      financial: 'FINANCIAL',
      blight: 'BLIGHT'
    };
    document.getElementById('view-title').innerText = titles[tabId];

    document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
    if (tabId === 'stats') {
      document.getElementById('stats-view').classList.remove('hidden');
      this.renderStats();
    } else if (tabId === 'calendar') {
      document.getElementById('calendar-view').classList.remove('hidden');
      this.renderCalendar();
    } else {
      document.getElementById('quest-view').classList.remove('hidden');
      this.renderQuests();
    }

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  }

  async handleAddQuest(e) {
    e.preventDefault();
    const name = document.getElementById('quest-name').value;
    const xp = parseInt(document.getElementById('quest-xp').value);
    const category = document.getElementById('quest-category').value;

    const newQuest = { id: Date.now(), name, xp, category };
    if (category === 'blight') {
      newQuest.targetCategory = document.getElementById('target-category').value;
      newQuest.xp = -Math.abs(xp); // Make negative for deduction
    }

    this.state.quests.push(newQuest);
    await this.saveState();
    this.toggleModal('add-modal', false);
    this.renderQuests();
    e.target.reset();
  }

  requestComplete(id) {
    const quest = this.state.quests.find(q => q.id === id);
    if (!quest) return;

    const today = new Date().toISOString().split('T')[0];
    if (this.state.dailyLogs[today]?.[quest.category]?.[id]?.completed) return;

    this.state.pendingComplete = { id, category: quest.category, xp: quest.xp, targetCategory: quest.targetCategory };
    document.getElementById('rating-title').innerText = quest.category === 'blight' ? 'Rate Severity' : 'Rate Performance';
    this.setRating(3); // Default middle
    this.toggleModal('rating-modal', true);
  }

  setRating(value) {
    document.querySelectorAll('.rating-stars i').forEach((star, index) => {
      star.classList.toggle('active', index < value);
      star.classList.toggle('fas', index < value);
      star.classList.toggle('far', index >= value);
    });
  }

  async confirmRating() {
    const { id, category, xp, targetCategory } = this.state.pendingComplete;
    const rating = document.querySelectorAll('.rating-stars .active').length || 3;
    let earnedXp = xp * rating / 5;

    const today = new Date().toISOString().split('T')[0];
    if (!this.state.dailyLogs[today]) this.state.dailyLogs[today] = {};
    if (!this.state.dailyLogs[today][category]) this.state.dailyLogs[today][category] = {};

    this.state.dailyLogs[today][category][id] = { completed: true, rating, earnedXp };

    this.state.xp += earnedXp;
    if (category === 'financial') {
      this.state.financial.balance += earnedXp;
      if (earnedXp > 0) this.state.financial.income += earnedXp;
      else this.state.financial.expenses += Math.abs(earnedXp);
    } else if (category === 'blight') {
      this.state.categories[targetCategory] += earnedXp; // Negative
      this.state.blightDamage += Math.abs(earnedXp);
    } else {
      this.state.categories[category] += earnedXp;
    }

    // Level up
    while (this.state.xp >= 100 * this.state.level) {
      this.state.level++;
      // Confetti for level up
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }

    await this.saveState();
    this.toggleModal('rating-modal', false);
    this.renderQuests();
    this.renderAll();
  }

  requestDelete(id) {
    this.state.pendingDelete = id;
    this.toggleModal('confirm-modal', true);
  }

  async executeDelete() {
    this.state.quests = this.state.quests.filter(q => q.id !== this.state.pendingDelete);
    await this.saveState();
    this.toggleModal('confirm-modal', false);
    this.renderQuests();
  }

  renderQuests() {
    const container = document.getElementById('quest-list');
    container.innerHTML = '';
    const tab = this.state.currentTab;
    const today = new Date().toISOString().split('T')[0];
    const filteredQuests = this.state.quests.filter(q => tab === 'home' ? q.category !== 'blight' : q.category === tab);

    filteredQuests.forEach(q => {
      const log = this.state.dailyLogs[today]?.[q.category]?.[q.id] || { completed: false };
      const item = document.createElement('div');
      item.className = 'quest-item glass';
      item.innerHTML = `
        <div class="quest-info">
          <h3>${q.name}</h3>
          <p>${q.xp > 0 ? '+' : ''}${q.xp} XP</p>
        </div>
        <button class="btn-primary" ${log.completed ? 'disabled' : ''} onclick="window.app.requestComplete(${q.id})">
          ${log.completed ? 'Completed' : (q.category === 'blight' ? 'Suffer' : 'Complete')}
        </button>
        <button class="btn-delete" onclick="window.app.requestDelete(${q.id})">×</button>
      `;
      container.appendChild(item);
    });
  }

  renderCalendar() {
    const container = document.getElementById('calendar-widget');
    const date = new Date(2026, 0, 2); // Use provided current date
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthName = date.toLocaleString('default', { month: 'long' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    let html = `<h4>${monthName} ${year}</h4><div class="calendar-grid">`;
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => html += `<div class="cal-header">${day}</div>`);

    for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${(month + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
      const dailyXp = Object.values(this.state.dailyLogs[dayStr] || {}).reduce((sum, cat) => sum + Object.values(cat).reduce((s, l) => s + (l.earnedXp || 0), 0), 0);
      const heatLevel = Math.min(Math.floor(Math.abs(dailyXp) / 20), 4);
      const isToday = day === date.getDate();
      html += `<div class="cal-day heat-${heatLevel} ${isToday ? 'today' : ''}">${day}</div>`;
    }
    container.innerHTML = html + '</div>';

    // History
    const historyContainer = document.getElementById('calendar-history');
    historyContainer.innerHTML = Object.entries(this.state.dailyLogs).slice(-10).map(([date, logs]) => {
      return `<div class="history-item"><strong>${date}</strong>: ${logs.totalXp || 0} XP</div>`;
    }).join('');
  }

  renderStats() {
    // Update stat cards
    document.getElementById('stat-physical').innerText = this.state.categories.physical;
    document.getElementById('stat-mental').innerText = this.state.categories.mental;
    document.getElementById('stat-spiritual').innerText = this.state.categories.spiritual;
    document.getElementById('stat-motivation').innerText = this.state.categories.motivation;
    document.getElementById('stat-financial-balance').innerText = this.state.financial.balance;
    document.getElementById('stat-income').innerText = this.state.financial.income;
    document.getElementById('stat-expenses').innerText = this.state.financial.expenses;
    document.getElementById('stat-blight').innerText = this.state.blightDamage;

    // Chart
    const ctx = document.getElementById('progressChart').getContext('2d');
    if (this.chart) this.chart.destroy();

    const dates = Object.keys(this.state.dailyLogs).sort();
    let cumulative = 0;
    const data = dates.map(d => {
      cumulative += Object.values(this.state.dailyLogs[d] || {}).reduce((sum, cat) => sum + Object.values(cat).reduce((s, l) => s + (l.earnedXp || 0), 0), 0);
      return cumulative;
    });

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Progress',
          data,
          borderColor: 'var(--accent)',
          backgroundColor: 'rgba(var(--accent), 0.2)',
          fill: true
        }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }

  async saveState() {
    if (this.state.user) {
      const userRef = doc(this.db, "users", this.state.user.uid);
      await updateDoc(userRef, this.state);
    }
  }

  toggleModal(id, show) {
    document.getElementById(id).classList.toggle('hidden', !show);
  }

  renderAll() {
    document.getElementById('user-name').innerText = this.state.user?.displayName || 'Traveler';
    document.getElementById('user-avatar').src = this.state.user?.photoURL || '';
    document.getElementById('level-display').innerText = `Level ${this.state.level}`;
    document.getElementById('xp-count').innerText = this.state.xp;
  }
}

// Global for onclick
window.app = new HerosQuest();