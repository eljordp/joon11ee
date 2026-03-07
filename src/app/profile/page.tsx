'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSession, logout, updateProfile, addFriend, removeFriend, type UserData, type CasinoDayStat, type Friend } from '@/lib/auth';
import { setUsername as saveUsername } from '@/lib/casino';
import { getBookings, type Booking } from '@/lib/bookings';
import { ACHIEVEMENTS, getUnlockedAchievements } from '@/lib/achievements';
import { formatPrice } from '@/data/fleet';
import AuthModal from '@/components/auth/AuthModal';
import PartySocket from 'partysocket';
import Link from 'next/link';
import { generateRoomCode } from '@/components/casino/RoomControls';

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

interface OnlineUser { username: string; game?: string; room?: string; }

export default function ProfilePage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<'casino' | 'achievements' | 'friends' | 'rentals' | 'settings'>('casino');
  const [unlockedAchievements, setUnlockedAchievements] = useState<Record<string, string>>({});

  // Settings state
  const [editName, setEditName] = useState('');
  const [editIG, setEditIG] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // Friends state
  const [friendInput, setFriendInput] = useState('');
  const [friendError, setFriendError] = useState('');
  const [friendSuccess, setFriendSuccess] = useState('');
  const [copiedChallenge, setCopiedChallenge] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, OnlineUser>>({});
  const presenceRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUserData(session);
      setBookings(getBookings());
      setEditName(session.user.name);
      setEditIG(session.user.instagram || '');
    }
    setUnlockedAchievements(getUnlockedAchievements());
  }, []);

  // Connect to presence server for online status
  useEffect(() => {
    const ws = new PartySocket({ host: PARTYKIT_HOST, party: 'presence', room: 'main' });
    presenceRef.current = ws;
    ws.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'presence') setOnlineUsers(data.users || {});
      else if (data.type === 'presence_update') setOnlineUsers(prev => ({ ...prev, [data.connId]: data.info }));
      else if (data.type === 'presence_left') setOnlineUsers(prev => { const next = { ...prev }; delete next[data.connId]; return next; });
    });
    return () => { ws.close(); };
  }, []);

  const handleAuth = (data: UserData) => {
    setUserData(data);
    setBookings(getBookings());
    setAuthOpen(false);
    setEditName(data.user.name);
    setEditIG(data.user.instagram || '');
  };

  const handleLogout = () => {
    logout();
    setUserData(null);
  };

  const handleSaveSettings = () => {
    if (!userData) return;
    setSettingsError('');
    const name = editName.trim().slice(0, 16);
    if (!name) return;

    const ig = editIG.trim().replace(/^@/, '').slice(0, 30);
    const result = updateProfile(userData.user.email, { name, instagram: ig || undefined });
    if (result !== true) {
      setSettingsError(result);
      return;
    }
    saveUsername(name);

    // Refresh local state
    const session = getSession();
    if (session) setUserData(session);

    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    setFriendError('');
    setFriendSuccess('');

    const input = friendInput.trim().replace(/^@/, '');
    if (!input) return;

    const result = addFriend(userData.user.email, input);
    if (result === true) {
      setFriendSuccess(`Added @${input}`);
      setFriendInput('');
      const session = getSession();
      if (session) setUserData(session);
      setTimeout(() => setFriendSuccess(''), 3000);
    } else {
      setFriendError(result);
    }
  };

  const handleRemoveFriend = (username: string) => {
    if (!userData) return;
    removeFriend(userData.user.email, username);
    const session = getSession();
    if (session) setUserData(session);
  };

  if (!userData) {
    return (
      <div className="min-h-screen bg-black pt-24 pb-20 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 border-2 border-red-600 flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-3xl">J</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Your Profile</h1>
          <p className="text-zinc-500 mb-8">Sign in to track your rental history and casino stats</p>
          <button
            onClick={() => setAuthOpen(true)}
            className="bg-red-600 text-white px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all"
          >
            Sign In / Sign Up
          </button>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuth={handleAuth} />
      </div>
    );
  }

  const casinoTotals = userData.casinoStats.reduce(
    (acc, s) => ({
      games: acc.games + s.gamesPlayed,
      wagered: acc.wagered + s.totalWagered,
      won: acc.won + s.totalWon,
      net: acc.net + s.netProfit,
    }),
    { games: 0, wagered: 0, won: 0, net: 0 }
  );

  const friends = userData.friends || [];

  return (
    <div className="min-h-screen bg-black pt-24 md:pt-32 pb-20">
      <div className="mx-auto max-w-4xl px-6">
        {/* User header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 border-2 border-red-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl">{userData.user.name[0].toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{userData.user.name}</h1>
              <div className="flex items-center gap-3">
                <p className="text-zinc-500 text-sm">{userData.user.email}</p>
                {userData.user.instagram && (
                  <a
                    href={`https://instagram.com/${userData.user.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-400/70 text-sm hover:text-pink-400 transition-colors"
                  >
                    @{userData.user.instagram}
                  </a>
                )}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="text-zinc-500 text-xs tracking-wider uppercase hover:text-white transition-colors">
            Log Out
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="p-5 border border-white/[0.06]">
            <p className="text-2xl font-bold text-white">{bookings.length}</p>
            <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1">Rentals</p>
          </div>
          <div className="p-5 border border-white/[0.06]">
            <p className="text-2xl font-bold text-white">{casinoTotals.games}</p>
            <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1">Games Played</p>
          </div>
          <div className="p-5 border border-white/[0.06]">
            <p className="text-2xl font-bold font-mono text-white">${userData.casinoBalance.toLocaleString()}</p>
            <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1">Casino Balance</p>
          </div>
          <div className="p-5 border border-white/[0.06]">
            <p className={`text-2xl font-bold font-mono ${casinoTotals.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {casinoTotals.net >= 0 ? '+' : ''}{formatPrice(casinoTotals.net)}
            </p>
            <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1">Net P&L</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(['casino', 'achievements', 'friends', 'rentals', 'settings'] as const).map((t) => {
            const labels: Record<string, string> = {
              casino: 'Casino History',
              achievements: `Badges (${Object.keys(unlockedAchievements).length}/${ACHIEVEMENTS.length})`,
              friends: `Friends${friends.length > 0 ? ` (${friends.length})` : ''}`,
              rentals: 'Rental History',
              settings: 'Settings',
            };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-3 text-xs font-bold tracking-widest uppercase transition-all ${
                  tab === t ? 'bg-red-600 text-white' : 'border border-white/10 text-zinc-500 hover:text-white'
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Casino history */}
        {tab === 'casino' && (
          <div>
            {userData.casinoStats.length === 0 ? (
              <div className="text-center py-20 border border-white/[0.04]">
                <p className="text-zinc-500 text-lg mb-4">No casino activity yet</p>
                <Link href="/casino" className="text-red-500 text-sm hover:text-red-400 transition-colors">
                  Hit the casino &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {userData.casinoStats.map((stat: CasinoDayStat) => (
                  <motion.div
                    key={stat.date}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-white/[0.06] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-white font-bold">{new Date(stat.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                      <p className="text-zinc-500 text-sm">{stat.gamesPlayed} games played</p>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <p className="text-zinc-600 text-xs uppercase">Wagered</p>
                        <p className="text-white font-mono">${stat.totalWagered.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600 text-xs uppercase">Won</p>
                        <p className="text-green-400 font-mono">${stat.totalWon.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600 text-xs uppercase">Net</p>
                        <p className={`font-bold font-mono ${stat.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stat.netProfit >= 0 ? '+' : ''}${stat.netProfit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Achievements */}
        {tab === 'achievements' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = !!unlockedAchievements[a.id];
              return (
                <div
                  key={a.id}
                  className={`p-4 border text-center transition-all ${
                    unlocked
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-white/[0.04] opacity-40'
                  }`}
                >
                  <span className="text-2xl block mb-2">{a.icon}</span>
                  <p className={`font-bold text-sm ${unlocked ? 'text-white' : 'text-zinc-600'}`}>{a.name}</p>
                  <p className="text-zinc-500 text-[10px] mt-1">{a.description}</p>
                  {unlocked && (
                    <p className="text-yellow-500/60 text-[9px] mt-2">
                      {new Date(unlockedAchievements[a.id]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Friends */}
        {tab === 'friends' && (
          <div className="space-y-6">
            {/* Add friend form */}
            <form onSubmit={handleAddFriend} className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
                <input
                  type="text"
                  value={friendInput}
                  onChange={(e) => { setFriendInput(e.target.value.replace(/[^a-zA-Z0-9_.]/g, '')); setFriendError(''); }}
                  placeholder="username"
                  maxLength={16}
                  className="w-full bg-black border border-white/[0.1] pl-7 pr-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={!friendInput.trim()}
                className="px-6 py-3 bg-red-600 text-white text-xs font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </form>

            <AnimatePresence>
              {friendError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-400 text-sm">
                  {friendError}
                </motion.p>
              )}
              {friendSuccess && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-green-400 text-sm">
                  {friendSuccess}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Friends list */}
            {friends.length === 0 ? (
              <div className="text-center py-16 border border-white/[0.04]">
                <p className="text-zinc-500 text-lg mb-2">No friends yet</p>
                <p className="text-zinc-700 text-sm">Add friends by their @username</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((f: Friend) => {
                  const online = Object.values(onlineUsers).find(u => u.username.toLowerCase() === f.username.toLowerCase());
                  const GAME_NAMES: Record<string, string> = {
                    mp_crash: 'Crash', mp_blackjack: 'Blackjack', mp_craps: 'Craps',
                    mp_dominoes: 'Dominoes', mp_poker: 'Poker', mp_spades: 'Spades', mp_hood_craps: 'Hood Craps',
                  };
                  return (
                    <motion.div
                      key={f.username}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-white/[0.06] p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 border border-white/10 flex items-center justify-center relative">
                          <span className="text-white font-bold text-sm">{f.username[0].toUpperCase()}</span>
                          {online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border border-black rounded-full" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">@{f.username}</p>
                          {online ? (
                            <p className="text-green-400 text-[10px] font-bold">
                              Online{online.game ? ` · Playing ${GAME_NAMES[online.game] || online.game}` : ''}
                            </p>
                          ) : (
                            <p className="text-zinc-600 text-[10px]">
                              Added {new Date(f.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {online?.game && online.room && (
                          <Link
                            href={`/casino?game=${online.game}&room=${online.room}`}
                            className="text-green-400 text-[10px] font-bold tracking-wider uppercase hover:text-green-300 transition-colors"
                          >
                            Join
                          </Link>
                        )}
                        <button
                          onClick={() => {
                            const code = generateRoomCode();
                            const game = 'mp_blackjack';
                            const url = `${window.location.origin}/casino?game=${game}&room=${code}&challenge=${userData?.user.name || 'Friend'}`;
                            navigator.clipboard.writeText(url).catch(() => {});
                            setCopiedChallenge(f.username);
                            setTimeout(() => setCopiedChallenge(null), 2000);
                          }}
                          className="text-yellow-400 text-[10px] font-bold tracking-wider uppercase hover:text-yellow-300 transition-colors"
                        >
                          {copiedChallenge === f.username ? 'Link Copied!' : 'Challenge'}
                        </button>
                        <button
                          onClick={() => handleRemoveFriend(f.username)}
                          className="text-zinc-600 text-[10px] font-bold tracking-wider uppercase hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Rental history */}
        {tab === 'rentals' && (
          <div>
            {bookings.length === 0 ? (
              <div className="text-center py-20 border border-white/[0.04]">
                <p className="text-zinc-500 text-lg mb-4">No rentals yet</p>
                <Link href="/fleet" className="text-red-500 text-sm hover:text-red-400 transition-colors">
                  Browse the fleet &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b: Booking) => (
                  <div key={b.id} className="border border-white/[0.06] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-white font-bold">{b.carBrand} {b.carName}</p>
                      <p className="text-zinc-500 text-sm">{b.cityFullName} &middot; {b.startDate} — {b.endDate}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-red-500 font-bold font-mono">{formatPrice(b.totalPrice)}</span>
                      <span className={`px-2 py-0.5 text-[10px] tracking-wider uppercase border ${
                        b.status === 'confirmed' ? 'border-green-500/50 text-green-500' :
                        b.status === 'pending' ? 'border-yellow-500/50 text-yellow-500' :
                        b.status === 'cancelled' ? 'border-red-500/50 text-red-500' :
                        'border-zinc-500/50 text-zinc-400'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <div className="max-w-lg space-y-6">
            <div>
              <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Username</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => { setEditName(e.target.value.replace(/[^a-zA-Z0-9_.]/g, '')); setSettingsError(''); }}
                maxLength={16}
                className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                placeholder="Your username"
              />
              <p className="text-zinc-700 text-[10px] mt-1">Letters, numbers, _ and . only</p>
            </div>

            <div>
              <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Instagram</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
                <input
                  type="text"
                  value={editIG}
                  onChange={(e) => setEditIG(e.target.value.replace(/^@/, ''))}
                  maxLength={30}
                  className="w-full bg-black border border-white/[0.1] pl-7 pr-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                  placeholder="yourhandle"
                />
              </div>
              <p className="text-zinc-700 text-[10px] mt-1">Shows on your profile</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={!editName.trim()}
                className="bg-red-600 text-white px-8 py-3 text-xs font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-30"
              >
                Save
              </button>
              <AnimatePresence>
                {settingsError && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-sm"
                  >
                    {settingsError}
                  </motion.span>
                )}
                {settingsSaved && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-green-400 text-sm"
                  >
                    Saved
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-white/[0.04] pt-6 mt-8">
              <p className="text-zinc-600 text-xs mb-1">Account</p>
              <p className="text-zinc-500 text-sm">{userData.user.email}</p>
              <p className="text-zinc-700 text-[10px] mt-1">Joined {new Date(userData.user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
