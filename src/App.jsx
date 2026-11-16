import React, { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX, Trophy, User, ArrowLeft, LogOut } from 'lucide-react';

// Connect to your local firebase.js configuration
import { db, auth } from './firebase'; 

// Import only the specific Firebase functions you need for the game logic
import { signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

const appId = 'toddler-engine-1';

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

  @keyframes pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(0); opacity: 0; }
  }
  .animate-pop { animation: pop 0.4s ease-out forwards; }

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
`;

// --- LEVEL GENERATOR (100 LEVELS) ---
const generateLevels = () => {
  const levels = [];
  let id = 0;

  // Levels 1-10: Colors & Shapes (10 Unique Colors)
  const colors = [
    { c: 'RED', bg: 'bg-red-500', hex: '🔴' }, { c: 'BLUE', bg: 'bg-blue-500', hex: '🔵' },
    { c: 'GREEN', bg: 'bg-green-500', hex: '🟢' }, { c: 'YELLOW', bg: 'bg-yellow-400', hex: '🟡' },
    { c: 'PURPLE', bg: 'bg-purple-500', hex: '🟣' }, { c: 'ORANGE', bg: 'bg-orange-500', hex: '🟠' },
    { c: 'BROWN', bg: 'bg-amber-800', hex: '🟤' }, { c: 'BLACK', bg: 'bg-gray-900', hex: '⚫' },
    { c: 'WHITE', bg: 'bg-gray-100', hex: '⚪' }, { c: 'PINK', bg: 'bg-pink-400', hex: '🌸' }
  ];
  for (let i = 0; i < 10; i++) {
    const target = colors[i];
    const others = colors.filter(c => c.c !== target.c).sort(() => Math.random() - 0.5).slice(0, 2);
    const options = [target, ...others].sort(() => Math.random() - 0.5);
    levels.push({
      id: id++, type: 'match', title: `Tap the ${target.c} color!`, target: target.c, reward: '🎈',
      options: options.map(o => ({ id: o.c, content: o.hex, color: o.bg }))
    });
  }

  // Levels 11-36: Alphabets (26 levels)
  for (let i = 0; i < 26; i++) {
    const char = String.fromCharCode(65 + i);
    const other1 = String.fromCharCode(65 + ((i + 1) % 26));
    const other2 = String.fromCharCode(65 + ((i + 2) % 26));
    const options = [
      { id: char, content: char, color: 'bg-purple-500 text-6xl font-bold text-white' },
      { id: other1, content: other1, color: 'bg-blue-400 text-6xl font-bold text-white' },
      { id: other2, content: other2, color: 'bg-pink-400 text-6xl font-bold text-white' }
    ].sort(() => Math.random() - 0.5);
    levels.push({
      id: id++, type: 'match', title: `Find the letter ${char}`, target: char, reward: '🍎',
      options
    });
  }

  // Levels 37-49: Counting (13 levels)
  const countIcons = ['⭐', '🎈', '🧸', '🚗', '🍎'];
  for (let i = 0; i < 13; i++) {
    const count = (i % 5) + 1; // 1 to 5
    const icon = countIcons[i % countIcons.length];
    levels.push({
      id: id++, type: 'count', title: `Tap ${count} ${count === 1 ? 'item' : 'items'}!`, 
      targetCount: count, itemIcon: icon, reward: '🌟'
    });
  }

  // Levels 50-100: Scenarios (51 Unique Scenarios - No Repeats)
  const scenarios = [
    { t: 'Uh oh, trash! Where does it go?', icon: '🍎', tgt: 'bin', r: '🏅', opt: [{id: 'floor', l: 'Floor', i: '👇', c: 'bg-gray-300 text-gray-700'}, {id: 'bin', l: 'Bin', i: '🗑️', c: 'bg-green-400 text-white'}] },
    { t: 'Before we eat, we must...', icon: '🥪', tgt: 'wash', r: '🧼', opt: [{id: 'play', l: 'Play', i: '🪴', c: 'bg-amber-700 text-white'}, {id: 'wash', l: 'Wash', i: '🫧', c: 'bg-blue-400 text-white'}] },
    { t: 'Friend wants to play. We should...', icon: '🧸', tgt: 'share', r: '❤️', opt: [{id: 'snatch', l: 'Keep it', i: '😠', c: 'bg-red-400 text-white'}, {id: 'share', l: 'Share', i: '🤝', c: 'bg-pink-400 text-white'}] },
    { t: 'Time for bed! What do we do?', icon: '🛏️', tgt: 'sleep', r: '🌙', opt: [{id: 'run', l: 'Run', i: '🏃', c: 'bg-yellow-400 text-gray-800'}, {id: 'sleep', l: 'Sleep', i: '😴', c: 'bg-indigo-400 text-white'}] },
    { t: 'We spilled juice! Let us...', icon: '🧃', tgt: 'clean', r: '🧽', opt: [{id: 'leave', l: 'Leave it', i: '🤷', c: 'bg-gray-400 text-white'}, {id: 'clean', l: 'Wipe it', i: '🧻', c: 'bg-teal-400 text-white'}] },
    { t: 'It is cold outside! Need a...', icon: '❄️', tgt: 'jacket', r: '🧥', opt: [{id: 'swim', l: 'Swimsuit', i: '🩱', c: 'bg-cyan-400 text-white'}, {id: 'jacket', l: 'Jacket', i: '🧥', c: 'bg-orange-500 text-white'}] },
    { t: 'It is raining! Let us take an...', icon: '🌧️', tgt: 'umbrella', r: '☔', opt: [{id: 'sun', l: 'Sunnies', i: '🕶️', c: 'bg-yellow-400 text-gray-800'}, {id: 'umbrella', l: 'Umbrella', i: '☂️', c: 'bg-purple-500 text-white'}] },
    { t: 'The plant is dry! We should...', icon: '🥀', tgt: 'water', r: '🌻', opt: [{id: 'kick', l: 'Kick it', i: '🥾', c: 'bg-red-400 text-white'}, {id: 'water', l: 'Water it', i: '🚿', c: 'bg-blue-400 text-white'}] },
    { t: 'My nose is runny! I need a...', icon: '🤧', tgt: 'tissue', r: '🌟', opt: [{id: 'sleeve', l: 'Sleeve', i: '👕', c: 'bg-gray-400 text-white'}, {id: 'tissue', l: 'Tissue', i: '🧻', c: 'bg-teal-400 text-white'}] },
    { t: 'See a cute dog! I should...', icon: '🐕', tgt: 'ask', r: '🐾', opt: [{id: 'pull', l: 'Pull tail', i: '✊', c: 'bg-red-500 text-white'}, {id: 'ask', l: 'Ask to pet', i: '👋', c: 'bg-green-400 text-white'}] },
    { t: 'Dinner is ready! Let us...', icon: '🍲', tgt: 'sit', r: '😋', opt: [{id: 'jump', l: 'Jump', i: '🦘', c: 'bg-yellow-400 text-gray-800'}, {id: 'sit', l: 'Sit down', i: '🪑', c: 'bg-orange-400 text-white'}] },
    { t: 'My toy broke! I should...', icon: '🚂', tgt: 'help', r: '🛠️', opt: [{id: 'cry', l: 'Cry', i: '😭', c: 'bg-blue-300 text-white'}, {id: 'help', l: 'Ask help', i: '🙋', c: 'bg-indigo-400 text-white'}] },
    { t: 'Finished eating! Plate goes in...', icon: '🍽️', tgt: 'sink', r: '✨', opt: [{id: 'throw', l: 'Throw', i: '💨', c: 'bg-red-400 text-white'}, {id: 'sink', l: 'Sink', i: '🚰', c: 'bg-blue-400 text-white'}] },
    { t: 'Crossing the street! We must...', icon: '🚦', tgt: 'hold', r: '🚶', opt: [{id: 'run', l: 'Run', i: '🏃', c: 'bg-orange-500 text-white'}, {id: 'hold', l: 'Hold hands', i: '🤝', c: 'bg-green-500 text-white'}] },
    { t: 'In the library! We should...', icon: '📚', tgt: 'whisper', r: '🤫', opt: [{id: 'yell', l: 'Yell', i: '🗣️', c: 'bg-red-500 text-white'}, {id: 'whisper', l: 'Whisper', i: '🤫', c: 'bg-purple-400 text-white'}] },
    { t: 'Dirty clothes go in the...', icon: '👕', tgt: 'hamper', r: '🧺', opt: [{id: 'floor', l: 'Floor', i: '👇', c: 'bg-gray-400 text-white'}, {id: 'hamper', l: 'Basket', i: '🧺', c: 'bg-orange-400 text-white'}] },
    { t: 'About to sneeze! I must...', icon: '🤧', tgt: 'cover', r: '😷', opt: [{id: 'friend', l: 'On friend', i: '🤦', c: 'bg-red-400 text-white'}, {id: 'cover', l: 'Cover it', i: '💪', c: 'bg-teal-500 text-white'}] },
    { t: 'I feel very mad! I will...', icon: '😡', tgt: 'breathe', r: '🧘', opt: [{id: 'hit', l: 'Hit', i: '🥊', c: 'bg-red-500 text-white'}, {id: 'breathe', l: 'Breathe', i: '🌬️', c: 'bg-blue-400 text-white'}] },
    { t: 'See a tiny bug! Let us...', icon: '🐞', tgt: 'look', r: '🔍', opt: [{id: 'squish', l: 'Squish it', i: '🦶', c: 'bg-gray-500 text-white'}, {id: 'look', l: 'Just look', i: '👀', c: 'bg-green-400 text-white'}] },
    { t: 'In the car! I need my...', icon: '🚗', tgt: 'belt', r: '🚙', opt: [{id: 'stand', l: 'Stand up', i: '🧍', c: 'bg-red-400 text-white'}, {id: 'belt', l: 'Seatbelt', i: '💺', c: 'bg-blue-500 text-white'}] },
    { t: 'At the store! I will...', icon: '🛒', tgt: 'close', r: '🍎', opt: [{id: 'run', l: 'Run away', i: '🏃', c: 'bg-yellow-500 text-white'}, {id: 'close', l: 'Stay close', i: '👨‍👧', c: 'bg-green-500 text-white'}] },
    { t: 'Morning time! Let us...', icon: '🌅', tgt: 'brush', r: '🦷', opt: [{id: 'candy', l: 'Eat candy', i: '🍬', c: 'bg-pink-400 text-white'}, {id: 'brush', l: 'Brush teeth', i: '🪥', c: 'bg-teal-400 text-white'}] },
    { t: 'Kitty is hungry! We should...', icon: '🐱', tgt: 'feed', r: '🐟', opt: [{id: 'tease', l: 'Tease', i: '😜', c: 'bg-red-400 text-white'}, {id: 'feed', l: 'Feed her', i: '🥣', c: 'bg-orange-400 text-white'}] },
    { t: 'Hands are sticky! Let us...', icon: '🍯', tgt: 'wash', r: '🧼', opt: [{id: 'shirt', l: 'Wipe shirt', i: '👕', c: 'bg-gray-400 text-white'}, {id: 'wash', l: 'Wash hands', i: '🚰', c: 'bg-blue-400 text-white'}] },
    { t: 'I want a cookie! I will say...', icon: '🍪', tgt: 'please', r: '🥛', opt: [{id: 'grab', l: 'Grab it', i: '✊', c: 'bg-red-400 text-white'}, {id: 'please', l: 'Please', i: '🙏', c: 'bg-purple-400 text-white'}] },
    { t: 'Hurt my knee! I need a...', icon: '🩹', tgt: 'bandage', r: '❤️‍🩹', opt: [{id: 'hide', l: 'Hide it', i: '🙈', c: 'bg-gray-500 text-white'}, {id: 'bandage', l: 'Bandage', i: '🩹', c: 'bg-pink-400 text-white'}] },
    { t: 'Getting out of the bath...', icon: '🛁', tgt: 'towel', r: '🧖', opt: [{id: 'run', l: 'Run wet', i: '🏃', c: 'bg-blue-300 text-white'}, {id: 'towel', l: 'Get towel', i: '🧣', c: 'bg-teal-500 text-white'}] },
    { t: 'My hands are cold! I need...', icon: '🖐️', tgt: 'mittens', r: '🧤', opt: [{id: 'socks', l: 'Socks', i: '🧦', c: 'bg-yellow-400 text-gray-800'}, {id: 'mittens', l: 'Mittens', i: '🧤', c: 'bg-orange-500 text-white'}] },
    { t: 'My hair is messy! Let us...', icon: '💇', tgt: 'brush', r: '🎀', opt: [{id: 'mud', l: 'Add mud', i: '💩', c: 'bg-amber-800 text-white'}, {id: 'brush', l: 'Brush it', i: '梳', c: 'bg-pink-400 text-white'}] },
    { t: 'Soup is too hot! I will...', icon: '🥣', tgt: 'blow', r: '🧊', opt: [{id: 'gulp', l: 'Gulp it', i: '🥵', c: 'bg-red-500 text-white'}, {id: 'blow', l: 'Blow on it', i: '🌬️', c: 'bg-blue-400 text-white'}] },
    { t: 'At the movies! We must...', icon: '🍿', tgt: 'quiet', r: '🎬', opt: [{id: 'talk', l: 'Talk loud', i: '🗣️', c: 'bg-red-400 text-white'}, {id: 'quiet', l: 'Sit quiet', i: '🤫', c: 'bg-indigo-500 text-white'}] },
    { t: 'In the sandbox! Let us...', icon: '🏖️', tgt: 'build', r: '🏰', opt: [{id: 'throw', l: 'Throw sand', i: '💨', c: 'bg-yellow-600 text-white'}, {id: 'build', l: 'Build', i: '🪣', c: 'bg-orange-400 text-white'}] },
    { t: 'Going to the pool! Need a...', icon: '🏊', tgt: 'swim', r: '🏖️', opt: [{id: 'jeans', l: 'Jeans', i: '👖', c: 'bg-blue-600 text-white'}, {id: 'swim', l: 'Swimsuit', i: '🩱', c: 'bg-cyan-400 text-white'}] },
    { t: 'Shoes are untied! I will...', icon: '👟', tgt: 'tie', r: '🎀', opt: [{id: 'trip', l: 'Leave them', i: '🤷', c: 'bg-gray-400 text-white'}, {id: 'tie', l: 'Tie them', i: '🪢', c: 'bg-green-500 text-white'}] },
    { t: 'Hear a loud noise! I will...', icon: '🔊', tgt: 'cover', r: '😌', opt: [{id: 'scream', l: 'Scream', i: '😱', c: 'bg-red-500 text-white'}, {id: 'cover', l: 'Cover ears', i: '🙉', c: 'bg-blue-400 text-white'}] },
    { t: 'See a sleeping baby! Be...', icon: '👶', tgt: 'gentle', r: '💤', opt: [{id: 'yell', l: 'Yell', i: '📢', c: 'bg-red-400 text-white'}, {id: 'gentle', l: 'Gentle', i: '🤫', c: 'bg-purple-300 text-white'}] },
    { t: 'Sun is too bright! Wear...', icon: '☀️', tgt: 'glasses', r: '😎', opt: [{id: 'stare', l: 'Stare at it', i: '👀', c: 'bg-yellow-500 text-white'}, {id: 'glasses', l: 'Sunnies', i: '🕶️', c: 'bg-gray-800 text-white'}] },
    { t: 'Time to draw! Use...', icon: '🖍️', tgt: 'paper', r: '🎨', opt: [{id: 'wall', l: 'The wall', i: '🧱', c: 'bg-red-400 text-white'}, {id: 'paper', l: 'Paper', i: '📝', c: 'bg-green-300 text-gray-800'}] },
    { t: 'Bath time! We wash with...', icon: '🛁', tgt: 'soap', r: '🫧', opt: [{id: 'toast', l: 'Toast', i: '🍞', c: 'bg-amber-700 text-white'}, {id: 'soap', l: 'Soap', i: '🧼', c: 'bg-blue-400 text-white'}] },
    { t: 'See a hot stove! We...', icon: '🔥', tgt: 'away', r: '🛑', opt: [{id: 'touch', l: 'Touch it', i: '👆', c: 'bg-red-500 text-white'}, {id: 'away', l: 'Stay away', i: '🙅', c: 'bg-blue-500 text-white'}] },
    { t: 'Just woke up! Time to...', icon: '🥱', tgt: 'stretch', r: '🌞', opt: [{id: 'cry', l: 'Cry', i: '😭', c: 'bg-blue-300 text-white'}, {id: 'stretch', l: 'Stretch', i: '🤸', c: 'bg-orange-400 text-white'}] },
    { t: 'Got a present! I say...', icon: '🎁', tgt: 'thanks', r: '💖', opt: [{id: 'throw', l: 'Throw it', i: '💨', c: 'bg-red-400 text-white'}, {id: 'thanks', l: 'Thank You', i: '🥰', c: 'bg-pink-400 text-white'}] },
    { t: 'Need a book up high! I...', icon: '📚', tgt: 'ask', r: '📖', opt: [{id: 'climb', l: 'Climb', i: '🧗', c: 'bg-yellow-500 text-white'}, {id: 'ask', l: 'Ask adult', i: '🙋', c: 'bg-indigo-400 text-white'}] },
    { t: 'See a muddy puddle! I...', icon: '💧', tgt: 'boots', r: '🐸', opt: [{id: 'sit', l: 'Sit in it', i: '🧘', c: 'bg-amber-700 text-white'}, {id: 'boots', l: 'Wear boots', i: '👢', c: 'bg-green-500 text-white'}] },
    { t: 'Leaving the house! We...', icon: '🚪', tgt: 'lock', r: '🗝️', opt: [{id: 'open', l: 'Leave open', i: '💨', c: 'bg-gray-400 text-white'}, {id: 'lock', l: 'Lock door', i: '🔒', c: 'bg-yellow-600 text-white'}] },
    { t: 'Tooth fell out! Put under...', icon: '🦷', tgt: 'pillow', r: '🧚', opt: [{id: 'trash', l: 'Trash', i: '🗑️', c: 'bg-gray-500 text-white'}, {id: 'pillow', l: 'Pillow', i: '🛏️', c: 'bg-purple-300 text-gray-800'}] },
    { t: 'Finished playing! Let us...', icon: '🧩', tgt: 'clean', r: '🧹', opt: [{id: 'run', l: 'Run away', i: '🏃', c: 'bg-red-400 text-white'}, {id: 'clean', l: 'Clean up', i: '📦', c: 'bg-teal-500 text-white'}] },
    { t: 'Feeling sad! I need a...', icon: '😢', tgt: 'hug', r: '🧸', opt: [{id: 'yell', l: 'Yell', i: '😠', c: 'bg-red-500 text-white'}, {id: 'hug', l: 'Hug', i: '🫂', c: 'bg-pink-400 text-white'}] },
    { t: 'Dark outside! Turn on the...', icon: '🌙', tgt: 'light', r: '💡', opt: [{id: 'hide', l: 'Hide', i: '🙈', c: 'bg-gray-700 text-white'}, {id: 'light', l: 'Light', i: '🔦', c: 'bg-yellow-400 text-gray-800'}] },
    { t: 'Eating dinner! Use a...', icon: '🍝', tgt: 'fork', r: '🍽️', opt: [{id: 'hands', l: 'Hands', i: '🖐️', c: 'bg-orange-400 text-white'}, {id: 'fork', l: 'Fork', i: '🍴', c: 'bg-blue-400 text-white'}] },
    { t: 'At the doctor! Be...', icon: '🩺', tgt: 'brave', r: '🦸', opt: [{id: 'bite', l: 'Bite', i: '🦷', c: 'bg-red-500 text-white'}, {id: 'brave', l: 'Brave', i: '🦁', c: 'bg-green-500 text-white'}] }
  ];
  for (let i = 0; i < 51; i++) {
    const s = scenarios[i];
    levels.push({
      id: id++, type: 'scenario', title: s.t, scenarioIcon: s.icon, target: s.tgt, reward: s.r,
      options: s.opt.sort(() => Math.random() - 0.5)
    });
  }

  return levels;
};
const LEVEL_DATA = generateLevels();

// --- COMPONENTS ---
const Confetti = ({ active }) => {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (active) {
      const colors = ['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#c084fc', '#fb923c'];
      const newPieces = Array.from({ length: 50 }).map((_, i) => ({
        id: i, left: `${Math.random() * 100}vw`, bg: colors[Math.floor(Math.random() * colors.length)],
        duration: `${Math.random() * 2 + 2}s`, delay: `${Math.random() * 0.5}s`,
        shape: Math.random() > 0.5 ? '50%' : '4px'
      }));
      setPieces(newPieces);
    } else setPieces([]);
  }, [active]);

  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece w-4 h-4 shadow-sm"
          style={{ left: p.left, backgroundColor: p.bg, animationDuration: p.duration, animationDelay: p.delay, borderRadius: p.shape }}
        />
      ))}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('auth'); // auth, start, playing, end, leaderboard
  const [childName, setChildName] = useState('');
  const [inputName, setInputName] = useState('');
  const [levelIndex, setLevelIndex] = useState(0);
  const [stickers, setStickers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const audioRef = useRef(null);

  // 1. Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch User Progress (Private)
  useEffect(() => {
    if (!user) return;
    const progressRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'progress');
    const unsubscribe = onSnapshot(progressRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.name) setChildName(data.name);
        if (data.currentLevel !== undefined && gameState === 'auth' && data.name) {
          setLevelIndex(data.currentLevel);
          setGameState('start'); // Auto login if profile exists
        }
      } else if (gameState === 'auth' && childName === '') {
        // Stay on auth screen
      }
    }, (err) => console.error("Error fetching progress", err));
    return () => unsubscribe();
  }, [user]); // Only trigger on user change

  // 3. Fetch Leaderboard (Public)
  useEffect(() => {
    if (!user) return;
    const lbCollection = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    const unsubscribe = onSnapshot(lbCollection, (snapshot) => {
      const lbData = [];
      snapshot.forEach(doc => lbData.push({ id: doc.id, ...doc.data() }));
      // Sort in memory
      lbData.sort((a, b) => b.level - a.level);
      setLeaderboard(lbData);
    }, (err) => console.error("Error fetching leaderboard", err));
    return () => unsubscribe();
  }, [user]);

  // Audio setup
  useEffect(() => {
    audioRef.current = new Audio('/bgm.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleBgm = () => {
    if (!audioRef.current) return;
    if (bgmPlaying) {
      audioRef.current.pause();
      setBgmPlaying(false);
    } else {
      audioRef.current.play().then(() => setBgmPlaying(true)).catch(() => {});
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!inputName.trim() || !user) return;
    const name = inputName.trim();
    
    // Save to private profile
    const progressRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'progress');
    await setDoc(progressRef, { name, currentLevel: 0 }, { merge: true });
    
    // Save to public leaderboard
    const lbRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', user.uid);
    await setDoc(lbRef, { name, level: 0 }, { merge: true });
    
    setChildName(name);
    setLevelIndex(0);
    setGameState('start');
  };

  const handleLogout = async () => {
    setChildName('');
    setInputName('');
    setLevelIndex(0);
    setGameState('auth');
    await signOut(auth);
  };

  const saveProgress = async (newLevel) => {
    if (!user) return;
    const progressRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'progress');
    await setDoc(progressRef, { currentLevel: newLevel }, { merge: true });
    
    const lbRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', user.uid);
    await setDoc(lbRef, { level: newLevel }, { merge: true });
  };

  const handleLevelComplete = () => {
    setShowConfetti(true);
    const currentLevel = LEVEL_DATA[levelIndex];
    setStickers(prev => [...prev, currentLevel.reward]);
    
    const nextLevel = levelIndex + 1;
    saveProgress(nextLevel);

    setTimeout(() => {
      setShowConfetti(false);
      if (nextLevel < LEVEL_DATA.length) {
        setLevelIndex(nextLevel);
        setGameState('playing');
      } else {
        setGameState('end');
      }
    }, 2500);
  };

  // --- SUB-COMPONENTS ---
  const MatchLevel = ({ data, onComplete }) => {
    const [wigglingId, setWigglingId] = useState(null);
    const handleTap = (id) => {
      if (id === data.target) onComplete();
      else {
        setWigglingId(id);
        setTimeout(() => setWigglingId(null), 600);
      }
    };
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-4">
        <h2 className="text-4xl md:text-6xl font-bold mb-12 text-gray-700 bg-white/80 px-8 py-4 rounded-3xl shadow-sm text-center">
          {data.title}
        </h2>
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 w-full">
          {data.options.map(opt => (
            <button
              key={opt.id} onClick={() => handleTap(opt.id)}
              className={`w-32 h-32 md:w-48 md:h-48 rounded-3xl shadow-[0_8px_0_rgba(0,0,0,0.2)] border-4 border-white flex items-center justify-center text-7xl select-none transition-transform active:scale-90 ${opt.color} ${wigglingId === opt.id ? 'animate-wiggle brightness-75' : ''}`}
            >
              {opt.content}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const CountLevel = ({ data, onComplete }) => {
    const [poppedIndexes, setPoppedIndexes] = useState([]);
    const handleTap = (index) => {
      if (poppedIndexes.includes(index)) return;
      const newPopped = [...poppedIndexes, index];
      setPoppedIndexes(newPopped);
      if (newPopped.length === data.targetCount) setTimeout(onComplete, 500);
    };
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-4">
        <h2 className="text-4xl md:text-6xl font-bold mb-8 text-gray-700 bg-white/80 px-8 py-4 rounded-3xl shadow-sm text-center">
          {data.title}
        </h2>
        <div className="flex gap-4 mb-12">
          {Array.from({ length: data.targetCount }).map((_, i) => (
            <div key={`tracker-${i}`} className={`w-8 h-8 rounded-full border-4 transition-colors duration-300 ${i < poppedIndexes.length ? 'bg-yellow-400 border-yellow-500 shadow-[0_0_15px_yellow]' : 'bg-white/40 border-white/60'}`} />
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-8 w-full">
          {Array.from({ length: data.targetCount }).map((_, i) => (
            <button
              key={`item-${i}`} onClick={() => handleTap(i)} disabled={poppedIndexes.includes(i)}
              className={`w-28 h-28 md:w-40 md:h-40 bg-yellow-300 rounded-full shadow-[0_8px_0_rgb(202,138,4)] border-4 border-white text-6xl md:text-7xl flex items-center justify-center select-none transition-transform active:scale-90 ${poppedIndexes.includes(i) ? 'animate-pop' : ''}`}
            >
              {data.itemIcon}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const ScenarioLevel = ({ data, onComplete }) => {
    const [wigglingId, setWigglingId] = useState(null);
    const handleTap = (id) => {
      if (id === data.target) onComplete();
      else {
        setWigglingId(id);
        setTimeout(() => setWigglingId(null), 600);
      }
    };
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-5xl mx-auto p-4">
        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-700 bg-white/80 px-8 py-4 rounded-3xl shadow-sm text-center max-w-3xl">
          {data.title}
        </h2>
        <div className="text-9xl mb-12 animate-bounce">{data.scenarioIcon}</div>
        <div className="flex flex-wrap justify-center gap-6 md:gap-12 w-full">
          {data.options.map(opt => (
            <button
              key={opt.id} onClick={() => handleTap(opt.id)}
              className={`flex flex-col items-center justify-center gap-4 w-48 h-48 md:w-64 md:h-64 rounded-[40px] shadow-[0_12px_0_rgba(0,0,0,0.15)] border-4 border-white select-none transition-transform active:scale-90 ${opt.color} ${wigglingId === opt.id ? 'animate-wiggle opacity-80' : ''}`}
            >
              <span className="text-7xl">{opt.icon}</span>
              <span className="text-2xl font-bold px-2 text-center leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div className="min-h-screen bg-gradient-to-br from-[#a1c4fd] to-[#c2e9fb] font-sans text-gray-800 overflow-hidden relative selection:bg-transparent">
        
        <Confetti active={showConfetti} />

        {/* Global Controls */}
        <div className="absolute top-4 right-4 z-40 flex gap-4">
          {gameState !== 'auth' && (
            <button 
              onClick={() => gameState === 'leaderboard' ? setGameState('start') : setGameState('leaderboard')}
              className="w-16 h-16 bg-yellow-400 hover:bg-yellow-300 rounded-full flex items-center justify-center shadow-lg border-2 border-white text-yellow-900 transition-all active:scale-90"
            >
              <Trophy size={32} />
            </button>
          )}
          <button 
            onClick={toggleBgm}
            className="w-16 h-16 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-white text-gray-600 transition-all active:scale-90"
          >
            {bgmPlaying ? <Volume2 size={32} /> : <VolumeX size={32} />}
          </button>
        </div>

        {gameState !== 'auth' && gameState !== 'playing' && (
           <div className="absolute top-4 left-4 z-40">
             <button 
              onClick={handleLogout}
              className="w-16 h-16 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-white text-gray-600 transition-all active:scale-90"
             >
               <LogOut size={28} />
             </button>
           </div>
        )}

        <div className="min-h-screen flex items-center justify-center">
          
          {gameState === 'auth' && (
            <div className="text-center animate-bounce-in w-full max-w-md bg-white/70 p-8 rounded-[40px] border-4 border-white shadow-xl mx-4">
              <div className="text-8xl mb-4">🧸</div>
              <h1 className="text-4xl font-bold text-blue-600 mb-2">Welcome!</h1>
              <p className="text-gray-600 mb-8 font-medium">What is your name?</p>
              <form onSubmit={handleLogin} className="flex flex-col gap-6">
                <input 
                  type="text" 
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="Your Name..."
                  className="text-center text-3xl font-bold p-4 rounded-2xl border-4 border-blue-300 focus:border-blue-500 outline-none text-gray-700 bg-white"
                  maxLength={15}
                  required
                />
                <button 
                  type="submit"
                  className="bg-green-500 hover:bg-green-400 text-white text-3xl font-bold py-4 px-8 rounded-full shadow-[0_8px_0_rgb(21,128,61)] border-4 border-white active:scale-95 transition-transform"
                >
                  Let's Go!
                </button>
              </form>
            </div>
          )}

          {gameState === 'start' && (
            <div className="text-center animate-bounce-in flex flex-col items-center p-4">
              <h1 className="text-5xl md:text-7xl font-black text-blue-600 mb-4 drop-shadow-md">
                Hi, {childName}!
              </h1>
              <p className="text-2xl font-bold text-gray-600 mb-8 bg-white/60 px-6 py-2 rounded-full border-2 border-white">
                Level {levelIndex + 1}
              </p>
              <div className="text-[120px] mb-8 leading-none animate-bounce">🎈</div>
              <button 
                onClick={() => {
                  setGameState('playing');
                  if (!bgmPlaying && audioRef.current) audioRef.current.play().then(() => setBgmPlaying(true)).catch(()=>{});
                }}
                className="bg-green-500 hover:bg-green-400 text-white text-5xl font-bold py-8 px-16 rounded-full shadow-[0_12px_0_rgb(21,128,61)] border-4 border-white active:scale-95 transition-transform flex items-center gap-4"
              >
                <Play size={48} fill="currentColor" /> PLAY
              </button>
            </div>
          )}

          {gameState === 'playing' && LEVEL_DATA[levelIndex] && (
            <div className="w-full animate-bounce-in" key={levelIndex}>
              {LEVEL_DATA[levelIndex].type === 'match' && <MatchLevel data={LEVEL_DATA[levelIndex]} onComplete={handleLevelComplete} />}
              {LEVEL_DATA[levelIndex].type === 'count' && <CountLevel data={LEVEL_DATA[levelIndex]} onComplete={handleLevelComplete} />}
              {LEVEL_DATA[levelIndex].type === 'scenario' && <ScenarioLevel data={LEVEL_DATA[levelIndex]} onComplete={handleLevelComplete} />}
            </div>
          )}

          {gameState === 'leaderboard' && (
            <div className="w-full max-w-2xl mx-auto p-4 animate-bounce-in flex flex-col h-[80vh]">
              <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setGameState('start')} className="bg-white p-3 rounded-full shadow-md active:scale-95 text-gray-700">
                  <ArrowLeft size={32} />
                </button>
                <h1 className="text-4xl md:text-6xl font-black text-yellow-600 drop-shadow-md flex-1 text-center">
                  Star Players
                </h1>
              </div>
              <div className="flex-1 overflow-y-auto bg-white/70 border-4 border-white rounded-[40px] p-4 md:p-8 shadow-inner custom-scrollbar">
                {leaderboard.length === 0 ? (
                  <p className="text-center text-2xl text-gray-500 font-bold mt-10">Loading players...</p>
                ) : (
                  leaderboard.map((player, idx) => (
                    <div key={player.id} className={`flex items-center justify-between p-4 mb-4 rounded-2xl border-2 ${player.id === user?.uid ? 'bg-yellow-200 border-yellow-400 shadow-md' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-center gap-4">
                        <div className="text-3xl font-black text-gray-400 w-8 text-center">{idx + 1}</div>
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                          <User size={24} />
                        </div>
                        <span className="text-2xl font-bold text-gray-700">{player.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">🌟</span>
                        <span className="text-3xl font-black text-blue-600">{player.level}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {gameState === 'end' && (
            <div className="text-center animate-bounce-in w-full max-w-4xl mx-auto">
              <h1 className="text-6xl md:text-8xl font-black text-pink-500 mb-8 drop-shadow-lg">
                You Did It!
              </h1>
              <h2 className="text-3xl md:text-5xl font-bold text-gray-700 mb-8 bg-white/80 inline-block px-8 py-4 rounded-3xl shadow-sm">
                100 Levels Completed!
              </h2>
              <div className="text-[150px] mb-8 animate-bounce">🏆</div>
              <button 
                onClick={() => {
                  setLevelIndex(0);
                  saveProgress(0);
                  setGameState('start');
                }}
                className="bg-blue-500 hover:bg-blue-400 text-white text-4xl font-bold py-6 px-12 rounded-full shadow-[0_12px_0_rgb(29,78,212)] border-4 border-white active:scale-95 transition-transform"
              >
                Play Again!
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}