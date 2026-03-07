'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { getStreakReward } from '@/lib/daily-bonus';

interface Props {
  open: boolean;
  streak: number;
  reward: number;
  onClaim: () => void;
}

export default function DailyBonusModal({ open, streak, reward, onClaim }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm border border-white/10 bg-black p-6"
          >
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🔥</div>
              <h2 className="text-white text-lg font-black tracking-wider uppercase">
                Day {streak} Streak
              </h2>
              <p className="text-zinc-500 text-xs mt-1">Welcome back</p>
            </div>

            {/* 7-day calendar strip */}
            <div className="flex gap-1 justify-center mb-6">
              {Array.from({ length: 7 }, (_, i) => {
                const day = i + 1;
                const dayReward = getStreakReward(day);
                const isPast = day < streak;
                const isCurrent = day === streak;
                const isFuture = day > streak;
                return (
                  <div
                    key={day}
                    className={`flex flex-col items-center px-2 py-2 border text-center min-w-[44px] ${
                      isCurrent
                        ? 'border-green-500/50 bg-green-500/10'
                        : isPast
                        ? 'border-white/10 bg-white/5'
                        : 'border-white/[0.04] opacity-40'
                    }`}
                  >
                    <span className="text-[9px] text-zinc-500 font-bold">D{day}</span>
                    <span className={`text-[10px] font-bold font-mono ${
                      isCurrent ? 'text-green-400' : isPast ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      ${dayReward >= 1000 ? `${dayReward / 1000}k` : dayReward}
                    </span>
                    {isPast && <span className="text-[8px] text-green-500">✓</span>}
                    {isCurrent && <span className="text-[8px] text-green-400">→</span>}
                    {isFuture && <span className="text-[8px] text-zinc-700">·</span>}
                  </div>
                );
              })}
            </div>

            {/* Reward display */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
                className="text-green-400 text-3xl font-black font-mono"
              >
                +${reward.toLocaleString()}
              </motion.div>
            </div>

            <button
              onClick={onClaim}
              className="w-full py-3 bg-green-600 text-white text-sm font-black tracking-wider uppercase hover:bg-green-500 transition-all"
            >
              Claim Bonus
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
