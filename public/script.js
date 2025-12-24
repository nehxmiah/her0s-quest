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

// EXTENDED STATE
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
        { name: "Review Budget", xp: 20 },
        { name: "Market Research", xp: 15 }
    ],
    spiritual: [
        { name: "Bible Reading", xp: 10 },
        { name: "Morning Prayer", xp: 10 },
        { name: "Journaling", xp: 15 }
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
      const data = docSnap.data();
      // Merge with default state to prevent errors if new categories are added
      state = { ...state, ...data };
  }
  render();
}

async function saveData() {
  if (currentUser) await setDoc(doc(db, "users", currentUser.uid), state);
}

window.switchTab = (tab) => {
    currentTab = tab;
    render();
};

window.toggleTask = async (taskName, xp, cat) => {
  const today = new Date().toISOString().split('T')[0];
  if (!state.history[today]) state.history[today] = {};
  if (!state.history[today][taskName]) state.history[today][taskName] = { done: false, note: "" };

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
  document.getElementById('xp-fill').style.width = `${state.xp}%`;
  document.getElementById('stat-points').textContent = state.totalPoints;

  const list = document.getElementById('habit-list');
  const statsSec = document.getElementById('stats-section');
  
  if (currentTab === 'stats') {
      list.classList.add('hidden');
      statsSec.classList.remove('hidden');
      updateChart();
  } else {
      list.classList.remove('hidden');
      statsSec.classList.add('hidden');
      list.innerHTML = '';
      
      ALL_QUESTS[currentTab].forEach(q => {
          const taskData = state.history[todayKey]?.[q.name] || { done: false, note: "" };
          const div = document.createElement('div');
          div.className = `habit-item ${taskData.done ? 'completed' : ''}`;
          div.innerHTML = `
            <span>${q.name} (+${q.xp} XP)</span>
            <input type="checkbox" ${taskData.done ? 'checked' : ''} 
                   onclick="toggleTask('${q.name}', ${q.xp}, '${currentTab}')">
          `;
          list.appendChild(div);
      });
  }
}

function updateChart() {
    const ctx = document.getElementById('xpChart').getContext('2d');
    const chartData = {
        labels: ['Physical', 'Mental', 'Financial', 'Spiritual'],
        datasets: [{
            data: [state.categories.physical, state.categories.mental, state.categories.financial, state.categories.spiritual],
            backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0']
        }]
    };

    if (myChart) {
        myChart.data = chartData;
        myChart.update();
    } else {
        myChart = new Chart(ctx, { type: 'pie', data: chartData });
    }
}