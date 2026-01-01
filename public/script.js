import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
      currentTab: 'physical',
      quests: { physical: [], mental: [], spiritual: [] },
      xp: 0,
      pendingDelete: null
    };

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
    // Tab Switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Modal Controls
    document.getElementById('open-add-modal').onclick = () => this.toggleModal('add-modal', true);
    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => this.toggleModal('add-modal', false));

    // Quest Submission
    document.getElementById('add-quest-form').onsubmit = (e) => this.handleAddQuest(e);

    // Delete Confirmation
    document.getElementById('confirm-delete').onclick = () => this.executeDelete();
    document.getElementById('cancel-delete').onclick = () => this.toggleModal('confirm-modal', false);

    // Auth
    document.getElementById('google-login-btn').onclick = () => signInWithPopup(this.auth, this.provider);
    document.getElementById('logout-btn').onclick = () => signOut(this.auth);
  }

  handleAuth() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.state.user = user;
        await this.syncData();
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        this.renderAll();
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
      this.state.xp = data.xp || 0;
    } else {
      await setDoc(doc(this.db, "users", this.state.user.uid), this.state);
    }
  }

  switchTab(tabId) {
    this.state.currentTab = tabId;
    document.body.setAttribute('data-theme', tabId);
    document.getElementById('view-title').innerText = `${tabId.toUpperCase()} JOURNEY`;

    document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
    document.getElementById(tabId === 'stats' ? 'stats-view' : tabId === 'calendar' ? 'calendar-view' : 'quest-view').classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));

    if (tabId === 'calendar') this.renderCalendar();
    this.renderQuests();
  }

  async handleAddQuest(e) {
    e.preventDefault();
    const name = document.getElementById('quest-name').value;
    const xp = parseInt(document.getElementById('quest-xp').value);

    const newQuest = { id: Date.now(), name, xp, completed: false };
    this.state.quests[this.state.currentTab].push(newQuest);

    await this.saveState();
    this.toggleModal('add-modal', false);
    this.renderQuests();
    e.target.reset();
  }

  requestDelete(id) {
    this.state.pendingDelete = id;
    this.toggleModal('confirm-modal', true);
  }

  async executeDelete() {
    const category = this.state.currentTab;
    this.state.quests[category] = this.state.quests[category].filter(q => q.id !== this.state.pendingDelete);
    await this.saveState();
    this.toggleModal('confirm-modal', false);
    this.renderQuests();
  }

  renderQuests() {
    const container = document.getElementById('quest-list');
    const quests = this.state.quests[this.state.currentTab] || [];
    
    container.innerHTML = quests.map(q => `
      <div class="quest-item glass">
        <div class="quest-info">
          <h3>${q.name}</h3>
          <p>Reward: ${q.xp} XP</p>
        </div>
        <button class="btn-delete" onclick="window.app.requestDelete(${q.id})" aria-label="Delete quest">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');
  }

  renderCalendar() {
    const container = document.getElementById('calendar-widget');
    const date = new Date();
    const month = date.toLocaleString('default', { month: 'long' });
    const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    let html = `<h4>${month} ${date.getFullYear()}</h4><div class="calendar-grid">`;
    for (let i = 1; i <= days; i++) {
      const active = i === date.getDate() ? 'today' : '';
      html += `<div class="cal-day ${active}">${i}</div>`;
    }
    container.innerHTML = html + `</div>`;
  }

  async saveState() {
    const userRef = doc(this.db, "users", this.state.user.uid);
    await updateDoc(userRef, { quests: this.state.quests, xp: this.state.xp });
  }

  toggleModal(id, show) {
    document.getElementById(id).classList.toggle('hidden', !show);
  }

  renderAll() {
    document.getElementById('user-name').innerText = this.state.user.displayName;
    document.getElementById('xp-count').innerText = this.state.xp;
    this.renderQuests();
  }
}

// Global scope access for onclick handlers
window.app = new HerosQuest();