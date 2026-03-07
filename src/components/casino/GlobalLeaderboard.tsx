'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PartySocket from 'partysocket';

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

interface LeaderboardEntry {
  player: string;
  game: string;
  amount: number;
  timestamp: number;
}

interface Props {
  username: string;
  onReportWin?: (player: string, game: string, amount: number) => void;
}

const RANK_COLORS = ['text-yellow-400', 'text-zinc-300', 'text-orange-400'];

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export let leaderboardWs: PartySocket | null = null;
export let currentJackpot = 10000;

export function reportWin(player: string, game: string, amount: number) {
  if (leaderboardWs?.readyState === WebSocket.OPEN) {
    leaderboardWs.send(JSON.stringify({ type: 'report_win', player, game, amount }));
  }
}

export function contributeJackpot(amount: number) {
  if (leaderboardWs?.readyState === WebSocket.OPEN) {
    leaderboardWs.send(JSON.stringify({ type: 'jackpot_contribution', amount }));
  }
}

export function checkJackpot(player: string) {
  if (leaderboardWs?.readyState === WebSocket.OPEN) {
    leaderboardWs.send(JSON.stringify({ type: 'check_jackpot', player }));
  }
}

export default function GlobalLeaderboard({ username }: Props) {
  const [tab, setTab] = useState<'daily' | 'weekly' | 'allTime'>('daily');
  const [daily, setDaily] = useState<LeaderboardEntry[]>([]);
  const [weekly, setWeekly] = useState<LeaderboardEntry[]>([]);
  const [allTime, setAllTime] = useState<LeaderboardEntry[]>([]);
  const [jackpot, setJackpot] = useState(10000);
  const [jackpotWinner, setJackpotWinner] = useState<{ player: string; amount: number } | null>(null);
  const wsRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    const ws = new PartySocket({
      host: PARTYKIT_HOST,
      party: 'leaderboard',
      room: 'main',
    });
    wsRef.current = ws;
    leaderboardWs = ws;

    ws.addEventListener('message', (e) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try { data = JSON.parse(e.data); } catch { return; }
      if (data.type === 'leaderboard') {
        setDaily(data.daily || []);
        setWeekly(data.weekly || []);
        setAllTime(data.allTime || []);
        if (data.jackpot !== undefined) { setJackpot(data.jackpot); currentJackpot = data.jackpot; }
      }
      if (data.type === 'jackpot_update') {
        setJackpot(data.jackpot);
        currentJackpot = data.jackpot;
      }
      if (data.type === 'jackpot_won') {
        setJackpotWinner({ player: data.player, amount: data.amount });
        setJackpot(10000);
        currentJackpot = 10000;
        setTimeout(() => setJackpotWinner(null), 5000);
      }
    });

    return () => {
      ws.close();
      leaderboardWs = null;
    };
  }, []);

  const entries = tab === 'daily' ? daily : tab === 'weekly' ? weekly : allTime;

  return (
    <div className="mt-8">
      {/* Jackpot winner celebration */}
      <AnimatePresence>
        {jackpotWinner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <div className="text-center">
              <p className="text-yellow-400 text-6xl mb-4">🎰</p>
              <p className="text-yellow-400 text-[10px] tracking-[0.5em] uppercase font-bold mb-2">JACKPOT</p>
              <p className="text-white text-4xl font-black mb-2">{jackpotWinner.player}</p>
              <p className="text-green-400 text-5xl font-black font-mono">+${jackpotWinner.amount.toLocaleString()}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard */}
      <div className="border border-white/[0.04]">
        <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <span className="text-zinc-400 text-xs tracking-wider uppercase font-bold">Leaderboard</span>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'allTime'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2 py-1 text-[10px] font-bold tracking-wider uppercase transition-all ${
                  tab === t ? 'bg-red-600 text-white' : 'text-zinc-600 hover:text-white'
                }`}
              >
                {t === 'allTime' ? 'All Time' : t === 'daily' ? '24h' : '7d'}
              </button>
            ))}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-xs">
            No entries yet. Win $200+ to appear.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {entries.map((entry, i) => {
              const isYou = entry.player.toLowerCase() === username.toLowerCase();
              return (
                <div key={`${entry.amount}-${entry.timestamp}-${i}`} className={`flex items-center justify-between px-4 py-2.5 ${isYou ? 'bg-white/[0.02]' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-black w-5 ${RANK_COLORS[i] || 'text-zinc-600'}`}>
                      {i + 1}.
                    </span>
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-bold ${isYou ? 'text-red-400' : 'text-zinc-400'}`}>
                        {entry.player}
                      </span>
                      <span className="text-green-400 text-sm font-bold font-mono">
                        +${entry.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-zinc-600 text-[10px]">{entry.game}</span>
                    <span className="text-zinc-800 text-[9px]">{timeAgo(entry.timestamp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
