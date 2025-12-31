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

let state = { xp: 0, level: 1, totalXp: 0, quests: { physical: [], mental: [], spiritual: [], blights: [] }, history: {} };
let user = null, currentTab = 'physical', myChart = null;

// --- LIQUID BACKGROUND (THE INTERESTING PART) ---
class LiquidEngine {
    constructor() {
        this.canvas = document.getElementById('webGLApp');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.uniforms = {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Vector3(0.0, 0.95, 1.0) }, // Default Cyan
            uColor2: { value: new THREE.Vector3(0.0, 0.05, 0.1) }
        };
        this.init();
    }
    init() {
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
            fragmentShader: `
                uniform float uTime; uniform vec3 uColor1; uniform vec3 uColor2; varying vec2 vUv;
                void main() {
                    vec2 p = vUv * 2.0 - 1.0;
                    float t = uTime * 0.5;
                    float noise = sin(p.x * 3.0 + t) * cos(p.y * 2.0 + t) + sin(t * 0.5);
                    gl_FragColor = vec4(mix(uColor1, uColor2, noise * 0.5 + 0.5), 1.0);
                }`
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
        this.uniforms.uColor1.value.set(c1[0], c1[1], c1[2]);
        this.uniforms.uColor2.value.set(c2[0], c2[1], c2[2]);
    }
}
const engine = new LiquidEngine();

// --- THEME UPDATER ---
const themeColors = {
    physical: [[0, 0.95, 1], [0, 0.05, 0.1]],
    mental: [[0.6, 1, 0], [0.1, 0.1, 0]],
    spiritual: [[1, 0, 1], [0.1, 0, 0.1]],
    blights: [[1, 0.1, 0.1], [0.05, 0, 0]],
    stats: [[1, 1, 1], [0.1, 0.1, 0.1]]
};

window.switchTab = (tab) => {
    currentTab = tab;
    document.body.setAttribute('data-theme', tab);
    
    // Update active button
    document.querySelectorAll('.main-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(tab));
    });

    // Update Liquid Colors
    const colors = themeColors[tab] || themeColors.physical;
    engine.updateTheme(colors[0], colors[1]);

    // UI visibility
    document.getElementById('view-title').innerText = tab.toUpperCase();
    document.getElementById('quest-area').classList.toggle('hidden', tab === 'stats');
    document.getElementById('stats-area').classList.toggle('hidden', tab !== 'stats');
    
    if (tab === 'stats') renderStats();
    render();
};

// --- DATA LOGIC ---
window.toggleTask = async (name, xp) => {
    const today = new Date().toISOString().split('T')[0];
    if (state.history[today]?.[name]?.done) return alert("Task already recorded for today.");

    state.xp += xp;
    state.totalXp += xp;
    (state.history[today] ??= {})[name] = { done: true, xp };

    // Leveling Logic
    while (state.xp >= 100) { state.level++; state.xp -= 100; }
    while (state.xp < 0 && state.level > 1) { state.level--; state.xp += 100; }

    render();
    await syncData();
};

window.addNewQuest = () => {
    const name = document.getElementById('new-name').value;
    const xp = parseInt(document.getElementById('new-xp').value);
    if (name && !isNaN(xp)) {
        state.quests[currentTab].push({ name, xp });
        document.getElementById('new-name').value = '';
        document.getElementById('new-xp').value = '';
        render();
        syncData();
    }
};

async function syncData() {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, state, { merge: true });
    await setDoc(doc(db, "leaderboard", user.uid), { name: user.displayName, xp: state.totalXp, level: state.level });
}

function render() {
    const list = document.getElementById('habit-list');
    list.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];

    state.quests[currentTab].forEach(q => {
        const isDone = state.history[today]?.[q.name]?.done;
        list.innerHTML += `
            <div class="habit-item">
                <span>${q.name} (${q.xp > 0 ? '+' : ''}${q.xp})</span>
                <button class="btn-plus" onclick="toggleTask('${q.name}', ${q.xp})" ${isDone ? 'disabled' : ''}>
                    ${isDone ? '✓' : (q.xp < 0 ? 'FAIL' : 'GO')}
                </button>
            </div>`;
    });

    document.getElementById('xp-fill').style.width = `${state.xp}%`;
    document.getElementById('xp-text').innerText = `${state.xp} / 100 XP`;
    document.getElementById('level-display').innerText = `LVL ${state.level}`;
}

function renderStats() {
    const ctx = document.getElementById('xpChart').getContext('2d');
    const labels = [], data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        labels.push(ds.slice(5));
        const dayTotal = Object.values(state.history[ds] || {}).reduce((a, b) => a + b.xp, 0);
        data.push(dayTotal);
    }

    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'XP', data, borderColor: '#fff', tension: 0.4 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

// --- AUTH HANDLERS ---
onAuthStateChanged(auth, async (u) => {
    user = u;
    if (u) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('user-name').innerText = u.displayName.split(' ')[0];
        
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) state = { ...state, ...snap.data() };
        
        // Defaults if new user
        if (!state.quests.physical.length) {
            state.quests = {
                physical: [{ name: "100 Pushups", xp: 20 }],
                mental: [{ name: "Read 10 Pages", xp: 15 }],
                spiritual: [{ name: "Meditate", xp: 10 }],
                blights: [{ name: "Relapse", xp: -50 }]
            };
        }
        render();
        
        // Leaderboard listener
        onSnapshot(query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(5)), s => {
            const b = document.getElementById('scoreboard-list');
            b.innerHTML = '';
            s.forEach(d => {
                const data = d.data();
                b.innerHTML += `<div class="habit-item"><span>${data.name} (Lvl ${data.level})</span><span>${data.xp} XP</span></div>`;
            });
        });
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        document.body.setAttribute('data-theme', 'login');
    }
});

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

document.onmousemove = e => {
    const c = document.getElementById('customCursor');
    c.style.left = e.clientX + 'px';
    c.style.top = e.clientY + 'px';
};