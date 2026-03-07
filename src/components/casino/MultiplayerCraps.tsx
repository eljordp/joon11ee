'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import PartySocket from 'partysocket';
import BetControls from './BetControls';
import MultiplayerChat from './MultiplayerChat';
import EmotePicker, { FloatingReactions } from './EmotePicker';
import CountdownTimer from './CountdownTimer';
import RoomControls, { generateRoomCode } from './RoomControls';
import SpectatorBadge from './SpectatorBadge';
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

interface CrapsBet { type: 'pass' | 'dont_pass' | 'field' | 'place'; amount: number; placeNumber?: number; }
interface PlayerBets { playerId: string; playerName: string; bets: CrapsBet[]; }

interface ServerState {
  phase: 'waiting' | 'betting' | 'rolling' | 'point_betting' | 'point_rolling' | 'results';
  shooterId: string | null;
  shooterOrder: string[];
  point: number | null;
  dice: [number, number];
  diceTotal: number;
  bettingTimeLeft: number;
  roundNumber: number;
  rollHistory: { dice: [number, number]; total: number }[];
  results: { playerId: string; playerName: string; profit: number }[];
  playerBets: PlayerBets[];
}

const DICE_FACES: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

function getOutcomeLabel(total: number, point: number | null): { text: string; color: string } | null {
  if (point === null) {
    if (total === 7 || total === 11) return { text: 'NATURAL!', color: 'text-green-400' };
    if (total === 2 || total === 3) return { text: 'CRAPS!', color: 'text-orange-400' };
    if (total === 12) return { text: 'CRAPS! (12)', color: 'text-orange-400' };
    return { text: `POINT IS ${total}`, color: 'text-yellow-400' };
  } else {
    if (total === point) return { text: 'POINT HIT!', color: 'text-yellow-400' };
    if (total === 7) return { text: 'SEVEN OUT!', color: 'text-red-400' };
    return null;
  }
}

const PLACE_ODDS_DISPLAY: Record<number, string> = { 4: '9:5', 5: '7:5', 6: '7:6', 8: '7:6', 9: '7:5', 10: '9:5' };

export default function MultiplayerCraps({ balance, onWin, onLose, onLeaderboardEntry, username, initialRoom, gameId, onPlayersChange }: Props) {
  const [bet, setBet] = useState(100);
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean | null } | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [outcomeLabel, setOutcomeLabel] = useState<{ text: string; color: string } | null>(null);
  const [authError, setAuthError] = useState<string | undefined>();
  const [isSpectating, setIsSpectating] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);

  const wsRef = useRef<PartySocket | null>(null);
  const prevPhaseRef = useRef<string>('');
  const serverStateRef = useRef<ServerState | null>(null);
  const passwordRef = useRef<string | undefined>(undefined);
  const playerName = useRef(username || 'Player_' + Math.random().toString(36).slice(2, 6).toUpperCase());
  useEffect(() => { if (username) playerName.current = username; }, [username]);

  const connectToRoom = useCallback((id: string, password?: string, spectate?: boolean) => {
    if (wsRef.current) wsRef.current.close();
    passwordRef.current = password;
    setAuthError(undefined);
    setIsSpectating(!!spectate);
    const ws = new PartySocket({ host: PARTYKIT_HOST, party: 'craps', room: id });
    ws.addEventListener('open', () => {
      setConnected(true);
      setMyId(ws.id);
      ws.send(JSON.stringify({ type: 'join', name: playerName.current, avatar: '🎲', password: passwordRef.current, spectate: !!spectate }));
    });
    ws.addEventListener('message', (evt) => {
      const data = JSON.parse(evt.data);
      handleServerMessage(data, ws.id);
    });
    ws.addEventListener('close', () => setConnected(false));
    wsRef.current = ws;
    setRoomId(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleServerMessage = useCallback((data: Record<string, unknown>, selfId: string) => {
    switch (data.type) {
      case 'state': {
        const state = data.state as ServerState;
        setServerState(state);
        serverStateRef.current = state;

        if (state.phase !== prevPhaseRef.current) {
          if (state.phase === 'results') {
            const myResult = state.results.find(r => r.playerId === selfId);
            const myBetTotal = state.playerBets.find(pb => pb.playerId === selfId)?.bets.reduce((sum, b) => sum + b.amount, 0) || 0;
            if (myResult) {
              if (myResult.profit > 0) {
                sounds.win();
                onWin(myResult.profit, myBetTotal);
                setResult({ text: `+$${myResult.profit.toLocaleString()}`, sub: 'nice roll!', win: true });
              } else if (myResult.profit < 0) {
                sounds.lose();
                onLose(Math.abs(myResult.profit));
                setResult({ text: `-$${Math.abs(myResult.profit).toLocaleString()}`, sub: 'tough break', win: false });
              } else {
                setResult({ text: 'PUSH', sub: 'no change', win: null });
              }
            }
            if (onLeaderboardEntry) {
              state.results.forEach(r => {
                if (r.playerId !== selfId && r.profit >= 500) {
                  onLeaderboardEntry({ player: r.playerName, game: 'Craps', emoji: '🎲', amount: r.profit });
                }
              });
            }
          }
          if (state.phase === 'betting' || state.phase === 'point_betting') {
            setResult(null);
            setOutcomeLabel(null);
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
      case 'dice_roll': {
        setDiceRolling(true);
        setOutcomeLabel(null);
        sounds.diceRoll();
        setTimeout(() => {
          setDiceRolling(false);
          sounds.diceLand();
          // Show outcome label after dice land
          const total = data.total as number;
          const label = getOutcomeLabel(total, serverStateRef.current?.point ?? null);
          if (label) setOutcomeLabel(label);
        }, 800);
        break;
      }
      case 'point_set': {
        setTimeout(() => {
          setOutcomeLabel({ text: `POINT IS ${data.point as number}`, color: 'text-yellow-400' });
        }, 900);
        break;
      }
      case 'round_result': break;
      case 'chat': {
        setChatMessages(prev => [...prev.slice(-100), {
          id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          playerId: data.playerId as string, playerName: data.playerName as string,
          avatar: data.avatar as string, text: data.text as string,
          timestamp: Date.now(), type: 'chat',
        }]);
        break;
      }
      case 'reaction': {
        const emoji = String(data.emoji || '');
        if (emoji) {
          const id = Date.now() + Math.random();
          const x = 10 + Math.random() * 80;
          setFloatingReactions(prev => [...prev, { id, emoji, x }]);
          setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2500);
        }
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
      case 'auth_error': {
        setAuthError(data.message as string);
        setConnected(false);
        break;
      }
    }
  }, [onWin, onLose, onLeaderboardEntry]);

  useEffect(() => { return () => { if (wsRef.current) wsRef.current.close(); }; }, []);

  const createRoom = useCallback((code?: string, password?: string) => connectToRoom(code || generateRoomCode(), password), [connectToRoom]);
  const joinRoom = useCallback((code: string, password?: string) => connectToRoom(code, password), [connectToRoom]);
  const watchRoom = useCallback((code: string, password?: string) => connectToRoom(code, password, true), [connectToRoom]);
  const leaveRoom = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null; setRoomId(null); setConnected(false); setServerState(null);
    setResult(null); setChatMessages([]); prevPhaseRef.current = '';
    setOutcomeLabel(null); setIsSpectating(false); setSpectatorCount(0);
  }, []);

  // Track total wagered this round locally to prevent over-betting
  const roundWagered = useRef(0);
  useEffect(() => {
    if (serverState && (serverState.phase === 'betting' || serverState.phase === 'point_betting') && prevPhaseRef.current !== serverState.phase) {
      if (serverState.phase === 'betting') roundWagered.current = 0;
    }
  }, [serverState]);

  const placeBet = useCallback((betType: string, placeNumber?: number) => {
    if (!wsRef.current || (balance - roundWagered.current) < bet) return;
    wsRef.current.send(JSON.stringify({ type: 'bet', betType, amount: bet, placeNumber }));
    roundWagered.current += bet;
    sounds.bet();
  }, [balance, bet]);

  const rollDice = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'roll' }));
  }, []);

  const skipTimer = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'skip' }));
  }, []);

  const sendChat = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }));
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'reaction', emoji }));
  }, []);

  if (!connected || !serverState) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Craps</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={false} gameId={gameId} initialRoom={initialRoom || undefined} authError={authError} onWatch={watchRoom} />
        <div className="border border-white/[0.06] bg-zinc-950/50 p-10 text-center">
          <div className="text-5xl mb-4">🎲</div>
          <p className="text-zinc-400 text-sm font-bold mb-1">Roll the bones</p>
          <p className="text-zinc-700 text-xs">Create or join a room to play craps</p>
        </div>
      </div>
    );
  }

  const { phase, shooterId, point, dice, diceTotal, bettingTimeLeft, roundNumber, rollHistory, results, playerBets } = serverState;
  const isShooter = myId === shooterId;
  const isBetting = phase === 'betting' || phase === 'point_betting';
  const isRolling = phase === 'rolling' || phase === 'point_rolling';
  const myBets = playerBets.find(pb => pb.playerId === myId);
  const totalBetted = myBets?.bets.reduce((sum, b) => sum + b.amount, 0) || 0;
  const allBetsTotal = playerBets.reduce((sum, pb) => sum + pb.bets.reduce((s, b) => s + b.amount, 0), 0);
  const canBet = (balance - roundWagered.current) >= bet;
  const shooterName = shooterId ? serverState.shooterOrder.indexOf(shooterId) : -1;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Craps</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <div className="flex items-center gap-3">
          {allBetsTotal > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-white/[0.03] text-zinc-500 border border-white/[0.06]">
              POT ${allBetsTotal.toLocaleString()}
            </span>
          )}
          <span className="text-zinc-600 text-xs font-mono">#{roundNumber}</span>
        </div>
      </div>

      <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={connected} gameId={gameId} initialRoom={initialRoom || undefined} authError={authError} onWatch={watchRoom} />
      <SpectatorBadge count={spectatorCount} isSpectating={isSpectating} />

      {/* Roll history strip */}
      {rollHistory.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin -mx-1 px-1">
          {rollHistory.slice(0, 15).map((h, i) => {
            const isFirst = i === 0;
            return (
              <motion.div key={`${roundNumber}-${h.total}-${i}`}
                initial={isFirst ? { scale: 0, opacity: 0 } : {}}
                animate={{ scale: 1, opacity: Math.max(0.3, 1 - i * 0.05) }}
                transition={isFirst ? { type: 'spring', stiffness: 300, damping: 20 } : {}}
                className={`flex-shrink-0 px-2 py-1 text-[10px] font-bold border ${
                  h.total === 7 ? 'bg-red-600/15 text-red-400 border-red-500/20' :
                  h.total === 11 ? 'bg-green-600/15 text-green-400 border-green-500/20' :
                  [2, 3, 12].includes(h.total) ? 'bg-orange-600/10 text-orange-400 border-orange-500/15' :
                  'bg-white/[0.02] text-zinc-400 border-white/[0.04]'
                }`}
              >
                <span className="opacity-60">{DICE_FACES[h.dice[0]]}{DICE_FACES[h.dice[1]]}</span> {h.total}
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3">
        {/* Main area */}
        <div className="space-y-3">
          {/* Phase indicator + Point */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 tracking-wider uppercase ${
              phase === 'waiting' ? 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30' :
              phase === 'betting' ? 'bg-green-600/10 text-green-400 border border-green-500/20' :
              phase === 'rolling' ? 'bg-red-600/10 text-red-400 border border-red-500/20' :
              phase === 'point_betting' ? 'bg-yellow-600/10 text-yellow-400 border border-yellow-500/20' :
              phase === 'point_rolling' ? 'bg-red-600/10 text-red-400 border border-red-500/20' :
              'bg-white/[0.03] text-zinc-400 border border-white/[0.06]'
            }`}>
              {phase === 'waiting' ? 'Waiting' :
               phase === 'betting' ? 'Come-Out Bets' :
               phase === 'rolling' ? 'Rolling' :
               phase === 'point_betting' ? 'Point Bets' :
               phase === 'point_rolling' ? 'Rolling' :
               'Results'}
            </span>
            {point !== null && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="text-[10px] font-black px-2.5 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 tracking-wider uppercase"
              >
                Point: {point}
              </motion.span>
            )}
            <span className={`text-[10px] font-bold px-2.5 py-1 tracking-wider ${
              isShooter ? 'bg-red-600/10 text-red-400 border border-red-500/20' : 'bg-white/[0.02] text-zinc-600 border border-white/[0.04]'
            }`}>
              {isShooter ? 'You Shoot' : `Shooter #${shooterName + 1}`}
            </span>
          </div>

          {/* Dice display area */}
          <div className={`relative border bg-black text-center overflow-hidden transition-colors duration-500 ${
            phase === 'results' && result?.win === true ? 'border-green-500/20' :
            phase === 'results' && result?.win === false ? 'border-red-500/20' :
            'border-white/[0.04]'
          }`}>
            <FloatingReactions reactions={floatingReactions} />
            {/* Background glow on results */}
            {phase === 'results' && result && (
              <div className={`absolute inset-0 pointer-events-none ${
                result.win === true ? 'bg-green-600/[0.03]' : result.win === false ? 'bg-red-600/[0.03]' : ''
              }`} />
            )}

            <div className="relative p-6 sm:p-10 min-h-[200px] flex flex-col items-center justify-center">
              {phase === 'waiting' && (
                <div className="space-y-2">
                  <div className="text-4xl opacity-20">🎲🎲</div>
                  <p className="text-zinc-600 text-sm tracking-wider uppercase">Waiting for players...</p>
                </div>
              )}

              {isBetting && (
                <div className="space-y-3">
                  <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase">
                    {phase === 'betting' ? 'Place your come-out bets' : 'Place your point bets'}
                  </p>
                  <motion.div key={bettingTimeLeft} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
                    className="relative"
                  >
                    <span className={`text-5xl sm:text-7xl font-black tabular-nums ${
                      bettingTimeLeft <= 2 ? 'text-red-400' : bettingTimeLeft <= 4 ? 'text-yellow-400' : 'text-white'
                    }`}>
                      {bettingTimeLeft}
                    </span>
                  </motion.div>
                  {totalBetted > 0 && (
                    <p className="text-zinc-600 text-xs">
                      Your bets: <span className="text-white font-bold font-mono">${totalBetted.toLocaleString()}</span>
                    </p>
                  )}
                </div>
              )}

              {(isRolling || phase === 'results') && (
                <div className="space-y-2">
                  {diceRolling ? (
                    <div className="flex items-center justify-center gap-4">
                      <motion.span
                        animate={{ rotate: [0, 180, 360], y: [0, -20, 0] }}
                        transition={{ duration: 0.4, repeat: 1, ease: 'easeInOut' }}
                        className="text-5xl sm:text-7xl inline-block"
                      >
                        🎲
                      </motion.span>
                      <motion.span
                        animate={{ rotate: [0, -180, -360], y: [0, -15, 0] }}
                        transition={{ duration: 0.4, repeat: 1, ease: 'easeInOut', delay: 0.05 }}
                        className="text-5xl sm:text-7xl inline-block"
                      >
                        🎲
                      </motion.span>
                    </div>
                  ) : diceTotal > 0 ? (
                    <div className="space-y-1">
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="flex items-center justify-center gap-3"
                      >
                        <span className="text-5xl sm:text-7xl">{DICE_FACES[dice[0]]}</span>
                        <span className="text-5xl sm:text-7xl">{DICE_FACES[dice[1]]}</span>
                      </motion.div>

                      <motion.p
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                        className={`text-4xl sm:text-6xl font-black ${
                          diceTotal === 7 && point !== null ? 'text-red-400' :
                          diceTotal === 7 || diceTotal === 11 ? 'text-green-400' :
                          [2, 3, 12].includes(diceTotal) ? 'text-orange-400' :
                          diceTotal === point ? 'text-yellow-400' : 'text-white'
                        }`}
                      >
                        {diceTotal}
                      </motion.p>

                      {/* Outcome label */}
                      <AnimatePresence>
                        {outcomeLabel && (
                          <motion.p
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`text-sm sm:text-base font-black tracking-[0.15em] uppercase ${outcomeLabel.color}`}
                          >
                            {outcomeLabel.text}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl opacity-30">🎲🎲</div>
                      <p className="text-zinc-500 text-xs tracking-wider uppercase">
                        {isShooter ? 'Your roll — shoot!' : 'Waiting for shooter...'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="text-center py-1"
              >
                <p className={`text-2xl sm:text-3xl font-black ${
                  result.win === true ? 'text-green-400' : result.win === false ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {result.text}
                </p>
                <p className={`text-[11px] mt-0.5 tracking-wider ${
                  result.win === true ? 'text-green-500/60' : 'text-zinc-600'
                }`}>
                  {result.sub}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bet controls */}
          {isBetting && !isSpectating && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CountdownTimer totalSeconds={6} remainingSeconds={bettingTimeLeft} label={phase === 'betting' ? 'Come-out bets' : 'Point bets'} />
                </div>
                <button onClick={skipTimer}
                  className="px-4 py-2 bg-white/[0.06] text-zinc-400 text-[10px] font-bold tracking-widest uppercase hover:bg-white/[0.1] hover:text-white transition-all border border-white/[0.08]"
                >
                  ROLL NOW
                </button>
              </div>
              <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />

              {/* Come-out bet buttons */}
              {phase === 'betting' && (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => placeBet('pass')} disabled={!canBet}
                    className="relative bg-green-700/90 text-white py-3.5 text-xs font-bold tracking-widest uppercase hover:bg-green-600 transition-all disabled:opacity-30 group"
                  >
                    <span className="block">PASS</span>
                    <span className="text-[9px] font-mono opacity-60 group-hover:opacity-80">${bet}</span>
                  </button>
                  <button onClick={() => placeBet('dont_pass')} disabled={!canBet}
                    className="relative bg-red-700/90 text-white py-3.5 text-xs font-bold tracking-widest uppercase hover:bg-red-600 transition-all disabled:opacity-30 group"
                  >
                    <span className="block">DON&apos;T PASS</span>
                    <span className="text-[9px] font-mono opacity-60 group-hover:opacity-80">${bet}</span>
                  </button>
                  <button onClick={() => placeBet('field')} disabled={!canBet}
                    className="relative bg-yellow-700/90 text-white py-3.5 text-xs font-bold tracking-widest uppercase hover:bg-yellow-600 transition-all disabled:opacity-30 group"
                  >
                    <span className="block">FIELD</span>
                    <span className="text-[9px] font-mono opacity-60 group-hover:opacity-80">${bet}</span>
                  </button>
                </div>
              )}

              {/* Point phase bet buttons */}
              {phase === 'point_betting' && (
                <div className="space-y-2">
                  <button onClick={() => placeBet('field')} disabled={!canBet}
                    className="w-full bg-yellow-700/90 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-yellow-600 transition-all disabled:opacity-30"
                  >
                    FIELD <span className="font-mono opacity-70">${bet}</span>
                    <span className="text-[9px] opacity-50 ml-2">2,3,4,9,10,11,12</span>
                  </button>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[4, 5, 6, 8, 9, 10].map(n => (
                      <button key={n} onClick={() => placeBet('place', n)} disabled={!canBet || n === point}
                        className={`py-2.5 text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-20 relative ${
                          n === point
                            ? 'bg-yellow-500/10 text-yellow-400/40 border border-yellow-500/20 cursor-not-allowed'
                            : 'bg-blue-700/80 text-white hover:bg-blue-600 border border-blue-600/30'
                        }`}
                      >
                        <span className="block">{n}</span>
                        <span className="text-[8px] font-mono opacity-50">{PLACE_ODDS_DISPLAY[n]}</span>
                        {n === point && (
                          <span className="absolute -top-1 -right-1 text-[7px] font-bold px-1 bg-yellow-500/30 text-yellow-400">PT</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Roll button for shooter (auto-rolls in 2s if not clicked) */}
          {isRolling && isShooter && !diceRolling && !isSpectating && (
            <motion.button
              onClick={rollDice}
              initial={{ scale: 0.95 }}
              animate={{ scale: [0.95, 1.02, 0.95] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              className="w-full bg-red-600 text-white py-5 text-base font-black tracking-widest uppercase hover:bg-red-500 transition-colors shadow-[0_0_40px_rgba(220,38,38,0.25)] border border-red-500/30"
            >
              🎲 ROLL THE DICE
              <span className="block text-[10px] font-normal opacity-60 mt-0.5">auto-rolls in 2s</span>
            </motion.button>
          )}

          {isRolling && !isShooter && !diceRolling && (
            <div className="text-center py-3">
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-zinc-500 text-xs tracking-[0.2em] uppercase"
              >
                rolling...
              </motion.div>
            </div>
          )}

          {phase === 'results' && (
            <div className="text-center py-3">
              <motion.p
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-zinc-600 text-xs tracking-wider uppercase"
              >
                next round starting soon...
              </motion.p>
            </div>
          )}

          {/* My bets */}
          {myBets && myBets.bets.length > 0 && (
            <div className="border border-white/[0.04] divide-y divide-white/[0.03]">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Your Bets</span>
                <span className="text-white text-[10px] font-bold font-mono">${totalBetted.toLocaleString()}</span>
              </div>
              {myBets.bets.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      b.type === 'pass' ? 'bg-green-400' : b.type === 'dont_pass' ? 'bg-red-400' :
                      b.type === 'field' ? 'bg-yellow-400' : 'bg-blue-400'
                    }`} />
                    <span className={`text-[11px] font-bold uppercase ${
                      b.type === 'pass' ? 'text-green-400' : b.type === 'dont_pass' ? 'text-red-400' :
                      b.type === 'field' ? 'text-yellow-400' : 'text-blue-400'
                    }`}>
                      {b.type === 'place' ? `Place ${b.placeNumber}` : b.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-white text-[11px] font-bold font-mono">${b.amount}</span>
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          <AnimatePresence>
            {phase === 'results' && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="border border-white/[0.04] divide-y divide-white/[0.03]"
              >
                <div className="px-3 py-2">
                  <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Round Results</span>
                </div>
                {results.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center justify-between px-3 py-2 ${
                      r.playerId === myId ? 'bg-white/[0.02]' : ''
                    }`}
                  >
                    <span className={`text-[11px] font-bold ${r.playerId === myId ? 'text-white' : 'text-zinc-500'}`}>
                      {r.playerId === myId ? `→ ${r.playerName}` : r.playerName}
                    </span>
                    <span className={`text-[11px] font-bold font-mono ${
                      r.profit > 0 ? 'text-green-400' : r.profit < 0 ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {r.profit > 0 ? '+' : ''}{r.profit === 0 ? 'PUSH' : `$${r.profit.toLocaleString()}`}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Quick rules / odds */}
          <div className="border border-white/[0.04] p-3">
            <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold block mb-2">Come-Out Roll</span>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-green-400 font-bold">7 or 11</span>
                <span className="text-zinc-500">Pass wins</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-orange-400 font-bold">2, 3, 12</span>
                <span className="text-zinc-500">Pass loses</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-yellow-400 font-bold">Other</span>
                <span className="text-zinc-500">Sets point</span>
              </div>
            </div>
            <div className="border-t border-white/[0.04] mt-2 pt-2">
              <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold block mb-1">Point Roll</span>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-yellow-400 font-bold">Hit point</span>
                  <span className="text-zinc-500">Pass wins</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-red-400 font-bold">7 (seven out)</span>
                  <span className="text-zinc-500">Pass loses</span>
                </div>
              </div>
            </div>
            <div className="border-t border-white/[0.04] mt-2 pt-2">
              <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold block mb-1">Field</span>
              <div className="flex justify-between text-[10px]">
                <span className="text-yellow-400 font-bold">2,3,4,9,10,11,12</span>
                <span className="text-zinc-500">1:1</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-yellow-300 font-bold">2 or 12</span>
                <span className="text-zinc-500">2:1</span>
              </div>
            </div>
          </div>

          {/* All players' bets */}
          {playerBets.length > 0 && playerBets.some(pb => pb.bets.length > 0) && (
            <div className="border border-white/[0.04] divide-y divide-white/[0.03]">
              <div className="px-3 py-1.5">
                <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Table Bets</span>
              </div>
              {playerBets.filter(pb => pb.bets.length > 0).map((pb, i) => (
                <div key={i} className="px-3 py-1.5">
                  <span className={`text-[10px] font-bold block mb-0.5 ${pb.playerId === myId ? 'text-white' : 'text-zinc-500'}`}>
                    {pb.playerName}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {pb.bets.map((b, j) => (
                      <span key={j} className={`text-[9px] font-bold px-1.5 py-0.5 ${
                        b.type === 'pass' ? 'bg-green-600/15 text-green-400' :
                        b.type === 'dont_pass' ? 'bg-red-600/15 text-red-400' :
                        b.type === 'field' ? 'bg-yellow-600/15 text-yellow-400' :
                        'bg-blue-600/15 text-blue-400'
                      }`}>
                        {b.type === 'place' ? `P${b.placeNumber}` : b.type === 'dont_pass' ? 'DP' : b.type.charAt(0).toUpperCase() + b.type.slice(1)} ${b.amount}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <EmotePicker onSelect={sendReaction} disabled={!connected} />
          </div>
          <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
        </div>
      </div>
    </div>
  );
}
