'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { getBalance, addBalance, subtractBalance, resetBalance } from '@/lib/casino';
import SlotMachine from '@/components/casino/SlotMachine';
import Roulette from '@/components/casino/Roulette';
import Blackjack from '@/components/casino/Blackjack';
import RevealOnScroll from '@/components/ui/RevealOnScroll';

type Game = 'slots' | 'roulette' | 'blackjack';

const GAMES: { id: Game; name: string; desc: string }[] = [
  { id: 'slots', name: 'Slots', desc: 'Match symbols for multiplied wins' },
  { id: 'roulette', name: 'Roulette', desc: 'Pick your color or number range' },
  { id: 'blackjack', name: 'Blackjack', desc: 'Beat the dealer to 21' },
];

export default function CasinoPage() {
  const [balance, setBalance] = useState(0);
  const [activeGame, setActiveGame] = useState<Game>('slots');
  const [flash, setFlash] = useState<'win' | 'lose' | null>(null);

  useEffect(() => {
    setBalance(getBalance());
  }, []);

  const handleWin = useCallback((amount: number) => {
    const newBal = addBalance(amount);
    setBalance(newBal);
    setFlash('win');
    setTimeout(() => setFlash(null), 600);
  }, []);

  const handleLose = useCallback((amount: number) => {
    const result = subtractBalance(amount);
    if (result !== false) {
      setBalance(result);
      setFlash('lose');
      setTimeout(() => setFlash(null), 600);
    }
  }, []);

  const handleReset = () => {
    const newBal = resetBalance();
    setBalance(newBal);
  };

  return (
    <div className="min-h-screen bg-black pt-24 md:pt-32 pb-20">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(800px,200vw)] h-[400px] bg-red-600/5 rounded-full blur-[200px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-600/3 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Header */}
        <RevealOnScroll>
          <div className="text-center mb-12">
            <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold mb-4 block">
              High Roller Lounge
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              CRYPTO <span className="text-red-600">CASINO</span>
            </h1>
            <p className="text-zinc-500 max-w-md mx-auto">
              Play with $10,000 in free chips. Win big, rent bigger.
            </p>
          </div>
        </RevealOnScroll>

        {/* Balance bar */}
        <div className="sticky top-20 z-30 mb-8">
          <div className="bg-black/90 backdrop-blur-sm border border-white/[0.06] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-zinc-500 text-[10px] tracking-wider uppercase block">Balance</span>
                <motion.span
                  key={balance}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className={`text-xl font-bold font-mono ${
                    flash === 'win' ? 'text-green-400' : flash === 'lose' ? 'text-red-400' : 'text-white'
                  }`}
                >
                  ${balance.toLocaleString()}
                </motion.span>
              </div>
              <div className="hidden sm:flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-zinc-500 text-xs">USDT</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {balance < 50 && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-red-600/20 border border-red-600/30 text-red-500 text-xs tracking-wider uppercase hover:bg-red-600/30 transition-all"
                >
                  Reload $10K
                </button>
              )}
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-white/10 text-zinc-500 text-xs tracking-wider uppercase hover:text-white transition-all"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Game selector */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className={`p-4 sm:p-6 text-left transition-all duration-300 ${
                activeGame === game.id
                  ? 'bg-red-600/10 border border-red-600/30'
                  : 'border border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              <p className={`font-bold text-sm sm:text-base ${activeGame === game.id ? 'text-white' : 'text-zinc-400'}`}>
                {game.name}
              </p>
              <p className="text-zinc-600 text-xs mt-1 hidden sm:block">{game.desc}</p>
            </button>
          ))}
        </div>

        {/* Active game */}
        <motion.div
          key={activeGame}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeGame === 'slots' && (
            <SlotMachine balance={balance} onWin={handleWin} onLose={handleLose} />
          )}
          {activeGame === 'roulette' && (
            <Roulette balance={balance} onWin={handleWin} onLose={handleLose} />
          )}
          {activeGame === 'blackjack' && (
            <Blackjack balance={balance} onWin={handleWin} onLose={handleLose} />
          )}
        </motion.div>

        {/* Disclaimer */}
        <div className="mt-12 text-center">
          <p className="text-zinc-700 text-xs">
            Play money only. No real cryptocurrency is used. For entertainment purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
