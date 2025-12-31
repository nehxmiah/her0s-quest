import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FIREBASE CONFIG (REPLACE WITH YOUR KEYS) ---
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

// --- STATE MANAGEMENT ---
let state = {
    xp: 0, level: 1, totalXp: 0,
    quests: {
        physical: [{name: "100 Pushups", xp: 20}],
        mental: [{name: "10 Pages Reading", xp: 15}],
        spiritual: [{name: "Meditation", xp: 10}],
        blights: [{name: "Relapse", xp: -50}]
    },
    history: {}
};
let currentUser = null;
let currentTab = 'physical';

// --- LIQUID BACKGROUND ENGINE ---
class LiquidEngine {
    constructor() {
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webGLApp'), antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.uniforms = {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Vector3(0.34, 0.65, 1.0) },
            uColor2: { value: new THREE.Vector3(0.05, 0.05, 0.15) }
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
                    float noise = sin(vUv.x * 5.0 + uTime) * cos(vUv.y * 3.0 + uTime);
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
    setThemeColors(c1, c2) {
        this.uniforms.uColor1.value.set(...c1);
        this.uniforms.uColor2.value.set(...c2);
    }
}
const engine = new LiquidEngine();

// --- CORE APP LOGIC ---
window.switchTab = (tab) => {
    currentTab = tab;
    document.body.setAttribute('data-theme', tab);
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(tab.substring(0,2))));
    
    // Theme transitions
    const colors = {
        physical: [[0.0, 0.95, 1.0], [0.0, 0.1, 0.2]],
        mental: [[0.5, 0.6, 0.0], [1.0, 0.96, 0.89]],
        spiritual: [[0.83, 0.68, 0.21], [0.1, 0.0, 0.1]],
        blights: [[0.6, 0.0, 0.0], [0.0, 0.0, 0.0]]
    };
    if (colors[tab]) engine.setThemeColors(...colors[tab]);
    
    document.getElementById('view-title').innerText = tab.toUpperCase();
    document.getElementById('quest-area').classList.toggle('hidden', tab === 'stats');
    document.getElementById('stats-area').classList.toggle('hidden', tab !== 'stats');
    render();
};

window.toggleTask = async (name, xp) => {
    const today = new Date().toISOString().split('T')[0];
    if (!state.history[today]) state.history[today] = {};
    
    let earned = xp;
    if (state.history[today][name]) {
        earned = Math.floor(xp * 0.25); // 25% Bonus
        alert(`✨ BONUS: +${earned} XP for Extra Effort!`);
    }

    state.xp += earned;
    state.totalXp += earned;
    state.history[today][name] = true;

    while (state.xp >= 100) { state.level++; state.xp -= 100; }
    while (state.xp < 0 && state.level > 1) { state.level--; state.xp += 100; }
    
    render();
    await syncData();
};

window.addNewQuest = () => {
    const name = document.getElementById('new-name').value;
    const xp = parseInt(document.getElementById('new-xp').value);
    if (name && xp) {
        state.quests[currentTab].push({ name, xp });
        render();
        syncData();
    }
};

// --- FIREBASE SYNC ---
async function syncData() {
    if (!currentUser) return;
    await setDoc(doc(db, "users", currentUser.uid), state, { merge: true });
    await setDoc(doc(db, "leaderboard", currentUser.uid), {
        name: currentUser.displayName, xp: state.totalXp, level: state.level
    });
}

function initLeaderboard() {
    const q = query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(5));
    onSnapshot(q, (snap) => {
        const board = document.getElementById('scoreboard-list');
        board.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            board.innerHTML += `<div class="habit-item"><span>${data.name} (Lvl ${data.level})</span><span>${data.xp} XP</span></div>`;
        });
    });
}

// --- INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) state = { ...state, ...snap.data() };
        render();
        initLeaderboard();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        document.body.setAttribute('data-theme', 'login');
    }
});

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

function render() {
    const list = document.getElementById('habit-list');
    list.innerHTML = "";
    state.quests[currentTab].forEach(q => {
        const div = document.createElement('div');
        div.className = 'habit-item';
        div.innerHTML = `<span>${q.name} (${q.xp > 0 ? '+' : ''}${q.xp} XP)</span>
                         <button class="btn-plus" onclick="toggleTask('${q.name}', ${q.xp})">${q.xp < 0 ? 'FAIL' : '✓'}</button>`;
        list.appendChild(div);
    });
    document.getElementById('xp-fill').style.width = `${state.xp}%`;
    document.getElementById('level-display').innerText = `LVL ${state.level}`;
}

// Custom Cursor
document.addEventListener('mousemove', e => {
    const cur = document.getElementById('customCursor');
    cur.style.left = e.clientX + 'px';
    cur.style.top = e.clientY + 'px';
});