'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROULETTE_NUMBERS } from '@/lib/casino';
import { sounds } from '@/lib/sounds';
import BetControls from './BetControls';
import SpeedControl from './SpeedControl';

type BetType = 'red' | 'black' | 'green' | 'odd' | 'even' | 'low' | 'high';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
}

const BETS: { type: BetType; label: string; payout: number; emoji: string; bg: string }[] = [
  { type: 'red', label: 'Red', payout: 2, emoji: '🔴', bg: 'bg-red-600 hover:bg-red-500' },
  { type: 'black', label: 'Black', payout: 2, emoji: '⚫', bg: 'bg-zinc-800 hover:bg-zinc-700 border border-white/10' },
  { type: 'green', label: '0', payout: 14, emoji: '💚', bg: 'bg-green-600 hover:bg-green-500' },
  { type: 'odd', label: 'Odd', payout: 2, emoji: '🤪', bg: 'border border-white/10 hover:bg-white/5' },
  { type: 'even', label: 'Even', payout: 2, emoji: '😌', bg: 'border border-white/10 hover:bg-white/5' },
  { type: 'low', label: '1-18', payout: 2, emoji: '⬇️', bg: 'border border-white/10 hover:bg-white/5' },
  { type: 'high', label: '19-36', payout: 2, emoji: '⬆️', bg: 'border border-white/10 hover:bg-white/5' },
];

type HistoryEntry = { num: number; color: string };

export default function Roulette({ balance, onWin, onLose }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [bet, setBet] = useState(100);
  const [betType, setBetType] = useState<BetType>('red');
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ballPosition, setBallPosition] = useState(0);
  const [landedNumber, setLandedNumber] = useState<HistoryEntry | null>(null);
  const [gameSpeed, setGameSpeed] = useState(1);

  const spin = useCallback(() => {
    if (spinning || balance < bet) return;
    sounds.bet();
    sounds.spinStart();
    setResult(null);
    setLandedNumber(null);
    setSpinning(true);

    const winnerIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
    const winner = ROULETTE_NUMBERS[winnerIndex];

    // Animate ball bouncing through numbers
    let pos = 0;
    const totalSteps = Math.floor((30 + Math.floor(Math.random() * 20)) / gameSpeed);
    let animSpeed = 40 / gameSpeed;

    const animate = () => {
      pos++;
      sounds.ballBounce();
      setBallPosition(pos % ROULETTE_NUMBERS.length);

      if (pos >= totalSteps) {
        // Land on winner
        sounds.ballLand();
        setBallPosition(winnerIndex);
        setLandedNumber({ num: winner.num, color: winner.color });
        setHistory((h) => [{ num: winner.num, color: winner.color }, ...h.slice(0, 19)]);

        // Check win
        let won = false;
        if (betType === 'red' && winner.color === 'red') won = true;
        if (betType === 'black' && winner.color === 'black') won = true;
        if (betType === 'green' && winner.num === 0) won = true;
        if (betType === 'odd' && winner.num > 0 && winner.num % 2 === 1) won = true;
        if (betType === 'even' && winner.num > 0 && winner.num % 2 === 0) won = true;
        if (betType === 'low' && winner.num >= 1 && winner.num <= 18) won = true;
        if (betType === 'high' && winner.num >= 19 && winner.num <= 36) won = true;

        const option = BETS.find((o) => o.type === betType)!;

        if (won) {
          const winAmount = bet * option.payout;
          if (betType === 'green') sounds.jackpot(); else sounds.win();
          onWin(winAmount);
          setResult({
            text: `+$${winAmount.toLocaleString()}`,
            sub: betType === 'green' ? 'GREEN HIT 14x 🤑' : `${option.label} wins ${option.emoji}`,
            win: true,
          });
        } else {
          sounds.lose();
          onLose(bet);
          setResult({
            text: `-$${bet.toLocaleString()}`,
            sub: winner.color === 'green' ? 'green said nah 💀' : 'L + ratio',
            win: false,
          });
        }
        setSpinning(false);
        return;
      }

      // Slow down near end
      if (pos > totalSteps - 10) {
        animSpeed += 30 / gameSpeed;
      }
      setTimeout(animate, animSpeed);
    };

    animate();
  }, [spinning, balance, bet, betType, gameSpeed, onWin, onLose]);

  const currentNum = ROULETTE_NUMBERS[ballPosition];

  return (
    <div className="border border-white/[0.06] bg-zinc-950/50 p-6 sm:p-8 relative overflow-hidden">
      {result?.win && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h3 className="text-xl font-bold text-white">Roulette</h3>
        <div className="flex items-center gap-3">
          <SpeedControl speed={gameSpeed} setSpeed={setGameSpeed} disabled={spinning} />
          {history.length > 0 && (
            <span className="text-zinc-600 text-xs">{history.length} spins</span>
          )}
        </div>
      </div>

      {/* Number display - big animated ball */}
      <div className="flex items-center justify-center mb-6">
        <motion.div
          key={ballPosition}
          initial={spinning ? { scale: 0.8, opacity: 0.5 } : { scale: 1.3 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: spinning ? 0.05 : 0.4, ease: spinning ? 'linear' : [0.2, 0.8, 0.2, 1.2] }}
          className={`w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center text-4xl sm:text-5xl font-black text-white ${
            currentNum?.color === 'red' ? 'bg-red-600' : currentNum?.color === 'green' ? 'bg-green-600' : 'bg-zinc-800 border-2 border-white/20'
          } ${spinning ? '' : 'shadow-[0_0_40px_rgba(220,38,38,0.2)]'}`}
        >
          {spinning ? currentNum?.num ?? 0 : landedNumber ? landedNumber.num : '?'}
        </motion.div>
      </div>

      {/* History trail */}
      {history.length > 0 && (
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-2 scrollbar-thin">
          {history.map((h, i) => (
            <motion.div
              key={`${h.num}-${i}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: i === 0 ? 1 : 0.5 + (1 - i / history.length) * 0.5 }}
              className={`w-8 h-8 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ${
                h.color === 'red' ? 'bg-red-600' : h.color === 'green' ? 'bg-green-600' : 'bg-zinc-800 border border-white/10'
              }`}
            >
              {h.num}
            </motion.div>
          ))}
        </div>
      )}

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
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

      {/* Bet type selector */}
      <div className="flex sm:grid sm:grid-cols-7 gap-1.5 sm:gap-2 mb-4 overflow-x-auto pb-1 sm:pb-0 -mx-6 px-6 sm:mx-0 sm:px-0 scrollbar-thin">
        {BETS.map((option) => (
          <button
            key={option.type}
            onClick={() => { if (!spinning) { sounds.click(); setBetType(option.type); } }}
            className={`flex-shrink-0 px-2.5 sm:px-2 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold transition-all text-center ${option.bg} ${
              betType === option.type ? 'ring-2 ring-white/50 text-white scale-105' : 'text-zinc-300'
            }`}
          >
            <span className="block text-sm sm:text-base mb-0.5">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>

      {/* Bet amount */}
      <div className="mb-4">
        <BetControls balance={balance} bet={bet} setBet={setBet} disabled={spinning} />
      </div>

      <button
        onClick={spin}
        disabled={spinning || balance < bet}
        className={`w-full py-4 text-sm font-bold tracking-widest uppercase transition-all ${
          spinning
            ? 'bg-zinc-800 text-zinc-500'
            : 'bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)]'
        } disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        {spinning ? 'ball is rolling...' : 'SPIN 🎯'}
      </button>
    </div>
  );
}
