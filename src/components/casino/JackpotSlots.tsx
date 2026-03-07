'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import BetControls from './BetControls';

// ─── 5-Reel, 4-tier jackpot machine ──────────────────────────────────
// Inspired by Cache Creek style progressive machines
// Mini / Minor / Major / Grand jackpots

const SYMBOLS = ['💎', '7️⃣', '🔔', '🍒', '🍋', '⭐', '🍀', 'BAR'];
const SYMBOL_WEIGHTS = [3, 5, 8, 12, 14, 10, 10, 8]; // weighted probability
const TOTAL_WEIGHT = SYMBOL_WEIGHTS.reduce((a, b) => a + b, 0);

function weightedPick(): string {
  let r = Math.floor(Math.random() * TOTAL_WEIGHT);
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= SYMBOL_WEIGHTS[i];
    if (r < 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

// Payouts for 5-of-a-kind, 4-of-a-kind, 3-of-a-kind
const PAYOUTS_5: Record<string, number> = {
  '💎': 500, '7️⃣': 200, '🔔': 100, '🍒': 50, '🍋': 30, '⭐': 40, '🍀': 35, 'BAR': 25,
};
const PAYOUTS_4: Record<string, number> = {
  '💎': 50, '7️⃣': 25, '🔔': 15, '🍒': 8, '🍋': 5, '⭐': 6, '🍀': 5, 'BAR': 4,
};
const PAYOUTS_3: Record<string, number> = {
  '💎': 10, '7️⃣': 5, '🔔': 3, '🍒': 2, '🍋': 1, '⭐': 2, '🍀': 1, 'BAR': 1,
};

// Jackpot tiers
interface JackpotTier {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  seedAmount: number;
  growthRate: number; // % of bet added per spin
  triggerChance: number; // chance per spin to trigger
}

const JACKPOT_TIERS: JackpotTier[] = [
  { name: 'GRAND', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', seedAmount: 50000, growthRate: 0.005, triggerChance: 0.0001 },
  { name: 'MAJOR', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', seedAmount: 10000, growthRate: 0.01, triggerChance: 0.0005 },
  { name: 'MINOR', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', seedAmount: 2500, growthRate: 0.02, triggerChance: 0.002 },
  { name: 'MINI', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', seedAmount: 500, growthRate: 0.05, triggerChance: 0.01 },
];

const REEL_COUNT = 5;
const REEL_SIZE = 20;
const LS_KEY = 'joon11ee_jackpot_pools';

function loadPools(): number[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return JACKPOT_TIERS.map(t => t.seedAmount);
}

function savePools(pools: number[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(pools));
}

function generateReelStrip(): string[] {
  return Array.from({ length: REEL_SIZE }, () => weightedPick());
}

interface Props {
  balance: number;
  onWin: (amount: number, wagered?: number) => void;
  onLose: (amount: number) => void;
}

export default function JackpotSlots({ balance, onWin, onLose }: Props) {
  const [reelStrips, setReelStrips] = useState<string[][]>(
    Array.from({ length: REEL_COUNT }, () => generateReelStrip())
  );
  const [reelPositions, setReelPositions] = useState(Array(REEL_COUNT).fill(0));
  const [spinning, setSpinning] = useState(Array(REEL_COUNT).fill(false));
  const [bet, setBet] = useState(100);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean; big?: boolean } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [pools, setPools] = useState<number[]>(loadPools);
  const [jackpotWin, setJackpotWin] = useState<{ tier: number; amount: number } | null>(null);
  const [totalSpins, setTotalSpins] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [showPaytable, setShowPaytable] = useState(false);
  const intervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const betRef = useRef(bet);
  const balanceRef = useRef(balance);

  useEffect(() => { betRef.current = bet; }, [bet]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  // Cosmetic pool ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setPools(prev => prev.map((p, i) => {
        const growth = JACKPOT_TIERS[i].growthRate;
        // Random small increment
        if (Math.random() < 0.4) return p + Math.floor(Math.random() * p * growth * 0.01) + 1;
        return p;
      }));
    }, 3000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    return () => intervals.current.forEach(clearInterval);
  }, []);

  const checkResult = useCallback((symbols: string[], currentBet: number) => {
    setTotalSpins(s => s + 1);

    // Count matches (most frequent symbol across 5 reels)
    const counts: Record<string, number> = {};
    for (const s of symbols) counts[s] = (counts[s] || 0) + 1;
    const bestSymbol = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const matchCount = bestSymbol[1];
    const matchSymbol = bestSymbol[0];

    let winAmount = 0;
    let sub = '';
    let big = false;

    if (matchCount === 5) {
      // 5 of a kind
      const mult = PAYOUTS_5[matchSymbol] || 25;
      winAmount = currentBet * mult;
      sub = `5x ${matchSymbol} — ${mult}x`;
      big = true;
    } else if (matchCount === 4) {
      // 4 of a kind
      const mult = PAYOUTS_4[matchSymbol] || 4;
      winAmount = currentBet * mult;
      sub = `4x ${matchSymbol} — ${mult}x`;
      big = mult >= 25;
    } else if (matchCount === 3) {
      // 3 of a kind
      const mult = PAYOUTS_3[matchSymbol] || 1;
      winAmount = currentBet * mult;
      sub = `3x ${matchSymbol} — ${mult}x`;
    }

    // Check for jackpot trigger (only on wins)
    if (winAmount > 0) {
      for (let i = 0; i < JACKPOT_TIERS.length; i++) {
        if (Math.random() < JACKPOT_TIERS[i].triggerChance) {
          const jackpotAmount = Math.floor(pools[i]);
          winAmount += jackpotAmount;
          setJackpotWin({ tier: i, amount: jackpotAmount });
          setTimeout(() => setJackpotWin(null), 4000);
          // Reset pool
          setPools(prev => {
            const next = [...prev];
            next[i] = JACKPOT_TIERS[i].seedAmount;
            savePools(next);
            return next;
          });
          sounds.jackpot();
          big = true;
          sub += ` + ${JACKPOT_TIERS[i].name} JACKPOT!`;
          break; // Only one jackpot per spin
        }
      }
    }

    if (winAmount > 0) {
      if (big) sounds.jackpot(); else sounds.win();
      onWin(winAmount, currentBet);
      setTotalWins(w => w + 1);
      if (big) { setShaking(true); setTimeout(() => setShaking(false), 1000); }
      setResult({ text: `+$${winAmount.toLocaleString()}`, sub, win: true, big });
    } else {
      sounds.lose();
      onLose(currentBet);
      setResult({ text: `-$${currentBet.toLocaleString()}`, sub: 'no matches', win: false });
    }

    // Grow pools from this bet
    setPools(prev => {
      const next = prev.map((p, i) => p + Math.floor(currentBet * JACKPOT_TIERS[i].growthRate));
      savePools(next);
      return next;
    });
  }, [onWin, onLose, pools]);

  const spin = useCallback(() => {
    if (spinning.some(Boolean) || balanceRef.current < betRef.current) return;
    const currentBet = betRef.current;
    sounds.spinStart();
    sounds.bet();
    setResult(null);
    setJackpotWin(null);
    setSpinning(Array(REEL_COUNT).fill(true));

    const finalSymbols = Array.from({ length: REEL_COUNT }, () => weightedPick());
    const newStrips = Array.from({ length: REEL_COUNT }, (_, i) => {
      const strip = generateReelStrip();
      strip[strip.length - 1] = finalSymbols[i];
      return strip;
    });
    setReelStrips(newStrips);

    Array.from({ length: REEL_COUNT }, (_, i) => i).forEach((i) => {
      let pos = 0;
      intervals.current[i] = setInterval(() => {
        pos++;
        if (pos % 4 === 0 && i === 0) sounds.slotTick();
        setReelPositions(prev => {
          const next = [...prev];
          next[i] = pos % REEL_SIZE;
          return next;
        });
      }, (50 + i * 10));

      setTimeout(() => {
        clearInterval(intervals.current[i]);
        sounds.reelStop();
        setReelPositions(prev => {
          const next = [...prev];
          next[i] = REEL_SIZE - 1;
          return next;
        });
        setSpinning(prev => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
        if (i === REEL_COUNT - 1) {
          setTimeout(() => checkResult(finalSymbols, currentBet), 200);
        }
      }, 600 + i * 350);
    });
  }, [spinning, checkResult]);

  const isSpinning = spinning.some(Boolean);
  const winRate = totalSpins > 0 ? Math.round((totalWins / totalSpins) * 100) : 0;

  return (
    <motion.div
      animate={shaking ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
      transition={{ duration: 0.6 }}
      className="border border-white/[0.06] bg-zinc-950/50 relative overflow-hidden"
    >
      {/* Jackpot win overlay */}
      <AnimatePresence>
        {jackpotWin && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="text-center">
              <motion.p
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className={`text-5xl font-black ${JACKPOT_TIERS[jackpotWin.tier].color}`}
              >
                {JACKPOT_TIERS[jackpotWin.tier].name}
              </motion.p>
              <p className="text-yellow-400 text-[10px] tracking-[0.5em] uppercase font-bold mt-2 mb-3">JACKPOT</p>
              <p className="text-green-400 text-4xl font-black font-mono">+${jackpotWin.amount.toLocaleString()}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tiered Jackpot displays */}
      <div className="grid grid-cols-4 border-b border-white/[0.04]">
        {JACKPOT_TIERS.map((tier, i) => (
          <div key={tier.name} className={`${tier.bgColor} border-r last:border-r-0 ${tier.borderColor} px-2 py-2.5 text-center`}>
            <p className={`${tier.color} text-[8px] sm:text-[9px] tracking-[0.2em] uppercase font-bold`}>{tier.name}</p>
            <p className={`${tier.color} text-xs sm:text-sm font-black font-mono tabular-nums`}>
              ${Math.floor(pools[i]).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="p-5 sm:p-8 relative z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-white">Jackpot Slots</h3>
          <span className="text-zinc-600 text-[10px] tracking-wider uppercase">5 reels</span>
        </div>

        {/* 5 Reels */}
        <div className="relative mb-4">
          {/* Payline */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-yellow-500/30 z-10 pointer-events-none" />

          <div className="flex justify-center gap-1 sm:gap-2">
            {Array.from({ length: REEL_COUNT }, (_, reelIndex) => (
              <div
                key={reelIndex}
                className={`relative w-[56px] sm:w-[68px] h-[168px] sm:h-[204px] border-2 overflow-hidden bg-black transition-colors duration-300 ${
                  result?.win && !isSpinning
                    ? result.big ? 'border-yellow-500/60 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border-green-500/40'
                    : 'border-white/10'
                }`}
              >
                <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/80 to-transparent z-[5] pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/80 to-transparent z-[5] pointer-events-none" />
                <div
                  style={{
                    transform: `translateY(-${reelPositions[reelIndex] * 56 - 56}px)`,
                    transition: spinning[reelIndex] ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1.2)',
                  }}
                >
                  {reelStrips[reelIndex].map((symbol, j) => (
                    <div key={j} className="w-full h-[56px] sm:h-[68px] flex items-center justify-center text-2xl sm:text-3xl select-none">
                      {symbol === 'BAR' ? <span className="text-white text-xs sm:text-sm font-black tracking-widest">BAR</span> : symbol}
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
              key={result.text + result.sub}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center mb-4"
            >
              <p className={`font-black ${result.big ? 'text-3xl' : 'text-2xl'} ${result.win ? (result.big ? 'text-yellow-400' : 'text-green-400') : 'text-red-400'}`}>
                {result.text}
              </p>
              <p className={`text-xs mt-1 ${result.win ? (result.big ? 'text-yellow-500/70' : 'text-green-500/70') : 'text-zinc-600'}`}>
                {result.sub}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        {totalSpins > 0 && (
          <div className="flex items-center gap-3 px-3 py-2 mb-4 bg-zinc-900/30 border border-white/[0.04] text-[10px] tracking-wider uppercase">
            <span className="text-zinc-600">Spins <span className="text-zinc-400 font-bold">{totalSpins}</span></span>
            <span className="text-zinc-600">Wins <span className="text-green-400 font-bold">{totalWins}</span></span>
            <span className="text-zinc-600">Rate <span className="text-white font-bold">{winRate}%</span></span>
          </div>
        )}

        {/* Bet + Spin */}
        <div className="mb-3">
          <BetControls balance={balance} bet={bet} setBet={setBet} disabled={isSpinning} />
        </div>
        <button
          onClick={spin}
          disabled={isSpinning || balance < bet}
          className={`w-full py-4 text-sm font-bold tracking-widest uppercase transition-all ${
            isSpinning ? 'bg-zinc-800 text-zinc-500' : 'bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)]'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {isSpinning ? 'spinning...' : 'SPIN'}
        </button>

        {/* Paytable toggle */}
        <button
          onClick={() => setShowPaytable(!showPaytable)}
          className="w-full text-center text-zinc-600 text-[10px] tracking-wider uppercase hover:text-zinc-400 transition-colors py-2 mt-2"
        >
          {showPaytable ? 'Hide' : 'Show'} Paytable
        </button>

        <AnimatePresence>
          {showPaytable && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border border-white/[0.04] divide-y divide-white/[0.03] text-xs">
                <div className="grid grid-cols-4 px-3 py-2 text-zinc-600 text-[9px] tracking-wider uppercase">
                  <span>Symbol</span><span className="text-center">3x</span><span className="text-center">4x</span><span className="text-center">5x</span>
                </div>
                {SYMBOLS.map(s => (
                  <div key={s} className="grid grid-cols-4 px-3 py-1.5 items-center">
                    <span className="text-lg">{s === 'BAR' ? <span className="text-white text-[10px] font-black">BAR</span> : s}</span>
                    <span className="text-center text-zinc-500">{PAYOUTS_3[s]}x</span>
                    <span className="text-center text-zinc-400">{PAYOUTS_4[s]}x</span>
                    <span className="text-center text-white font-bold">{PAYOUTS_5[s]}x</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1 text-[9px] text-zinc-600 text-center">
                <p>Mini: ~1% per spin · Minor: ~0.2% · Major: ~0.05% · Grand: ~0.01%</p>
                <p>Jackpots can only trigger on winning spins</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
