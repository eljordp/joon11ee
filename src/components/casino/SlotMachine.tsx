'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SLOT_SYMBOLS, SLOT_PAYOUTS } from '@/lib/casino';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
}

export default function SlotMachine({ balance, onWin, onLose }: Props) {
  const [reels, setReels] = useState(['🏎️', '🏎️', '🏎️']);
  const [spinning, setSpinning] = useState(false);
  const [bet, setBet] = useState(100);
  const [result, setResult] = useState<{ text: string; win: boolean } | null>(null);
  const [intermediateReels, setIntermediateReels] = useState<string[][]>([[], [], []]);

  const spin = useCallback(() => {
    if (spinning || balance < bet) return;
    setResult(null);
    setSpinning(true);

    // Animate intermediate symbols
    const intervals = [0, 1, 2].map((i) => {
      const frames: string[] = [];
      const count = 10 + i * 5;
      for (let j = 0; j < count; j++) {
        frames.push(SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
      }
      return frames;
    });
    setIntermediateReels(intervals);

    // Final results
    const finalReels = [0, 1, 2].map(() =>
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
    );

    // Staggered stop
    const delays = [600, 1000, 1400];
    const newReels = [...reels];

    delays.forEach((delay, i) => {
      setTimeout(() => {
        newReels[i] = finalReels[i];
        setReels([...newReels]);
        if (i === 2) {
          // Check win
          if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
            const multiplier = SLOT_PAYOUTS[finalReels[0]] || 2;
            const winAmount = bet * multiplier;
            onWin(winAmount);
            setResult({ text: `JACKPOT! +$${winAmount.toLocaleString()}`, win: true });
          } else if (finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2]) {
            const winAmount = Math.floor(bet * 1.5);
            onWin(winAmount);
            setResult({ text: `PAIR! +$${winAmount.toLocaleString()}`, win: true });
          } else {
            onLose(bet);
            setResult({ text: `-$${bet.toLocaleString()}`, win: false });
          }
          setSpinning(false);
        }
      }, delay);
    });
  }, [spinning, balance, bet, reels, onWin, onLose]);

  return (
    <div className="border border-white/[0.06] p-6 sm:p-8">
      <h3 className="text-xl font-bold text-white mb-6 text-center">Slots</h3>

      {/* Reels */}
      <div className="flex justify-center gap-3 mb-6">
        {reels.map((symbol, i) => (
          <div
            key={i}
            className="w-24 h-28 border-2 border-white/10 bg-black flex items-center justify-center overflow-hidden relative"
          >
            {spinning && intermediateReels[i]?.length > 0 ? (
              <motion.div
                key={`spin-${i}`}
                animate={{ y: [0, -40, 0, 40, 0] }}
                transition={{ repeat: Infinity, duration: 0.15, ease: 'linear' }}
                className="text-4xl"
              >
                {SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]}
              </motion.div>
            ) : (
              <motion.span
                key={`${symbol}-${i}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl"
              >
                {symbol}
              </motion.span>
            )}
          </div>
        ))}
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`text-center mb-6 text-lg font-bold ${result.win ? 'text-green-400' : 'text-red-400'}`}
          >
            {result.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet controls */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <span className="text-zinc-500 text-xs tracking-wider uppercase">Bet</span>
        {[50, 100, 250, 500, 1000].map((amount) => (
          <button
            key={amount}
            onClick={() => !spinning && setBet(amount)}
            className={`px-3 py-1.5 text-xs font-bold transition-all ${
              bet === amount
                ? 'bg-red-600 text-white'
                : 'border border-white/10 text-zinc-500 hover:text-white'
            }`}
          >
            ${amount}
          </button>
        ))}
      </div>

      {/* Spin button */}
      <button
        onClick={spin}
        disabled={spinning || balance < bet}
        className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {spinning ? 'SPINNING...' : 'SPIN'}
      </button>

      {/* Paytable */}
      <div className="mt-6 grid grid-cols-4 gap-2 text-center text-xs">
        {Object.entries(SLOT_PAYOUTS).slice(0, 4).map(([symbol, mult]) => (
          <div key={symbol} className="border border-white/[0.04] p-2">
            <span className="text-lg">{symbol}</span>
            <p className="text-zinc-500 mt-1">×{mult}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
