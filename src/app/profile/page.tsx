'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getSession, logout, type UserData, type CasinoDayStat } from '@/lib/auth';
import { getBookings, type Booking } from '@/lib/bookings';
import { formatPrice } from '@/data/fleet';
import AuthModal from '@/components/auth/AuthModal';
import Link from 'next/link';

export default function ProfilePage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<'rentals' | 'casino'>('casino');

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUserData(session);
      setBookings(getBookings());
    }
  }, []);

  const handleAuth = (data: UserData) => {
    setUserData(data);
    setBookings(getBookings());
    setAuthOpen(false);
  };

  const handleLogout = () => {
    logout();
    setUserData(null);
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
              <p className="text-zinc-500 text-sm">{userData.user.email}</p>
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
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setTab('casino')}
            className={`px-6 py-3 text-xs font-bold tracking-widest uppercase transition-all ${
              tab === 'casino' ? 'bg-red-600 text-white' : 'border border-white/10 text-zinc-500 hover:text-white'
            }`}
          >
            Casino History
          </button>
          <button
            onClick={() => setTab('rentals')}
            className={`px-6 py-3 text-xs font-bold tracking-widest uppercase transition-all ${
              tab === 'rentals' ? 'bg-red-600 text-white' : 'border border-white/10 text-zinc-500 hover:text-white'
            }`}
          >
            Rental History
          </button>
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
      </div>
    </div>
  );
}
