'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUnlockedAchievements, ACHIEVEMENTS } from '@/lib/achievements';
import { addFriend, getSession } from '@/lib/auth';

interface PlayerInfo {
  name: string;
  seatIndex?: number;
  handsPlayed?: number;
  sessionProfit?: number;
}

interface Props {
  player: PlayerInfo | null;
  onClose: () => void;
}

export default function PlayerProfilePopup({ player, onClose }: Props) {
  const [friendResult, setFriendResult] = useState<string | null>(null);

  if (!player) return null;

  const session = getSession();
  const isSelf = session && session.user.name.toLowerCase() === player.name.toLowerCase();

  // Get top 3 achievements (from local storage — only works for viewing own profile or public achievements)
  const unlocked = getUnlockedAchievements();
  const topAchievements = ACHIEVEMENTS
    .filter(a => unlocked[a.id])
    .slice(0, 3);

  const handleAddFriend = () => {
    if (!session) { setFriendResult('Not logged in'); return; }
    const result = addFriend(session.user.email, player.name);
    setFriendResult(result === true ? 'Added!' : result);
    setTimeout(() => setFriendResult(null), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-zinc-900 border border-white/10 w-72 p-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 border border-white/10 flex items-center justify-center bg-zinc-800">
              <span className="text-white font-bold text-lg">{player.name[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm">@{player.name}</p>
              {player.seatIndex !== undefined && (
                <p className="text-zinc-500 text-[10px]">Seat {player.seatIndex + 1}</p>
              )}
            </div>
          </div>

          {/* Session stats */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="border border-white/[0.06] p-2 text-center">
              <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Hands</p>
              <p className="text-white font-bold text-sm">{player.handsPlayed ?? '—'}</p>
            </div>
            <div className="border border-white/[0.06] p-2 text-center">
              <p className="text-zinc-500 text-[9px] uppercase tracking-wider">Session P/L</p>
              <p className={`font-bold text-sm ${(player.sessionProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {player.sessionProfit !== undefined ? `${player.sessionProfit >= 0 ? '+' : ''}$${Math.abs(player.sessionProfit).toLocaleString()}` : '—'}
              </p>
            </div>
          </div>

          {/* Achievements (only visible for self) */}
          {isSelf && topAchievements.length > 0 && (
            <div className="mb-4">
              <p className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1.5">Achievements</p>
              <div className="flex gap-1.5">
                {topAchievements.map(a => (
                  <span key={a.id} title={a.name} className="text-lg">{a.icon}</span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!isSelf && session && (
              <button
                onClick={handleAddFriend}
                className="flex-1 py-2 border border-green-500/20 text-green-400 text-[10px] font-bold tracking-wider uppercase hover:bg-green-500/10 transition-all"
              >
                {friendResult || 'Add Friend'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-white/[0.06] text-zinc-500 text-[10px] font-bold tracking-wider uppercase hover:text-white transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
