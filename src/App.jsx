import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Volume2, VolumeX, Trophy, User, ArrowLeft, LogOut, Star, Home } from 'lucide-react';

// Connect to your local firebase.js configuration
import { db, auth } from './firebase'; 
import { signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

const appId = 'toddler-engine-1';
const AUTO_ADVANCE_SECONDS = 5; 

// --- AUDIO & VOICEOVER HELPERS ---
const playSfx = (url) => {
  const audio = new Audio(url);
  audio.volume = 0.6;
  audio.play().catch(() => {});
};

let femaleVoice = null;

const pickFemaleVoice = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter(v => v.lang.startsWith('en'));

  femaleVoice =
    english.find(v => /aria|jenny|samantha|zira|karen|victoria|female/i.test(v.name)) ||
    english[0] ||
    voices[0];
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickFemaleVoice();
  window.speechSynthesis.onvoiceschanged = pickFemaleVoice;
}

const speakText = (text, rate = 0.9, pitch = 1.2) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!femaleVoice) pickFemaleVoice();

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text));
  if (femaleVoice) utterance.voice = femaleVoice;
  utterance.rate = rate;
  utterance.pitch = pitch;
  window.speechSynthesis.speak(utterance);
};

const speakNumber = (num) => speakText(num, 0.9, 1.2);

const SOUNDS = {
  pop: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg',
  uhoh: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'
};

// --- GLOBAL STYLES ---
const globalStyles = `
  @keyframes wiggle {
    0%, 100% { transform: rotate(0deg) scale(1); }
    25% { transform: rotate(-10deg) scale(0.95); }
    50% { transform: rotate(10deg) scale(0.95); }
    75% { transform: rotate(-10deg) scale(0.95); }
  }
  .animate-wiggle { animation: wiggle 0.5s ease-in-out; }
  
  @keyframes bounce-in {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

  @keyframes float-up {
    0% { transform: translateY(0) scale(0.8); opacity: 1; }
    100% { transform: translateY(-70px) scale(1.4); opacity: 0; }
  }
  .animate-float-up { animation: float-up 0.8s ease-out forwards; }

  @keyframes fall-down {
    0% { transform: translateY(-20vh) rotate(0deg); }
    100% { transform: translateY(120vh) rotate(360deg); }
  }
  .animate-fall { animation: fall-down linear infinite; }

  @keyframes confetti-fall {
    to { transform: translateY(110vh) rotate(720deg); }
  }
  .confetti-piece {
    position: fixed;
    top: -20px;
    z-index: 1000;
    pointer-events: none;
    animation: confetti-fall linear forwards;
  }

  @keyframes progress-fill {
    from { width: 0%; }
    to { width: 100%; }
  }

  @keyframes playful-wobble {
    0%, 100% { transform: translateY(0) rotate(-6deg) scale(1); }
    25% { transform: translateY(-10px) rotate(6deg) scale(1.06); }
    50% { transform: translateY(0) rotate(-4deg) scale(0.98); }
    75% { transform: translateY(-6px) rotate(5deg) scale(1.04); }
  }
  .animate-playful-wobble {
    animation: playful-wobble 2.2s ease-in-out infinite;
  }
`;

// Helper to randomize level order
const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// --- LEVEL GENERATORS ---

// 1. Toddler Levels (Ages <= 5)
const generateToddlerLevels = () => {
  const levels = [];
  let id = 0;
  
  const colors = [
    { c: 'RED', bg: 'bg-red-500', hex: '🔴' }, { c: 'BLUE', bg: 'bg-blue-500', hex: '🔵' },
    { c: 'GREEN', bg: 'bg-green-500', hex: '🟢' }, { c: 'YELLOW', bg: 'bg-yellow-400', hex: '🟡' },
    { c: 'PURPLE', bg: 'bg-purple-500', hex: '🟣' }
  ];
  for (let i = 0; i < 5; i++) {
    const target = colors[i];
    const others = colors.filter(c => c.c !== target.c).sort(() => Math.random() - 0.5).slice(0, 2);
    const options = [target, ...others].sort(() => Math.random() - 0.5);
    levels.push({ id: id++, type: 'match', title: `Tap the ${target.c} color!`, target: target.c, options: options.map(o => ({ id: o.c, content: o.hex, color: o.bg })) });
  }
  
  const countIcons = ['🎈', '⭐', '🍎', '🧸', '🚗'];
  for (let i = 1; i <= 5; i++) {
    levels.push({ id: id++, type: 'count', title: `Count ${i} ${i === 1 ? 'item' : 'items'}!`, targetCount: i, itemIcon: countIcons[i - 1] });
  }
  
  levels.push({ id: id++, type: 'scenario', title: 'Uh oh, trash! Where does it go?', scenarioIcon: '🍎', target: 'bin', options: [{id: 'floor', label: 'Floor', icon: '👇', color: 'bg-gray-300'}, {id: 'bin', label: 'Bin', icon: '🗑️', color: 'bg-green-400 text-white'}] });
  levels.push({ id: id++, type: 'scenario', title: 'Time for bed!', scenarioIcon: '🛏️', target: 'sleep', options: [{id: 'run', label: 'Run', icon: '🏃', color: 'bg-yellow-400'}, {id: 'sleep', label: 'Sleep', icon: '😴', color: 'bg-indigo-400 text-white'}] });
  levels.push({ id: id++, type: 'scenario', title: 'Dinner is ready! Let us...', scenarioIcon: '🍲', target: 'sit', options: [{id: 'jump', label: 'Jump', icon: '🦘', color: 'bg-yellow-400'}, {id: 'sit', label: 'Sit down', icon: '🪑', color: 'bg-orange-400 text-white'}] });

  const popupGames = [
    { icon: '⚽', title: 'Tap 5 bouncy balls!', count: 5 },
    { icon: '🫧', title: 'Pop 4 bubbles!', count: 4 },
    { icon: '🐥', title: 'Find 3 ducks!', count: 3 },
    { icon: '🎈', title: 'Pop 6 balloons!', count: 6 },
    { icon: '🌟', title: 'Catch 5 stars!', count: 5 }
  ];
  popupGames.forEach(pg => levels.push({ id: id++, type: 'popup', title: pg.title, targetCount: pg.count, itemIcon: pg.icon }));

  return shuffleArray(levels);
};

// 2. Kid Levels (Ages > 5)
const generateKidLevels = () => {
  const levels = [];
  let id = 0;

  const oddSets = [
    { title: 'Find the odd one out!', out: '🚗', group: ['🍎', '🍌', '🍇'] },
    { title: 'Which one does not belong?', out: '📱', group: ['🐶', '🐱', '🐭'] },
    { title: 'Find the odd one out!', out: '🍕', group: ['👕', '👖', '👗'] },
    { title: 'Which one is different?', out: '🌲', group: ['🚗', '🚌', '🚂'] },
    { title: 'Find the odd one out!', out: '⚽', group: ['☀️', '☁️', '🌧️'] }
  ];
  oddSets.forEach(set => {
    const options = [...set.group.map(icon => ({ id: icon, icon, isCorrect: false })), { id: set.out, icon: set.out, isCorrect: true }].sort(() => Math.random() - 0.5);
    levels.push({ id: id++, type: 'odd', title: set.title, target: set.out, options });
  });

  const words = [
    { word: 'CAT', missing: 'A', options: ['A', 'O', 'E'] },
    { word: 'DOG', missing: 'O', options: ['U', 'O', 'A'] },
    { word: 'BIRD', missing: 'I', options: ['A', 'E', 'I'] },
    { word: 'FISH', missing: 'S', options: ['C', 'S', 'Z'] },
    { word: 'APPLE', missing: 'L', options: ['R', 'L', 'T'] }
  ];
  words.forEach(w => {
    const displayWord = w.word.replace(w.missing, '_');
    levels.push({ id: id++, type: 'spell', title: `Spell the word!`, displayWord, target: w.missing, fullWord: w.word, options: w.options.sort(() => Math.random() - 0.5) });
  });

  const catchGames = [
    { targetCount: 5, icon: '🥚', title: 'Catch 5 falling eggs!' },
    { targetCount: 7, icon: '🎈', title: 'Pop 7 balloons!' },
    { targetCount: 6, icon: '🦋', title: 'Catch 6 butterflies!' },
    { targetCount: 8, icon: '🍎', title: 'Catch 8 apples!' },
    { targetCount: 5, icon: '🛸', title: 'Catch 5 spaceships!' }
  ];
  catchGames.forEach(cg => {
    levels.push({ id: id++, type: 'catch', title: cg.title, targetCount: cg.targetCount, itemIcon: cg.icon });
  });

  return shuffleArray(levels);
};

// --- SUB-COMPONENTS ---
const Confetti = ({ active }) => {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (active) {
      const colors = ['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#c084fc', '#fb923c'];
      setPieces(Array.from({ length: 60 }).map((_, i) => ({
        id: i, left: `${Math.random() * 100}vw`, bg: colors[Math.floor(Math.random() * colors.length)],
        duration: `${Math.random() * 2 + 2}s`, delay: `${Math.random() * 0.5}s`, shape: Math.random() > 0.5 ? '50%' : '4px'
      })));
    } else setPieces([]);
  }, [active]);
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece w-4 h-4 shadow-sm" style={{ left: p.left, backgroundColor: p.bg, animationDuration: p.duration, animationDelay: p.delay, borderRadius: p.shape }} />
      ))}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('auth'); 
  const [childProfile, setChildProfile] = useState({ name: '', age: 4 });
  const [inputName, setInputName] = useState('');
  const [inputAge, setInputAge] = useState('');
  
  const [levelIndex, setLevelIndex] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [stars, setStars] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [feedback, setFeedback] = useState(null); 
  const [countdown, setCountdown] = useState(AUTO_ADVANCE_SECONDS);
  const audioRef = useRef(null);

  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const currentLevels = useMemo(() => {
    return childProfile.age > 5 ? generateKidLevels() : generateToddlerLevels();
  }, [childProfile.age > 5]);
  
  const levelData = currentLevels[levelIndex % (currentLevels.length || 1)];

  // Auto-advance timer when level succeeds
  useEffect(() => {
    if (feedback?.status !== 'success') return;

    setCountdown(AUTO_ADVANCE_SECONDS);

    const tickInterval = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    const advanceTimer = setTimeout(() => {
      setFeedback(null);
      setLevelIndex(prev => prev + 1);
    }, AUTO_ADVANCE_SECONDS * 1000);

    return () => {
      clearInterval(tickInterval);
      clearTimeout(advanceTimer);
    };
  }, [feedback]);

  // Auth Sync
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Firebase Real-time Progress Sync
  useEffect(() => {
    if (!user) return;
    const progressRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'progress');
    const unsubscribe = onSnapshot(progressRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.name) setChildProfile({ name: data.name, age: data.age || 4 });
        if (data.stars !== undefined) setStars(data.stars);
        
        if (gameStateRef.current === 'auth' && data.name && data.currentLevel !== undefined) {
          setLevelIndex(data.currentLevel);
          setGameState('start'); 
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Firebase Leaderboard
  useEffect(() => {
    if (!user) return;
    const lbCollection = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    const unsubscribe = onSnapshot(lbCollection, (snapshot) => {
      const lbData = [];
      snapshot.forEach(doc => lbData.push({ id: doc.id, ...doc.data() }));
      lbData.sort((a, b) => (b.stars || 0) - (a.stars || 0));
      setLeaderboard(lbData);
    });
    return () => unsubscribe();
  }, [user]);

  // Audio setup
  useEffect(() => {
    audioRef.current = new Audio('/bgm.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.2;
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  const toggleBgm = () => {
    if (!audioRef.current) return;
    if (bgmPlaying) { audioRef.current.pause(); setBgmPlaying(false); }
    else { audioRef.current.play().then(() => setBgmPlaying(true)).catch(() => {}); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!inputName.trim() || !inputAge || !user) return;
    const name = inputName.trim();
    const ageNum = parseInt(inputAge, 10);
    
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'progress'), { name, age: ageNum, currentLevel: 0, stars: 0 }, { merge: true });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', user.uid), { name, level: 0, stars: 0 }, { merge: true });
    
    setChildProfile({ name, age: ageNum });
    setLevelIndex(0);
    setStars(0);
    setGameState('start');
  };

  const handleLogout = async () => {
    setChildProfile({ name: '', age: 4 });
    setInputName(''); setInputAge('');
    setLevelIndex(0); setGameState('auth');
    await signOut(auth);
  };

  // --- GAMEPLAY HANDLERS ---
  const handleAnswer = (isCorrect) => {
    if (isCorrect) {
      playSfx(SOUNDS.pop);
      setTimeout(() => speakText('Hurray! You won!', 1.0, 1.35), 250);
      setFeedback({ status: 'success' });
      
      const nextLevel = levelIndex + 1;
      const newStars = stars + 3;
      setStars(newStars);
      
      if (user) {
        setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'progress'), { currentLevel: nextLevel, stars: newStars }, { merge: true });
        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', user.uid), { level: nextLevel, stars: newStars }, { merge: true });
      }
    } else {
      playSfx(SOUNDS.uhoh);
      setTimeout(() => speakText('Uh oh! Try again!', 0.95, 1.1), 200);
      setFeedback({ status: 'fail' });
    }
  };

  const advanceToNext = () => {
    setFeedback(null);
    setLevelIndex(prev => prev + 1);
  };

  const exitToMenu = () => {
    setFeedback(null);
    setLevelIndex(prev => prev + 1);
    setGameState('start');
  };

  // --- LEVEL RENDERERS ---
  const MatchLevel = ({ data }) => (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-4 h-[80vh]">
      <h2 className="text-4xl md:text-6xl font-bold mb-12 text-gray-700 bg-white/80 px-8 py-4 rounded-3xl shadow-sm text-center">{data.title}</h2>
      <div className="flex flex-wrap justify-center gap-8 md:gap-16 w-full">
        {data.options.map(opt => (
          <button key={opt.id} onClick={() => handleAnswer(opt.id === data.target)} className={`w-32 h-32 md:w-48 md:h-48 rounded-3xl shadow-[0_8px_0_rgba(0,0,0,0.2)] border-4 border-white text-7xl select-none active:scale-90 ${opt.color}`}>{opt.content}</button>
        ))}
      </div>
    </div>
  );

  const CountLevel = ({ data }) => {
    const [tappedIndexes, setTappedIndexes] = useState([]);

    const handleTap = (index) => {
      if (tappedIndexes.includes(index)) return;

      const newTapped = [...tappedIndexes, index];
      const currentCount = newTapped.length;
      setTappedIndexes(newTapped);

      playSfx(SOUNDS.pop);
      speakNumber(currentCount);

      if (currentCount === data.targetCount) {
        setTimeout(() => handleAnswer(true), 800);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-4 h-[80vh]">
        <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gray-700 bg-white/80 px-8 py-4 rounded-3xl shadow-sm text-center">
          {data.title}
        </h2>

        <div className="text-4xl md:text-5xl font-black text-blue-600 bg-white/70 px-8 py-2 rounded-full border-4 border-white shadow-sm mb-10">
          {tappedIndexes.length} / {data.targetCount}
        </div>

        <div className="flex flex-wrap justify-center gap-8 md:gap-12 w-full">
          {Array.from({ length: data.targetCount }).map((_, i) => {
            const isTapped = tappedIndexes.includes(i);
            return (
              <div key={`count-item-${i}`} className="relative flex items-center justify-center">
                {isTapped && (
                  <span className="absolute -top-6 text-5xl font-black text-green-500 drop-shadow-[0_2px_2px_rgba(255,255,255,1)] pointer-events-none z-20 animate-float-up">
                    +1
                  </span>
                )}
                <button
                  onClick={() => handleTap(i)}
                  disabled={isTapped}
                  className={`w-28 h-28 md:w-40 md:h-40 rounded-full border-4 border-white text-6xl md:text-7xl flex items-center justify-center select-none transition-all duration-300 ${
                    isTapped
                      ? 'bg-green-300 opacity-40 scale-75 shadow-none'
                      : 'bg-yellow-300 shadow-[0_8px_0_rgb(202,138,4)] active:scale-90'
                  }`}
                >
                  {data.itemIcon}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const SpellLevel = ({ data }) => (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-4 h-[80vh]">
      <h2 className="text-4xl md:text-5xl font-bold mb-8 text-gray-700 bg-white/80 px-8 py-4 rounded-3xl text-center">{data.title}</h2>
      <div className="text-7xl md:text-9xl font-black text-blue-600 tracking-[0.2em] mb-12 bg-white/60 py-8 px-12 rounded-[3rem] border-4 border-white shadow-inner">
        {data.displayWord}
      </div>
      <div className="flex justify-center gap-6 md:gap-12 w-full">
        {data.options.map(opt => (
          <button key={opt} onClick={() => handleAnswer(opt === data.target)} className="w-24 h-24 md:w-32 md:h-32 bg-purple-500 rounded-2xl shadow-[0_8px_0_rgb(147,51,234)] border-4 border-white text-5xl md:text-6xl text-white font-bold active:scale-90">{opt}</button>
        ))}
      </div>
    </div>
  );

  const OddOneOutLevel = ({ data }) => (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-4 h-[80vh]">
      <h2 className="text-4xl md:text-6xl font-bold mb-12 text-gray-700 bg-white/80 px-8 py-4 rounded-3xl shadow-sm text-center">{data.title}</h2>
      <div className="flex flex-wrap justify-center gap-8 w-full">
        {data.options.map((opt, i) => (
          <button key={i} onClick={() => handleAnswer(opt.isCorrect)} className="w-32 h-32 md:w-48 md:h-48 bg-white rounded-3xl shadow-[0_8px_0_rgba(0,0,0,0.1)] border-4 border-gray-200 text-7xl md:text-8xl active:scale-90 flex items-center justify-center hover:bg-gray-50">{opt.icon}</button>
        ))}
      </div>
    </div>
  );

  const CatchGameLevel = ({ data }) => {
    const [caught, setCaught] = useState(0);
    const [eggs, setEggs] = useState([]);
    const [timeLeft, setTimeLeft] = useState(30);
    const [isGameOver, setIsGameOver] = useState(false);
    
    useEffect(() => {
      if (isGameOver) return;
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }, [isGameOver]);

    useEffect(() => {
      if (isGameOver) return;
      const interval = setInterval(() => {
        setEggs(prev => [...prev, { id: Math.random(), left: Math.random() * 80 + 10, speed: Math.random() * 2 + 3 }]);
      }, 800);
      return () => clearInterval(interval);
    }, [isGameOver]);

    useEffect(() => {
      if (timeLeft === 0 && caught < data.targetCount && !isGameOver) {
        setIsGameOver(true);
        handleAnswer(false);
      }
    }, [timeLeft, caught, data.targetCount, isGameOver]);

    const catchEgg = (id) => {
      if (isGameOver) return;
      playSfx(SOUNDS.pop);
      setEggs(prev => prev.filter(e => e.id !== id));
      const newCaught = caught + 1;
      setCaught(newCaught);
      
      if (newCaught >= data.targetCount) {
        setIsGameOver(true);
        setTimeout(() => handleAnswer(true), 300);
      }
    };

    return (
      <div className="flex flex-col items-center w-full h-screen fixed inset-0 pointer-events-none">
        <div className="z-10 mt-24 flex flex-col items-center bg-white/90 px-8 py-4 rounded-3xl shadow-sm pointer-events-auto border-4 border-white">
          <h2 className="text-4xl font-bold text-gray-700 mb-2">{data.title}</h2>
          <div className="flex items-center gap-8 mt-2">
            <div className="text-3xl font-black text-blue-600">Caught: {caught} / {data.targetCount}</div>
            <div className={`text-3xl font-black flex items-center gap-2 ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
              ⏳ {timeLeft}s
            </div>
          </div>
        </div>
        {eggs.map(egg => (
          <div key={egg.id} onClick={() => catchEgg(egg.id)} className="absolute text-6xl md:text-8xl cursor-pointer animate-fall pointer-events-auto active:scale-75 transition-transform" style={{ left: `${egg.left}%`, top: '-10%', animationDuration: `${egg.speed}s` }}>
            {data.itemIcon}
          </div>
        ))}
      </div>
    );
  };

  const PopupGameLevel = ({ data }) => {
    const [cells, setCells] = useState([]);
    
    useEffect(() => {
      const allCells = Array.from({ length: 12 }).map((_, i) => i);
      const activeCells = allCells.sort(() => Math.random() - 0.5).slice(0, data.targetCount);
      setCells(activeCells.map(id => ({ id, active: true })));
    }, [data]);

    const handleTap = (id) => {
      playSfx(SOUNDS.pop);
      setCells(prev => prev.map(c => c.id === id ? { ...c, active: false } : c));
      
      if (cells.filter(c => c.active).length === 1) {
        setTimeout(() => handleAnswer(true), 300);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-4 h-[80vh]">
        <h2 className="text-4xl md:text-6xl font-bold mb-12 text-gray-700 bg-white/80 px-8 py-4 rounded-3xl shadow-sm text-center">{data.title}</h2>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-2xl h-[50vh]">
          {Array.from({ length: 12 }).map((_, index) => {
            const cell = cells.find(c => c.id === index);
            return (
              <div key={index} className="flex items-center justify-center relative">
                {cell && cell.active && (
                  <div className="animate-bounce-in">
                    <button
                      onClick={() => handleTap(index)}
                      className="text-7xl md:text-8xl animate-playful-wobble active:scale-75 transition-transform cursor-pointer select-none"
                      style={{ animationDelay: `${(index % 4) * 0.25}s` }}
                    >
                      {data.itemIcon}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div className="min-h-screen bg-gradient-to-br from-[#a1c4fd] to-[#c2e9fb] font-sans text-gray-800 overflow-hidden relative selection:bg-transparent">
        
        <Confetti active={feedback?.status === 'success'} />

        {/* Global UI */}
        <div className="absolute top-4 right-4 z-40 flex gap-4">
          <div className="bg-white/90 h-16 px-6 rounded-full flex items-center justify-center shadow-md border-2 border-white gap-2 font-black text-2xl text-yellow-500">
            <Star fill="currentColor" size={28} /> {stars}
          </div>
          {gameState !== 'auth' && (
            <button onClick={() => setGameState(gameState === 'leaderboard' ? 'start' : 'leaderboard')} className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border-2 border-white text-yellow-900 active:scale-90"><Trophy size={32} /></button>
          )}
          <button onClick={toggleBgm} className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center shadow-lg border-2 border-white text-gray-600 active:scale-90">
            {bgmPlaying ? <Volume2 size={32} /> : <VolumeX size={32} />}
          </button>
        </div>
        {gameState !== 'auth' && gameState !== 'playing' && (
           <div className="absolute top-4 left-4 z-40"><button onClick={handleLogout} className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center shadow-lg border-2 border-white text-gray-600 active:scale-90"><LogOut size={28} /></button></div>
        )}

        {/* Feedback Modals with Auto-Advance Progress Bar */}
        {feedback && (
          <div className="fixed inset-0 bg-black/40 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
            {feedback.status === 'success' ? (
              <div className="bg-white rounded-[3rem] p-8 md:p-12 flex flex-col items-center animate-bounce-in shadow-2xl border-8 border-green-400 w-full max-w-xl">
                <div className="text-[100px] md:text-[120px] leading-none mb-4">🎉</div>
                <h1 className="text-5xl md:text-6xl font-black text-green-500 mb-4 text-center">Hurray!</h1>
                <p className="text-2xl md:text-3xl font-bold text-gray-600 flex items-center gap-2 mb-6">
                  You won <span className="text-yellow-500 flex items-center">+3 <Star fill="currentColor" /></span>
                </p>

                <div className="w-full max-w-md mb-8">
                  <p className="text-center text-sm md:text-base font-bold text-gray-400 mb-2">Next level in {countdown}s...</p>
                  <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full" style={{ animation: `progress-fill ${AUTO_ADVANCE_SECONDS}s linear forwards` }} />
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
                  <button onClick={exitToMenu} className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-2xl font-bold py-4 px-8 rounded-full shadow-[0_6px_0_rgb(156,163,175)] active:scale-95 flex items-center justify-center gap-2">
                    <Home size={28} /> Exit
                  </button>
                  <button onClick={advanceToNext} className="bg-blue-500 hover:bg-blue-400 text-white text-2xl md:text-3xl font-bold py-4 px-10 rounded-full shadow-[0_8px_0_rgb(29,78,212)] active:scale-95 flex items-center justify-center gap-2">
                    Next Level <Play size={28} fill="currentColor" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[3rem] p-12 flex flex-col items-center animate-bounce-in shadow-2xl border-8 border-red-400">
                <div className="text-[120px] leading-none mb-4">🙈</div>
                <h1 className="text-6xl font-black text-red-500 mb-8">Uh oh!</h1>
                <button onClick={() => { setFeedback(null); setRetryKey(prev => prev + 1); }} className="bg-blue-500 hover:bg-blue-400 text-white text-3xl font-bold py-4 px-12 rounded-full shadow-[0_8px_0_rgb(29,78,212)] active:scale-95">
                  Try Again!
                </button>
              </div>
            )}
          </div>
        )}

        {/* Screens */}
        <div className="min-h-screen flex items-center justify-center">
          
          {gameState === 'auth' && (
            <div className="text-center animate-bounce-in w-full max-w-md bg-white/70 p-8 rounded-[40px] border-4 border-white shadow-xl mx-4">
              <div className="text-8xl mb-4">🧸</div>
              <h1 className="text-4xl font-bold text-blue-600 mb-6">Welcome!</h1>
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <input type="text" value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="Child's Name" className="text-center text-2xl font-bold p-4 rounded-2xl border-4 border-blue-200 outline-none" required maxLength={12}/>
                <input type="number" value={inputAge} onChange={(e) => setInputAge(e.target.value)} placeholder="Age (e.g. 4)" className="text-center text-2xl font-bold p-4 rounded-2xl border-4 border-purple-200 outline-none" required min={2} max={12}/>
                <button type="submit" className="bg-green-500 text-white text-3xl font-bold py-4 px-8 mt-4 rounded-full shadow-[0_8px_0_rgb(21,128,61)] active:scale-95">Let's Go!</button>
              </form>
            </div>
          )}

          {gameState === 'start' && (
            <div className="text-center animate-bounce-in flex flex-col items-center p-4">
              <h1 className="text-5xl md:text-7xl font-black text-blue-600 mb-2 drop-shadow-md">Hi, {childProfile.name}!</h1>
              <p className="text-xl font-bold text-gray-500 mb-6 bg-white/60 px-6 py-2 rounded-full">Age {childProfile.age} Curriculum</p>
              <div className="text-[120px] mb-8 animate-bounce">🚀</div>
              <button onClick={() => { setGameState('playing'); if (!bgmPlaying && audioRef.current) audioRef.current.play().then(() => setBgmPlaying(true)).catch(()=>{}); }} className="bg-green-500 hover:bg-green-400 text-white text-5xl font-bold py-8 px-16 rounded-full shadow-[0_12px_0_rgb(21,128,61)] active:scale-95 flex items-center gap-4"><Play size={48} fill="currentColor" /> PLAY</button>
            </div>
          )}

          {gameState === 'playing' && levelData && !feedback && (
            <div className="w-full animate-bounce-in" key={`${levelIndex}-${retryKey}`}>
              {levelData.type === 'match' && <MatchLevel data={levelData} />}
              {levelData.type === 'count' && <CountLevel data={levelData} />}
              {levelData.type === 'spell' && <SpellLevel data={levelData} />}
              {levelData.type === 'odd' && <OddOneOutLevel data={levelData} />}
              {levelData.type === 'catch' && <CatchGameLevel data={levelData} />}
              {levelData.type === 'popup' && <PopupGameLevel data={levelData} />}
              {levelData.type === 'scenario' && <MatchLevel data={{...levelData, options: levelData.options.map(opt => ({ id: opt.id, content: opt.icon, color: opt.color }))}} />}
            </div>
          )}

          {gameState === 'leaderboard' && (
            <div className="w-full max-w-2xl mx-auto p-4 animate-bounce-in flex flex-col h-[80vh]">
              <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setGameState('start')} className="bg-white p-3 rounded-full shadow-md text-gray-700 active:scale-95"><ArrowLeft size={32} /></button>
                <h1 className="text-4xl md:text-6xl font-black text-yellow-600 drop-shadow-md flex-1 text-center">Star Players</h1>
              </div>
              <div className="flex-1 overflow-y-auto bg-white/70 border-4 border-white rounded-[40px] p-4 md:p-8 shadow-inner custom-scrollbar">
                {leaderboard.map((player, idx) => (
                  <div key={player.id} className={`flex items-center justify-between p-4 mb-4 rounded-2xl border-2 ${player.id === user?.uid ? 'bg-yellow-200 border-yellow-400 shadow-md' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-black text-gray-400 w-8 text-center">{idx + 1}</div>
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400"><User size={24} /></div>
                      <span className="text-2xl font-bold text-gray-700">{player.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-2xl font-black text-yellow-500"><Star fill="currentColor" size={28}/> {player.stars || 0}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}