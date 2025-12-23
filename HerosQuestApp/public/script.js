import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION START ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// --- CONFIGURATION END ---

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let state = { xp: 0, level: 1, totalPoints: 0, history: {} };
let currentUser = null;
const START_DATE = "2025-01-01";

const ROUTINES = {
  1: { name: "Push A", lifts: ["Flat Barbell Bench", "Strict OHP", "Close-Grip Bench", "Lateral Raises"] },
  2: { name: "Pull A", lifts: ["Conv. Deadlift", "Weighted Pull-Ups", "Barbell Pendlay Row", "Face Pulls"] },
  3: { name: "Legs A", lifts: ["Barbell Squat", "Romanian Deadlift", "Bulgarian Split Squat", "Standing Calf Raises"] },
  4: { name: "Push B", lifts: ["Heavy OHP", "Incline Barbell Bench", "DB Skull Crushers", "Lateral Raises"] },
  5: { name: "Pull B", lifts: ["Strict Barbell Row", "Weighted Pull-Ups", "Chest-Supported Row", "Face Pulls"] },
  6: { name: "Legs B", lifts: ["Barbell Squat", "Heavy Deadlift", "Leg Curls", "Seated Calf Raises"] },
  0: { name: "Rest & Recovery", lifts: ["Active Recovery Walk", "Mobility Flow"] }
};

// AUTHENTICATION OBSERVER
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

// DATABASE OPS
async function loadData() {
  const docSnap = await getDoc(doc(db, "users", currentUser.uid));
  if (docSnap.exists()) state = docSnap.data();
  render();
}

async function saveData() {
  if (currentUser) {
    await setDoc(doc(db, "users", currentUser.uid), state);
  }
}

// LOGIC FUNCTIONS
window.toggleTask = async (taskName, xp) => {
  const today = new Date().toISOString().split('T')[0];
  if (!state.history[today]) state.history[today] = {};
  if (!state.history[today][taskName]) state.history[today][taskName] = { done: false, note: "" };

  const t = state.history[today][taskName];
  t.done = !t.done;
  state.xp += t.done ? xp : -xp;
  state.totalPoints += t.done ? xp : -xp;

  while (state.xp >= 100) { state.level++; state.xp -= 100; }
  render();
  await saveData();
};

window.updateNote = async (taskName, val) => {
  const today = new Date().toISOString().split('T')[0];
  if (!state.history[today]) state.history[today] = {};
  if (!state.history[today][taskName]) state.history[today][taskName] = { done: false, note: "" };
  
  state.history[today][taskName].note = val;
  await saveData();
};

// UI RENDERING
function render() {
  const todayKey = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay();
  
  // Stats
  document.getElementById('level-display').textContent = `Level ${state.level}`;
  document.getElementById('xp-fill').style.width = `${state.xp}%`;
  document.getElementById('xp-fill').textContent = `${state.xp}/100 XP`;
  document.getElementById('stat-points').textContent = state.totalPoints;
  document.getElementById('stat-lvl').textContent = state.level;
  document.getElementById('current-date').textContent = new Date().toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'});

  // Reference for "Last Week" (7 days ago)
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekKey = lastWeekDate.toISOString().split('T')[0];

  const list = document.getElementById('habit-list');
  list.innerHTML = '';

  const dailyQuests = [
    { name: "🧘 Layer 1 Stretches", xp: 15 },
    { name: "🤸 Calisthenics Skills", xp: 20 },
    { name: "📖 Bible Reading", xp: 10 }
  ];

  if (dayOfWeek !== 0) {
    dailyQuests.push({ name: "🏃 10 min Jump Rope", xp: 10 });
    ROUTINES[dayOfWeek].lifts.forEach(l => dailyQuests.push({ name: `🏋️ ${l}`, xp: 10 }));
  }

  dailyQuests.forEach(q => {
    const taskData = state.history[todayKey]?.[q.name] || { done: false, note: "" };
    const lastWeekNote = state.history[lastWeekKey]?.[q.name]?.note || "No data";
    
    const div = document.createElement('div');
    div.className = `habit-item ${taskData.done ? 'completed' : ''}`;
    div.innerHTML = `
      <div class="habit-header">
        <span class="habit-name">${q.name}</span>
        <input type="checkbox" ${taskData.done ? 'checked' : ''} onclick="toggleTask('${q.name}', ${q.xp})">
      </div>
      <div class="last-week-ref">🕒 Last Week: <span class="last-week-val">${lastWeekNote}</span></div>
      <input type="text" class="note-input" placeholder="Weight / Reps / Progress" value="${taskData.note}" onchange="updateNote('${q.name}', this.value)">
    `;
    list.appendChild(div);
  });

  renderCalendar();
}

function renderCalendar() {
  const cal = document.getElementById('calendar'); cal.innerHTML = '';
  const start = new Date(START_DATE);
  // Render 35 days (5 weeks) from Jan 1
  for (let i = 0; i < 35; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const dStr = d.toISOString().split('T')[0];
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    
    if (state.history[dStr] && Object.values(state.history[dStr]).some(v => v.done)) {
      dayEl.classList.add('completed');
    }
    if (dStr === new Date().toISOString().split('T')[0]) dayEl.classList.add('today');
    
    dayEl.textContent = d.getDate();
    cal.appendChild(dayEl);
  }
}