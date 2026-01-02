// Hero's Quest - Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDTTyEWFBam2EEWK4X2VV5E-wUJx10V38",
  authDomain: "her0s-quest.firebaseapp.com",
  projectId: "her0s-quest",
  storageBucket: "her0s-quest.firebasestorage.app",
  messagingSenderId: "120264562008",
  appId: "1:120264562008:web:69365314951dc05980812d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();



import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trophy, Home, TrendingUp, Flame, Heart, Brain, DollarSign, Skull, Plus, X, Star, Calendar, LogOut } from 'lucide-react';

// Motivational Quotes Database
const QUOTES = {
  spiritual: [
    { text: "Faith is taking the first step even when you don't see the whole staircase.", author: "Martin Luther King Jr." },
    { text: "The soul always knows what to do to heal itself.", author: "Caroline Myss" },
    { text: "Your task is not to seek for love, but find the barriers within yourself.", author: "Rumi" },
    { text: "The privilege of a lifetime is to become who you truly are.", author: "Carl Jung" },
    { text: "Be still and know.", author: "Psalm 46:10" }
  ],
  physical: [
    { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
    { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
    { text: "Your body can stand almost anything. It's your mind you must convince.", author: "Unknown" },
    { text: "Strength comes from overcoming what you thought you couldn't.", author: "Rikki Rogers" },
    { text: "The pain you feel today is the strength you feel tomorrow.", author: "Unknown" }
  ],
  mental: [
    { text: "The mind is everything. What you think you become.", author: "Buddha" },
    { text: "Your emotions will never lie to you.", author: "Roger Ebert" },
    { text: "Choose one thought over another to defeat stress.", author: "William James" },
    { text: "You have power over your mind, not outside events.", author: "Marcus Aurelius" },
    { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" }
  ],
  financial: [
    { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
    { text: "It's not how much you make, but how much you keep.", author: "Robert Kiyosaki" },
    { text: "The best time to plant a tree was 20 years ago. The second best is now.", author: "Chinese Proverb" },
    { text: "Save first, spend what's left.", author: "Warren Buffett" },
    { text: "Wealth is the ability to fully experience life.", author: "Henry David Thoreau" }
  ],
  motivation: [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "Success is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Your limitation—it's only your imagination.", author: "Unknown" },
    { text: "Great things never come from comfort zones.", author: "Unknown" }
  ],
  blight: [
    { text: "Every setback is a setup for a comeback.", author: "Unknown" },
    { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
    { text: "It's not how far you fall, but how high you bounce.", author: "Zig Ziglar" },
    { text: "The phoenix must burn to emerge.", author: "Janet Fitch" },
    { text: "Your struggles develop your strengths.", author: "Arnold Schwarzenegger" }
  ]
};

const HerosQuest = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState({ name: 'Hero', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hero' });
  const [currentTab, setCurrentTab] = useState('home');
  const [quests, setQuests] = useState([]);
  const [dailyLogs, setDailyLogs] = useState({});
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [categories, setCategories] = useState({ physical: 0, mental: 0, spiritual: 0, motivation: 0 });
  const [financial, setFinancial] = useState({ balance: 0, income: 0, expenses: 0 });
  const [blightDamage, setBlightDamage] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingComplete, setPendingComplete] = useState(null);
  const [rating, setRating] = useState(3);
  const [achievement, setAchievement] = useState(null);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [achievements, setAchievements] = useState([]);

  const themeColors = {
    home: { accent: '#4caf50', rgb: '76, 175, 80' },
    stats: { accent: '#2196f3', rgb: '33, 150, 243' },
    motivation: { accent: '#ff9800', rgb: '255, 152, 0' },
    spiritual: { accent: '#9c27b0', rgb: '156, 39, 176' },
    physical: { accent: '#f44336', rgb: '244, 67, 54' },
    mental: { accent: '#607d8b', rgb: '96, 125, 139' },
    financial: { accent: '#ffc107', rgb: '255, 193, 7' },
    blight: { accent: '#b71c1c', rgb: '183, 28, 28' }
  };

  // Load data on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('herosQuest_auth');
    if (savedAuth) {
      const data = JSON.parse(savedAuth);
      setIsAuthenticated(true);
      setUser(data.user);
      setQuests(data.quests || []);
      setDailyLogs(data.dailyLogs || {});
      setXp(data.xp || 0);
      setLevel(data.level || 1);
      setCategories(data.categories || { physical: 0, mental: 0, spiritual: 0, motivation: 0 });
      setFinancial(data.financial || { balance: 0, income: 0, expenses: 0 });
      setBlightDamage(data.blightDamage || 0);
      setAchievements(data.achievements || []);
    }
  }, []);

  // Save data
  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem('herosQuest_auth', JSON.stringify({
        user, quests, dailyLogs, xp, level, categories, financial, blightDamage, achievements
      }));
    }
  }, [isAuthenticated, user, quests, dailyLogs, xp, level, categories, financial, blightDamage, achievements]);

  // Update quote when tab changes
  useEffect(() => {
    updateQuote();
  }, [currentTab]);

  const updateQuote = () => {
    const categoryQuotes = QUOTES[currentTab] || QUOTES.motivation;
    const quote = categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)];
    setCurrentQuote(quote);
  };

  const handleSignIn = () => {
    setIsAuthenticated(true);
    showAchievementToast('Welcome Back!', `Level ${level} Hero`);
  };

  const handleSignOut = () => {
    localStorage.removeItem('herosQuest_auth');
    setIsAuthenticated(false);
  };

  const showAchievementToast = (title, text) => {
    setAchievement({ title, text });
    setTimeout(() => setAchievement(null), 4000);
  };

  const addQuest = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const xpValue = parseInt(formData.get('xp'));
    const category = formData.get('category');
    const targetCategory = formData.get('targetCategory');

    const newQuest = {
      id: Date.now(),
      name,
      xp: category === 'blight' ? -Math.abs(xpValue) : xpValue,
      category,
      targetCategory: category === 'blight' ? targetCategory : null
    };

    setQuests([...quests, newQuest]);
    setShowAddModal(false);
    showAchievementToast('Quest Created!', name);
    e.target.reset();
  };

  const deleteQuest = () => {
    setQuests(quests.filter(q => q.id !== pendingDelete));
    setShowDeleteModal(false);
    showAchievementToast('Quest Removed', 'The quest has been deleted');
  };

  const completeQuest = (questId) => {
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    const today = new Date().toISOString().split('T')[0];
    if (dailyLogs[today]?.[quest.category]?.[questId]?.completed) {
      showAchievementToast('Already Completed', 'This quest is done for today!');
      return;
    }

    setPendingComplete({ ...quest, id: questId });
    setRating(3);
    setShowRatingModal(true);
  };

  const confirmRating = () => {
    const { id, category, xp: questXp, targetCategory, name } = pendingComplete;
    const earnedXp = Math.round(questXp * rating / 5);

    const today = new Date().toISOString().split('T')[0];
    const newDailyLogs = { ...dailyLogs };
    if (!newDailyLogs[today]) newDailyLogs[today] = {};
    if (!newDailyLogs[today][category]) newDailyLogs[today][category] = {};
    newDailyLogs[today][category][id] = { completed: true, rating, earnedXp, timestamp: Date.now() };

    setDailyLogs(newDailyLogs);

    const newXp = xp + earnedXp;
    setXp(newXp);

    if (category === 'financial') {
      setFinancial({
        balance: financial.balance + earnedXp,
        income: financial.income + (earnedXp > 0 ? earnedXp : 0),
        expenses: financial.expenses + (earnedXp < 0 ? Math.abs(earnedXp) : 0)
      });
    } else if (category === 'blight') {
      setCategories({ ...categories, [targetCategory]: categories[targetCategory] + earnedXp });
      setBlightDamage(blightDamage + Math.abs(earnedXp));
    } else {
      setCategories({ ...categories, [category]: categories[category] + earnedXp });
    }

    const newLevel = Math.floor(newXp / 100) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
      showAchievementToast('🎉 LEVEL UP!', `You are now Level ${newLevel}!`);
    }

    setShowRatingModal(false);
    showAchievementToast(`${category === 'blight' ? '💀' : '⭐'} Quest Complete!`, `${earnedXp > 0 ? '+' : ''}${earnedXp} XP`);
  };

  const getFilteredQuests = () => {
    if (currentTab === 'home') return quests.filter(q => q.category !== 'blight');
    if (currentTab === 'stats' || currentTab === 'motivation') return [];
    return quests.filter(q => q.category === currentTab);
  };

  const isQuestCompleted = (questId, category) => {
    const today = new Date().toISOString().split('T')[0];
    return dailyLogs[today]?.[category]?.[questId]?.completed || false;
  };

  const getChartData = () => {
    const dates = Object.keys(dailyLogs).sort();
    let cumulative = 0;
    return dates.map(date => {
      const dayXp = Object.values(dailyLogs[date] || {}).reduce((sum, cat) => 
        sum + Object.values(cat).reduce((s, l) => s + (l.earnedXp || 0), 0), 0
      );
      cumulative += dayXp;
      return { date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), xp: cumulative };
    });
  };

  const getCalendarDays = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const today = date.getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dailyXp = Object.values(dailyLogs[dayStr] || {}).reduce((sum, cat) => 
        sum + Object.values(cat).reduce((s, l) => s + (l.earnedXp || 0), 0), 0
      );
      const heatLevel = Math.min(Math.floor(Math.abs(dailyXp) / 50), 4);
      days.push({ day, heatLevel, isToday: day === today, xp: dailyXp });
    }
    return days;
  };

  const TabIcon = ({ tab }) => {
    const icons = {
      home: Home, stats: TrendingUp, motivation: Flame, spiritual: Heart,
      physical: Heart, mental: Brain, financial: DollarSign, blight: Skull
    };
    const Icon = icons[tab];
    return <Icon className="w-5 h-5" />;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="glass-card p-12 text-center max-w-md w-full animate-fadeIn">
          <div className="text-6xl mb-6 animate-pulse">👑</div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
            HERO'S QUEST
          </h1>
          <p className="text-gray-400 mb-8">Embark on your journey of self-improvement</p>
          <button onClick={handleSignIn} className="btn-epic w-full">
            START JOURNEY
          </button>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  const theme = themeColors[currentTab];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white" style={{ '--accent': theme.accent, '--accent-rgb': theme.rgb }}>
      <div className="flex h-screen overflow-hidden p-4 gap-4">
        {/* Sidebar */}
        <aside className="w-72 glass-card p-6 flex flex-col">
          <div className="flex items-center mb-8 pb-6 border-b border-white/10">
            <img src={user.avatar} alt="Avatar" className="w-14 h-14 rounded-full mr-3 border-2" style={{ borderColor: theme.accent }} />
            <div>
              <h2 className="font-bold">{user.name}</h2>
              <span className="px-2 py-1 rounded text-xs font-semibold" style={{ background: theme.accent, color: '#000' }}>
                Level {level}
              </span>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            {['home', 'stats', 'motivation', 'spiritual', 'physical', 'mental', 'financial', 'blight'].map(tab => (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentTab === tab ? 'active' : ''}`}
              >
                <TabIcon tab={tab} />
                <span className="capitalize">{tab}</span>
              </button>
            ))}
          </nav>

          <button onClick={() => setShowAddModal(true)} className="btn-epic w-full mb-4">
            <Plus className="w-5 h-5 inline mr-2" />
            New Quest
          </button>

          <button onClick={handleSignOut} className="text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4 inline mr-2" />
            Logout
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 glass-card p-8 overflow-y-auto">
          <header className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-4 uppercase">{currentTab}</h1>
              {currentQuote && (
                <div className="glass-card p-4 border-l-4 italic text-gray-300" style={{ borderColor: theme.accent }}>
                  "{currentQuote.text}"
                  <br />
                  <small className="text-gray-500">— {currentQuote.author}</small>
                </div>
              )}
            </div>
            <div className="glass-card px-6 py-3 flex items-center gap-2" style={{ color: theme.accent }}>
              <Star className="w-5 h-5" />
              <span className="text-xl font-bold">{xp} XP</span>
            </div>
          </header>

          {/* Quest View */}
          {currentTab !== 'stats' && currentTab !== 'motivation' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredQuests().length === 0 ? (
                <div className="col-span-full text-center py-20 text-gray-500">
                  <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <h3 className="text-xl mb-2">No quests yet</h3>
                  <p>Click "New Quest" to start your journey!</p>
                </div>
              ) : (
                getFilteredQuests().map((quest, i) => {
                  const completed = isQuestCompleted(quest.id, quest.category);
                  return (
                    <div key={quest.id} className="quest-card glass-card p-6 relative" style={{ animationDelay: `${i * 50}ms` }}>
                      <button
                        onClick={() => { setPendingDelete(quest.id); setShowDeleteModal(true); }}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white transition-all opacity-0 hover:opacity-100"
                      >
                        <X className="w-4 h-4 mx-auto" />
                      </button>
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                          <TabIcon tab={quest.category} />
                          {quest.name}
                        </h3>
                        <p className="font-bold" style={{ color: theme.accent }}>
                          {quest.xp > 0 ? '+' : ''}{quest.xp} XP
                        </p>
                        {quest.targetCategory && (
                          <p className="text-sm text-gray-500">Affects: {quest.targetCategory}</p>
                        )}
                      </div>
                      <button
                        onClick={() => completeQuest(quest.id)}
                        disabled={completed}
                        className={`btn-epic w-full ${quest.category === 'blight' ? 'bg-red-600' : ''}`}
                      >
                        {completed ? 'Completed' : (quest.category === 'blight' ? 'Suffer' : 'Complete')}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Stats View */}
          {currentTab === 'stats' && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {Object.entries(categories).map(([cat, val]) => (
                  <div key={cat} className="glass-card p-6 text-center">
                    <TabIcon tab={cat} />
                    <h3 className="text-sm uppercase text-gray-400 mt-2">{cat}</h3>
                    <p className="text-3xl font-bold" style={{ color: theme.accent }}>{Math.round(val)}</p>
                    <div className="w-full h-2 bg-white/10 rounded-full mt-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((val / Math.max(...Object.values(categories), 100)) * 100, 100)}%`, background: theme.accent }} />
                    </div>
                  </div>
                ))}
                <div className="glass-card p-6 text-center">
                  <DollarSign className="w-6 h-6 mx-auto" />
                  <h3 className="text-sm uppercase text-gray-400 mt-2">Balance</h3>
                  <p className="text-3xl font-bold text-green-400">{Math.round(financial.balance)}</p>
                </div>
                <div className="glass-card p-6 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto text-green-400" />
                  <h3 className="text-sm uppercase text-gray-400 mt-2">Income</h3>
                  <p className="text-3xl font-bold text-green-400">{Math.round(financial.income)}</p>
                </div>
                <div className="glass-card p-6 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto text-red-400 transform rotate-180" />
                  <h3 className="text-sm uppercase text-gray-400 mt-2">Expenses</h3>
                  <p className="text-3xl font-bold text-red-400">{Math.round(financial.expenses)}</p>
                </div>
                <div className="glass-card p-6 text-center">
                  <Skull className="w-6 h-6 mx-auto text-red-600" />
                  <h3 className="text-sm uppercase text-gray-400 mt-2">Blight</h3>
                  <p className="text-3xl font-bold text-red-600">{Math.round(blightDamage)}</p>
                </div>
              </div>

              <div className="glass-card p-6">
                <h3 className="text-xl font-bold mb-4">Progress Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="#fff" />
                    <YAxis stroke="#fff" />
                    <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="xp" stroke={theme.accent} strokeWidth={3} dot={{ fill: theme.accent }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Motivation View */}
          {currentTab === 'motivation' && (
            <div className="space-y-6">
              {Object.entries(QUOTES).filter(([cat]) => cat !== 'motivation').map(([cat, quotes]) => (
                <div key={cat} className="glass-card p-6">
                  <h3 className="text-xl font-bold mb-4 capitalize flex items-center gap-2">
                    <TabIcon tab={cat} />
                    {cat} Wisdom
                  </h3>
                  <div className="space-y-4">
                    {quotes.map((q, i) => (
                      <div key={i} className="glass-card p-4 border-l-4" style={{ borderColor: themeColors[cat].accent }}>
                        <p className="italic mb-2">"{q.text}"</p>
                        <span className="text-sm text-gray-500">— {q.author}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Calendar Sidebar */}
        <aside className="w-80 glass-card p-6">
          <h3 className="flex items-center gap-2 mb-6 text-lg font-bold">
            <Calendar className="w-5 h-5" />
            Calendar
          </h3>
          <div className="mb-6">
            <h4 className="text-center mb-4">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                <div key={d} className="text-center text-xs text-gray-500 font-semibold">{d}</div>
              ))}
              {getCalendarDays().map((day, i) => (
                <div
                  key={i}
                  className={`aspect-square flex items-center justify-center rounded text-sm ${
                    !day ? 'opacity-0' : day.isToday ? 'ring-2 ring-current font-bold' : ''
                  }`}
                  style={{
                    background: day && day.heatLevel > 0 ? `rgba(${theme.rgb}, ${day.heatLevel * 0.2})` : 'rgba(255,255,255,0.02)',
                    color: day?.isToday ? theme.accent : '#fff'
                  }}
                  title={day ? `${day.xp} XP` : ''}
                >
                  {day?.day}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Add Quest Modal */}
      {showAddModal && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setShowAddModal(false)} />
          <div className="glass-card p-8 relative z-10 w-full max-w-md animate-scaleIn">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold mb-6">Create Quest</h3>
            <form onSubmit={addQuest} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Quest Name</label>
                <input name="name" type="text" required maxLength="40" className="input-field" placeholder="Enter quest name..." />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">XP Value</label>
                <input name="xp" type="number" required min="10" max="500" defaultValue="50" className="input-field" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Category</label>
                <select name="category" className="input-field" onChange={(e) => {
                  const isBlight = e.target.value === 'blight';
                  document.getElementById('targetCategoryGroup').classList.toggle('hidden', !isBlight);
                }}>
                  <option value="physical">Physical</option>
                  <option value="mental">Mental</option>
                  <option value="spiritual">Spiritual</option>
                  <option value="motivation">Motivation</option>
                  <option value="financial">Financial</option>
                  <option value="blight">Blight</option>
                </select>
              </div>
              <div id="targetCategoryGroup" className="hidden">
                <label className="block text-sm text-gray-400 mb-2">Target Category</label>
                <select name="targetCategory" className="input-field">
                  <option value="physical">Physical</option>
                  <option value="mental">Mental</option>
                  <option value="spiritual">Spiritual</option>
                  <option value="motivation">Motivation</option>
                  <option value="financial">Financial</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-epic flex-1">Add Quest</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)} />
          <div className="glass-card p-8 relative z-10 w-full max-w-md animate-scaleIn">
            <h3 className="text-2xl font-bold mb-4">Delete Quest?</h3>
            <p className="text-gray-400 mb-6">Are you sure you want to delete this quest? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={deleteQuest} className="btn-epic flex-1 bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setShowRatingModal(false)} />
          <div className="glass-card p-8 relative z-10 w-full max-w-md animate-scaleIn">
            <h3 className="text-2xl font-bold mb-4">
              {pendingComplete?.category === 'blight' ? 'Rate Severity' : 'Rate Performance'}
            </h3>
            <p className="text-gray-400 mb-6">How well did you complete this quest?</p>
            <div className="flex justify-center gap-4 mb-8">
              {[1, 2, 3, 4, 5].map(val => (
                <button
                  key={val}
                  onClick={() => setRating(val)}
                  className="transition-all"
                >
                  <Star
                    className={`w-10 h-10 ${val <= rating ? 'fill-current' : ''}`}
                    style={{ color: val <= rating ? theme.accent : '#666' }}
                  />
                </button>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowRatingModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={confirmRating} className="btn-epic flex-1">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Toast */}
      {achievement && (
        <div className="achievement-toast glass-card p-6 flex items-center gap-4 animate-slideInRight">
          <Trophy className="w-8 h-8" style={{ color: theme.accent }} />
          <div>
            <h4 className="font-bold text-lg">{achievement.title}</h4>
            <p className="text-gray-400">{achievement.text}</p>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Space Grotesk', sans-serif;
    overflow: hidden;
  }
  
  .glass-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
  }
  
  .glass-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(var(--accent-rgb), 0.3);
  }
  
  .nav-btn {
    position: relative;
    transition: all 0.3s ease;
  }
  
  .nav-btn:hover {
    background: rgba(var(--accent-rgb), 0.1);
    transform: translateX(4px);
  }
  
  .nav-btn.active {
    background: rgba(var(--accent-rgb), 0.2);
    color: var(--accent);
    border-left: 3px solid var(--accent);
  }
  
  .btn-epic {
    background: var(--accent);
    color: #000;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: 600;
    box-shadow: 0 4px 15px rgba(var(--accent-rgb), 0.3);
    position: relative;
    overflow: hidden;
  }
  
  .btn-epic:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(var(--accent-rgb), 0.5);
  }
  
  .btn-epic:active {
    transform: translateY(0);
  }
  
  .btn-epic:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  .btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: 600;
  }
  
  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--accent);
  }
  
  .input-field {
    width: 100%;
    padding: 0.875rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    transition: all 0.3s ease;
  }
  
  .input-field:focus {
    outline: none;
    border-color: var(--accent);
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.1);
  }
  
  .quest-card {
    animation: fadeInUp 0.5s ease-out;
    transition: all 0.3s ease;
  }
  
  .quest-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 40px rgba(var(--accent-rgb), 0.2);
  }
  
  .quest-card:hover button {
    opacity: 1;
  }
  
  .modal {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease-out;
  }
  
  .modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
  }
  
  .achievement-toast {
    position: fixed;
    top: 2rem;
    right: 2rem;
    z-index: 1001;
    min-width: 300px;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes scaleIn {
    from { transform: scale(0.8); }
    to { transform: scale(1); }
  }
  
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  ::-webkit-scrollbar {
    width: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }
  
  ::-webkit-scrollbar-thumb {
    background: rgba(var(--accent-rgb), 0.3);
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--accent-rgb), 0.5);
  }
`;

export default HerosQuest;