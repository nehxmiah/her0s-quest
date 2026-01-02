// Hero's Quest - Enhanced Self-Improvement Application
// Full-featured gamified personal development tracker

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Motivational quotes database
const QUOTES = {
  spiritual: [
    { text: "Faith is taking the first step even when you don't see the whole staircase.", author: "Martin Luther King Jr." },
    { text: "The soul always knows what to do to heal itself. The challenge is to silence the mind.", author: "Caroline Myss" },
    { text: "Your task is not to seek for love, but merely to seek and find all the barriers within yourself that you have built against it.", author: "Rumi" },
    { text: "The privilege of a lifetime is to become who you truly are.", author: "Carl Jung" },
    { text: "Be still and know.", author: "Psalm 46:10" }
  ],
  physical: [
    { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
    { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
    { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Unknown" },
    { text: "Strength doesn't come from what you can do. It comes from overcoming the things you once thought you couldn't.", author: "Rikki Rogers" },
    { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" }
  ],
  mental: [
    { text: "The mind is everything. What you think you become.", author: "Buddha" },
    { text: "Your intellect may be confused, but your emotions will never lie to you.", author: "Roger Ebert" },
    { text: "The greatest weapon against stress is our ability to choose one thought over another.", author: "William James" },
    { text: "You have power over your mind - not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
    { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" }
  ],
  financial: [
    { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
    { text: "It's not how much money you make, but how much money you keep.", author: "Robert Kiyosaki" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "Do not save what is left after spending, but spend what is left after saving.", author: "Warren Buffett" },
    { text: "Wealth is the ability to fully experience life.", author: "Henry David Thoreau" }
  ],
  motivation: [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Your limitation—it's only your imagination.", author: "Unknown" },
    { text: "Great things never come from comfort zones.", author: "Unknown" }
  ],
  blight: [
    { text: "Every setback is a setup for a comeback.", author: "Unknown" },
    { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
    { text: "It's not how far you fall, but how high you bounce that counts.", author: "Zig Ziglar" },
    { text: "The phoenix must burn to emerge.", author: "Janet Fitch" },
    { text: "Your struggles develop your strengths.", author: "Arnold Schwarzenegger" }
  ]
};

class HerosQuest {
  constructor() {
    this.firebaseConfig = {
      apiKey: "AIzaSyBDTTyEWFBam2EEWK4X2VV5E-wUJx10V38",
      authDomain: "her0s-quest.firebaseapp.com",
      projectId: "her0s-quest",
      storageBucket: "her0s-quest.firebasestorage.app",
      messagingSenderId: "120264562008",
      appId: "1:120264562008:web:69365314951dc05980812d"
    };

    this.state = {
      user: null,
      currentTab: 'home',
      quests: [],
      dailyLogs: {},
      xp: 0,
      level: 1,
      categories: { physical: 0, mental: 0, spiritual: 0, motivation: 0 },
      financial: { balance: 0, income: 0, expenses: 0 },
      blightDamage: 0,
      pendingDelete: null,
      pendingComplete: null,
      achievements: []
    };

    this.chart = null;
    this.threeScene = null;
    this.currentQuote = null;

    this.init();
  }

  async init() {
    this.app = initializeApp(this.firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.provider = new GoogleAuthProvider();

    this.setupEventListeners();
    this.handleAuth();
    this.initThreeJS();
    this.startQuoteRotation();
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Modals
    document.getElementById('open-add-modal').addEventListener('click', () => this.toggleModal('add-modal', true));
    document.querySelectorAll('.close-modal, .modal-close').forEach(b => {
      b.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) this.toggleModal(modal.id, false);
      });
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) this.toggleModal(modal.id, false);
      });
    });

    // Category change handler
    document.getElementById('quest-category').addEventListener('change', (e) => {
      const value = e.target.value;
      const targetGroup = document.getElementById('target-category-group');
      const xpInput = document.getElementById('quest-xp');
      
      targetGroup.classList.toggle('hidden', value !== 'blight');
      
      if (value === 'financial') {
        xpInput.min = -500;
        xpInput.value = 0;
      } else if (value === 'blight') {
        xpInput.min = 10;
        xpInput.value = 50;
      } else {
        xpInput.min = 10;
        xpInput.value = 50;
      }
    });

    // Form submission
    document.getElementById('add-quest-form').addEventListener('submit', (e) => this.handleAddQuest(e));

    // Delete confirmation
    document.getElementById('confirm-delete').addEventListener('click', () => this.executeDelete());
    document.getElementById('cancel-delete').addEventListener('click', () => this.toggleModal('confirm-modal', false));

    // Rating system
    document.querySelectorAll('.rating-stars i').forEach(star => {
      star.addEventListener('click', () => this.setRating(parseInt(star.dataset.value)));
      star.addEventListener('mouseenter', () => this.previewRating(parseInt(star.dataset.value)));
    });
    
    document.querySelector('.rating-stars').addEventListener('mouseleave', () => {
      const currentRating = document.querySelectorAll('.rating-stars .active').length;
      this.setRating(currentRating || 3);
    });

    document.getElementById('confirm-rating').addEventListener('click', () => this.confirmRating());
    document.getElementById('cancel-rating').addEventListener('click', () => this.toggleModal('rating-modal', false));

    // Auth
    document.getElementById('google-login-btn').addEventListener('click', () => {
      signInWithPopup(this.auth, this.provider).catch(err => {
        console.error('Login error:', err);
        this.showAchievement('Login Failed', 'Please try again');
      });
    });
    
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
        this.showAchievement('Welcome Back!', `Level ${this.state.level} Hero`);
      } else {
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
      }
    });
  }

  async syncData() {
    try {
      const userDoc = await getDoc(doc(this.db, "users", this.state.user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        Object.assign(this.state, {
          quests: data.quests || [],
          dailyLogs: data.dailyLogs || {},
          xp: data.xp || 0,
          level: data.level || 1,
          categories: data.categories || this.state.categories,
          financial: data.financial || this.state.financial,
          blightDamage: data.blightDamage || 0,
          achievements: data.achievements || []
        });
      } else {
        await setDoc(doc(this.db, "users", this.state.user.uid), this.state);
      }
      this.renderAll();
    } catch (error) {
      console.error('Sync error:', error);
    }
  }

  switchTab(tabId) {
    this.state.currentTab = tabId;
    document.body.setAttribute('data-theme', tabId);

    const titles = {
      home: 'HOME',
      stats: 'STATS',
      motivation: 'MOTIVATION',
      spiritual: 'SPIRITUAL',
      physical: 'PHYSICAL',
      mental: 'MENTAL',
      financial: 'FINANCIAL',
      blight: 'BLIGHT'
    };
    
    document.getElementById('view-title').innerText = titles[tabId];

    // Update quote
    this.updateQuote(tabId);

    // Show appropriate view
    document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
    
    if (tabId === 'stats') {
      document.getElementById('stats-view').classList.remove('hidden');
      this.renderStats();
    } else if (tabId === 'motivation') {
      document.getElementById('motivation-view').classList.remove('hidden');
      this.renderMotivationQuotes();
    } else {
      document.getElementById('quest-view').classList.remove('hidden');
      this.renderQuests();
    }

    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
  }

  updateQuote(category) {
    const quoteEl = document.getElementById('motivational-quote');
    if (!quoteEl) return;

    const categoryQuotes = QUOTES[category] || QUOTES.motivation;
    const quote = categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)];
    
    quoteEl.style.opacity = '0';
    setTimeout(() => {
      quoteEl.innerHTML = `${quote.text} <br><small>— ${quote.author}</small>`;
      quoteEl.style.opacity = '1';
    }, 300);
  }

  startQuoteRotation() {
    setInterval(() => {
      if (this.state.currentTab !== 'motivation') {
        this.updateQuote(this.state.currentTab);
      }
    }, 30000); // Rotate every 30 seconds
  }

  renderMotivationQuotes() {
    const container = document.getElementById('motivation-quotes-list');
    container.innerHTML = '';

    Object.entries(QUOTES).forEach(([category, quotes]) => {
      if (category === 'motivation') return; // Skip showing motivation in motivation tab
      
      const categoryCard = document.createElement('div');
      categoryCard.className = 'glass';
      categoryCard.style.padding = '2rem';
      categoryCard.style.marginBottom = '1.5rem';
      
      const icon = {
        spiritual: 'fa-pray',
        physical: 'fa-dumbbell',
        mental: 'fa-brain',
        financial: 'fa-money-bill-wave',
        blight: 'fa-skull'
      }[category];
      
      categoryCard.innerHTML = `
        <h3 style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; text-transform: capitalize;">
          <i class="fas ${icon}" style="color: var(--accent);"></i>
          ${category} Wisdom
        </h3>
        ${quotes.map(q => `
          <div class="quote-card glass" style="margin-bottom: 1rem;">
            <p>"${q.text}"</p>
            <span>— ${q.author}</span>
          </div>
        `).join('')}
      `;
      
      container.appendChild(categoryCard);
    });
  }

  async handleAddQuest(e) {
    e.preventDefault();
    
    const name = document.getElementById('quest-name').value.trim();
    const xp = parseInt(document.getElementById('quest-xp').value);
    const category = document.getElementById('quest-category').value;

    if (!name) return;

    const newQuest = { 
      id: Date.now(), 
      name, 
      xp: category === 'blight' ? -Math.abs(xp) : xp,
      category 
    };
    
    if (category === 'blight') {
      newQuest.targetCategory = document.getElementById('target-category').value;
    }

    this.state.quests.push(newQuest);
    await this.saveState();
    
    this.toggleModal('add-modal', false);
    this.renderQuests();
    this.showAchievement('Quest Created!', name);
    
    e.target.reset();
    document.getElementById('quest-xp').value = 50;
  }

  requestComplete(id) {
    const quest = this.state.quests.find(q => q.id === id);
    if (!quest) return;

    const today = new Date().toISOString().split('T')[0];
    if (this.state.dailyLogs[today]?.[quest.category]?.[id]?.completed) {
      this.showAchievement('Already Completed', 'This quest is done for today!');
      return;
    }

    this.state.pendingComplete = { 
      id, 
      category: quest.category, 
      xp: quest.xp, 
      targetCategory: quest.targetCategory,
      name: quest.name
    };
    
    const titleText = quest.category === 'blight' ? 'Rate Severity' : 'Rate Performance';
    const icon = quest.category === 'blight' ? 'fa-skull' : 'fa-star';
    
    document.getElementById('rating-title').innerHTML = `<i class="fas ${icon}"></i> ${titleText}`;
    this.setRating(3);
    this.toggleModal('rating-modal', true);
  }

  setRating(value) {
    document.querySelectorAll('.rating-stars i').forEach((star, index) => {
      const isActive = index < value;
      star.classList.toggle('active', isActive);
      star.classList.toggle('fas', isActive);
      star.classList.toggle('far', !isActive);
    });
  }

  previewRating(value) {
    this.setRating(value);
  }

  async confirmRating() {
    const { id, category, xp, targetCategory, name } = this.state.pendingComplete;
    const rating = document.querySelectorAll('.rating-stars .active').length || 3;
    
    // Calculate earned XP based on rating
    let earnedXp = Math.round(xp * rating / 5);

    const today = new Date().toISOString().split('T')[0];
    if (!this.state.dailyLogs[today]) this.state.dailyLogs[today] = {};
    if (!this.state.dailyLogs[today][category]) this.state.dailyLogs[today][category] = {};

    this.state.dailyLogs[today][category][id] = { 
      completed: true, 
      rating, 
      earnedXp,
      timestamp: Date.now()
    };

    // Update XP and categories
    this.state.xp += earnedXp;
    
    if (category === 'financial') {
      this.state.financial.balance += earnedXp;
      if (earnedXp > 0) {
        this.state.financial.income += earnedXp;
      } else {
        this.state.financial.expenses += Math.abs(earnedXp);
      }
    } else if (category === 'blight') {
      this.state.categories[targetCategory] += earnedXp; // Negative impact
      this.state.blightDamage += Math.abs(earnedXp);
      this.triggerBlightEffect();
    } else {
      this.state.categories[category] += earnedXp;
    }

    // Check for level up
    const oldLevel = this.state.level;
    while (this.state.xp >= 100 * this.state.level) {
      this.state.level++;
    }
    
    if (this.state.level > oldLevel) {
      this.celebrateLevelUp();
    }

    // Check achievements
    this.checkAchievements();

    await this.saveState();
    this.toggleModal('rating-modal', false);
    this.renderQuests();
    this.renderAll();
    
    // Show completion feedback
    const emoji = category === 'blight' ? '💀' : '⭐';
    this.showAchievement(`${emoji} Quest Complete!`, `+${earnedXp} XP`);
  }

  celebrateLevelUp() {
    // Confetti effect
    if (typeof confetti !== 'undefined') {
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: [this.getCurrentAccentColor()]
      });
    }
    
    this.showAchievement('🎉 LEVEL UP!', `You are now Level ${this.state.level}!`);
  }

  triggerBlightEffect() {
    // Visual blight effect
    document.body.style.filter = 'brightness(0.7) saturate(0.5)';
    setTimeout(() => {
      document.body.style.filter = '';
    }, 1000);
  }

  checkAchievements() {
    const achievements = [];
    
    // First quest
    if (this.state.quests.length === 1 && !this.state.achievements.includes('first_quest')) {
      achievements.push({ id: 'first_quest', title: 'First Steps', desc: 'Created your first quest' });
    }
    
    // 10 quests completed
    const totalCompleted = Object.values(this.state.dailyLogs).reduce((sum, day) => {
      return sum + Object.values(day).reduce((s, cat) => s + Object.keys(cat).length, 0);
    }, 0);
    
    if (totalCompleted >= 10 && !this.state.achievements.includes('10_quests')) {
      achievements.push({ id: '10_quests', title: 'Dedicated', desc: 'Completed 10 quests' });
    }
    
    // Level 5
    if (this.state.level >= 5 && !this.state.achievements.includes('level_5')) {
      achievements.push({ id: 'level_5', title: 'Rising Hero', desc: 'Reached Level 5' });
    }
    
    // Show new achievements
    achievements.forEach(ach => {
      if (!this.state.achievements.includes(ach.id)) {
        this.state.achievements.push(ach.id);
        setTimeout(() => this.showAchievement(ach.title, ach.desc), 500);
      }
    });
  }

  showAchievement(title, text) {
    const toast = document.getElementById('achievement-toast');
    document.getElementById('achievement-text').innerHTML = `<strong>${title}</strong><br>${text}`;
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
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
    this.showAchievement('Quest Removed', 'The quest has been deleted');
  }

  renderQuests() {
    const container = document.getElementById('quest-list');
    if (!container) return;
    
    container.innerHTML = '';
    const tab = this.state.currentTab;
    const today = new Date().toISOString().split('T')[0];
    
    let filteredQuests;
    if (tab === 'home') {
      filteredQuests = this.state.quests.filter(q => q.category !== 'blight');
    } else {
      filteredQuests = this.state.quests.filter(q => q.category === tab);
    }

    if (filteredQuests.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-inbox" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.3;"></i>
          <h3>No quests yet</h3>
          <p>Click "New Quest" to get started on your journey!</p>
        </div>
      `;
      return;
    }

    filteredQuests.forEach((q, index) => {
      const log = this.state.dailyLogs[today]?.[q.category]?.[q.id] || { completed: false };
      const item = document.createElement('div');
      item.className = 'quest-item glass';
      item.style.animationDelay = `${index * 0.05}s`;
      
      const categoryIcons = {
        physical: 'fa-dumbbell',
        mental: 'fa-brain',
        spiritual: 'fa-pray',
        motivation: 'fa-fire',
        financial: 'fa-money-bill-wave',
        blight: 'fa-skull'
      };
      
      const buttonText = log.completed ? 'Completed' : (q.category === 'blight' ? 'Suffer' : 'Complete');
      const buttonClass = log.completed ? 'btn-primary' : (q.category === 'blight' ? 'btn-danger' : 'btn-primary');
      
      item.innerHTML = `
        <button class="btn-delete" onclick="window.app.requestDelete(${q.id})" aria-label="Delete quest">×</button>
        <div class="quest-info">
          <h3><i class="fas ${categoryIcons[q.category]}"></i> ${q.name}</h3>
          <p>${q.xp > 0 ? '+' : ''}${q.xp} XP</p>
          ${q.targetCategory ? `<p style="font-size: 0.85rem; color: var(--text-muted);">Affects: ${q.targetCategory}</p>` : ''}
        </div>
        <button class="btn-primary ${buttonClass} btn-epic" ${log.completed ? 'disabled' : ''} onclick="window.app.requestComplete(${q.id})">
          <span>${buttonText}</span>
          ${!log.completed ? '<div class="btn-glow"></div>' : ''}
        </button>
      `;
      
      container.appendChild(item);
    });
  }

  renderStats() {
    // Update stat values
    document.getElementById('stat-physical').innerText = Math.round(this.state.categories.physical);
    document.getElementById('stat-mental').innerText = Math.round(this.state.categories.mental);
    document.getElementById('stat-spiritual').innerText = Math.round(this.state.categories.spiritual);
    document.getElementById('stat-motivation').innerText = Math.round(this.state.categories.motivation);
    document.getElementById('stat-financial-balance').innerText = Math.round(this.state.financial.balance);
    document.getElementById('stat-income').innerText = Math.round(this.state.financial.income);
    document.getElementById('stat-expenses').innerText = Math.round(this.state.financial.expenses);
    document.getElementById('stat-blight').innerText = Math.round(this.state.blightDamage);

    // Update progress bars
    const maxValue = Math.max(...Object.values(this.state.categories), 100);
    ['physical', 'mental', 'spiritual', 'motivation'].forEach(cat => {
      const bar = document.getElementById(`stat-${cat}-bar`);
      if (bar) {
        const percentage = (this.state.categories[cat] / maxValue) * 100;
        bar.style.width = `${Math.max(percentage, 0)}%`;
      }
    });

    // Render chart
    this.renderChart();
  }

  renderChart() {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;

    if (this.chart) this.chart.destroy();

    const dates = Object.keys(this.state.dailyLogs).sort();
    let cumulative = 0;
    const data = dates.map(d => {
      const dayXp = Object.values(this.state.dailyLogs[d] || {}).reduce((sum, cat) => 
        sum + Object.values(cat).reduce((s, l) => s + (l.earnedXp || 0), 0), 0
      );
      cumulative += dayXp;
      return cumulative;
    });

    const accentColor = this.getCurrentAccentColor();

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [{
          label: 'Total XP',
          data,
          borderColor: accentColor,
          backgroundColor: `${accentColor}20`,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: accentColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#ffffff' }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#ffffff' }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#ffffff' }
          }
        }
      }
    });
  }

  renderCalendar() {
    const container = document.getElementById('calendar-widget');
    if (!container) return;

    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthName = date.toLocaleString('default', { month: 'long' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    let html = `<h4 style="text-align: center; margin-bottom: 1rem;">${monthName} ${year}</h4><div class="calendar-grid">`;
    
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
      html += `<div class="cal-header">${day}</div>`;
    });

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="cal-day empty"></div>';
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dailyXp = Object.values(this.state.dailyLogs[dayStr] || {}).reduce((sum, cat) => 
        sum + Object.values(cat).reduce((s, l) => s + (l.earnedXp || 0), 0), 0
      );
      
      const heatLevel = Math.min(Math.floor(Math.abs(dailyXp) / 50), 4);
      const isToday = day === date.getDate() && month === date.getMonth();
      
      html += `<div class="cal-day heat-${heatLevel} ${isToday ? 'today' : ''}" title="${dailyXp} XP">${day}</div>`;
    }
    
    container.innerHTML = html + '</div>';

    // Render history
    this.renderHistory();
  }

  renderHistory() {
    const historyContainer = document.getElementById('calendar-history');
    if (!historyContainer) return;

    const dates = Object.keys(this.state.dailyLogs).sort().reverse().slice(0, 7);
    
    if (dates.length === 0) {
      historyContainer.innerHTML = '<div class="history-item" style="text-align: center; color: var(--text