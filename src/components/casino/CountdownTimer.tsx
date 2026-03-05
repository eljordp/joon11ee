'use client';

import { motion } from 'framer-motion';

interface Props {
  totalSeconds: number;
  remainingSeconds: number;
  label?: string;
}

export default function CountdownTimer({ totalSeconds, remainingSeconds, label }: Props) {
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const isUrgent = remainingSeconds <= 2;
  const isWarning = remainingSeconds <= 3 && !isUrgent;

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-[10px] tracking-wider uppercase">{label}</span>
          <motion.span
            key={remainingSeconds}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className={`text-xs font-black font-mono ${
              isUrgent ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-white'
            }`}
          >
            {remainingSeconds}s
          </motion.span>
        </div>
      )}
      <div className="h-1 bg-zinc-900 overflow-hidden">
        <motion.div
          className={`h-full ${
            isUrgent ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-white/40'
          }`}
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>
    </div>
  );
}
