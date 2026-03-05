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

type GameState = 'betting' | 'playing' | 'dead' | 'cashed';

interface Car {
  id: number;
  lane: number;
  x: number;
  speed: number;
  emoji: string;
  direction: 1 | -1;
}

const LANE_COUNT = 5;
const GRID_COLS = 9;
const CAR_EMOJIS = ['🚗', '🚕', '🚙', '🏎️', '🚐', '🚛'];

export default function CrossyRoad({ balance, onWin, onLose }: Props) {
  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState<GameState>('betting');
  const [chickenPos, setChickenPos] = useState({ row: 0, col: 4 });
  const [cars, setCars] = useState<Car[]>([]);
  const [multiplier, setMultiplier] = useState(1.0);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean } | null>(null);
  const [maxRow, setMaxRow] = useState(0);
  const carIdRef = useRef(0);
  const gameLoop = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => { if (gameLoop.current) clearInterval(gameLoop.current); };
  }, []);

  const startGame = useCallback(() => {
    if (balance < bet) return;
    sounds.bet();
    sounds.click();

    // Generate initial cars
    const initialCars: Car[] = [];
    for (let lane = 1; lane <= LANE_COUNT; lane++) {
      const dir = lane % 2 === 0 ? 1 : -1 as 1 | -1;
      const carCount = 1 + Math.floor(Math.random() * 2);
      for (let c = 0; c < carCount; c++) {
        initialCars.push({
          id: carIdRef.current++,
          lane,
          x: Math.floor(Math.random() * GRID_COLS),
          speed: 0.8 + Math.random() * 1.2 + lane * 0.2,
          emoji: CAR_EMOJIS[Math.floor(Math.random() * CAR_EMOJIS.length)],
          direction: dir,
        });
      }
    }

    setCars(initialCars);
    setChickenPos({ row: 0, col: 4 });
    setMultiplier(1.0);
    setMaxRow(0);
    setGameState('playing');
    setResult(null);

    // Start game loop - move cars
    gameLoop.current = setInterval(() => {
      setCars((prev) => prev.map((car) => ({
        ...car,
        x: ((car.x + car.speed * car.direction * 0.15) % (GRID_COLS + 2) + GRID_COLS + 2) % (GRID_COLS + 2),
      })));
    }, 100);
  }, [balance, bet]);

  const move = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    if (gameState !== 'playing') return;
    sounds.click();

    setChickenPos((prev) => {
      let newPos = { ...prev };
      if (dir === 'up') newPos.row = Math.min(prev.row + 1, LANE_COUNT + 1);
      if (dir === 'down') newPos.row = Math.max(prev.row - 1, 0);
      if (dir === 'left') newPos.col = Math.max(prev.col - 1, 0);
      if (dir === 'right') newPos.col = Math.min(prev.col + 1, GRID_COLS - 1);

      // Check if crossed to safe zone (top)
      if (newPos.row > LANE_COUNT) {
        clearInterval(gameLoop.current);
        const newMult = multiplier + 0.5;
        sounds.win();
        setMultiplier(newMult);

        // Reset to bottom for next cross, add more cars
        setTimeout(() => {
          setChickenPos({ row: 0, col: 4 });
          setCars((prev) => {
            const newCars = [...prev];
            // Add a new car to a random lane
            const lane = 1 + Math.floor(Math.random() * LANE_COUNT);
            newCars.push({
              id: carIdRef.current++,
              lane,
              x: Math.floor(Math.random() * GRID_COLS),
              speed: 1.0 + Math.random() * 1.5 + newMult * 0.3,
              emoji: CAR_EMOJIS[Math.floor(Math.random() * CAR_EMOJIS.length)],
              direction: lane % 2 === 0 ? 1 : -1,
            });
            return newCars;
          });
          gameLoop.current = setInterval(() => {
            setCars((prev) => prev.map((car) => ({
              ...car,
              x: ((car.x + car.speed * car.direction * 0.15) % (GRID_COLS + 2) + GRID_COLS + 2) % (GRID_COLS + 2),
            })));
          }, 100);
        }, 300);

        return { row: LANE_COUNT + 1, col: newPos.col };
      }

      // Check collision with cars
      if (newPos.row >= 1 && newPos.row <= LANE_COUNT) {
        const laneCars = cars.filter((c) => c.lane === newPos.row);
        const hit = laneCars.some((c) => Math.abs(Math.round(c.x) - newPos.col) < 1);
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

      // Update max row for multiplier display
      if (newPos.row > maxRow) {
        setMaxRow(newPos.row);
      }

      return newPos;
    });
  }, [gameState, cars, multiplier, maxRow, bet, onLose]);

  const cashOut = useCallback(() => {
    if (gameState !== 'playing') return;
    clearInterval(gameLoop.current);
    const winAmount = Math.floor(bet * multiplier);
    sounds.win();
    if (multiplier >= 3) sounds.jackpot();
    onWin(winAmount);
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

  return (
    <div className="border border-white/[0.06] bg-zinc-950/50 p-6 sm:p-8 relative overflow-hidden">
      {gameState === 'dead' && <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />}
      {gameState === 'cashed' && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Crossy Road</h3>
        {gameState === 'playing' && (
          <span className={`text-sm font-bold font-mono ${multiplier > 1 ? 'text-green-400' : 'text-white'}`}>
            {multiplier.toFixed(1)}x
          </span>
        )}
      </div>

      {/* Game grid */}
      <div className="relative border border-white/[0.04] bg-black mb-6 select-none" style={{ aspectRatio: `${GRID_COLS}/${LANE_COUNT + 2}` }}>
        {/* Safe zone top */}
        <div
          className="absolute left-0 right-0 bg-green-950/30 border-b border-green-800/20 flex items-center justify-center"
          style={{ top: 0, height: `${100 / (LANE_COUNT + 2)}%` }}
        >
          <span className="text-green-600/40 text-[10px] tracking-wider uppercase">Safe Zone</span>
        </div>

        {/* Lanes */}
        {Array.from({ length: LANE_COUNT }).map((_, lane) => (
          <div
            key={lane}
            className="absolute left-0 right-0 border-b border-zinc-800/30"
            style={{
              top: `${((lane + 1) / (LANE_COUNT + 2)) * 100}%`,
              height: `${100 / (LANE_COUNT + 2)}%`,
              backgroundColor: lane % 2 === 0 ? 'rgba(39,39,42,0.2)' : 'rgba(39,39,42,0.1)',
            }}
          />
        ))}

        {/* Safe zone bottom */}
        <div
          className="absolute left-0 right-0 bottom-0 bg-green-950/30 border-t border-green-800/20 flex items-center justify-center"
          style={{ height: `${100 / (LANE_COUNT + 2)}%` }}
        >
          <span className="text-green-600/40 text-[10px] tracking-wider uppercase">Start</span>
        </div>

        {/* Cars */}
        {(gameState === 'playing' || gameState === 'dead') && cars.map((car) => (
          <div
            key={car.id}
            className="absolute text-lg sm:text-xl transition-all duration-100"
            style={{
              left: `${(car.x / GRID_COLS) * 100}%`,
              top: `${((LANE_COUNT + 1 - car.lane) / (LANE_COUNT + 2)) * 100}%`,
              width: `${100 / GRID_COLS}%`,
              height: `${100 / (LANE_COUNT + 2)}%`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: car.direction === -1 ? 'scaleX(-1)' : undefined,
            }}
          >
            {car.emoji}
          </div>
        ))}

        {/* Chicken */}
        {(gameState === 'playing' || gameState === 'dead') && (
          <motion.div
            animate={{
              left: `${(chickenPos.col / GRID_COLS) * 100}%`,
              top: `${((LANE_COUNT + 1 - chickenPos.row) / (LANE_COUNT + 2)) * 100}%`,
            }}
            transition={{ duration: 0.1, type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute text-xl sm:text-2xl flex items-center justify-center"
            style={{
              width: `${100 / GRID_COLS}%`,
              height: `${100 / (LANE_COUNT + 2)}%`,
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
          {/* D-pad */}
          <div className="grid grid-cols-3 gap-1.5 max-w-[200px] sm:max-w-[180px] mx-auto">
            <div />
            <button onClick={() => move('up')} className="bg-white/10 text-white py-4 sm:py-3 text-xl sm:text-lg font-bold hover:bg-white/15 active:bg-white/25 transition-all flex items-center justify-center min-h-[48px]">↑</button>
            <div />
            <button onClick={() => move('left')} className="bg-white/10 text-white py-4 sm:py-3 text-xl sm:text-lg font-bold hover:bg-white/15 active:bg-white/25 transition-all flex items-center justify-center min-h-[48px]">←</button>
            <button onClick={() => move('down')} className="bg-white/10 text-white py-4 sm:py-3 text-xl sm:text-lg font-bold hover:bg-white/15 active:bg-white/25 transition-all flex items-center justify-center min-h-[48px]">↓</button>
            <button onClick={() => move('right')} className="bg-white/10 text-white py-4 sm:py-3 text-xl sm:text-lg font-bold hover:bg-white/15 active:bg-white/25 transition-all flex items-center justify-center min-h-[48px]">→</button>
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
