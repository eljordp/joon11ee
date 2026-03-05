'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROULETTE_NUMBERS } from '@/lib/casino';

type BetType = 'red' | 'black' | 'green' | 'odd' | 'even' | 'low' | 'high';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
}

const BET_OPTIONS: { type: BetType; label: string; payout: number; color: string }[] = [
  { type: 'red', label: 'Red', payout: 2, color: 'bg-red-600' },
  { type: 'black', label: 'Black', payout: 2, color: 'bg-zinc-800' },
  { type: 'green', label: '0', payout: 14, color: 'bg-green-600' },
  { type: 'odd', label: 'Odd', payout: 2, color: 'border border-white/20' },
  { type: 'even', label: 'Even', payout: 2, color: 'border border-white/20' },
  { type: 'low', label: '1-18', payout: 2, color: 'border border-white/20' },
  { type: 'high', label: '19-36', payout: 2, color: 'border border-white/20' },
];

export default function Roulette({ balance, onWin, onLose }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [bet, setBet] = useState(100);
  const [betType, setBetType] = useState<BetType>('red');
  const [landedNumber, setLandedNumber] = useState<typeof ROULETTE_NUMBERS[0] | null>(null);
  const [result, setResult] = useState<{ text: string; win: boolean } | null>(null);
  const [rotation, setRotation] = useState(0);

  const spin = useCallback(() => {
    if (spinning || balance < bet) return;
    setResult(null);
    setSpinning(true);

    const winnerIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
    const winner = ROULETTE_NUMBERS[winnerIndex];

    // Spin animation
    const spins = 3 + Math.random() * 2;
    const targetRotation = rotation + spins * 360 + (winnerIndex / ROULETTE_NUMBERS.length) * 360;
    setRotation(targetRotation);

    setTimeout(() => {
      setLandedNumber(winner);

      // Check win
      let won = false;
      if (betType === 'red' && winner.color === 'red') won = true;
      if (betType === 'black' && winner.color === 'black') won = true;
      if (betType === 'green' && winner.num === 0) won = true;
      if (betType === 'odd' && winner.num > 0 && winner.num % 2 === 1) won = true;
      if (betType === 'even' && winner.num > 0 && winner.num % 2 === 0) won = true;
      if (betType === 'low' && winner.num >= 1 && winner.num <= 18) won = true;
      if (betType === 'high' && winner.num >= 19 && winner.num <= 36) won = true;

      const option = BET_OPTIONS.find((o) => o.type === betType)!;

      if (won) {
        const winAmount = bet * option.payout;
        onWin(winAmount);
        setResult({ text: `WIN! +$${winAmount.toLocaleString()}`, win: true });
      } else {
        onLose(bet);
        setResult({ text: `-$${bet.toLocaleString()}`, win: false });
      }
      setSpinning(false);
    }, 3000);
  }, [spinning, balance, bet, betType, rotation, onWin, onLose]);

  return (
    <div className="border border-white/[0.06] p-6 sm:p-8">
      <h3 className="text-xl font-bold text-white mb-6 text-center">Roulette</h3>

      {/* Wheel visual */}
      <div className="relative w-48 h-48 mx-auto mb-6">
        {/* Pointer */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[16px] border-l-transparent border-r-transparent border-t-red-600" />

        <motion.div
          animate={{ rotate: rotation }}
          transition={{ duration: 3, ease: [0.15, 0.85, 0.35, 1] }}
          className="w-full h-full rounded-full border-2 border-white/20 relative overflow-hidden"
        >
          {ROULETTE_NUMBERS.map((n, i) => {
            const angle = (i / ROULETTE_NUMBERS.length) * 360;
            const bg = n.color === 'red' ? '#DC2626' : n.color === 'black' ? '#18181b' : '#16a34a';
            return (
              <div
                key={n.num}
                className="absolute top-0 left-1/2 h-1/2 origin-bottom"
                style={{
                  transform: `rotate(${angle}deg) translateX(-50%)`,
                  width: `${(1 / ROULETTE_NUMBERS.length) * 100 * 3.14}%`,
                }}
              >
                <div className="w-full h-full" style={{ backgroundColor: bg }}>
                  <span className="text-white text-[6px] font-bold block text-center pt-1">
                    {n.num}
                  </span>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Landed number */}
      <AnimatePresence>
        {landedNumber && !spinning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center mb-4"
          >
            <span className={`inline-flex items-center justify-center w-12 h-12 text-lg font-bold text-white ${
              landedNumber.color === 'red' ? 'bg-red-600' : landedNumber.color === 'green' ? 'bg-green-600' : 'bg-zinc-800 border border-white/20'
            }`}>
              {landedNumber.num}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`text-center mb-4 text-lg font-bold ${result.win ? 'text-green-400' : 'text-red-400'}`}
          >
            {result.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet type */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
        {BET_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => !spinning && setBetType(option.type)}
            className={`px-2 py-2 text-xs font-bold transition-all text-center ${option.color} ${
              betType === option.type ? 'ring-2 ring-white/40 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Bet amount */}
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

      {/* Spin */}
      <button
        onClick={spin}
        disabled={spinning || balance < bet}
        className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {spinning ? 'SPINNING...' : 'PLACE BET'}
      </button>
    </div>
  );
}
