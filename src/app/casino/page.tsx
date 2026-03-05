'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBalance, addBalance, subtractBalance, resetBalance, setBalance as setCasinoBalance, getUsername, setUsername as saveUsername } from '@/lib/casino';
import { getSession, recordCasinoGame, updateCasinoBalance, type UserData } from '@/lib/auth';
import SlotMachine from '@/components/casino/SlotMachine';
import Roulette from '@/components/casino/Roulette';
import Blackjack from '@/components/casino/Blackjack';
import Crash from '@/components/casino/Crash';
import CrossyRoad from '@/components/casino/CrossyRoad';
import AuthModal from '@/components/auth/AuthModal';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MultiplayerCrash = dynamic(() => import('@/components/casino/MultiplayerCrash'), { ssr: false });
const MultiplayerBlackjack = dynamic(() => import('@/components/casino/MultiplayerBlackjack'), { ssr: false });

type Game = 'slots' | 'roulette' | 'blackjack' | 'crash' | 'crossy' | 'mp_crash' | 'mp_blackjack';

interface LeaderboardEntry {
  player: string;
  game: string;
  emoji: string;
  amount: number;
  time: number;
}

const GAMES: { id: Game; name: string; emoji: string; desc: string; live?: boolean }[] = [
  { id: 'slots', name: 'Slots', emoji: '🎰', desc: 'Match 3 and go crazy' },
  { id: 'roulette', name: 'Roulette', emoji: '🎯', desc: 'Pick a side' },
  { id: 'blackjack', name: 'Blackjack', emoji: '🃏', desc: 'Beat the dealer' },
  { id: 'crash', name: 'Crash', emoji: '🚀', desc: 'Cash out before boom' },
  { id: 'crossy', name: 'Crossy', emoji: '🐔', desc: 'Cross the road alive' },
  { id: 'mp_crash', name: 'Crash MP', emoji: '🚀', desc: 'Multiplayer crash', live: true },
  { id: 'mp_blackjack', name: 'Table BJ', emoji: '🃏', desc: '5-seat table', live: true },
];

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const RANK_COLORS = ['text-yellow-400', 'text-zinc-300', 'text-orange-400'];

export default function CasinoPage() {
  const [balance, setBalance] = useState(0);
  const [activeGame, setActiveGame] = useState<Game>('slots');
  const [flash, setFlash] = useState<'win' | 'lose' | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [totalSession, setTotalSession] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [username, setUsernameState] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    setBalance(getBalance());
    const session = getSession();
    if (session) {
      setUser(session);
      if (session.casinoBalance !== getBalance()) {
        setCasinoBalance(session.casinoBalance);
        setBalance(session.casinoBalance);
      }
    }
    try {
      const saved = localStorage.getItem('casino_leaderboard');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate old entries that don't have a player field
        const migrated = parsed.map((e: LeaderboardEntry & { player?: string }) => ({
          ...e,
          player: e.player || 'You',
        }));
        setLeaderboard(migrated);
      }
    } catch {}
    const savedName = getUsername();
    setUsernameState(savedName);
  }, []);

  useEffect(() => {
    if (leaderboard.length > 0) {
      try { localStorage.setItem('casino_leaderboard', JSON.stringify(leaderboard)); } catch {}
    }
  }, [leaderboard]);

  const getDisplayName = useCallback(() => {
    if (username) return username;
    if (user) return user.user.name;
    return 'You';
  }, [username, user]);

  const handleWin = useCallback((amount: number) => {
    const newBal = addBalance(amount);
    setBalance(newBal);
    setTotalSession((t) => t + amount);
    setFlash('win');
    setTimeout(() => setFlash(null), 600);
    const gameInfo = GAMES.find((g) => g.id === activeGame);
    setLeaderboard((lb) => {
      const entry: LeaderboardEntry = {
        player: getDisplayName(),
        game: gameInfo?.name || activeGame,
        emoji: gameInfo?.emoji || '',
        amount,
        time: Date.now(),
      };
      return [...lb, entry].sort((a, b) => b.amount - a.amount).slice(0, 20);
    });
    if (user) {
      recordCasinoGame(user.user.email, 0, amount);
      updateCasinoBalance(user.user.email, newBal);
    }
  }, [user, activeGame, getDisplayName]);

  const handleLose = useCallback((amount: number) => {
    const result = subtractBalance(amount);
    if (result !== false) {
      setBalance(result);
      setTotalSession((t) => t - amount);
      setFlash('lose');
      setTimeout(() => setFlash(null), 600);
      if (user) {
        recordCasinoGame(user.user.email, amount, 0);
        updateCasinoBalance(user.user.email, result);
      }
    }
  }, [user]);

  const handleLeaderboardEntry = useCallback((entry: { player: string; game: string; emoji: string; amount: number }) => {
    setLeaderboard((lb) => {
      const full: LeaderboardEntry = { ...entry, time: Date.now() };
      return [...lb, full].sort((a, b) => b.amount - a.amount).slice(0, 20);
    });
  }, []);

  const handleReset = () => {
    const newBal = resetBalance();
    setBalance(newBal);
    setTotalSession(0);
    if (user) updateCasinoBalance(user.user.email, newBal);
  };

  const handleAuth = (data: UserData) => {
    setUser(data);
    setAuthOpen(false);
    setCasinoBalance(data.casinoBalance);
    setBalance(data.casinoBalance);
    if (!username) {
      setUsernameState(data.user.name);
      saveUsername(data.user.name);
    }
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed.length <= 16) {
      saveUsername(trimmed);
      setUsernameState(trimmed);
    }
    setEditingName(false);
    setNameInput('');
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
          <div className="text-center mb-6 sm:mb-10">
            <span className="text-red-600 text-[10px] sm:text-xs tracking-[0.3em] uppercase font-semibold mb-2 sm:mb-4 block">
              High Roller Lounge
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-2 sm:mb-3">
              CRYPTO <span className="text-red-600">CASINO</span>
            </h1>
            <p className="text-zinc-500 max-w-md mx-auto text-xs sm:text-sm">
              $10K free chips. no real money. just vibes and W&apos;s.
            </p>
          </div>
        </RevealOnScroll>

        {/* Balance bar */}
        <div className="sticky top-16 sm:top-20 z-30 mb-6 sm:mb-8">
          <div className="bg-black/95 backdrop-blur-md border border-white/[0.06] px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              {/* Username display */}
              <div className="flex items-center gap-2 min-w-0">
                {editingName ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSaveName(); }}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="username"
                      maxLength={16}
                      autoFocus
                      className="w-24 sm:w-32 px-2 py-1 text-xs font-bold font-mono bg-black border border-white/20 text-white outline-none focus:border-red-500 transition-colors"
                    />
                    <button type="submit" className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold tracking-wider uppercase">
                      Set
                    </button>
                    <button type="button" onClick={() => setEditingName(false)} className="text-zinc-600 text-[10px] hover:text-white px-1">
                      X
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => { setEditingName(true); setNameInput(username || user?.user.name || ''); }}
                    className="text-zinc-500 text-[10px] sm:text-xs font-bold tracking-wider hover:text-white transition-colors truncate max-w-[80px] sm:max-w-[120px]"
                    title="Click to set username"
                  >
                    {getDisplayName()}
                  </button>
                )}
              </div>

              <div>
                <span className="text-zinc-600 text-[9px] sm:text-[10px] tracking-wider uppercase block">Balance</span>
                <motion.span
                  key={balance}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  className={`text-lg sm:text-2xl font-black font-mono block ${
                    flash === 'win' ? 'text-green-400' : flash === 'lose' ? 'text-red-400' : 'text-white'
                  }`}
                >
                  ${balance.toLocaleString()}
                </motion.span>
              </div>
              {totalSession !== 0 && (
                <span className={`text-[10px] sm:text-xs font-mono font-bold hidden sm:block ${totalSession > 0 ? 'text-green-500/60' : 'text-red-500/60'}`}>
                  {totalSession > 0 ? '+' : ''}{totalSession.toLocaleString()} session
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {!user && (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 border border-red-600/30 bg-red-600/10 text-red-400 text-[10px] sm:text-xs font-bold tracking-wider uppercase hover:bg-red-600/20 transition-all"
                >
                  Sign In
                </button>
              )}
              {user && (
                <Link
                  href="/profile"
                  className="px-2 sm:px-3 py-1.5 sm:py-2 border border-white/10 text-zinc-400 text-[10px] sm:text-xs font-bold tracking-wider uppercase hover:text-white transition-all"
                >
                  Stats
                </Link>
              )}
              {balance < 50 && (
                <button
                  onClick={handleReset}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 bg-red-600 text-white text-[10px] sm:text-xs font-bold tracking-wider uppercase hover:bg-red-500 transition-all animate-pulse"
                >
                  Reload
                </button>
              )}
              <button
                onClick={handleReset}
                className="px-2 sm:px-3 py-1.5 sm:py-2 border border-white/10 text-zinc-600 text-[10px] sm:text-xs tracking-wider uppercase hover:text-white transition-all"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Game selector */}
        <div className="flex sm:grid sm:grid-cols-7 gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-2 sm:pb-0 -mx-6 px-6 sm:mx-0 sm:px-0 scrollbar-thin">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className={`flex-shrink-0 w-[72px] sm:w-auto p-2.5 sm:p-5 text-center transition-all duration-300 relative ${
                activeGame === game.id
                  ? game.live
                    ? 'bg-green-600/10 border-2 border-green-600/40 scale-[1.02]'
                    : 'bg-red-600/10 border-2 border-red-600/40 scale-[1.02]'
                  : 'border border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              {game.live && (
                <span className="absolute top-1 right-1 text-[8px] font-bold px-1 py-0.5 bg-green-500/20 text-green-400 border border-green-500/20 tracking-wider uppercase leading-none">
                  Live
                </span>
              )}
              <span className="text-xl sm:text-3xl block mb-0.5 sm:mb-1">{game.emoji}</span>
              <p className={`font-bold text-[11px] sm:text-sm ${activeGame === game.id ? 'text-white' : 'text-zinc-500'}`}>
                {game.name}
              </p>
              <p className="text-zinc-700 text-[10px] mt-0.5 hidden sm:block">{game.desc}</p>
            </button>
          ))}
        </div>

        {/* Active game */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeGame}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
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
            {activeGame === 'crash' && (
              <Crash balance={balance} onWin={handleWin} onLose={handleLose} />
            )}
            {activeGame === 'crossy' && (
              <CrossyRoad balance={balance} onWin={handleWin} onLose={handleLose} />
            )}
            {activeGame === 'mp_crash' && (
              <MultiplayerCrash balance={balance} onWin={handleWin} onLose={handleLose} onLeaderboardEntry={handleLeaderboardEntry} username={getDisplayName()} />
            )}
            {activeGame === 'mp_blackjack' && (
              <MultiplayerBlackjack balance={balance} onWin={handleWin} onLose={handleLose} onLeaderboardEntry={handleLeaderboardEntry} username={getDisplayName()} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="mt-8 border border-white/[0.04]">
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <span className="text-zinc-400 text-xs tracking-wider uppercase font-bold">Leaderboard</span>
              <div className="flex items-center gap-3">
                <span className="text-zinc-700 text-[10px]">top {leaderboard.length} wins</span>
                <button
                  onClick={() => { setLeaderboard([]); localStorage.removeItem('casino_leaderboard'); }}
                  className="text-zinc-800 text-[9px] tracking-wider uppercase hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {leaderboard.map((entry, i) => {
                const isYou = entry.player === getDisplayName() || entry.player === 'You';
                return (
                  <div key={`${entry.amount}-${entry.time}-${i}`} className={`flex items-center justify-between px-4 py-2.5 ${isYou ? 'bg-white/[0.02]' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black w-5 ${RANK_COLORS[i] || 'text-zinc-600'}`}>
                        {i + 1}.
                      </span>
                      <span className="text-base">{entry.emoji}</span>
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-bold ${isYou ? 'text-red-400' : 'text-zinc-400'}`}>
                          {entry.player}
                        </span>
                        <span className="text-green-400 text-sm font-bold font-mono">
                          +${entry.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-zinc-600 text-[10px] sm:text-xs">{entry.game}</span>
                      <span className="text-zinc-800 text-[9px]">{timeAgo(entry.time)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sign in CTA if not logged in */}
        {!user && (
          <div className="mt-10 text-center border border-white/[0.04] py-8 px-6">
            <p className="text-zinc-500 text-sm mb-3">
              Sign in to save your progress and track daily stats
            </p>
            <button
              onClick={() => setAuthOpen(true)}
              className="text-red-500 text-sm font-bold hover:text-red-400 transition-colors"
            >
              Create free account &rarr;
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-10 text-center">
          <p className="text-zinc-800 text-[10px]">
            play money only. no real crypto. for entertainment only. don&apos;t gamble irl.
          </p>
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuth={handleAuth} />
    </div>
  );
}
