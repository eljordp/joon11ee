'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import BetControls from './BetControls';

interface Props {
  balance: number;
  onWin: (amount: number, wagered?: number) => void;
  onLose: (amount: number) => void;
}

type GameState = 'betting' | 'playing' | 'dead' | 'cashed';

interface Car {
  id: number;
  lane: number; // which vertical lane (column) 1-5
  y: number;    // vertical position
  speed: number;
  styleIdx: number;
  direction: 1 | -1; // 1 = down, -1 = up
}

const LANE_COUNT = 5;
const GRID_ROWS = 7;
// Colored blocks like real Crossy Road - no corny emojis
const CAR_STYLES = [
  { bg: 'bg-red-500', w: 'w-[85%]' },
  { bg: 'bg-blue-500', w: 'w-[85%]' },
  { bg: 'bg-yellow-500', w: 'w-[70%]' },
  { bg: 'bg-purple-500', w: 'w-[85%]' },
  { bg: 'bg-white', w: 'w-[90%]' },        // truck (wider)
  { bg: 'bg-orange-500', w: 'w-[70%]' },
];

export default function CrossyRoad({ balance, onWin, onLose }: Props) {
  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState<GameState>('betting');
  const [chickenPos, setChickenPos] = useState({ col: 0, row: 3 }); // col = horizontal progress, row = vertical pos
  const [cars, setCars] = useState<Car[]>([]);
  const [multiplier, setMultiplier] = useState(1.0);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean } | null>(null);
  const carIdRef = useRef(0);
  const gameLoop = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => { if (gameLoop.current) clearInterval(gameLoop.current); };
  }, []);

  const startGame = useCallback(() => {
    if (balance < bet) return;
    sounds.bet();
    sounds.click();

    const initialCars: Car[] = [];
    for (let lane = 1; lane <= LANE_COUNT; lane++) {
      const dir = lane % 2 === 0 ? 1 : -1 as 1 | -1;
      const carCount = 1 + Math.floor(Math.random() * 2);
      for (let c = 0; c < carCount; c++) {
        initialCars.push({
          id: carIdRef.current++,
          lane,
          y: Math.floor(Math.random() * GRID_ROWS),
          speed: 0.8 + Math.random() * 1.2 + lane * 0.15,
          styleIdx: Math.floor(Math.random() * CAR_STYLES.length),
          direction: dir,
        });
      }
    }

    setCars(initialCars);
    setChickenPos({ col: 0, row: 3 });
    setMultiplier(1.0);
    setGameState('playing');
    setResult(null);

    gameLoop.current = setInterval(() => {
      setCars((prev) => prev.map((car) => ({
        ...car,
        y: ((car.y + car.speed * car.direction * 0.15) % (GRID_ROWS + 2) + GRID_ROWS + 2) % (GRID_ROWS + 2),
      })));
    }, 100);
  }, [balance, bet]);

  const move = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    if (gameState !== 'playing') return;
    sounds.click();

    setChickenPos((prev) => {
      let newPos = { ...prev };
      if (dir === 'right') newPos.col = Math.min(prev.col + 1, LANE_COUNT + 1);
      if (dir === 'left') newPos.col = Math.max(prev.col - 1, 0);
      if (dir === 'up') newPos.row = Math.max(prev.row - 1, 0);
      if (dir === 'down') newPos.row = Math.min(prev.row + 1, GRID_ROWS - 1);

      // Check if crossed to safe zone (right side)
      if (newPos.col > LANE_COUNT) {
        clearInterval(gameLoop.current);
        const newMult = multiplier + 0.5;
        sounds.win();
        setMultiplier(newMult);

        // Reset to left for next cross, add more cars
        setTimeout(() => {
          setChickenPos({ col: 0, row: 3 });
          setCars((prev) => {
            const newCars = [...prev];
            const lane = 1 + Math.floor(Math.random() * LANE_COUNT);
            newCars.push({
              id: carIdRef.current++,
              lane,
              y: Math.floor(Math.random() * GRID_ROWS),
              speed: 1.0 + Math.random() * 1.5 + newMult * 0.3,
              styleIdx: Math.floor(Math.random() * CAR_STYLES.length),
              direction: lane % 2 === 0 ? 1 : -1,
            });
            return newCars;
          });
          gameLoop.current = setInterval(() => {
            setCars((prev) => prev.map((car) => ({
              ...car,
              y: ((car.y + car.speed * car.direction * 0.15) % (GRID_ROWS + 2) + GRID_ROWS + 2) % (GRID_ROWS + 2),
            })));
          }, 100);
        }, 300);

        return { col: LANE_COUNT + 1, row: newPos.row };
      }

      // Check collision with cars
      if (newPos.col >= 1 && newPos.col <= LANE_COUNT) {
        const laneCars = cars.filter((c) => c.lane === newPos.col);
        const hit = laneCars.some((c) => Math.abs(Math.round(c.y) - newPos.row) < 1);
        if (hit) {
          clearInterval(gameLoop.current);
          sounds.lose();
          setGameState('dead');
          onLose(bet);
          setResult({
            text: `-$${bet.toLocaleString()}`,
            sub: `splat at ${multiplier.toFixed(1)}x 🐔💀`,
            win: false,
          });
          return newPos;
        }
      }

      return newPos;
    });
  }, [gameState, cars, multiplier, bet, onLose]);

  const cashOut = useCallback(() => {
    if (gameState !== 'playing') return;
    clearInterval(gameLoop.current);
    const winAmount = Math.floor(bet * multiplier);
    sounds.win();
    if (multiplier >= 3) sounds.jackpot();
    onWin(winAmount, bet);
    setGameState('cashed');
    setResult({
      text: `+$${winAmount.toLocaleString()}`,
      sub: `chicken survived at ${multiplier.toFixed(1)}x 🐔✨`,
      win: true,
    });
  }, [gameState, bet, multiplier, onWin]);

  // Keyboard controls
  useEffect(() => {
    if (gameState !== 'playing') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); move('up'); }
      if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); move('down'); }
      if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); move('left'); }
      if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); move('right'); }
      if (e.key === ' ') { e.preventDefault(); cashOut(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, move, cashOut]);

  // Grid dimensions: LANE_COUNT+2 columns (start + lanes + end), GRID_ROWS rows
  const totalCols = LANE_COUNT + 2;

  return (
    <div className="border border-white/[0.06] bg-zinc-950/50 p-4 sm:p-8 relative overflow-hidden">
      {gameState === 'dead' && <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />}
      {gameState === 'cashed' && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h3 className="text-xl font-bold text-white">Crossy Road</h3>
        {gameState === 'playing' && (
          <span className={`text-sm font-bold font-mono ${multiplier > 1 ? 'text-green-400' : 'text-white'}`}>
            {multiplier.toFixed(1)}x
          </span>
        )}
      </div>

      {/* Game grid - horizontal layout */}
      <div className="relative border border-white/[0.04] bg-black mb-4 sm:mb-6 select-none" style={{ aspectRatio: `${totalCols}/${GRID_ROWS}` }}>
        {/* Safe zone left (start) */}
        <div
          className="absolute top-0 bottom-0 bg-green-950/30 border-r border-green-800/20 flex items-center justify-center"
          style={{ left: 0, width: `${100 / totalCols}%` }}
        >
          <span className="text-green-600/40 text-[8px] sm:text-[10px] tracking-wider uppercase [writing-mode:vertical-lr] rotate-180">Start</span>
        </div>

        {/* Lanes (vertical columns) */}
        {Array.from({ length: LANE_COUNT }).map((_, lane) => (
          <div
            key={lane}
            className="absolute top-0 bottom-0 border-r border-zinc-800/30"
            style={{
              left: `${((lane + 1) / totalCols) * 100}%`,
              width: `${100 / totalCols}%`,
              backgroundColor: lane % 2 === 0 ? 'rgba(39,39,42,0.2)' : 'rgba(39,39,42,0.1)',
            }}
          />
        ))}

        {/* Safe zone right (goal) */}
        <div
          className="absolute top-0 bottom-0 right-0 bg-green-950/30 border-l border-green-800/20 flex items-center justify-center"
          style={{ width: `${100 / totalCols}%` }}
        >
          <span className="text-green-600/40 text-[8px] sm:text-[10px] tracking-wider uppercase [writing-mode:vertical-lr] rotate-180">Safe</span>
        </div>

        {/* Cars - moving vertically */}
        {(gameState === 'playing' || gameState === 'dead') && cars.map((car) => {
          const style = CAR_STYLES[car.styleIdx];
          return (
            <div
              key={car.id}
              className="absolute transition-all duration-100 flex items-center justify-center"
              style={{
                left: `${(car.lane / totalCols) * 100}%`,
                top: `${(car.y / GRID_ROWS) * 100}%`,
                width: `${100 / totalCols}%`,
                height: `${100 / GRID_ROWS}%`,
              }}
            >
              <div className={`${style.bg} ${style.w} h-[60%] rounded-sm opacity-90`} />
            </div>
          );
        })}

        {/* Chicken */}
        {(gameState === 'playing' || gameState === 'dead') && (
          <motion.div
            animate={{
              left: `${(chickenPos.col / totalCols) * 100}%`,
              top: `${(chickenPos.row / GRID_ROWS) * 100}%`,
            }}
            transition={{ duration: 0.1, type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute text-lg sm:text-2xl flex items-center justify-center"
            style={{
              width: `${100 / totalCols}%`,
              height: `${100 / GRID_ROWS}%`,
            }}
          >
            {gameState === 'dead' ? '💀' : '🐔'}
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
            className="text-center mb-4 sm:mb-6"
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
            onClick={startGame}
            disabled={balance < bet}
            className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            START 🐔
          </button>
        </>
      )}

      {gameState === 'playing' && (
        <div className="space-y-3">
          {/* D-pad - forward (right) is prominent */}
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => move('up')} className="bg-white/10 text-white w-12 h-12 sm:w-11 sm:h-11 text-xl sm:text-lg font-bold hover:bg-white/15 active:bg-white/25 transition-all flex items-center justify-center">↑</button>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => move('left')} className="bg-white/10 text-white w-12 h-12 sm:w-11 sm:h-11 text-xl sm:text-lg font-bold hover:bg-white/15 active:bg-white/25 transition-all flex items-center justify-center">←</button>
              <button onClick={() => move('down')} className="bg-white/10 text-white w-12 h-12 sm:w-11 sm:h-11 text-xl sm:text-lg font-bold hover:bg-white/15 active:bg-white/25 transition-all flex items-center justify-center">↓</button>
            </div>
            <button onClick={() => move('right')} className="bg-green-600/30 border border-green-500/30 text-green-400 w-16 h-[108px] sm:w-14 sm:h-[96px] text-2xl sm:text-xl font-bold hover:bg-green-600/40 active:bg-green-600/50 transition-all flex items-center justify-center">→</button>
          </div>

          <button
            onClick={cashOut}
            disabled={multiplier <= 1}
            className="w-full bg-green-600 text-white py-3 text-sm font-bold tracking-widest uppercase hover:bg-green-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            CASH OUT ${Math.floor(bet * multiplier).toLocaleString()} 💰
          </button>

          <p className="text-zinc-700 text-[10px] text-center hidden sm:block">arrows / WASD to move &middot; space to cash out</p>
        </div>
      )}

      {(gameState === 'dead' || gameState === 'cashed') && (
        <button
          onClick={() => { setGameState('betting'); setResult(null); setCars([]); setMultiplier(1.0); }}
          className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all"
        >
          {gameState === 'cashed' ? 'PLAY AGAIN 🐔' : 'TRY AGAIN 💀'}
        </button>
      )}
    </div>
  );
}
