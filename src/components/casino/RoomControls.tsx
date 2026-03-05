'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  roomId: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
  playerCount: number;
  connected: boolean;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export { generateRoomCode };

export default function RoomControls({ roomId, onCreateRoom, onJoinRoom, onLeaveRoom, playerCount, connected }: Props) {
  const [joinInput, setJoinInput] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (connected && roomId) {
    return (
      <div className="border border-green-500/20 bg-green-500/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div>
            <span className="text-green-400 text-xs font-bold tracking-wider uppercase">Room: </span>
            <button onClick={copyCode} className="text-white text-sm font-mono font-bold hover:text-green-300 transition-colors">
              {roomId}
            </button>
            <AnimatePresence>
              {copied && (
                <motion.span
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-green-400 text-[10px] ml-2"
                >
                  copied!
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-[10px]">{playerCount} player{playerCount !== 1 ? 's' : ''}</span>
          <button
            onClick={onLeaveRoom}
            className="px-3 py-1.5 border border-red-600/30 text-red-400 text-[10px] font-bold tracking-wider uppercase hover:bg-red-600/10 transition-all"
          >
            Leave
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <span className="text-zinc-500 text-xs">Play with friends</span>
      <div className="flex items-center gap-2">
        {showJoin ? (
          <form
            onSubmit={(e) => { e.preventDefault(); if (joinInput.trim()) onJoinRoom(joinInput.trim().toUpperCase()); setShowJoin(false); setJoinInput(''); }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={8}
              autoFocus
              className="w-24 px-2 py-1.5 text-xs font-bold font-mono bg-black border border-white/20 text-white outline-none focus:border-green-500 transition-colors uppercase text-center tracking-wider"
            />
            <button type="submit" className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-bold tracking-wider uppercase hover:bg-green-500 transition-all">
              Go
            </button>
            <button type="button" onClick={() => setShowJoin(false)} className="px-2 py-1.5 text-zinc-600 text-[10px] hover:text-white transition-colors">
              X
            </button>
          </form>
        ) : (
          <>
            <button
              onClick={onCreateRoom}
              className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-bold tracking-wider uppercase hover:bg-green-500 transition-all"
            >
              Create Room
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="px-3 py-1.5 border border-white/10 text-zinc-400 text-[10px] font-bold tracking-wider uppercase hover:text-white transition-all"
            >
              Join Room
            </button>
          </>
        )}
      </div>
    </div>
  );
}
