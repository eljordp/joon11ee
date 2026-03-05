'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import BetControls from './BetControls';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
}

type GameState = 'betting' | 'flying' | 'crashed' | 'cashed' | 'coasting';

export default function Crash({ balance, onWin, onLose }: Props) {
  const [bet, setBet] = useState(100);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [gameState, setGameState] = useState<GameState>('betting');
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean } | null>(null);
  const [history, setHistory] = useState<{ mult: number; cashed: boolean }[]>([]);
  const [trail, setTrail] = useState<number[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ mult: number; bet: number; win: number }[]>([]);
  const animRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTime = useRef(0);
  const cashedAt = useRef(0);
  const crashRef = useRef(0);

  useEffect(() => {
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

  const launch = useCallback(() => {
    if (gameState !== 'betting' || balance < bet) return;
    sounds.bet();
    sounds.spinStart();

    // Generate crash point with house edge
    // E(crash) ~ 1.98x, realistic distribution
    const r = Math.random();
    const crash = Math.max(1.0, 1 / (1 - r) * 0.97);
    const cappedCrash = Math.min(crash, 100);
    setCrashPoint(cappedCrash);
    crashRef.current = cappedCrash;
    cashedAt.current = 0;
    setMultiplier(1.0);
    setTrail([]);
    setResult(null);
    setGameState('flying');
    startTime.current = Date.now();

    animRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      const currentMult = Math.pow(Math.E, 0.08 * elapsed);

      if (currentMult >= cappedCrash) {
        clearInterval(animRef.current);
        setMultiplier(cappedCrash);
        setGameState((prev) => {
          if (prev === 'coasting') {
            // Player already cashed out - just show crash
            setHistory((h) => [{ mult: parseFloat(cappedCrash.toFixed(2)), cashed: true }, ...h.slice(0, 19)]);
            setResult((r) => r ? {
              ...r,
              sub: `cashed ${cashedAt.current.toFixed(2)}x → crashed ${cappedCrash.toFixed(2)}x 🤑`,
            } : r);
            return 'cashed';
          }
          // Player didn't cash out
          sounds.lose();
          onLose(bet);
          setHistory((h) => [{ mult: parseFloat(cappedCrash.toFixed(2)), cashed: false }, ...h.slice(0, 19)]);
          setResult({
            text: `-$${bet.toLocaleString()}`,
            sub: `CRASHED at ${cappedCrash.toFixed(2)}x 💥`,
            win: false,
          });
          return 'crashed';
        });
      } else {
        setMultiplier(currentMult);
        setTrail((t) => [...t.slice(-60), currentMult]);
        if (currentMult > 2 && Math.random() < 0.1) sounds.slotTick();
      }
    }, 50);
  }, [gameState, balance, bet, onLose]);

  const cashOut = useCallback(() => {
    if (gameState !== 'flying') return;
    // Don't clear interval - let the rocket keep flying to show crash point
    sounds.win();
    const winAmount = Math.floor(bet * multiplier);
    cashedAt.current = multiplier;
    onWin(winAmount);
    setGameState('coasting');
    setLeaderboard((lb) => {
      const entry = { mult: parseFloat(multiplier.toFixed(2)), bet, win: winAmount };
      const updated = [...lb, entry].sort((a, b) => b.win - a.win).slice(0, 10);
      return updated;
    });
    setResult({
      text: `+$${winAmount.toLocaleString()}`,
      sub: `cashed at ${multiplier.toFixed(2)}x — waiting for crash...`,
      win: true,
    });
    if (multiplier >= 5) sounds.jackpot();
  }, [gameState, bet, multiplier, onWin]);

  const getMultColor = (m: number) => {
    if (m < 1.5) return 'text-white';
    if (m < 3) return 'text-green-400';
    if (m < 5) return 'text-yellow-400';
    if (m < 10) return 'text-orange-400';
    return 'text-red-400';
  };

  // Calculate rocket position for visual
  const isLive = gameState === 'flying' || gameState === 'coasting';
  const rocketY = isLive ? Math.min(85, (multiplier - 1) * 15) : 0;

  return (
    <div className="border border-white/[0.06] bg-zinc-950/50 p-6 sm:p-8 relative overflow-hidden">
      {gameState === 'crashed' && <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />}
      {gameState === 'cashed' && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Crash</h3>
        {history.length > 0 && (
          <span className="text-zinc-600 text-xs">{history.length} rounds</span>
        )}
      </div>

      {/* Crash history */}
      {history.length > 0 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1.5 scrollbar-thin -mx-6 px-6 sm:mx-0 sm:px-0">
          {history.map((h, i) => (
            <motion.div
              key={`${h.mult}-${i}`}
              initial={i === 0 ? { scale: 0, opacity: 0 } : {}}
              animate={{ scale: 1, opacity: i === 0 ? 1 : 0.6 + (1 - i / history.length) * 0.4 }}
              className={`flex-shrink-0 px-2.5 py-1.5 text-[11px] font-bold ${
                h.mult < 1.5
                  ? 'bg-red-600/20 text-red-400'
                  : h.mult < 2
                  ? 'bg-orange-600/15 text-orange-400'
                  : h.mult < 5
                  ? 'bg-zinc-800/50 text-zinc-300'
                  : h.mult < 10
                  ? 'bg-green-600/15 text-green-400'
                  : 'bg-yellow-600/15 text-yellow-400'
              } ${h.cashed ? 'border border-green-500/30' : ''}`}
            >
              {h.mult.toFixed(2)}x
              {h.cashed && <span className="ml-0.5 text-green-400">✓</span>}
            </motion.div>
          ))}
        </div>
      )}

      {/* Rocket display */}
      <div className="relative h-48 sm:h-56 border border-white/[0.04] bg-black mb-6 overflow-hidden">
        {/* Grid lines */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="absolute left-0 right-0 border-t border-white/[0.03]" style={{ bottom: `${i * 20}%` }}>
            <span className="text-zinc-800 text-[9px] absolute right-1 -top-3">{(1 + i * (multiplier > 5 ? multiplier / 5 : 1)).toFixed(1)}x</span>
          </div>
        ))}

        {/* Trail */}
        {gameState !== 'betting' && trail.length > 1 && (
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke={gameState === 'crashed' ? '#ef4444' : gameState === 'coasting' ? '#facc15' : '#22c55e'}
              strokeWidth="2"
              strokeOpacity="0.5"
              points={trail.map((m, i) => {
                const x = (i / 60) * 100;
                const y = 100 - Math.min(90, (m - 1) * 15);
                return `${x}%,${y}%`;
              }).join(' ')}
            />
          </svg>
        )}

        {/* Rocket */}
        <motion.div
          animate={{
            bottom: gameState === 'betting' ? '10%' : gameState === 'crashed' ? '5%' : `${10 + rocketY}%`,
            x: gameState === 'crashed' ? [0, -3, 3, -3, 0] : 0,
          }}
          transition={gameState === 'crashed' ? { duration: 0.3 } : { duration: 0.1 }}
          className="absolute left-1/2 -translate-x-1/2 text-3xl sm:text-4xl"
        >
          {gameState === 'crashed' ? '💥' : gameState === 'coasting' ? '👻' : '🚀'}
        </motion.div>

        {/* Multiplier overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            key={gameState === 'crashed' ? 'crashed' : multiplier.toFixed(1)}
            initial={gameState === 'crashed' ? { scale: 1.5 } : {}}
            animate={{ scale: 1 }}
            className={`text-4xl sm:text-6xl font-black ${
              gameState === 'crashed' ? 'text-red-500' : getMultColor(multiplier)
            }`}
          >
            {multiplier.toFixed(2)}x
          </motion.span>
        </div>

        {/* Status labels */}
        {gameState === 'crashed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 text-xs font-bold tracking-widest uppercase"
          >
            CRASHED
          </motion.div>
        )}
        {gameState === 'coasting' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-1 text-xs font-bold tracking-widest uppercase"
          >
            CASHED @ {cashedAt.current.toFixed(2)}x
          </motion.div>
        )}
      </div>

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

      {/* Controls */}
      {gameState === 'betting' && (
        <>
          <div className="mb-4">
            <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />
          </div>
          <button
            onClick={launch}
            disabled={balance < bet}
            className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            LAUNCH 🚀
          </button>
        </>
      )}

      {gameState === 'flying' && (
        <button
          onClick={cashOut}
          className="w-full bg-green-600 text-white py-5 text-base font-black tracking-widest uppercase hover:bg-green-500 transition-all animate-pulse shadow-[0_0_30px_rgba(34,197,94,0.3)]"
        >
          CASH OUT ${Math.floor(bet * multiplier).toLocaleString()} 💰
        </button>
      )}

      {gameState === 'coasting' && (
        <div className="text-center text-yellow-400/60 text-xs font-bold py-4 animate-pulse tracking-wider uppercase">
          still flying... watching for crash 👀
        </div>
      )}

      {(gameState === 'crashed' || gameState === 'cashed') && (
        <button
          onClick={() => { setGameState('betting'); setMultiplier(1.0); setTrail([]); setResult(null); }}
          className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all"
        >
          {gameState === 'cashed' ? 'GO AGAIN 🚀' : 'TRY AGAIN 💀'}
        </button>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="mt-6 border border-white/[0.04]">
          <div className="px-3 py-2 border-b border-white/[0.04] flex items-center justify-between">
            <span className="text-zinc-500 text-[10px] tracking-wider uppercase font-bold">Leaderboard</span>
            <span className="text-zinc-700 text-[10px]">session top {leaderboard.length}</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {leaderboard.map((entry, i) => (
              <div key={`${entry.win}-${entry.mult}-${i}`} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black w-5 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-orange-400' : 'text-zinc-600'}`}>
                    {i + 1}.
                  </span>
                  <span className="text-green-400 text-sm font-bold font-mono">
                    +${entry.win.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-[10px]">
                    ${entry.bet.toLocaleString()} bet
                  </span>
                  <span className={`text-xs font-bold ${entry.mult >= 5 ? 'text-yellow-400' : entry.mult >= 3 ? 'text-green-400' : 'text-zinc-400'}`}>
                    {entry.mult}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
