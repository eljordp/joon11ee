'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ACHIEVEMENTS } from '@/lib/achievements';

interface Props {
  achievementId: string | null;
  onDismiss: () => void;
}

export default function AchievementToast({ achievementId, onDismiss }: Props) {
  const achievement = achievementId ? ACHIEVEMENTS.find(a => a.id === achievementId) : null;

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50, x: '-50%' }}
          onAnimationComplete={(def) => {
            if ((def as { opacity: number }).opacity === 1) {
              setTimeout(onDismiss, 3000);
            }
          }}
          className="fixed bottom-6 left-1/2 z-50 border border-yellow-500/30 bg-black/95 backdrop-blur-md px-5 py-3 flex items-center gap-3 shadow-lg shadow-yellow-500/10"
        >
          <span className="text-2xl">{achievement.icon}</span>
          <div>
            <div className="text-yellow-400 text-[10px] font-bold tracking-wider uppercase">Achievement Unlocked</div>
            <div className="text-white text-sm font-bold">{achievement.name}</div>
            <div className="text-zinc-500 text-[10px]">{achievement.description}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
