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

// --- Initialize Firebase Services ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- State and UI Constants ---
let state = { xp: 0, level: 1, totalXp: 0, quests: { physical: [], mental: [], spiritual: [], blights: [] }, history: {} };
let user = null, tab = 'physical', chart = null, cal = null;

// --- Liquid Background Engine ---
class Liquid { 
    constructor() { 
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webGLApp'), antialias: true }); 
        this.renderer.setSize(innerWidth, innerHeight); 
        this.scene = new THREE.Scene(); 
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); 
        this.uniforms = { uTime: { value: 0 } }; 
        this.init(); 
    } 
    init() { 
        const mat = new THREE.ShaderMaterial({ 
            uniforms: this.uniforms, 
            vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`, 
            fragmentShader: `uniform float uTime;varying vec2 vUv;void main(){float n=sin(vUv.x*5.+uTime)*cos(vUv.y*3.+uTime);gl_FragColor=vec4(mix(vec3(0.34,0.65,1.0),vec3(0.05),n*.5+.5),1.0);}` 
        }); 
        this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)); 
        this.anim(); 
    } 
    anim() { 
        requestAnimationFrame(() => this.anim()); 
        this.uniforms.uTime.value += 0.01; 
        this.renderer.render(this.scene, this.camera); 
    } 
}
new Liquid();

// --- Core App Functions ---
window.switchTab = t => {
    tab = t; 
    document.body.dataset.theme = t; // Triggers CSS theme variables
    
    // UI Navigation Updates
    document.querySelectorAll('.main-nav button').forEach(b => {
        b.classList.toggle('active', b.getAttribute('onclick').includes(t));
    });
    
    document.getElementById('view-title').textContent = t.toUpperCase();
    document.getElementById('quest-area').classList.toggle('hidden', t === 'stats');
    document.getElementById('stats-area').classList.toggle('hidden', t !== 'stats');
    render();
};

window.toggleTask = async (name, baseXp) => {
    const today = new Date().toISOString().slice(0, 10);
    if (state.history[today]?.[name]?.done) return alert("Already done today!");
    
    const r = prompt(`Rate "${name}" (1-5 stars):`, "5");
    const rating = Math.min(5, Math.max(1, parseInt(r) || 5));
    const earned = Math.round(baseXp * (rating / 5));
    
    state.xp += earned; 
    state.totalXp += earned;
    (state.history[today] ??= {})[name] = { done: true, rating, xp: earned };
    
    // Level Up Logic
    while (state.xp >= 100) { state.level++; state.xp -= 100; }
    while (state.xp < 0 && state.level > 1) { state.level--; state.xp += 100; }
    
    render(); 
    await sync();
};

window.addNewQuest = () => {
    const nInput = document.getElementById('new-name');
    const xInput = document.getElementById('new-xp');
    const name = nInput.value.trim();
    const xp = parseInt(xInput.value);
    
    if (name && !isNaN(xp)) { 
        state.quests[tab].push({ name, xp }); 
        nInput.value = ''; 
        xInput.value = ''; 
        render(); 
        sync(); 
    }
};

async function sync() {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), state, { merge: true });
    await setDoc(doc(db, "leaderboard", user.uid), { name: user.displayName, xp: state.totalXp, level: state.level });
}

function render() {
    const today = new Date().toISOString().slice(0, 10);
    const list = document.getElementById('habit-list'); 
    list.innerHTML = '';
    
    state.quests[tab].forEach(q => {
        const done = state.history[today]?.[q.name]?.done;
        list.innerHTML += `<div class="habit-item ${done ? 'completed' : ''}">
            <span>${q.name} (${q.xp > 0 ? '+' : ''}${q.xp} XP)</span>
            <button class="btn-plus" onclick="toggleTask('${q.name.replace(/'/g, "\\\'")}', ${q.xp})" ${done ? 'disabled' : ''}>
                ${done ? '✓' : (q.xp < 0 ? 'FAIL' : 'GO')}
            </button>
        </div>`;
    });
    
    // XP Bar Updates
    document.getElementById('xp-fill').style.width = state.xp + '%';
    document.getElementById('xp-text').textContent = `${state.xp} / 100 XP`;
    document.getElementById('level-display').textContent = `LVL ${state.level}`;

    if (tab === 'stats') updateStats();
}

function updateStats() {
    const labels = [], data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        labels.push(ds.slice(5));
        const dayTotal = Object.values(state.history[ds] || {}).reduce((s, v) => s + (v.xp || 0), 0);
        data.push(dayTotal);
    }
    
    if (chart) chart.destroy();
    const ctx = document.getElementById('xpChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: '#58a6ff' }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

// --- Auth State Management ---
onAuthStateChanged(auth, async (u) => {
    user = u;
    if (u) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('user-name').textContent = u.displayName.split(' ')[0];
        
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) state = { ...state, ...snap.data() };
        
        // Populate defaults if needed
        if (!state.quests.physical.length) {
            state.quests = {
                physical: [{ name: "100 Pushups", xp: 20 }],
                mental: [{ name: "Read 10 Pages", xp: 15 }],
                spiritual: [{ name: "Meditate", xp: 10 }],
                blights: [{ name: "Relapse", xp: -50 }]
            };
        }
        render();
        
        // Real-time Leaderboard
        onSnapshot(query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(10)), s => {
            const board = document.getElementById('scoreboard-list'); 
            board.innerHTML = '';
            s.forEach(d => {
                const data = d.data();
                board.innerHTML += `<div class="habit-item"><span>${data.name} (Lvl ${data.level})</span><span>${data.xp} XP</span></div>`;
            });
        });
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    }
});

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

// Custom Cursor
document.onmousemove = e => { 
    const c = document.getElementById('customCursor'); 
    if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }
};