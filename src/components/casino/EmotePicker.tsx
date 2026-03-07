'use client';

import { useState, useRef, useEffect } from 'react';
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="w-10 h-10 flex items-center justify-center text-lg border border-white/[0.06] hover:border-white/20 hover:bg-white/5 transition-all disabled:opacity-30"
      >
        😀
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-black/95 border border-white/10 p-2 grid grid-cols-4 gap-1 z-50 backdrop-blur-md"
          >
            {EMOTES.map(e => (
              <button
                key={e}
                onClick={() => { onSelect(e); setOpen(false); }}
                className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/10 transition-all rounded"
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
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      <AnimatePresence>
        {reactions.map(r => (
          <motion.div
            key={r.id}
            initial={{ opacity: 1, y: 0, x: `${r.x}%` }}
            animate={{ opacity: 0, y: -120 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute bottom-4 text-3xl"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
