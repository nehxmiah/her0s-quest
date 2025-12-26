import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDTTyEWFBam2EEWK4X2VV5E-wUJx10V38",
  authDomain: "her0s-quest.firebaseapp.com",
  projectId: "her0s-quest",
  storageBucket: "her0s-quest.firebasestorage.app",
  messagingSenderId: "120264562008",
  appId: "1:120264562008:web:69365314951dc05980812d",
  measurementId: "G-BSGT8LZPKV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let state = { 
    xp: 0, 
    level: 1, 
    totalPoints: 0, 
    categories: { physical: 0, mental: 0, financial: 0, spiritual: 0 },
    history: {} 
};
let currentUser = null;
let currentTab = 'physical';
let myChart = null;

const ALL_QUESTS = {
    physical: [
        { name: "Layer 1 Stretches", xp: 15 },
        { name: "10 min Jump Rope", xp: 10 },
        { name: "Workout Session", xp: 30 }
    ],
    mental: [
        { name: "Read 10 Pages", xp: 15 },
        { name: "Coding Practice", xp: 20 },
        { name: "Meditation", xp: 10 }
    ],
    financial: [
        { name: "Track Expenses", xp: 10 },
        { name: "Review Budget", xp: 20 }
    ],
    spiritual: [
        { name: "Bible Reading", xp: 10 },
        { name: "Morning Prayer", xp: 10 }
    ]
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('user-name').textContent = user.displayName;
    await loadData();
  } else {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
  }
});

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

async function loadData() {
  const docSnap = await getDoc(doc(db, "users", currentUser.uid));
  if (docSnap.exists()) {
      state = { ...state, ...docSnap.data() };
  }
  render();
}

async function saveData() {
  if (currentUser) await setDoc(doc(db, "users", currentUser.uid), state);
}

window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === tab);
    });
    render();
};

window.toggleTask = async (taskName, xp, cat) => {
  const today = new Date().toISOString().split('T')[0];
  if (!state.history[today]) state.history[today] = {};
  if (!state.history[today][taskName]) state.history[today][taskName] = { done: false };

  const t = state.history[today][taskName];
  t.done = !t.done;
  
  const multiplier = t.done ? 1 : -1;
  state.xp += (xp * multiplier);
  state.totalPoints += (xp * multiplier);
  state.categories[cat] = (state.categories[cat] || 0) + (xp * multiplier);

  while (state.xp >= 100) { state.level++; state.xp -= 100; }
  while (state.xp < 0 && state.level > 1) { state.level--; state.xp += 100; }
  
  render();
  await saveData();
};

function render() {
  const todayKey = new Date().toISOString().split('T')[0];
  document.getElementById('level-display').textContent = `Level ${state.level}`;
  document.getElementById('stat-lvl').textContent = state.level;
  document.getElementById('xp-fill').style.width = `${state.xp}%`;
  document.getElementById('xp-fill').textContent = `${state.xp}/100 XP`;
  document.getElementById('total-xp-display').textContent = state.totalPoints;
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const list = document.getElementById('habit-list');
  const questSec = document.getElementById('quest-section');
  const statsSec = document.getElementById('stats-section');
  
  if (currentTab === 'stats') {
      questSec.classList.add('hidden');
      statsSec.classList.remove('hidden');
      updateChart();
  } else {
      questSec.classList.remove('hidden');
      statsSec.classList.add('hidden');
      document.getElementById('tab-title').innerText = `📜 ${currentTab.charAt(0).toUpperCase() + currentTab.slice(1)} Quests`;
      list.innerHTML = '';
      
      ALL_QUESTS[currentTab].forEach(q => {
          const isDone = state.history[todayKey]?.[q.name]?.done || false;
          const div = document.createElement('div');
          div.className = `habit-item ${isDone ? 'completed' : ''}`;
          div.innerHTML = `
            <div class="habit-header">
                <span class="habit-name">${q.name} (+${q.xp} XP)</span>
                <input type="checkbox" ${isDone ? 'checked' : ''} 
                       onclick="toggleTask('${q.name}', ${q.xp}, '${currentTab}')">
            </div>
          `;
          list.appendChild(div);
      });
  }
}

function updateChart() {
    const ctx = document.getElementById('xpChart').getContext('2d');
    const dataValues = [state.categories.physical, state.categories.mental, state.categories.financial, state.categories.spiritual];
    
    if (myChart) {
        myChart.data.datasets[0].data = dataValues;
        myChart.update();
    } else {
        myChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Physical', 'Mental', 'Financial', 'Spiritual'],
                datasets: [{
                    data: dataValues,
                    backgroundColor: ['#58a6ff', '#d2a8ff', '#238636', '#f093fb']
                }]
            },
            options: { plugins: { legend: { labels: { color: '#c9d1d9' } } } }
        });
    }
}