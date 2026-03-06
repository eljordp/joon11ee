'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  roomId: string | null;
  onCreateRoom: (code?: string, password?: string) => void;
  onJoinRoom: (roomId: string, password?: string) => void;
  onLeaveRoom: () => void;
  playerCount: number;
  connected: boolean;
  gameId?: string;
  initialRoom?: string;
  authError?: string;
  hasPassword?: boolean;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export { generateRoomCode };

export default function RoomControls({ roomId, onCreateRoom, onJoinRoom, onLeaveRoom, playerCount, connected, gameId, initialRoom, authError, hasPassword }: Props) {
  const [joinInput, setJoinInput] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [password, setPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const autoJoinedRef = useRef(false);

  // Auto-join room from invite link
  useEffect(() => {
    if (initialRoom && !connected && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      onJoinRoom(initialRoom);
    }
  }, [initialRoom, connected, onJoinRoom]);

  // Show password prompt on auth error
  useEffect(() => {
    if (authError && pendingJoinCode) {
      setShowPasswordPrompt(true);
    }
  }, [authError, pendingJoinCode]);

  const copyCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyInviteLink = () => {
    if (roomId && gameId) {
      const url = `${window.location.origin}/casino?game=${gameId}&room=${roomId}`;
      navigator.clipboard.writeText(url).catch(() => {});
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const handleCreate = () => {
    const code = customCode.trim() || undefined;
    const pw = password.trim() || undefined;
    onCreateRoom(code, pw);
    setShowCreate(false);
    setCustomCode('');
    setPassword('');
  };

  const handleJoin = (code: string) => {
    setPendingJoinCode(code);
    onJoinRoom(code);
  };

  const handlePasswordSubmit = () => {
    if (pendingJoinCode && joinPassword.trim()) {
      onJoinRoom(pendingJoinCode, joinPassword.trim());
      setShowPasswordPrompt(false);
      setJoinPassword('');
    }
  };

  if (connected && roomId) {
    return (
      <div className="border border-green-500/20 bg-green-500/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div className="flex items-center gap-1.5">
            {hasPassword && <span className="text-yellow-500 text-xs">🔒</span>}
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
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-[10px]">{playerCount} player{playerCount !== 1 ? 's' : ''}</span>
          {gameId && (
            <button
              onClick={copyInviteLink}
              className="px-3 py-1.5 border border-green-600/30 text-green-400 text-[10px] font-bold tracking-wider uppercase hover:bg-green-600/10 transition-all"
            >
              {copiedInvite ? 'Copied!' : 'Invite'}
            </button>
          )}
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

  // Password prompt overlay
  if (showPasswordPrompt) {
    return (
      <div className="border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
        <div className="text-yellow-400 text-xs font-bold mb-2">🔒 This room requires a password</div>
        {authError && <div className="text-red-400 text-[10px] mb-2">{authError}</div>}
        <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }} className="flex items-center gap-2">
          <input
            type="password"
            value={joinPassword}
            onChange={(e) => setJoinPassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
            className="flex-1 px-2 py-1.5 text-xs bg-black border border-white/20 text-white outline-none focus:border-yellow-500 transition-colors"
          />
          <button type="submit" className="px-3 py-1.5 bg-yellow-600 text-black text-[10px] font-bold tracking-wider uppercase hover:bg-yellow-500 transition-all">
            Enter
          </button>
          <button type="button" onClick={() => { setShowPasswordPrompt(false); setPendingJoinCode(''); setJoinPassword(''); }} className="px-2 py-1.5 text-zinc-600 text-[10px] hover:text-white transition-colors">
            Cancel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <span className="text-zinc-500 text-xs">Play with friends</span>
      <div className="flex items-center gap-2">
        {showCreate ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="CUSTOM CODE"
                maxLength={8}
                autoFocus
                className="w-24 px-2 py-1.5 text-xs font-bold font-mono bg-black border border-white/20 text-white outline-none focus:border-green-500 transition-colors uppercase text-center tracking-wider"
              />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                maxLength={20}
                className="w-24 px-2 py-1.5 text-xs bg-black border border-white/20 text-white outline-none focus:border-yellow-500 transition-colors"
              />
              <button onClick={handleCreate} className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-bold tracking-wider uppercase hover:bg-green-500 transition-all whitespace-nowrap">
                Go
              </button>
              <button onClick={() => { setShowCreate(false); setCustomCode(''); setPassword(''); }} className="px-2 py-1.5 text-zinc-600 text-[10px] hover:text-white transition-colors">
                X
              </button>
            </div>
            <div className="text-zinc-600 text-[9px]">Leave blank for random code. Password is optional.</div>
          </div>
        ) : showJoin ? (
          <form
            onSubmit={(e) => { e.preventDefault(); if (joinInput.trim()) handleJoin(joinInput.trim().toUpperCase()); setShowJoin(false); setJoinInput(''); }}
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
              onClick={() => setShowCreate(true)}
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
