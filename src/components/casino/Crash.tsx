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

type GameState = 'betting' | 'flying' | 'crashed' | 'cashed';

export default function Crash({ balance, onWin, onLose }: Props) {
  const [bet, setBet] = useState(100);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [gameState, setGameState] = useState<GameState>('betting');
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean } | null>(null);
  const [history, setHistory] = useState<{ mult: number; cashed: boolean }[]>([]);
  const [trail, setTrail] = useState<number[]>([]);
  const animRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTime = useRef(0);

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
        setGameState('crashed');
        sounds.lose();
        onLose(bet);
        setHistory((h) => [{ mult: parseFloat(cappedCrash.toFixed(2)), cashed: false }, ...h.slice(0, 19)]);
        setResult({
          text: `-$${bet.toLocaleString()}`,
          sub: `CRASHED at ${cappedCrash.toFixed(2)}x 💥`,
          win: false,
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
    clearInterval(animRef.current);
    sounds.win();
    const winAmount = Math.floor(bet * multiplier);
    onWin(winAmount);
    setGameState('cashed');
    setHistory((h) => [{ mult: parseFloat(multiplier.toFixed(2)), cashed: true }, ...h.slice(0, 19)]);
    setResult({
      text: `+$${winAmount.toLocaleString()}`,
      sub: `cashed at ${multiplier.toFixed(2)}x 🤑`,
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
  const rocketY = gameState === 'flying' ? Math.min(85, (multiplier - 1) * 15) : 0;

  return (
    <div className="border border-white/[0.06] bg-zinc-950/50 p-6 sm:p-8 relative overflow-hidden">
      {gameState === 'crashed' && <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />}
      {gameState === 'cashed' && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Crash</h3>
        {history.length > 0 && (
          <div className="flex gap-1.5 overflow-hidden max-w-[200px]">
            {history.slice(0, 8).map((h, i) => (
              <span
                key={i}
                className={`text-[10px] font-bold px-1.5 py-0.5 ${
                  h.cashed ? 'text-green-400' : h.mult < 2 ? 'text-red-400' : 'text-zinc-500'
                }`}
              >
                {h.mult}x
              </span>
            ))}
          </div>
        )}
      </div>

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
              stroke={gameState === 'crashed' ? '#ef4444' : '#22c55e'}
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
          {gameState === 'crashed' ? '💥' : '🚀'}
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

        {/* Crashed label */}
        {gameState === 'crashed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 text-xs font-bold tracking-widest uppercase"
          >
            CRASHED
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

      {(gameState === 'crashed' || gameState === 'cashed') && (
        <button
          onClick={() => { setGameState('betting'); setMultiplier(1.0); setTrail([]); setResult(null); }}
          className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all"
        >
          {gameState === 'cashed' ? 'GO AGAIN 🚀' : 'TRY AGAIN 💀'}
        </button>
      )}
    </div>
  );
}
