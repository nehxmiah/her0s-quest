/**
 * Hero's Quest - Production Script
 * Improved Structure, Performance, and Error Handling
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class HerosQuest {
  constructor() {
    // SECURITY NOTE: In production, use environment variables for these values.
    this.firebaseConfig = {
      apiKey: "AIzaSyBDTTyEWFBam2EEWK4X2VV5E-wUJx10V38",
      authDomain: "her0s-quest.firebaseapp.com",
      projectId: "her0s-quest",
      storageBucket: "her0s-quest.firebasestorage.app",
      messagingSenderId: "120264562008",
      appId: "1:120264562008:web:69365314951dc05980812d"
    };

    this.state = {
      xp: 0, level: 1, gold: 0,
      quests: { physical: [], mental: [], spiritual: [], blights: [] },
      history: {},
      user: null,
      currentTab: 'physical'
    };

    this.init();
  }

  async init() {
    this.app = initializeApp(this.firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.provider = new GoogleAuthProvider();

    this.bindEvents();
    this.setupAuthListener();
    this.initVisuals();
  }

  // --- Core Methods ---

  bindEvents() {
    // Navigation (Event Delegation)
    document.querySelector('.sidebar-nav').addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-btn');
      if (btn) this.switchTab(btn.dataset.tab);
    });

    // Quest Management
    document.getElementById('add-quest-btn')?.addEventListener('click', () => this.addNewQuest());
    document.getElementById('toggle-add-quest')?.addEventListener('click', this.toggleAddForm);
    
    // Auth
    document.getElementById('google-login-btn').addEventListener('click', () => this.login());
    document.getElementById('logout-btn').addEventListener('click', () => this.logout());

    // Window Resize
    window.addEventListener('resize', this.debounce(() => {
      if (this.engine) this.engine.handleResize();
    }, 250));
  }

  async login() {
    try {
      this.showLoading(true);
      await signInWithPopup(this.auth, this.provider);
    } catch (error) {
      this.notify('Login failed. Please try again.', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async logout() {
    const confirmed = await this.confirmAction('Are you sure you want to log out?');
    if (confirmed) await signOut(this.auth);
  }

  // --- UI Logic ---

  switchTab(tab) {
    this.state.currentTab = tab;
    document.body.setAttribute('data-theme', tab);
    
    // Update active state
    document.querySelectorAll('.nav-btn').forEach(b => 
      b.classList.toggle('active', b.dataset.tab === tab)
    );

    document.getElementById('view-title').textContent = `${tab.toUpperCase()} QUESTS`;
    this.renderQuests();
    
    // Update background color if engine exists
    if (this.engine) this.engine.updateTheme(tab);
  }

  renderQuests() {
    const container = document.getElementById('quest-list');
    const items = this.state.quests[this.state.currentTab] || [];
    
    if (items.length === 0) {
      container.innerHTML = `<p class="empty-state">No quests active. Add one above!</p>`;
      return;
    }

    container.innerHTML = items.map(q => `
      <div class="quest-item glass slide-in">
        <div class="quest-info">
          <h3>${this.sanitize(q.name)}</h3>
          <span class="xp-badge">+${q.xp} XP</span>
        </div>
        <button onclick="app.completeQuest('${q.name}', ${q.xp})" class="btn-complete">
          <i class="fas fa-check"></i>
        </button>
      </div>
    `).join('');
  }

  // --- Utilities ---

  sanitize(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }

  notify(msg, type = 'info') {
    // Custom Toast implementation
    console.log(`[${type.toUpperCase()}] ${msg}`);
    // In production, insert a temporary DOM element here
  }

  confirmAction(msg) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const msgEl = document.getElementById('confirm-message');
      msgEl.textContent = msg;
      modal.classList.remove('hidden');

      const cleanup = (val) => {
        modal.classList.add('hidden');
        resolve(val);
      };

      document.getElementById('confirm-ok').onclick = () => cleanup(true);
      document.getElementById('confirm-cancel').onclick = () => cleanup(false);
    });
  }

  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  showLoading(show) {
    document.getElementById('loading-spinner').classList.toggle('hidden', !show);
  }

  initVisuals() {
    // Initialize WebGL background engine here...
  }
}

// Global instance for easy access in HTML event handlers
window.app = new HerosQuest();