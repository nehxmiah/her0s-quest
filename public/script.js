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


let state = { xp:0, level:1, totalXp:0, quests:{physical:[],mental:[],spiritual:[],blights:[]}, history:{} };
let user = null, tab = 'physical', chart = null, cal = null;

const themes = { physical:[[0,0.95,1],[0,0.1,0.2]], mental:[[0.5,0.6,0],[1,0.96,0.89]], spiritual:[[0.83,0.68,0.21],[0.1,0,0.1]], blights:[[0.6,0,0],[0,0,0]] };
const scales = {
    physical: {colors:{min:'#001122',max:'#00f2ff'}},
    mental: {colors:{min:'#eee8d5',max:'#859900'}},
    spiritual: {colors:{min:'#221100',max:'#d4af37'}},
    blights: {colors:{min:'#330000',max:'#ff3366'}},
    default: {colors:{min:'#222',max:'#58a6ff'}}
};

// Liquid Background (minimal)
class Liquid { constructor(){ this.renderer=new THREE.WebGLRenderer({canvas:document.getElementById('webGLApp'),antialias:true}); this.renderer.setSize(innerWidth,innerHeight); this.scene=new THREE.Scene(); this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1); this.uniforms={uTime:{value:0}}; this.init(); } init(){ const mat=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`,fragmentShader:`uniform float uTime;varying vec2 vUv;void main(){float n=sin(vUv.x*5.+uTime)*cos(vUv.y*3.+uTime);gl_FragColor=vec4(mix(vec3(0.34,0.65,1.),vec3(0.05),n*.5+.5),1.);}`}); this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat)); this.anim(); } anim(){ requestAnimationFrame(()=>this.anim()); this.uniforms.uTime.value+=0.01; this.renderer.render(this.scene,this.camera); } set(c1,c2){ /* extend if needed */ } }
new Liquid();

window.switchTab = t => {
    tab = t; document.body.dataset.theme = t;
    document.querySelectorAll('.main-nav button').forEach(b=>b.classList.toggle('active',b.onclick.toString().includes(t)));
    document.getElementById('view-title').textContent = t.toUpperCase();
    document.getElementById('quest-area').classList.toggle('hidden', t==='stats');
    document.getElementById('stats-area').classList.toggle('hidden', t!=='stats');
    render();
};

window.toggleTask = async (name, baseXp) => {
    const today = new Date().toISOString().slice(0,10);
    if (state.history[today]?.[name]?.done) return alert("Already done today!");
    const r = prompt(`Rate "${name}" (1-5 stars):`, "5");
    const rating = Math.min(5, Math.max(1, parseInt(r)||5));
    const earned = Math.round(baseXp * (rating/5));
    state.xp += earned; state.totalXp += earned;
    (state.history[today] ??= {})[name] = {done:true, rating};
    while (state.xp >= 100) { state.level++; state.xp -= 100; }
    while (state.xp < 0 && state.level > 1) { state.level--; state.xp += 100; }
    render(); await sync();
};

window.addNewQuest = () => {
    const name = document.getElementById('new-name').value.trim();
    const xp = +document.getElementById('new-xp').value;
    if (name && xp) { state.quests[tab].push({name,xp}); [1,2].forEach(i=>document.getElementById(['new-name','new-xp'][i-1]).value=''); render(); sync(); }
};

async function sync() {
    if (!user) return;
    await setDoc(doc(db,"users",user.uid), state, {merge:true});
    await setDoc(doc(db,"leaderboard",user.uid), {name:user.displayName, xp:state.totalXp, level:state.level});
}

function render() {
    const today = new Date().toISOString().slice(0,10);
    const list = document.getElementById('habit-list'); list.innerHTML='';
    state.quests[tab].forEach(q => {
        const done = state.history[today]?.[q.name]?.done;
        list.innerHTML += `<div class="habit-item ${done?'completed':''}">
            <span>${q.name} (${q.xp>0?'+':''}${q.xp} XP)</span>
            <button class="btn-plus" onclick="toggleTask('${q.name.replace(/'/g,"\\\'")}',${q.xp})" ${done?'disabled':''}>${done?'✓':(q.xp<0?'FAIL':'GO')}</button>
        </div>`;
    });
    document.getElementById('xp-fill').style.width = state.xp + '%';
    document.getElementById('xp-text').textContent = `${state.xp} / 100 XP`;
    document.getElementById('level-display').textContent = `LVL ${state.level}`;

    if (tab === 'stats') {
        // 7-day chart
        const labels=[],data=[];
        for (let i=6;i>=0;i--) { const d=new Date(); d.setDate(d.getDate()-i); const ds=d.toISOString().slice(0,10); labels.push(ds.slice(5)); data.push(Object.values(state.history[ds]||{}).reduce((s,v)=>v.done?s+Math.abs(v.xp||0):s,0)); }
        if (chart) chart.destroy(); chart = new Chart(document.getElementById('xpChart'), {type:'bar', data:{labels,datasets:[{data,backgroundColor:'rgba(0,242,255,0.6)'}]}, options:{plugins:{legend:{display:false}}}});

        // Streak
        let streak=0, d=new Date();
        while (true) { d.setDate(d.getDate()-1); const ds=d.toISOString().slice(0,10); if (Object.keys(state.history[ds]||{}).length) streak++; else break; }
        document.getElementById('streak-info').textContent = `Streak: ${streak} days 🔥`;

        // Heatmap
        const end=new Date(), start=new Date(end); start.setFullYear(end.getFullYear()-1);
        const hdata={};
        for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) {
            const ds=d.toISOString().slice(0,10), day=state.history[ds]||{};
            let xp=0, rats=[]; Object.values(day).forEach(e=>{if(e.done){xp+=Math.abs(e.xp||0); e.rating&&rats.push(e.rating);}});
            if (xp>0) hdata[Math.floor(d.getTime()/1000)] = {v:xp, r:rats.length?(rats.reduce((a,b)=>a+b,0)/rats.length).toFixed(1):null};
        }
        if (cal) cal.destroy(); cal = new CalHeatmap();
        cal.init({itemSelector:'#cal-heatmap', domain:'month', subDomain:'day', range:13, start, data:hdata, cellSize:14, cellPadding:3, cellRadius:4, domainGutter:15, legend:[20,50,100,200], scale:scales[tab]||scales.default, tooltip:true});
    }
}

// Auth & Leaderboard
onAuthStateChanged(auth, async u => {
    user = u;
    if (u) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('user-name').textContent = u.displayName.split(' ')[0];
        const snap = await getDoc(doc(db,"users",u.uid));
        if (snap.exists()) state = {...state, ...snap.data()};
        // Default quests if empty
        if (!state.quests.physical.length) state.quests = {physical:[{name:"100 Pushups",xp:20}],mental:[{name:"Read 10 Pages",xp:15}],spiritual:[{name:"Meditate",xp:10}],blights:[{name:"Relapse",xp:-50}]};
        render();
        onSnapshot(query(collection(db,"leaderboard"),orderBy("xp","desc"),limit(10)), s=> {
            const board=document.getElementById('scoreboard-list'); board.innerHTML='';
            s.forEach(d=>board.innerHTML+=`<div class="habit-item"><span>${d.data().name} (Lvl ${d.data().level})</span><span>${d.data().xp} XP</span></div>`);
        });
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    }
});
document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

// Cursor
document.onmousemove = e => { const c=document.getElementById('customCursor'); c.style.left=e.clientX+'px'; c.style.top=e.clientY+'px'; };