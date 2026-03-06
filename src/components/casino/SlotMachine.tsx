'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import BetControls from './BetControls';
import SpeedControl from './SpeedControl';

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
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean } | null>(null);
  const [streak, setStreak] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervals = useRef<ReturnType<typeof setInterval>[]>([]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => intervals.current.forEach(clearInterval);
  }, []);

  const spin = useCallback(() => {
    if (spinning.some(Boolean) || balance < bet) return;
    sounds.spinStart();
    sounds.bet();
    setResult(null);
    setSpinning([true, true, true]);

    // Generate new strips with final symbols
    const finalSymbols = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    const newStrips = [0, 1, 2].map((i) => {
      const strip = generateReelStrip();
      strip[strip.length - 1] = finalSymbols[i];
      return strip;
    });
    setReelStrips(newStrips);

    // Animate each reel
    [0, 1, 2].forEach((i) => {
      let pos = 0;
      intervals.current[i] = setInterval(() => {
        pos++;
        if (pos % 3 === 0) sounds.slotTick();
        setReelPositions((prev) => {
          const next = [...prev];
          next[i] = pos % REEL_SIZE;
          return next;
        });
      }, (60 + i * 15) / speed);

      // Stop reel
      setTimeout(() => {
        clearInterval(intervals.current[i]);
        sounds.reelStop();
        setReelPositions((prev) => {
          const next = [...prev];
          next[i] = REEL_SIZE - 1;
          return next;
        });
        setSpinning((prev) => {
          const next = [...prev];
          next[i] = false;
          return next;
        });

        // Last reel stopped
        if (i === 2) {
          setTimeout(() => checkResult(finalSymbols), 150 / speed);
        }
      }, (800 + i * 400) / speed);
    });
  }, [spinning, balance, bet]);

  const checkResult = (symbols: string[]) => {
    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
      const p = PAYOUTS[symbols[0]];
      const winAmount = bet * p.mult;
      sounds.jackpot();
      onWin(winAmount, bet);
      setStreak((s) => s + 1);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setResult({
        text: `+$${winAmount.toLocaleString()}`,
        sub: `${p.name} ${p.mult}x`,
        win: true,
      });
    } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
      const winAmount = Math.floor(bet * 2);
      sounds.win();
      onWin(winAmount, bet);
      setStreak((s) => s + 1);
      setResult({ text: `+$${winAmount.toLocaleString()}`, sub: 'PAIR — 2x', win: true });
    } else {
      sounds.lose();
      onLose(bet);
      setStreak(0);
      setResult({ text: `-$${bet.toLocaleString()}`, sub: 'no cap that was rough', win: false });
    }
  };

  const isSpinning = spinning.some(Boolean);

  return (
    <motion.div
      animate={shaking ? { x: [0, -5, 5, -5, 5, 0] } : {}}
      transition={{ duration: 0.4 }}
      className="border border-white/[0.06] bg-zinc-950/50 p-6 sm:p-8 relative overflow-hidden"
    >
      {/* Glow on win */}
      {result?.win && (
        <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h3 className="text-xl font-bold text-white">Slots</h3>
        <div className="flex items-center gap-3">
          <SpeedControl speed={speed} setSpeed={setSpeed} disabled={isSpinning} />
          {streak > 1 && (
            <motion.span
              key={streak}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold px-3 py-1 bg-red-600/20 border border-red-600/30 text-red-400"
            >
              {streak} streak 🔥
            </motion.span>
          )}
        </div>
      </div>

      {/* Reels */}
      <div className="flex justify-center gap-2 sm:gap-4 mb-4">
        {[0, 1, 2].map((reelIndex) => (
          <div key={reelIndex} className="relative w-24 sm:w-28 h-24 sm:h-28 border-2 border-white/10 bg-black overflow-hidden">
            {/* Win glow */}
            {result?.win && !isSpinning && (
              <div className="absolute inset-0 border-2 border-green-500/50 z-10 pointer-events-none" />
            )}
            <div
              className="transition-transform"
              style={{
                transform: `translateY(-${reelPositions[reelIndex] * 96}px)`,
                transition: spinning[reelIndex] ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2)',
              }}
            >
              {reelStrips[reelIndex].map((symbol, j) => (
                <div key={j} className="w-full h-24 sm:h-28 flex items-center justify-center text-5xl sm:text-6xl">
                  {symbol}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.text}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center mb-6"
          >
            <p className={`text-2xl sm:text-3xl font-black ${result.win ? 'text-green-400' : 'text-red-400'}`}>
              {result.text}
            </p>
            <p className={`text-xs mt-1 ${result.win ? 'text-green-500/70' : 'text-zinc-600'}`}>
              {result.sub}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet controls */}
      <div className="mb-4">
        <BetControls balance={balance} bet={bet} setBet={setBet} disabled={isSpinning} />
      </div>

      <button
        onClick={spin}
        disabled={isSpinning || balance < bet}
        className={`w-full py-4 text-sm font-bold tracking-widest uppercase transition-all ${
          isSpinning
            ? 'bg-zinc-800 text-zinc-500'
            : 'bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)]'
        } disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        {isSpinning ? 'spinning fr fr...' : 'SPIN 🎰'}
      </button>

      {/* Paytable */}
      <div className="mt-6 grid grid-cols-4 gap-1.5 text-center text-xs">
        {Object.entries(PAYOUTS).map(([symbol, { mult }]) => (
          <div key={symbol} className="border border-white/[0.04] bg-white/[0.01] py-2">
            <span className="text-xl">{symbol}</span>
            <p className="text-zinc-500 text-[10px] mt-0.5">{mult}x</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
