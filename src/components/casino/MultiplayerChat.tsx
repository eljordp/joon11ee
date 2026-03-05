'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '@/lib/multiplayer/types';

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  collapsed?: boolean;
}

export default function MultiplayerChat({ messages, onSend, collapsed = false }: Props) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(!collapsed);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full border border-white/[0.06] px-3 py-2 text-zinc-600 text-[10px] tracking-wider uppercase hover:text-zinc-400 transition-colors flex items-center justify-between"
      >
        <span>Chat ({messages.length})</span>
        <span>+</span>
      </button>
    );
  }

  return (
    <div className="border border-white/[0.06] bg-zinc-950/50">
      <div className="px-3 py-2 border-b border-white/[0.04] flex items-center justify-between">
        <span className="text-zinc-500 text-[10px] tracking-wider uppercase font-bold">Live Chat</span>
        {collapsed && (
          <button onClick={() => setIsOpen(false)} className="text-zinc-700 text-xs hover:text-zinc-400">
            —
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="h-32 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin"
      >
        <AnimatePresence initial={false}>
          {messages.slice(-50).map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-[11px] leading-relaxed ${
                msg.type === 'system' ? 'text-zinc-600 italic' :
                msg.type === 'win' || msg.type === 'cashout' ? 'text-green-500/70' :
                'text-zinc-400'
              }`}
            >
              {msg.type === 'chat' && (
                <>
                  <span className="text-zinc-500 font-bold mr-1">{msg.avatar}</span>
                  <span className="text-zinc-300 font-bold mr-1">{msg.playerName}:</span>
                </>
              )}
              {msg.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="border-t border-white/[0.04] flex"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="type here..."
          maxLength={100}
          className="flex-1 bg-transparent px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-700"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-3 py-2 text-xs font-bold text-red-500 hover:text-red-400 disabled:text-zinc-800 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
