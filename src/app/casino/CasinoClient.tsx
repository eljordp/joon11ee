'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import PartySocket from 'partysocket';
import { motion, AnimatePresence } from 'framer-motion';
import { getBalance, addBalance, subtractBalance, resetBalance, setBalance as setCasinoBalance, getUsername, setUsername as saveUsername } from '@/lib/casino';
import { getSession, recordCasinoGame, updateCasinoBalance, sendMoney, type UserData } from '@/lib/auth';
import BreakBread from '@/components/casino/BreakBread';
import SlotMachine from '@/components/casino/SlotMachine';
import Roulette from '@/components/casino/Roulette';
import Blackjack from '@/components/casino/Blackjack';
import Crash from '@/components/casino/Crash';
import CrossyRoad from '@/components/casino/CrossyRoad';
import AuthModal from '@/components/auth/AuthModal';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import { isMuted, toggleMute, startAmbient } from '@/lib/sounds';
import { checkDailyBonus, claimDailyBonus, getCurrentStreak } from '@/lib/daily-bonus';
import { checkAndUnlock, ACHIEVEMENTS } from '@/lib/achievements';
import DailyBonusModal from '@/components/casino/DailyBonusModal';
import AchievementToast from '@/components/casino/AchievementToast';
import GlobalLeaderboard, { reportWin, contributeJackpot, checkJackpot } from '@/components/casino/GlobalLeaderboard';
import NotificationBell, { pushNotification } from '@/components/casino/NotificationBell';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MultiplayerCrash = dynamic(() => import('@/components/casino/MultiplayerCrash'), { ssr: false });
const MultiplayerBlackjack = dynamic(() => import('@/components/casino/MultiplayerBlackjack'), { ssr: false });
const MultiplayerCraps = dynamic(() => import('@/components/casino/MultiplayerCraps'), { ssr: false });
const SoloCraps = dynamic(() => import('@/components/casino/SoloCraps'), { ssr: false });
const MultiplayerDominoes = dynamic(() => import('@/components/casino/MultiplayerDominoes'), { ssr: false });
const MultiplayerPoker = dynamic(() => import('@/components/casino/MultiplayerPoker'), { ssr: false });
const MultiplayerSpades = dynamic(() => import('@/components/casino/MultiplayerSpades'), { ssr: false });
const MultiplayerHoodCraps = dynamic(() => import('@/components/casino/MultiplayerHoodCraps'), { ssr: false });
const MultiplayerTournament = dynamic(() => import('@/components/casino/MultiplayerTournament'), { ssr: false });
const JackpotSlots = dynamic(() => import('@/components/casino/JackpotSlots'), { ssr: false });

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

type Game = 'slots' | 'jackpot_slots' | 'roulette' | 'blackjack' | 'crash' | 'crossy' | 'mp_crash' | 'mp_blackjack' | 'solo_craps' | 'mp_craps' | 'mp_dominoes' | 'mp_poker' | 'mp_spades' | 'mp_hood_craps' | 'tournament';

const GAMES: { id: Game; name: string; emoji: string; desc: string; live?: boolean }[] = [
  { id: 'slots', name: 'Slots', emoji: '🎰', desc: 'Match 3 and go crazy' },
  { id: 'jackpot_slots', name: 'Jackpot Slots', emoji: '💎', desc: '5 reels, 4 jackpots' },
  { id: 'roulette', name: 'Roulette', emoji: '🎯', desc: 'Pick a side' },
  { id: 'blackjack', name: 'Blackjack', emoji: '🃏', desc: 'Beat the dealer' },
  { id: 'crash', name: 'Crash', emoji: '🚀', desc: 'Cash out before boom' },
  { id: 'crossy', name: 'Crossy', emoji: '🐔', desc: 'Cross the road alive' },
  { id: 'mp_crash', name: 'Crash MP', emoji: '🚀', desc: 'Multiplayer crash', live: true },
  { id: 'mp_blackjack', name: 'Table BJ', emoji: '🃏', desc: '5-seat table', live: true },
  { id: 'solo_craps', name: 'Craps', emoji: '🎲', desc: 'Solo w/ bots' },
  { id: 'mp_craps', name: 'Craps MP', emoji: '🎲', desc: 'Live tables', live: true },
  { id: 'mp_dominoes', name: 'Dominoes', emoji: '🁣', desc: 'Play to 100', live: true },
  { id: 'mp_poker', name: 'Poker', emoji: '🂡', desc: "Texas Hold'em", live: true },
  { id: 'mp_spades', name: 'Spades', emoji: '♠️', desc: '2v2 teams', live: true },
  { id: 'mp_hood_craps', name: 'Hood Craps', emoji: '🎲', desc: '7s n 10s', live: true },
  { id: 'tournament', name: 'Tournament', emoji: '🏆', desc: '4-player bracket', live: true },
];

export default function CasinoPage() {
  const [balance, setBalance] = useState(0);
  const [activeGame, setActiveGame] = useState<Game>('slots');
  const [flash, setFlash] = useState<'win' | 'lose' | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [totalSession, setTotalSession] = useState(0);
  const [username, setUsernameState] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [initialRoom, setInitialRoom] = useState<string | null>(null);
  const [challengeFrom, setChallengeFrom] = useState<string | null>(null);
  const [breadOpen, setBreadOpen] = useState(false);
  const [tablePlayers, setTablePlayers] = useState<{ name: string }[]>([]);
  const [soundMuted, setSoundMuted] = useState(true);
  const [dailyBonusOpen, setDailyBonusOpen] = useState(false);
  const [dailyBonusInfo, setDailyBonusInfo] = useState<{ streak: number; reward: number }>({ streak: 0, reward: 0 });
  const [dailyStreak, setDailyStreak] = useState(0);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, { username: string; game?: string; room?: string }>>({});
  const presenceRef = useRef<PartySocket | null>(null);
  const searchParams = useSearchParams();

  // Read invite link params on mount
  useEffect(() => {
    const gameParam = searchParams.get('game') as Game | null;
    const roomParam = searchParams.get('room');
    const challengeParam = searchParams.get('challenge');
    if (gameParam && GAMES.some(g => g.id === gameParam)) {
      setActiveGame(gameParam);
    }
    if (roomParam) {
      setInitialRoom(roomParam.toUpperCase());
    }
    if (challengeParam) {
      setChallengeFrom(challengeParam);
      pushNotification({ type: 'challenge', title: 'Challenge!', message: `${challengeParam} challenged you!` });
    }
    // Clean URL after reading params
    if (gameParam || roomParam || challengeParam) {
      window.history.replaceState({}, '', '/casino');
    }
  }, [searchParams]);

  useEffect(() => {
    setBalance(getBalance());
    const session = getSession();
    if (session) {
      setUser(session);
      if (session.casinoBalance !== getBalance()) {
        setCasinoBalance(session.casinoBalance);
        setBalance(session.casinoBalance);
      }
    } else {
      setAuthOpen(true);
    }
    const savedName = getUsername();
    setUsernameState(savedName);
    setSoundMuted(isMuted());
    const bonus = checkDailyBonus();
    setDailyStreak(getCurrentStreak());
    if (bonus.canClaim) {
      setDailyBonusInfo({ streak: bonus.streak, reward: bonus.reward });
      setDailyBonusOpen(true);
    }
  }, []);

  // Process achievement queue
  useEffect(() => {
    if (!achievementToast && achievementQueue.length > 0) {
      setAchievementToast(achievementQueue[0]);
      setAchievementQueue(q => q.slice(1));
    }
  }, [achievementToast, achievementQueue]);

  // Presence server connection + heartbeat
  useEffect(() => {
    const ws = new PartySocket({ host: PARTYKIT_HOST, party: 'presence', room: 'main' });
    presenceRef.current = ws;

    ws.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'presence') {
        setOnlineUsers(data.users || {});
      } else if (data.type === 'presence_update') {
        setOnlineUsers(prev => ({ ...prev, [data.connId]: data.info }));
      } else if (data.type === 'presence_left') {
        setOnlineUsers(prev => { const next = { ...prev }; delete next[data.connId]; return next; });
      }
    });

    return () => { ws.close(); presenceRef.current = null; };
  }, []);

  // Send heartbeat every 30s with current game
  useEffect(() => {
    const name = username || user?.user.name;
    if (!name || !presenceRef.current) return;
    const send = () => {
      presenceRef.current?.send(JSON.stringify({
        type: 'heartbeat', username: name,
        game: activeGame.startsWith('mp_') ? activeGame : undefined,
      }));
    };
    send();
    const interval = setInterval(send, 30000);
    return () => clearInterval(interval);
  }, [username, user, activeGame]);

  const getDisplayName = useCallback(() => {
    if (username) return username;
    if (user) return user.user.name;
    return 'You';
  }, [username, user]);

  const handleWin = useCallback((amount: number, wagered?: number) => {
    const newBal = addBalance(amount);
    setBalance(newBal);
    setTotalSession((t) => t + amount);
    setFlash('win');
    setTimeout(() => setFlash(null), 600);
    const gameInfo = GAMES.find((g) => g.id === activeGame);
    if (user) {
      recordCasinoGame(user.user.email, wagered || 0, amount);
      updateCasinoBalance(user.user.email, newBal);
    }
    // Report to global leaderboard (wins >= $200)
    if (amount >= 200) {
      reportWin(getDisplayName(), gameInfo?.name || activeGame, amount);
    }
    // Progressive jackpot: contribute 1% of wager, then check
    if (wagered && wagered > 0) {
      contributeJackpot(Math.floor(wagered * 0.01));
      checkJackpot(getDisplayName());
    }
    // Check achievements
    const isMP = activeGame.startsWith('mp_');
    const newAchievements = checkAndUnlock({
      winAmount: amount,
      betAmount: wagered,
      isMultiplayer: isMP,
      totalProfit: totalSession + amount,
    });
    if (newAchievements.length > 0) {
      setAchievementQueue(q => [...q, ...newAchievements]);
      for (const id of newAchievements) {
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (ach) pushNotification({ type: 'achievement', title: ach.name, message: ach.description });
      }
    }
  }, [user, activeGame, getDisplayName, totalSession]);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleLeaderboardEntry = useCallback((_entry: { player: string; game: string; emoji: string; amount: number }) => {
    // Global leaderboard handles this via reportWin in handleWin
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

  const handleClaimDailyBonus = () => {
    const { streak, reward } = claimDailyBonus();
    const newBal = addBalance(reward);
    setBalance(newBal);
    setDailyStreak(streak);
    setDailyBonusOpen(false);
    if (user) updateCasinoBalance(user.user.email, newBal);
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

  const handleSendMoney = useCallback((toUsername: string, amount: number): string | true => {
    if (!user) return 'Not logged in.';
    const result = sendMoney(user.user.email, toUsername, amount);
    if (result === true) {
      const newBal = balance - amount;
      setBalance(newBal);
      setCasinoBalance(newBal);
    }
    return result;
  }, [user, balance]);

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
              pull up. play with friends. stack chips.
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
              {dailyStreak > 0 && (
                <span className="text-[10px] sm:text-xs font-bold text-orange-400/70 hidden sm:block" title={`${dailyStreak}-day login streak`}>
                  🔥{dailyStreak}
                </span>
              )}
              {totalSession !== 0 && (
                <span className={`text-[10px] sm:text-xs font-mono font-bold hidden sm:block ${totalSession > 0 ? 'text-green-500/60' : 'text-red-500/60'}`}>
                  {totalSession > 0 ? '+' : ''}{totalSession.toLocaleString()} session
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  const newState = toggleMute();
                  setSoundMuted(newState);
                  if (!newState) startAmbient();
                }}
                className="px-2 py-1.5 sm:py-2 border border-white/10 text-zinc-400 text-sm hover:text-white transition-all"
                title={soundMuted ? 'Unmute' : 'Mute'}
              >
                {soundMuted ? '🔇' : '🔊'}
              </button>
              <NotificationBell />
              {!user && (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 border border-red-600/30 bg-red-600/10 text-red-400 text-[10px] sm:text-xs font-bold tracking-wider uppercase hover:bg-red-600/20 transition-all"
                >
                  Sign In
                </button>
              )}
              {user && (
                <button
                  onClick={() => setBreadOpen(true)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 border border-white/10 text-zinc-400 text-[10px] sm:text-xs font-bold tracking-wider uppercase hover:text-white transition-all"
                >
                  🍞
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
        <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-2 sm:pb-0 -mx-6 px-6 sm:mx-0 sm:px-0 scrollbar-thin">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => { setActiveGame(game.id); setTablePlayers([]); }}
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

        {/* Challenge banner */}
        <AnimatePresence>
          {challengeFrom && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-lg">&#9876;</span>
                <span className="text-yellow-300 text-sm font-bold">@{challengeFrom}</span>
                <span className="text-zinc-400 text-xs">challenged you!</span>
              </div>
              <button onClick={() => setChallengeFrom(null)} className="text-zinc-600 text-xs hover:text-white transition-colors">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

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
            {activeGame === 'jackpot_slots' && (
              <JackpotSlots balance={balance} onWin={handleWin} onLose={handleLose} />
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
              <MultiplayerCrash balance={balance} onWin={handleWin} onLose={handleLose} onLeaderboardEntry={handleLeaderboardEntry} username={getDisplayName()} initialRoom={initialRoom} gameId="mp_crash" />
            )}
            {activeGame === 'mp_blackjack' && (
              <MultiplayerBlackjack balance={balance} onWin={handleWin} onLose={handleLose} onLeaderboardEntry={handleLeaderboardEntry} username={getDisplayName()} initialRoom={initialRoom} gameId="mp_blackjack" onPlayersChange={setTablePlayers} />
            )}
            {activeGame === 'solo_craps' && (
              <SoloCraps balance={balance} onWin={handleWin} onLose={handleLose} />
            )}
            {activeGame === 'mp_craps' && (
              <MultiplayerCraps balance={balance} onWin={handleWin} onLose={handleLose} onLeaderboardEntry={handleLeaderboardEntry} username={getDisplayName()} initialRoom={initialRoom} gameId="mp_craps" onPlayersChange={setTablePlayers} />
            )}
            {activeGame === 'mp_dominoes' && (
              <MultiplayerDominoes balance={balance} onWin={handleWin} onLose={handleLose} onLeaderboardEntry={handleLeaderboardEntry} username={getDisplayName()} initialRoom={initialRoom} gameId="mp_dominoes" />
            )}
            {activeGame === 'mp_poker' && (
              <MultiplayerPoker balance={balance} onWin={handleWin} onLose={handleLose} onLeaderboardEntry={handleLeaderboardEntry} username={getDisplayName()} initialRoom={initialRoom} gameId="mp_poker" onPlayersChange={setTablePlayers} />
            )}
            {activeGame === 'mp_spades' && (
              <MultiplayerSpades balance={balance} onWin={handleWin} onLose={handleLose} onLeaderboardEntry={handleLeaderboardEntry} username={getDisplayName()} initialRoom={initialRoom} gameId="mp_spades" />
            )}
            {activeGame === 'mp_hood_craps' && (
              <MultiplayerHoodCraps balance={balance} onWin={handleWin} onLose={handleLose} onLeaderboardEntry={handleLeaderboardEntry} username={getDisplayName()} initialRoom={initialRoom} gameId="mp_hood_craps" onPlayersChange={setTablePlayers} />
            )}
            {activeGame === 'tournament' && (
              <MultiplayerTournament balance={balance} onWin={handleWin} onLose={handleLose} username={getDisplayName()} initialRoom={initialRoom} gameId="tournament" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Global Leaderboard + Jackpot */}
        <GlobalLeaderboard username={getDisplayName()} />

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
            for entertainment purposes only.
          </p>
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuth={handleAuth} required={!user} />
      <BreakBread
        open={breadOpen}
        onClose={() => setBreadOpen(false)}
        balance={balance}
        onSend={handleSendMoney}
        friends={user?.friends}
        tablePlayers={tablePlayers}
        myUsername={getDisplayName()}
      />
      <DailyBonusModal
        open={dailyBonusOpen}
        streak={dailyBonusInfo.streak}
        reward={dailyBonusInfo.reward}
        onClaim={handleClaimDailyBonus}
      />
      <AchievementToast achievementId={achievementToast} onDismiss={() => setAchievementToast(null)} />
    </div>
  );
}
