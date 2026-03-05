'use client';

import { motion, AnimatePresence } from 'framer-motion';

export interface PlayerListEntry {
  id: string;
  name: string;
  avatar: string;
  bet: number;
  status: string;
  profit: number | null;
  isHuman: boolean;
}

interface Props {
  players: PlayerListEntry[];
  title?: string;
}

export default function PlayerList({ players, title = 'Players' }: Props) {
  return (
    <div className="border border-white/[0.06] bg-zinc-950/50">
      <div className="px-3 py-2 border-b border-white/[0.04] flex items-center justify-between">
        <span className="text-zinc-500 text-[10px] tracking-wider uppercase font-bold">{title}</span>
        <span className="text-zinc-700 text-[10px]">{players.length} online</span>
      </div>

      <div className="max-h-64 overflow-y-auto scrollbar-thin divide-y divide-white/[0.03]">
        <AnimatePresence initial={false}>
          {players.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={`flex items-center justify-between px-3 py-2 ${
                p.isHuman ? 'bg-red-600/5 border-l-2 border-red-600/40' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm flex-shrink-0">{p.avatar}</span>
                <span className={`text-xs font-bold truncate ${p.isHuman ? 'text-red-400' : 'text-zinc-400'}`}>
                  {p.isHuman ? 'You' : p.name}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {p.bet > 0 && (
                  <span className="text-zinc-600 text-[10px] font-mono">${p.bet.toLocaleString()}</span>
                )}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 ${
                  p.status === 'betting' ? 'text-yellow-400 bg-yellow-500/10' :
                  p.status === 'waiting' ? 'text-zinc-600' :
                  p.status.includes('x') ? 'text-green-400 bg-green-500/10' :
                  p.status === 'BUST' || p.status === 'CRASHED' ? 'text-red-400 bg-red-500/10' :
                  'text-zinc-500'
                }`}>
                  {p.status}
                </span>
                {p.profit !== null && p.profit !== 0 && (
                  <span className={`text-[10px] font-bold font-mono ${p.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.profit > 0 ? '+' : ''}{p.profit.toLocaleString()}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
