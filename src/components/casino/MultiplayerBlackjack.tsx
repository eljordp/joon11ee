'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import { isRed, type Card } from '@/lib/casino';
import PartySocket from 'partysocket';
import BetControls from './BetControls';
import MultiplayerChat from './MultiplayerChat';
import EmotePicker, { FloatingReactions } from './EmotePicker';
import SpectatorBadge from './SpectatorBadge';
import PlayerProfilePopup from './PlayerProfilePopup';
import CountdownTimer from './CountdownTimer';
import RoomControls, { generateRoomCode } from './RoomControls';
import type { ChatMessage } from '@/lib/multiplayer/types';

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

interface Props {
  balance: number;
  onWin: (amount: number, wagered?: number) => void;
  onLose: (amount: number) => void;
  onLeaderboardEntry?: (entry: { player: string; game: string; emoji: string; amount: number }) => void;
  username?: string;
  initialRoom?: string | null;
  gameId?: string;
  onPlayersChange?: (players: { name: string }[]) => void;
}

interface SeatState {
  index: number;
  player: { id: string; name: string; avatar: string } | null;
  bet: number;
  hand: Card[];
  handValue: number;
  status: string;
  doubled: boolean;
  profit: number;
}

interface ServerState {
  phase: string;
  seats: SeatState[];
  dealerHand: Card[];
  dealerHandValue: number;
  dealerRevealed: boolean;
  activeSeatIndex: number | null;
  turnTimeLeft: number;
  roundNumber: number;
  bettingTimeLeft: number;
  hostId: string | null;
  botIds: string[];
}

function PlayingCard({ card, hidden = false, index, small = false }: { card: Card; hidden?: boolean; index: number; small?: boolean }) {
  const red = !hidden && isRed(card.suit);
  return (
    <motion.div
      initial={{ opacity: 0, y: -30, rotateZ: -8 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35, type: 'spring', stiffness: 200 }}
      className={`relative flex-shrink-0 rounded-lg ${
        small ? 'w-10 h-[60px]' : 'w-14 h-[84px] sm:w-20 sm:h-[120px]'
      } ${
        hidden
          ? 'bg-gradient-to-br from-red-900 to-red-950 border-2 border-red-800'
          : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-white/15'
      } shadow-xl`}
    >
      {hidden ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-red-700 text-xs font-bold">J</span>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 ${small ? 'text-[8px]' : 'text-[10px] sm:text-xs'}`}>
            <p className={`font-black leading-none ${red ? 'text-red-500' : 'text-white'}`}>{card.rank}</p>
            <p className={`leading-none ${red ? 'text-red-500' : 'text-white/70'}`}>{card.suit}</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${small ? 'text-lg' : 'text-2xl sm:text-3xl'} ${red ? 'text-red-500' : 'text-white/80'}`}>{card.suit}</span>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function MultiplayerBlackjack({ balance, onWin, onLose, onLeaderboardEntry, username, initialRoom, gameId, onPlayersChange }: Props) {
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [bet, setBet] = useState(100);
  const [hasBet, setHasBet] = useState(false);
  const [seated, setSeated] = useState(false);
  const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean | null } | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [turnTimeLeft, setTurnTimeLeft] = useState(0);
  const [lastBet, setLastBet] = useState<number | null>(null);
  const [stats, setStats] = useState({ hands: 0, wins: 0, losses: 0, pushes: 0, streak: 0, bestWin: 0, sessionProfit: 0 });
  const [streakCelebration, setStreakCelebration] = useState<number | null>(null);
  const [reactions, setReactions] = useState<Map<number, { emoji: string; key: number }>>(new Map());
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [authError, setAuthError] = useState<string | undefined>();
  const [isSpectating, setIsSpectating] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [profilePlayer, setProfilePlayer] = useState<{ name: string; seatIndex: number } | null>(null);
  const [tableHistory, setTableHistory] = useState<{ round: number; players: { name: string; bet: number; profit: number }[] }[]>([]);
  const [tableName, setTableName] = useState(username || '');
  const [actionSent, setActionSent] = useState(false);

  const wsRef = useRef<PartySocket | null>(null);
  const prevPhaseRef = useRef<string>('');
  const playerName = useRef(username || 'Player_' + Math.random().toString(36).slice(2, 6).toUpperCase());
  const handleMessageRef = useRef<(data: Record<string, unknown>, selfId: string) => void>(() => {});
  useEffect(() => { if (username) { playerName.current = username; setTableName(username); } }, [username]);

  const updateStats = useCallback((outcome: 'win' | 'loss' | 'push', amount: number) => {
    setStats(prev => {
      const newStreak = outcome === 'win' ? (prev.streak > 0 ? prev.streak + 1 : 1)
        : outcome === 'loss' ? (prev.streak < 0 ? prev.streak - 1 : -1) : 0;
      const profit = outcome === 'win' ? amount : outcome === 'loss' ? -amount : 0;
      if (newStreak === 3 || newStreak === 5 || newStreak === 10) {
        setStreakCelebration(newStreak);
        setTimeout(() => sounds.hotStreak(), 500);
        setTimeout(() => setStreakCelebration(null), 1800);
      }
      return {
        hands: prev.hands + 1,
        wins: prev.wins + (outcome === 'win' ? 1 : 0),
        losses: prev.losses + (outcome === 'loss' ? 1 : 0),
        pushes: prev.pushes + (outcome === 'push' ? 1 : 0),
        streak: newStreak,
        bestWin: outcome === 'win' ? Math.max(prev.bestWin, amount) : prev.bestWin,
        sessionProfit: prev.sessionProfit + profit,
      };
    });
  }, []);

  const connectToRoom = useCallback((id: string, password?: string, spectate?: boolean) => {
    if (wsRef.current) wsRef.current.close();
    setIsSpectating(!!spectate);

    const ws = new PartySocket({
      host: PARTYKIT_HOST,
      party: 'blackjack',
      room: id,
    });

    ws.addEventListener('open', () => {
      setConnected(true);
      setMyId(ws.id);
      setAuthError(undefined);
      // Reset stale state on connect/reconnect
      setHasBet(false);
      setResult(null);
      setActionSent(false);
      ws.send(JSON.stringify({ type: 'join', name: playerName.current, avatar: '🎮', password, spectate: !!spectate }));
    });

    ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        handleMessageRef.current(data, ws.id);
      } catch { /* ignore malformed messages */ }
    });

    ws.addEventListener('close', () => {
      setConnected(false);
    });

    wsRef.current = ws;
    setRoomId(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleServerMessage = useCallback((data: Record<string, unknown>, selfId: string) => {
    switch (data.type) {
      case 'state': {
        const state = data.state as ServerState;
        setServerState(state);

        // Check if we're seated
        const mySeat = state.seats.find((s) => s.player?.id === selfId);
        if (mySeat) {
          setSeated(true);
          setMySeatIndex(mySeat.index);
        } else {
          setSeated(false);
          setMySeatIndex(null);
        }

        // Reset action debounce on any state update (server acknowledged action)
        setActionSent(false);

        if (state.phase !== prevPhaseRef.current) {
          if (state.phase === 'dealing') {
            setTimeout(() => sounds.cardDeal(), 100);
            setTimeout(() => sounds.cardDeal(), 300);
          }

          if (state.phase === 'player_turns' && mySeat) {
            if (state.activeSeatIndex === mySeat.index) sounds.click();
          }

          if (state.phase === 'dealer_turn') sounds.cardFlip();

          if (state.phase === 'results') {
            // Report own results
            if (mySeat && mySeat.bet > 0 && mySeat.hand.length > 0) {
              setLastBet(mySeat.doubled ? mySeat.bet / 2 : mySeat.bet);
              if (mySeat.profit > 0) {
                sounds.win();
                onWin(mySeat.profit, mySeat.bet);
                updateStats('win', mySeat.profit);
                const isBJ = mySeat.handValue === 21 && mySeat.hand.length === 2;
                setResult({ text: `+$${mySeat.profit.toLocaleString()}`, sub: isBJ ? 'BLACKJACK' : `${mySeat.handValue} vs ${state.dealerHandValue}`, win: true });
                if (isBJ) sounds.jackpot();
              } else if (mySeat.profit < 0) {
                sounds.lose();
                onLose(Math.abs(mySeat.profit));
                updateStats('loss', Math.abs(mySeat.profit));
                setResult({ text: `-$${Math.abs(mySeat.profit).toLocaleString()}`, sub: mySeat.handValue > 21 ? 'BUST' : `${mySeat.handValue} vs ${state.dealerHandValue}`, win: false });
              } else {
                updateStats('push', 0);
                setResult({ text: 'PUSH', sub: `both ${mySeat.handValue}`, win: null });
              }
            }
            // Report other players' wins to leaderboard
            if (onLeaderboardEntry) {
              state.seats.forEach((s) => {
                if (s.player && s.player.id !== selfId && s.profit >= 500) {
                  onLeaderboardEntry({ player: s.player.name, game: 'Table BJ', emoji: '🃏', amount: s.profit });
                }
              });
            }
          }

          if (state.phase === 'betting') {
            setHasBet(false);
            setResult(null);
          }

          prevPhaseRef.current = state.phase;
        }
        break;
      }

      case 'players': {
        const players = data.players as Array<{ name: string }>;
        setPlayerCount(players.length);
        onPlayersChange?.(players.map(p => ({ name: p.name })));
        break;
      }

      case 'turn_tick': {
        setTurnTimeLeft(data.remaining as number);
        break;
      }

      case 'chat': {
        const msg: ChatMessage = {
          id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          playerId: data.playerId as string,
          playerName: data.playerName as string,
          avatar: data.avatar as string,
          text: data.text as string,
          timestamp: Date.now(),
          type: (data.chatType as ChatMessage['type']) || 'chat',
        };
        setChatMessages((prev) => [...prev.slice(-100), msg]);
        break;
      }

      case 'auth_error': {
        setAuthError(data.message as string);
        break;
      }

      case 'reaction': {
        const seatIdx = data.seatIndex as number;
        const emoji = String(data.emoji || '🔥');
        // Show on seat bubble if seated player
        if (seatIdx >= 0) {
          setReactions(prev => { const next = new Map(prev); next.set(seatIdx, { emoji, key: Date.now() }); return next; });
          setTimeout(() => setReactions(prev => { const next = new Map(prev); next.delete(seatIdx); return next; }), 2000);
        }
        // Always show floating reaction too
        const rId = Date.now() + Math.random();
        const rx = 10 + Math.random() * 80;
        setFloatingReactions(prev => [...prev, { id: rId, emoji, x: rx }]);
        setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== rId)), 2500);
        break;
      }

      case 'spectator_count': {
        setSpectatorCount(data.count as number);
        break;
      }

      case 'joined_as_spectator': {
        setIsSpectating(true);
        break;
      }

      case 'table_history': {
        setTableHistory(data.history as typeof tableHistory);
        break;
      }
    }
  }, [onWin, onLose, updateStats]);

  // Keep message handler ref in sync
  useEffect(() => { handleMessageRef.current = handleServerMessage; }, [handleServerMessage]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const createRoom = useCallback((code?: string, password?: string) => connectToRoom(code || generateRoomCode(), password), [connectToRoom]);
  const joinRoom = useCallback((code: string, password?: string) => connectToRoom(code, password), [connectToRoom]);
  const watchRoom = useCallback((code: string, password?: string) => connectToRoom(code, password, true), [connectToRoom]);
  const leaveRoom = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    setRoomId(null);
    setConnected(false);
    setServerState(null);
    setSeated(false);
    setMySeatIndex(null);
    setHasBet(false);
    setResult(null);
    setChatMessages([]);
    setIsSpectating(false);
    setSpectatorCount(0);
    prevPhaseRef.current = '';
  }, []);

  const sitDown = useCallback((seatIndex: number) => {
    if (!wsRef.current || seated || isSpectating) return;
    wsRef.current.send(JSON.stringify({ type: 'take_seat', seatIndex }));
    sounds.click();
  }, [seated, isSpectating]);

  const placeBet = useCallback((amount?: number) => {
    const betAmount = amount || bet;
    if (!wsRef.current || hasBet || balance < betAmount) return;
    wsRef.current.send(JSON.stringify({ type: 'bet', amount: betAmount }));
    setHasBet(true);
    setLastBet(betAmount);
    sounds.bet();
  }, [hasBet, balance, bet]);

  const hit = useCallback(() => { if (actionSent) return; setActionSent(true); wsRef.current?.send(JSON.stringify({ type: 'hit' })); sounds.cardDeal(); }, [actionSent]);
  const stand = useCallback(() => { if (actionSent) return; setActionSent(true); wsRef.current?.send(JSON.stringify({ type: 'stand' })); sounds.click(); }, [actionSent]);
  const doubleDown = useCallback(() => {
    if (actionSent) return; setActionSent(true);
    wsRef.current?.send(JSON.stringify({ type: 'double' }));
    sounds.bet();
  }, [actionSent]);

  const sendChat = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }));
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'reaction', emoji }));
  }, []);

  const addBot = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'add_bot' }));
  }, []);

  const removeBot = useCallback((botId: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'remove_bot', botId }));
  }, []);

  // Not connected
  if (!connected || !serverState) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Blackjack Table</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        {/* Table name */}
        <div className="border border-white/[0.06] px-4 py-3 flex items-center gap-3">
          <span className="text-zinc-500 text-xs">Name:</span>
          <input
            type="text"
            value={tableName}
            onChange={(e) => {
              const v = e.target.value.replace(/[^a-zA-Z0-9_. ]/g, '').slice(0, 16);
              setTableName(v);
              playerName.current = v || 'Player_' + Math.random().toString(36).slice(2, 6).toUpperCase();
            }}
            placeholder="Your table name"
            maxLength={16}
            className="flex-1 px-2 py-1.5 text-sm bg-black border border-white/10 text-white outline-none focus:border-green-500 transition-colors"
          />
        </div>
        <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={false} gameId={gameId} initialRoom={initialRoom || undefined} authError={authError} />
        <div className="border border-white/[0.06] bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-500 text-sm mb-2">Create or join a room to play multiplayer blackjack</p>
          <p className="text-zinc-700 text-xs">Share the room code with friends or play with bots</p>
        </div>
      </div>
    );
  }

  const { phase, seats, dealerHand, dealerHandValue, dealerRevealed, activeSeatIndex, roundNumber, bettingTimeLeft, hostId, botIds } = serverState;
  const isMyTurn = mySeatIndex !== null && activeSeatIndex === mySeatIndex && phase === 'player_turns';
  const mySeat = mySeatIndex !== null ? seats[mySeatIndex] : null;
  const canDouble = isMyTurn && mySeat && mySeat.hand.length === 2 && !mySeat.doubled && balance >= mySeat.bet;
  const isHost = myId !== null && hostId === myId;
  const botIdSet = new Set(botIds || []);

  return (
    <div className="space-y-3 relative">
      <FloatingReactions reactions={floatingReactions} />
      {/* Streak celebration overlay */}
      <AnimatePresence>
        {streakCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <div className={`text-center ${streakCelebration >= 10 ? 'text-yellow-400' : streakCelebration >= 5 ? 'text-green-400' : 'text-white'}`}>
              <p className="text-5xl font-black">W{streakCelebration}</p>
              <p className="text-sm tracking-[0.3em] uppercase font-bold mt-1">
                {streakCelebration >= 10 ? 'LEGENDARY' : streakCelebration >= 5 ? 'ON FIRE' : 'HOT STREAK'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Blackjack Table</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
          {stats.streak !== 0 && (
            <span className={`text-[10px] font-bold px-2 py-0.5 ${stats.streak > 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {stats.streak > 0 ? `W${stats.streak}` : `L${Math.abs(stats.streak)}`}
            </span>
          )}
        </div>
        <span className="text-zinc-600 text-xs">Round #{roundNumber}</span>
      </div>

      <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={connected} gameId={gameId} initialRoom={initialRoom || undefined} authError={authError} onWatch={watchRoom} />

      <SpectatorBadge count={spectatorCount} isSpectating={isSpectating} />

      {/* Session stats */}
      {stats.hands > 0 && (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap px-3 py-2 bg-zinc-900/30 border border-white/[0.04] text-[10px] tracking-wider uppercase">
          <span className="text-zinc-600">Hands <span className="text-zinc-400 font-bold">{stats.hands}</span></span>
          <span className="text-zinc-600">W <span className="text-green-400 font-bold">{stats.wins}</span></span>
          <span className="text-zinc-600">L <span className="text-red-400 font-bold">{stats.losses}</span></span>
          <span className="text-zinc-600">Win% <span className="text-white font-bold">{Math.round((stats.wins / stats.hands) * 100)}%</span></span>
          <span className={`font-bold font-mono ml-auto ${stats.sessionProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.sessionProfit >= 0 ? '+' : ''}${stats.sessionProfit.toLocaleString()}
          </span>
        </div>
      )}

      <div className="border border-white/[0.06] bg-zinc-950/50 p-4 sm:p-6">
        {/* Dealer */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-500 text-[10px] tracking-wider uppercase">Dealer</span>
            {dealerRevealed && dealerHand.length > 0 && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`text-sm font-mono font-bold ${dealerHandValue > 21 ? 'text-red-400' : 'text-white'}`}
              >
                {dealerHandValue}{dealerHandValue > 21 ? ' BUST' : ''}
              </motion.span>
            )}
          </div>
          <div className="flex gap-1.5 sm:gap-2 min-h-[84px] sm:min-h-[120px] justify-center">
            {dealerHand.map((card, i) => (
              <PlayingCard key={`d-${i}-${card.rank}${card.suit}`} card={card} hidden={card.rank === '?' && card.suit === '?'} index={i} />
            ))}
            {dealerHand.length === 0 && <div className="flex items-center text-zinc-800 text-xs">waiting for deal...</div>}
          </div>
        </div>

        <div className="border-t border-dashed border-white/[0.06] mb-6" />

        {/* Seats */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {seats.map((seat, idx) => {
            const isActive = activeSeatIndex === idx;
            const isMe = seat.player?.id === myId;
            const isEmpty = !seat.player;
            const isBot = seat.player ? botIdSet.has(seat.player.id) : false;

            return (
              <div key={idx}
                className={`relative border p-2 sm:p-3 min-h-[140px] sm:min-h-[200px] flex flex-col transition-all ${
                  isActive ? 'border-yellow-500/50 bg-yellow-500/5 shadow-[0_0_15px_rgba(234,179,8,0.1)]' :
                  isMe ? 'border-red-600/30 bg-red-600/5' :
                  isEmpty ? 'border-dashed border-white/[0.06] hover:border-white/[0.12] cursor-pointer' :
                  'border-white/[0.06]'
                }`}
                onClick={() => { if (isEmpty && !seated && !isSpectating) sitDown(idx); }}
              >
                {/* Reaction bubble */}
                <AnimatePresence>
                  {reactions.has(idx) && (
                    <motion.div
                      key={reactions.get(idx)!.key}
                      initial={{ opacity: 0, y: 10, scale: 0 }}
                      animate={{ opacity: 1, y: -20, scale: 1.5 }}
                      exit={{ opacity: 0, y: -40, scale: 0.5 }}
                      className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl z-10 pointer-events-none"
                    >
                      {reactions.get(idx)!.emoji}
                    </motion.div>
                  )}
                </AnimatePresence>
                {isEmpty ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-1">
                    <span className="text-zinc-700 text-xl">+</span>
                    <span className="text-zinc-700 text-[9px] tracking-wider uppercase">{seated ? '' : 'Sit'}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs">{seat.player!.avatar}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (!isBot) setProfilePlayer({ name: seat.player!.name, seatIndex: idx }); }}
                        className={`text-[10px] font-bold truncate ${isMe ? 'text-red-400' : 'text-zinc-400'} ${!isBot ? 'hover:underline cursor-pointer' : ''}`}
                      >
                        {seat.player!.name}
                      </button>
                      {isBot && <span className="text-[8px] text-zinc-600 font-mono">BOT</span>}
                    </div>
                    {isHost && isBot && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeBot(seat.player!.id); }}
                        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-red-400 text-[10px] font-bold transition-colors"
                        title="Remove bot"
                      >
                        x
                      </button>
                    )}
                    {seat.bet > 0 && (
                      <div className="text-[10px] text-zinc-500 font-mono mb-1">
                        ${seat.bet.toLocaleString()}{seat.doubled && <span className="text-yellow-400 ml-1">2x</span>}
                      </div>
                    )}
                    <div className="flex gap-0.5 flex-wrap mb-1 flex-1">
                      {seat.hand.map((card, ci) => (
                        <PlayingCard key={`s${idx}-${ci}`} card={card} index={ci} small />
                      ))}
                    </div>
                    {seat.hand.length > 0 && (
                      <div className="flex items-center justify-between mt-auto">
                        <span className={`text-xs font-mono font-bold ${
                          seat.handValue === 21 ? 'text-green-400' : seat.handValue > 21 ? 'text-red-400' : 'text-white'
                        }`}>
                          {seat.handValue}
                        </span>
                        <span className={`text-[9px] font-bold uppercase ${
                          seat.status === 'blackjack' ? 'text-yellow-400' :
                          seat.status === 'busted' ? 'text-red-400' :
                          seat.status === 'stood' ? 'text-zinc-500' :
                          seat.status === 'playing' ? 'text-green-400' :
                          seat.status === 'done' ? (seat.profit > 0 ? 'text-green-400' : seat.profit < 0 ? 'text-red-400' : 'text-yellow-400') :
                          'text-zinc-600'
                        }`}>
                          {seat.status === 'blackjack' ? 'BJ!' :
                           seat.status === 'busted' ? 'BUST' :
                           seat.status === 'playing' ? (isActive ? 'TURN' : '...') :
                           seat.status === 'stood' ? 'STAND' :
                           seat.status === 'done' ? (
                             seat.profit > 0 ? `+$${seat.profit}` : seat.profit < 0 ? `-$${Math.abs(seat.profit)}` : 'PUSH'
                           ) : ''}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {isHost && (
          <div className="flex items-center justify-end gap-2 mt-2">
            <span className="text-zinc-700 text-[9px] tracking-wider uppercase">Bots</span>
            <button
              onClick={addBot}
              disabled={botIdSet.size >= 3 || seats.every((s) => s.player !== null)}
              className="px-2 py-1 text-[10px] font-bold tracking-wider uppercase border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              + Add
            </button>
          </div>
        )}

        {phase === 'player_turns' && activeSeatIndex !== null && (
          <div className="mt-3">
            <CountdownTimer
              totalSeconds={15}
              remainingSeconds={turnTimeLeft}
              label={activeSeatIndex === mySeatIndex ? 'Your turn' : `${seats[activeSeatIndex]?.player?.name || 'Player'}'s turn`}
            />
          </div>
        )}
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="text-center">
            <p className={`text-2xl sm:text-3xl font-black ${result.win === true ? 'text-green-400' : result.win === false ? 'text-red-400' : 'text-yellow-400'}`}>{result.text}</p>
            <p className={`text-xs mt-1 ${result.win === true ? 'text-green-500/70' : result.win === false ? 'text-zinc-600' : 'text-yellow-500/70'}`}>{result.sub}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="space-y-3">
        {!seated && !isSpectating && (
          <div className="text-center border border-dashed border-white/[0.08] py-6">
            <p className="text-zinc-500 text-sm mb-1">Click an empty seat to sit down</p>
            <p className="text-zinc-700 text-xs">{phase !== 'waiting' && phase !== 'betting' ? 'You\'ll play next round' : 'Pick your spot at the table'}</p>
          </div>
        )}

        {seated && phase === 'betting' && !hasBet && (
          <div className="space-y-3">
            <CountdownTimer totalSeconds={8} remainingSeconds={bettingTimeLeft} label="Betting closes in" />
            {lastBet && balance >= lastBet && (
              <button onClick={() => placeBet(lastBet)}
                className="w-full bg-red-600/80 text-white py-3 text-sm font-bold tracking-widest uppercase hover:bg-red-600 transition-all"
              >
                SAME BET ${lastBet.toLocaleString()}
              </button>
            )}
            <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />
            <button onClick={() => placeBet()} disabled={balance < bet}
              className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              PLACE BET ${bet.toLocaleString()}
            </button>
          </div>
        )}

        {seated && phase === 'betting' && hasBet && (
          <div className="text-center text-green-400/60 text-xs font-bold py-3 animate-pulse tracking-wider uppercase">
            Bet placed — dealing soon...
          </div>
        )}

        {isMyTurn && (
          <div className={`grid ${canDouble ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
            <button onClick={hit} disabled={actionSent} className="bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed">HIT</button>
            <button onClick={stand} disabled={actionSent} className="border border-white/20 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">STAND</button>
            {canDouble && (
              <button onClick={doubleDown} disabled={actionSent} className="bg-yellow-600/80 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-yellow-500/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed">2x</button>
            )}
          </div>
        )}

        {seated && phase === 'player_turns' && !isMyTurn && activeSeatIndex !== null && (
          <div className="text-center text-zinc-500 text-sm py-3 animate-pulse">
            {seats[activeSeatIndex]?.player?.name || 'Player'} is playing...
          </div>
        )}

        {phase === 'dealing' && <div className="text-center text-zinc-500 text-sm py-3 animate-pulse">dealing cards...</div>}
        {phase === 'dealer_turn' && <div className="text-center text-zinc-500 text-sm py-3 animate-pulse">dealer&apos;s turn...</div>}
        {phase === 'results' && <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">next round starting soon...</div>}
        {phase === 'waiting' && seated && <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">waiting for round to start...</div>}
        {seated && !hasBet && (phase === 'dealing' || phase === 'player_turns' || phase === 'dealer_turn') && mySeat && mySeat.bet === 0 && (
          <div className="text-center text-zinc-500 text-xs py-3 tracking-wider uppercase">playing next round...</div>
        )}
      </div>

      {/* Reactions */}
      {connected && (
        <div className="flex items-center justify-center">
          <EmotePicker onSelect={sendReaction} />
        </div>
      )}

      {/* Head-to-head table history */}
      {tableHistory.length > 0 && connected && (() => {
        const myName = username;
        const h2h: Record<string, { hands: number; myProfit: number }> = {};
        for (const round of tableHistory) {
          const me = round.players.find(p => p.name === myName);
          if (!me) continue;
          for (const p of round.players) {
            if (p.name === myName) continue;
            if (!h2h[p.name]) h2h[p.name] = { hands: 0, myProfit: 0 };
            h2h[p.name].hands++;
            h2h[p.name].myProfit += me.profit;
          }
        }
        const entries = Object.entries(h2h).filter(([, v]) => v.hands >= 2);
        if (entries.length === 0) return null;
        return (
          <div className="border border-white/[0.04] p-3 flex flex-wrap gap-3">
            <span className="text-zinc-600 text-[9px] uppercase tracking-wider">Table H2H:</span>
            {entries.map(([name, v]) => (
              <span key={name} className="text-[10px]">
                <span className="text-zinc-400">vs @{name}:</span>{' '}
                <span className="text-zinc-500">{v.hands}h</span>{' '}
                <span className={v.myProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {v.myProfit >= 0 ? '+' : ''}${Math.abs(v.myProfit).toLocaleString()}
                </span>
              </span>
            ))}
          </div>
        );
      })()}

      <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />

      <PlayerProfilePopup
        player={profilePlayer}
        onClose={() => setProfilePlayer(null)}
      />
    </div>
  );
}
