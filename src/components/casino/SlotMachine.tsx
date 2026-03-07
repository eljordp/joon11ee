'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import { currentJackpot } from './GlobalLeaderboard';
import BetControls from './BetControls';
import SpeedControl from './SpeedControl';

// ─── Symbols & Payouts ────────────────────────────────────────────────
const SYMBOLS = ['🏎️', '💎', '🔥', '💰', '⭐', '🍀', '👑', '🎰'];
const PAYOUTS: Record<string, { mult: number; name: string }> = {
  '🏎️': { mult: 69, name: 'LAMBO JACKPOT' },
  '💎': { mult: 42, name: 'DIAMOND HANDS' },
  '🔥': { mult: 25, name: 'FIRE TRIPLE' },
  '💰': { mult: 15, name: 'MONEY BAGS' },
  '⭐': { mult: 10, name: 'STAR POWER' },
  '🍀': { mult: 7, name: 'LUCKY STREAK' },
  '👑': { mult: 5, name: 'CROWN ROYAL' },
  '🎰': { mult: 3, name: 'SLOTS BABY' },
};

const REEL_SIZE = 20;
const LOSS_MESSAGES = [
  'no cap that was rough',
  'down bad fr',
  'the machine is hungry',
  'try again fam',
  'pain.',
  'not your spin',
  'L + ratio',
  'house always eats',
];

// ─── Odds (uniform 1/8 per symbol) ────────────────────────────────────
const TRIPLE_CHANCE = 1.56;  // ~1/64
const PAIR_CHANCE = 21.09;   // any 2 of 3 match (excl. triple)
const WIN_CHANCE = 22.66;    // triple + pair

function generateReelStrip(): string[] {
  const strip: string[] = [];
  for (let i = 0; i < REEL_SIZE; i++) {
    strip.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  }
  return strip;
}

interface Props {
  balance: number;
  onWin: (amount: number, wagered?: number) => void;
  onLose: (amount: number) => void;
}

export default function SlotMachine({ balance, onWin, onLose }: Props) {
  const [reelStrips, setReelStrips] = useState<string[][]>([
    generateReelStrip(), generateReelStrip(), generateReelStrip()
  ]);
  const [reelPositions, setReelPositions] = useState([0, 0, 0]);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [bet, setBet] = useState(100);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean; big?: boolean } | null>(null);
  const [streak, setStreak] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [autoSpin, setAutoSpin] = useState(false);
  const [totalSpins, setTotalSpins] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [jackpotDisplay, setJackpotDisplay] = useState(currentJackpot);
  const [showOdds, setShowOdds] = useState(false);
  const [nearMiss, setNearMiss] = useState(false);
  const [dramaticMode, setDramaticMode] = useState(false);
  const [lamboExplosion, setLamboExplosion] = useState<number | null>(null);
  const [streakBonus, setStreakBonus] = useState<{ streak: number; amount: number } | null>(null);
  const intervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const autoSpinRef = useRef(false);
  const betRef = useRef(bet);
  const balanceRef = useRef(balance);

  // Keep refs in sync
  useEffect(() => { betRef.current = bet; }, [bet]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  // Jackpot ticker — slowly counts up with small random increments
  // Resets to real value when server sends an update
  useEffect(() => {
    const ticker = setInterval(() => {
      setJackpotDisplay(prev => {
        const real = currentJackpot;
        // If server value jumped (jackpot won / reset), snap toward it
        if (real < prev - 500) return prev - Math.ceil((prev - real) * 0.15);
        // If server is ahead, catch up
        if (real > prev + 50) return prev + Math.ceil((real - prev) * 0.1);
        // Slow cosmetic rise: +$1-5 every 2-4 seconds
        return prev + Math.floor(Math.random() * 5) + 1;
      });
    }, 2500);
    return () => clearInterval(ticker);
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => intervals.current.forEach(clearInterval);
  }, []);

  const checkResult = useCallback((symbols: string[], currentBet: number) => {
    setTotalSpins(s => s + 1);
    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
      // TRIPLE
      const p = PAYOUTS[symbols[0]];
      const winAmount = currentBet * p.mult;
      if (p.mult >= 25) sounds.jackpot(); else sounds.win();
      onWin(winAmount, currentBet);
      setStreak(prev => {
        const s = prev + 1;
        // Streak bonuses
        if (s === 3 || s === 5 || s === 10) {
          const bonusMult = s === 10 ? 5 : s === 5 ? 3 : 1.5;
          const bonus = Math.floor(currentBet * bonusMult);
          onWin(bonus, 0);
          setStreakBonus({ streak: s, amount: bonus });
          setTimeout(() => setStreakBonus(null), 2500);
          sounds.jackpot();
        }
        return s;
      });
      setTotalWins(w => w + 1);
      setShaking(true);
      setTimeout(() => setShaking(false), p.mult >= 25 ? 1200 : 500);
      setResult({
        text: `+$${winAmount.toLocaleString()}`,
        sub: `${p.name} ${p.mult}x`,
        win: true,
        big: p.mult >= 15,
      });
    } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
      // PAIR
      const winAmount = Math.floor(currentBet * 2);
      sounds.win();
      onWin(winAmount, currentBet);
      setStreak(prev => {
        const s = prev + 1;
        if (s === 3 || s === 5 || s === 10) {
          const bonusMult = s === 10 ? 5 : s === 5 ? 3 : 1.5;
          const bonus = Math.floor(currentBet * bonusMult);
          onWin(bonus, 0);
          setStreakBonus({ streak: s, amount: bonus });
          setTimeout(() => setStreakBonus(null), 2500);
          sounds.jackpot();
        }
        return s;
      });
      setTotalWins(w => w + 1);
      setResult({ text: `+$${winAmount.toLocaleString()}`, sub: 'PAIR — 2x', win: true });
    } else {
      // LOSS
      sounds.lose();
      onLose(currentBet);
      setStreak(0);
      setResult({
        text: `-$${currentBet.toLocaleString()}`,
        sub: LOSS_MESSAGES[Math.floor(Math.random() * LOSS_MESSAGES.length)],
        win: false,
      });
    }
  }, [onWin, onLose]);

  const spin = useCallback(() => {
    if (spinning.some(Boolean) || balanceRef.current < betRef.current) {
      if (autoSpinRef.current) setAutoSpin(false);
      return;
    }
    const currentBet = betRef.current;
    sounds.spinStart();
    sounds.bet();
    setResult(null);
    setNearMiss(false);
    setDramaticMode(false);
    setLamboExplosion(null);
    setSpinning([true, true, true]);

    // Generate final symbols
    const finalSymbols = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    const newStrips = [0, 1, 2].map((i) => {
      const strip = generateReelStrip();
      strip[strip.length - 1] = finalSymbols[i];
      return strip;
    });
    setReelStrips(newStrips);

    // Detect outcome for dramatic effects
    const firstTwoMatch = finalSymbols[0] === finalSymbols[1];
    const isTriple = firstTwoMatch && finalSymbols[1] === finalSymbols[2];
    const isLambo = isTriple && finalSymbols[0] === '🏎️';

    const landReel2 = () => {
      sounds.reelStop();
      setReelPositions(prev => { const n = [...prev]; n[2] = REEL_SIZE - 1; return n; });
      setSpinning(prev => { const n = [...prev]; n[2] = false; return n; });
      setDramaticMode(false);
    };

    const finalize = () => {
      if (firstTwoMatch && !isTriple) {
        setNearMiss(true);
        setTimeout(() => setNearMiss(false), 800);
      }
      checkResult(finalSymbols, currentBet);
      // Auto-spin: stop on lambo, pause 3s on triple, normal otherwise
      if (isLambo) {
        if (autoSpinRef.current) setAutoSpin(false);
      } else if (isTriple && autoSpinRef.current) {
        setTimeout(() => { if (autoSpinRef.current) spin(); }, 3000);
      } else if (autoSpinRef.current) {
        setTimeout(() => spin(), 400 / speed);
      }
    };

    // ── Reels 0 & 1: normal ──
    [0, 1].forEach((i) => {
      let pos = 0;
      intervals.current[i] = setInterval(() => {
        pos++;
        if (pos % 4 === 0) sounds.slotTick();
        setReelPositions(prev => { const n = [...prev]; n[i] = pos % REEL_SIZE; return n; });
      }, (60 + i * 15) / speed);

      setTimeout(() => {
        clearInterval(intervals.current[i]);
        sounds.reelStop();
        setReelPositions(prev => { const n = [...prev]; n[i] = REEL_SIZE - 1; return n; });
        setSpinning(prev => { const n = [...prev]; n[i] = false; return n; });
      }, (800 + i * 400) / speed);
    });

    // ── Reel 2: start spinning ──
    let pos2 = 0;
    intervals.current[2] = setInterval(() => {
      pos2++;
      if (pos2 % 4 === 0) sounds.slotTick();
      setReelPositions(prev => { const n = [...prev]; n[2] = pos2 % REEL_SIZE; return n; });
    }, 90 / speed);

    if (isLambo) {
      // ═══ LAMBO 69x: hyper spin 5s → slowdown → explosion ═══
      setTimeout(() => {
        clearInterval(intervals.current[2]);
        setDramaticMode(true);
        let hPos = pos2;
        intervals.current[2] = setInterval(() => {
          hPos += 2;
          setReelPositions(prev => { const n = [...prev]; n[2] = hPos % REEL_SIZE; return n; });
        }, 25);
        setTimeout(() => {
          clearInterval(intervals.current[2]);
          let sPos = hPos;
          let d = 30;
          const slowTick = () => {
            sPos++;
            if (d > 100) sounds.slotTick();
            setReelPositions(prev => { const n = [...prev]; n[2] = sPos % REEL_SIZE; return n; });
            d *= 1.25;
            if (d >= 500) {
              landReel2();
              setLamboExplosion(currentBet * 69);
              setTimeout(finalize, 500);
              setTimeout(() => setLamboExplosion(null), 5000);
              return;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            intervals.current[2] = setTimeout(slowTick, d) as any;
          };
          slowTick();
        }, 5000);
      }, (800 + 400 + 300) / speed);

    } else if (firstTwoMatch) {
      // ═══ DRAMATIC SLOWDOWN: first 2 match → tension on reel 3 ═══
      setTimeout(() => {
        clearInterval(intervals.current[2]);
        setDramaticMode(true);
        let sPos = pos2;
        let d = 60;
        const slowTick = () => {
          sPos++;
          if (d > 80) sounds.slotTick();
          setReelPositions(prev => { const n = [...prev]; n[2] = sPos % REEL_SIZE; return n; });
          d *= 1.12;
          if (d >= 400) {
            setTimeout(() => { landReel2(); setTimeout(finalize, 150); }, 300);
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          intervals.current[2] = setTimeout(slowTick, d) as any;
        };
        slowTick();
      }, (800 + 400 + 300) / speed);

    } else {
      // ═══ NORMAL ═══
      setTimeout(() => {
        clearInterval(intervals.current[2]);
        landReel2();
        setTimeout(finalize, 150 / speed);
      }, (800 + 2 * 400) / speed);
    }
  }, [spinning, speed, checkResult]);

  // Auto-spin trigger
  useEffect(() => {
    if (autoSpin && !spinning.some(Boolean)) {
      const t = setTimeout(() => spin(), 300);
      return () => clearTimeout(t);
    }
  }, [autoSpin]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSpinning = spinning.some(Boolean);
  const winRate = totalSpins > 0 ? Math.round((totalWins / totalSpins) * 100) : 0;

  return (
    <motion.div
      animate={shaking ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
      transition={{ duration: 0.6 }}
      className="border border-white/[0.06] bg-zinc-950/50 relative overflow-hidden"
    >
      {/* Big win glow */}
      <AnimatePresence>
        {result?.big && result.win && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-green-500/10 via-transparent to-yellow-500/5 pointer-events-none z-0"
          />
        )}
      </AnimatePresence>

      {/* LAMBO 69x explosion overlay */}
      <AnimatePresence>
        {lamboExplosion !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/95" />
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: (Math.random() - 0.5) * 600,
                  y: (Math.random() - 0.5) * 600,
                  scale: [0, 2, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 2, delay: Math.random() * 0.5 }}
                className="absolute text-2xl"
              >
                {['🏎️', '💰', '🔥', '💎', '⭐'][i % 5]}
              </motion.div>
            ))}
            <div className="relative text-center z-10">
              <motion.p
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="text-8xl mb-6"
              >
                🏎️
              </motion.p>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-yellow-400 text-[12px] tracking-[0.5em] uppercase font-bold mb-3"
              >
                LAMBO JACKPOT
              </motion.p>
              <motion.p
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-white text-6xl font-black mb-2"
              >
                69x
              </motion.p>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-green-400 text-4xl font-black font-mono"
              >
                +${lamboExplosion.toLocaleString()}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progressive Jackpot ticker */}
      <div className="bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 text-center">
        <p className="text-yellow-500/60 text-[8px] tracking-[0.4em] uppercase font-bold mb-0.5">Progressive Jackpot</p>
        <div className="flex items-center justify-center gap-1">
          <span className="text-yellow-400 text-xl sm:text-2xl font-black font-mono tabular-nums">
            ${jackpotDisplay.toLocaleString()}
          </span>
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-yellow-500/50 text-[8px]"
          >
            ▲
          </motion.span>
        </div>
        <p className="text-zinc-600 text-[8px] mt-0.5">0.1% chance on any win</p>
      </div>

      <div className="p-5 sm:p-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-white">Slots</h3>
            {streak > 1 && (
              <motion.span
                key={streak}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`text-xs font-bold px-3 py-1 border ${
                  streak >= 5 ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' :
                  streak >= 3 ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                  'bg-red-600/20 border-red-600/30 text-red-400'
                }`}
              >
                {streak}x streak {streak >= 5 ? '🔥' : streak >= 3 ? '✨' : ''}
              </motion.span>
            )}
          </div>
          <SpeedControl speed={speed} setSpeed={setSpeed} disabled={isSpinning} />
        </div>

        {/* Reels with 3-row display */}
        <div className="relative">
          {/* Payline indicator */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-red-500/40 z-10 pointer-events-none" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-6 bg-red-500/60 -ml-1 z-10" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-6 bg-red-500/60 -mr-1 z-10" />

          {/* Near-miss flash */}
          <AnimatePresence>
            {nearMiss && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.3, 0, 0.3, 0] }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 bg-yellow-500/20 z-10 pointer-events-none"
              />
            )}
          </AnimatePresence>

          <div className="flex justify-center gap-2 sm:gap-3 mb-4">
            {[0, 1, 2].map((reelIndex) => (
              <div
                key={reelIndex}
                className={`relative w-24 sm:w-28 h-[216px] sm:h-[252px] border-2 overflow-hidden bg-black transition-colors duration-300 ${
                  dramaticMode && reelIndex === 2
                    ? 'border-yellow-500 shadow-[0_0_25px_rgba(234,179,8,0.3)] animate-pulse'
                    : result?.win && !isSpinning
                      ? result.big ? 'border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'border-green-500/40'
                      : 'border-white/10'
                }`}
              >
                {/* Fade edges */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent z-[5] pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent z-[5] pointer-events-none" />

                <div
                  style={{
                    transform: `translateY(-${reelPositions[reelIndex] * 72 - 72}px)`,
                    transition: spinning[reelIndex] ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1.2)',
                  }}
                >
                  {reelStrips[reelIndex].map((symbol, j) => (
                    <div key={j} className="w-full h-[72px] sm:h-[84px] flex items-center justify-center text-4xl sm:text-5xl select-none">
                      {symbol}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Result */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={result.text}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center mb-5"
            >
              <p className={`font-black ${
                result.big ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
              } ${result.win ? (result.big ? 'text-yellow-400' : 'text-green-400') : 'text-red-400'}`}>
                {result.text}
              </p>
              <p className={`text-xs mt-1 ${result.win ? (result.big ? 'text-yellow-500/70' : 'text-green-500/70') : 'text-zinc-600'}`}>
                {result.sub}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streak bonus overlay */}
        <AnimatePresence>
          {streakBonus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center mb-4 py-3 px-4 bg-gradient-to-r from-yellow-500/10 via-yellow-500/20 to-yellow-500/10 border border-yellow-500/30"
            >
              <p className="text-yellow-400 text-lg font-black">
                {streakBonus.streak}x STREAK BONUS
              </p>
              <p className="text-green-400 text-xl font-black font-mono">
                +${streakBonus.amount.toLocaleString()}
              </p>
              <p className="text-yellow-500/60 text-[9px] tracking-wider uppercase mt-1">
                {streakBonus.streak >= 10 ? 'LEGENDARY — 5x bet bonus' : streakBonus.streak >= 5 ? 'ON FIRE — 3x bet bonus' : 'HOT — 1.5x bet bonus'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session stats bar */}
        {totalSpins > 0 && (
          <div className="flex items-center gap-3 px-3 py-2 mb-4 bg-zinc-900/30 border border-white/[0.04] text-[10px] tracking-wider uppercase">
            <span className="text-zinc-600">Spins <span className="text-zinc-400 font-bold">{totalSpins}</span></span>
            <span className="text-zinc-600">Wins <span className="text-green-400 font-bold">{totalWins}</span></span>
            <span className="text-zinc-600">Rate <span className="text-white font-bold">{winRate}%</span></span>
          </div>
        )}

        {/* Bet controls */}
        <div className="mb-3">
          <BetControls balance={balance} bet={bet} setBet={setBet} disabled={isSpinning} />
        </div>

        {/* Spin + Auto */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { if (autoSpin) { setAutoSpin(false); } else { spin(); } }}
            disabled={(isSpinning && !autoSpin) || balance < bet}
            className={`flex-1 py-4 text-sm font-bold tracking-widest uppercase transition-all ${
              isSpinning
                ? 'bg-zinc-800 text-zinc-500'
                : 'bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)]'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {isSpinning ? 'spinning...' : 'SPIN'}
          </button>
          <button
            onClick={() => {
              if (autoSpin) {
                setAutoSpin(false);
              } else {
                setAutoSpin(true);
                if (!isSpinning) spin();
              }
            }}
            disabled={balance < bet && !autoSpin}
            className={`px-4 py-4 text-xs font-bold tracking-widest uppercase transition-all border ${
              autoSpin
                ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                : 'border-white/10 text-zinc-500 hover:text-white hover:border-white/20'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {autoSpin ? 'STOP' : 'AUTO'}
          </button>
        </div>

        {/* Win odds toggle */}
        <button
          onClick={() => setShowOdds(!showOdds)}
          className="w-full text-center text-zinc-600 text-[10px] tracking-wider uppercase hover:text-zinc-400 transition-colors py-1 mb-2"
        >
          {showOdds ? 'Hide' : 'Show'} Odds & Paytable
        </button>

        {/* Paytable + Odds */}
        <AnimatePresence>
          {showOdds && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Win probability */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="border border-green-500/10 bg-green-500/5 py-2 px-2">
                  <p className="text-green-400 text-sm font-bold font-mono">{WIN_CHANCE}%</p>
                  <p className="text-zinc-600 text-[9px] tracking-wider uppercase mt-0.5">Any Win</p>
                </div>
                <div className="border border-yellow-500/10 bg-yellow-500/5 py-2 px-2">
                  <p className="text-yellow-400 text-sm font-bold font-mono">{PAIR_CHANCE}%</p>
                  <p className="text-zinc-600 text-[9px] tracking-wider uppercase mt-0.5">Pair 2x</p>
                </div>
                <div className="border border-red-500/10 bg-red-500/5 py-2 px-2">
                  <p className="text-red-400 text-sm font-bold font-mono">{TRIPLE_CHANCE}%</p>
                  <p className="text-zinc-600 text-[9px] tracking-wider uppercase mt-0.5">Triple 3-69x</p>
                </div>
              </div>

              {/* Symbol payouts */}
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                {Object.entries(PAYOUTS).map(([symbol, { mult, name }]) => (
                  <div key={symbol} className="border border-white/[0.04] bg-white/[0.01] py-2 group hover:border-white/10 transition-colors">
                    <span className="text-xl">{symbol}</span>
                    <p className="text-white font-bold text-[11px] mt-0.5">{mult}x</p>
                    <p className="text-zinc-700 text-[8px] tracking-wider uppercase">{name}</p>
                  </div>
                ))}
              </div>

              <p className="text-zinc-700 text-[9px] text-center mt-2">
                Any 2 matching = 2x · 3 matching = shown multiplier · House edge ~0%
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
