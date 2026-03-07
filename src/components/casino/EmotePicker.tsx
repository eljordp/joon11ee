'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOTES = [
  '🔥', '💀', '🎉', '😱', '💰', '🤑', '😤', '🫡',
  '👑', '💎', '🎯', '🤡', '🙏', '😂', '🥶', '🏆',
];

interface Props {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export default function EmotePicker({ onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const handleSelect = useCallback((e: string) => {
    if (cooldown) return;
    onSelect(e);
    setOpen(false);
    setCooldown(true);
    setTimeout(() => setCooldown(false), 500);
  }, [onSelect, cooldown]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled || cooldown}
        className="px-3 py-2 flex items-center gap-2 text-sm border border-white/[0.06] hover:border-white/20 hover:bg-white/5 transition-all disabled:opacity-30"
      >
        <span className="text-lg">😀</span>
        <span className="text-zinc-500 text-[10px] tracking-wider uppercase hidden sm:inline">React</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/95 border border-white/10 p-2 grid grid-cols-8 gap-1 z-50 backdrop-blur-md min-w-[280px]"
          >
            {EMOTES.map(e => (
              <button
                key={e}
                onClick={() => handleSelect(e)}
                className="w-9 h-9 flex items-center justify-center text-xl hover:bg-white/10 hover:scale-125 transition-all rounded"
              >
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Floating reaction layer — render above game area */
export function FloatingReactions({ reactions }: { reactions: { id: number; emoji: string; x: number }[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      <AnimatePresence>
        {reactions.map(r => (
          <motion.div
            key={r.id}
            initial={{ opacity: 1, scale: 0.5, y: 0 }}
            animate={{ opacity: 0, scale: 1.2, y: -200 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
            className="absolute text-4xl sm:text-5xl"
            style={{ left: `${r.x}%`, bottom: '20%' }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
