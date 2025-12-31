import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- LIQUID ENGINE CLASSES ---
class TouchTexture {
    constructor() {
        this.size = 64; this.maxAge = 64; this.radius = 0.25 * this.size;
        this.speed = 1 / this.maxAge; this.trail = []; this.last = null;
        this.initTexture();
    }
    initTexture() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.canvas.height = this.size;
        this.ctx = this.canvas.getContext("2d");
        this.texture = new THREE.Texture(this.canvas);
    }
    update() {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const p = this.trail[i]; p.age++;
            if (p.age > this.maxAge) this.trail.splice(i, 1);
            else this.drawPoint(p);
        }
        this.texture.needsUpdate = true;
    }
    addTouch(point) {
        let force = 0, vx = 0, vy = 0;
        if (this.last) {
            const dx = point.x - this.last.x, dy = point.y - this.last.y;
            const dd = dx * dx + dy * dy;
            force = Math.min(dd * 20000, 2.0);
            vx = dx / Math.sqrt(dd); vy = dy / Math.sqrt(dd);
        }
        this.last = { x: point.x, y: point.y };
        this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
    }
    drawPoint(p) {
        const pos = { x: p.x * this.size, y: (1 - p.y) * this.size };
        let intensity = p.age < this.maxAge * 0.3 ? Math.sin((p.age / (this.maxAge * 0.3)) * (Math.PI / 2)) : 1 - (p.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
        intensity *= p.force;
        this.ctx.shadowBlur = this.radius;
        this.ctx.shadowColor = `rgba(${((p.vx + 1) / 2) * 255}, ${((p.vy + 1) / 2) * 255}, ${intensity * 255}, ${0.2 * intensity})`;
        this.ctx.beginPath(); this.ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2); this.ctx.fill();
    }
}

class LiquidApp {
    constructor() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.domElement.id = "webGLApp";
        document.body.appendChild(this.renderer.domElement);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.camera.position.z = 50;
        this.clock = new THREE.Clock();
        this.touchTexture = new TouchTexture();
        this.initBackground();
        this.animate();
    }
    initBackground() {
        const geometry = new THREE.PlaneGeometry(100, 100);
        this.uniforms = {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Vector3(0.94, 0.35, 0.13) }, 
            uColor2: { value: new THREE.Vector3(0.04, 0.05, 0.15) }, 
            uTouchTexture: { value: this.touchTexture.texture }
        };
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
                uniform float uTime; uniform vec3 uColor1; uniform vec3 uColor2; uniform sampler2D uTouchTexture;
                varying vec2 vUv;
                void main() {
                    vec4 touch = texture2D(uTouchTexture, vUv);
                    vec2 uv = vUv + touch.rg * 0.15;
                    float noise = sin(uv.x * 3.0 + uTime) * cos(uv.y * 2.0 + uTime);
                    vec3 color = mix(uColor1, uColor2, clamp(noise + touch.b, 0.0, 1.0));
                    gl_FragColor = vec4(color, 1.0);
                }`
        });
        this.scene.add(new THREE.Mesh(geometry, material));
    }
    animate() {
        requestAnimationFrame(() => this.animate());
        this.touchTexture.update();
        this.uniforms.uTime.value = this.clock.getElapsedTime();
        this.renderer.render(this.scene, this.camera);
    }
}

// --- FIREBASE CONFIG ---
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

window.liquidApp = new LiquidApp();

// --- STATE & DATA ---
let state = { 
    xp: 0, 
    level: 1, 
    totalPoints: 0, 
    categories: { physical: 0, mental: 0, spiritual: 0, blights: 0 }, 
    history: {} 
};
let currentUser = null;
let currentTab = 'physical';
let myChart = null;

const ALL_QUESTS = {
    physical: [{ name: "Layer 1 Stretches", xp: 15 }, { name: "10 min Jump Rope", xp: 10 }, { name: "Workout", xp: 30 }],
    mental: [{ name: "Read 10 Pages", xp: 15 }, { name: "Coding", xp: 20 }, { name: "Meditation", xp: 10 }],
    spiritual: [{ name: "Bible Reading", xp: 10 }, { name: "Morning Prayer", xp: 10 }],
    blights: [
        { name: "Missed Streak", xp: -20 },
        { name: "Watched Adult Content", xp: -50 },
        { name: "Drinking / Smoking", xp: -40 }
    ]
};

// --- AUTH ---
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

// --- CORE LOGIC ---
window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(tab));
    });
    
    // Liquid Color Feedback
    if (tab === 'blights' && window.liquidApp) {
        window.liquidApp.uniforms.uColor1.value.set(0.5, 0.0, 0.0);
        window.liquidApp.uniforms.uColor2.value.set(0.1, 0.0, 0.0);
    } else if (window.liquidApp) {
        window.liquidApp.uniforms.uColor1.value.set(0.94, 0.35, 0.13);
        window.liquidApp.uniforms.uColor2.value.set(0.04, 0.05, 0.15);
    }
    render();
};

window.applyPenalty = async (name, xpLoss) => {
    document.getElementById('app-screen').classList.add('shake-effect');
    setTimeout(() => document.getElementById('app-screen').classList.remove('shake-effect'), 300);

    state.xp += xpLoss;
    state.totalPoints += xpLoss;
    state.categories.blights = (state.categories.blights || 0) + Math.abs(xpLoss);

    while (state.xp < 0) {
        if (state.level > 1) {
            state.level--;
            state.xp += 100;
        } else {
            state.xp = 0;
            break;
        }
    }
    render();
    await saveData();
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
    const list = document.getElementById('habit-list');
    const todayKey = new Date().toISOString().split('T')[0];
    
    document.getElementById('level-display').textContent = `Level ${state.level}`;
    document.getElementById('xp-fill').style.width = `${Math.max(0, state.xp)}%`;
    document.getElementById('xp-fill').textContent = `${Math.max(0, state.xp)}/100 XP`;
    document.getElementById('stat-points').textContent = Math.floor(state.totalPoints);
    document.getElementById('stat-lvl').textContent = state.level;

    if (currentTab === 'stats') {
        document.getElementById('quest-section').classList.add('hidden');
        document.getElementById('stats-section').classList.remove('hidden');
        updateChart();
    } else {
        document.getElementById('quest-section').classList.remove('hidden');
        document.getElementById('stats-section').classList.add('hidden');
        document.getElementById('tab-title').textContent = currentTab === 'blights' ? "⚠️ Active Blights" : "📜 Today's Quests";
        
        list.innerHTML = '';
        ALL_QUESTS[currentTab].forEach(item => {
            const div = document.createElement('div');
            if (currentTab === 'blights') {
                div.className = 'habit-item penalty';
                div.innerHTML = `<span>${item.name} (${item.xp} XP)</span><button class="btn-penalty" onclick="applyPenalty('${item.name}', ${item.xp})">FAIL</button>`;
            } else {
                const isDone = state.history[todayKey]?.[item.name]?.done || false;
                div.className = `habit-item ${isDone ? 'completed' : ''}`;
                div.innerHTML = `<span>${item.name} (+${item.xp} XP)</span><input type="checkbox" ${isDone ? 'checked' : ''} onclick="toggleTask('${item.name}', ${item.xp}, '${currentTab}')">`;
            }
            list.appendChild(div);
        });
    }
}

function updateChart() {
    const ctx = document.getElementById('xpChart').getContext('2d');
    const dataValues = [state.categories.physical, state.categories.mental, state.categories.spiritual, state.categories.blights];
    if (myChart) {
        myChart.data.datasets[0].data = dataValues;
        myChart.update();
    } else {
        myChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Physical', 'Mental', 'Spiritual', 'Blights'],
                datasets: [{ data: dataValues, backgroundColor: ['#58a6ff', '#d2a8ff', '#f5576c', '#ff4d4d'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#c9d1d9' } } } }
        });
    }
}

// Cursor
const cursor = document.getElementById('customCursor');
document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    if(window.liquidApp) window.liquidApp.touchTexture.addTouch({ x: e.clientX/window.innerWidth, y: 1-(e.clientY/window.innerHeight) });
});