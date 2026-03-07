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

interface HoodBet { type: 'seven' | 'ten' | 'over' | 'under' | 'doubles'; amount: number; }
interface PlayerBets { playerId: string; playerName: string; bets: HoodBet[]; }

interface ServerState {
  phase: 'waiting' | 'betting' | 'rolling' | 'results';
  shooterId: string | null;
  shooterOrder: string[];
  dice: [number, number];
  diceTotal: number;
  bettingTimeLeft: number;
  roundNumber: number;
  rollHistory: { dice: [number, number]; total: number; doubles: boolean }[];
  results: { playerId: string; playerName: string; profit: number }[];
  playerBets: PlayerBets[];
  streak: { type: string; count: number };
}

const DICE_FACES: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

const BET_LABELS: Record<string, { label: string; color: string; payout: string }> = {
  seven: { label: '7', color: 'bg-red-700 hover:bg-red-600', payout: '5x' },
  ten: { label: '10', color: 'bg-purple-700 hover:bg-purple-600', payout: '10x' },
  over: { label: 'OVER 7', color: 'bg-green-700 hover:bg-green-600', payout: '2x' },
  under: { label: 'UNDER 7', color: 'bg-blue-700 hover:bg-blue-600', payout: '2x' },
  doubles: { label: 'DOUBLES', color: 'bg-yellow-700 hover:bg-yellow-600', payout: '5x' },
};

const BET_TEXT_COLORS: Record<string, string> = {
  seven: 'text-red-400',
  ten: 'text-purple-400',
  over: 'text-green-400',
  under: 'text-blue-400',
  doubles: 'text-yellow-400',
};

export default function MultiplayerHoodCraps({ balance, onWin, onLose, onLeaderboardEntry, username, initialRoom, gameId, onPlayersChange }: Props) {
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
  const [authError, setAuthError] = useState<string | undefined>();
  const [isSpectating, setIsSpectating] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);

  const wsRef = useRef<PartySocket | null>(null);
  const prevPhaseRef = useRef<string>('');
  const passwordRef = useRef<string | undefined>(undefined);
  const playerName = useRef(username || 'Player_' + Math.random().toString(36).slice(2, 6).toUpperCase());
  useEffect(() => { if (username) playerName.current = username; }, [username]);

  const connectToRoom = useCallback((id: string, password?: string, spectate?: boolean) => {
    if (wsRef.current) wsRef.current.close();
    passwordRef.current = password;
    setAuthError(undefined);
    setIsSpectating(false);
    const ws = new PartySocket({ host: PARTYKIT_HOST, party: 'hood-craps', room: id });
    ws.addEventListener('open', () => {
      setConnected(true);
      setMyId(ws.id);
      ws.send(JSON.stringify({ type: 'join', name: playerName.current, avatar: '🎲', password: passwordRef.current, ...(spectate ? { spectate: true } : {}) }));
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

        if (state.phase !== prevPhaseRef.current) {
          if (state.phase === 'results') {
            const myResult = state.results.find(r => r.playerId === selfId);
            const myBetTotal = state.playerBets.find(pb => pb.playerId === selfId)?.bets.reduce((sum, b) => sum + b.amount, 0) || 0;
            if (myResult) {
              if (myResult.profit > 0) {
                sounds.win();
                onWin(myResult.profit, myBetTotal);
                setResult({ text: `+$${myResult.profit.toLocaleString()}`, sub: 'cash money', win: true });
              } else if (myResult.profit < 0) {
                sounds.lose();
                onLose(Math.abs(myResult.profit));
                setResult({ text: `-$${Math.abs(myResult.profit).toLocaleString()}`, sub: 'run it back', win: false });
              } else {
                setResult({ text: 'PUSH', sub: 'no change', win: null });
              }
            }
            if (onLeaderboardEntry) {
              state.results.forEach(r => {
                if (r.playerId !== selfId && r.profit >= 500) {
                  onLeaderboardEntry({ player: r.playerName, game: 'Hood Craps', emoji: '🎲', amount: r.profit });
                }
              });
            }
          }
          if (state.phase === 'betting') {
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
      case 'dice_roll': {
        setDiceRolling(true);
        sounds.diceRoll();
        setTimeout(() => { setDiceRolling(false); sounds.diceLand(); }, 800);
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
      case 'auth_error': {
        setAuthError(data.message as string);
        setConnected(false);
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
    setIsSpectating(false); setSpectatorCount(0);
  }, []);

  const placeBet = useCallback((betType: string) => {
    if (!wsRef.current || balance < bet) return;
    wsRef.current.send(JSON.stringify({ type: 'bet', betType, amount: bet }));
    sounds.bet();
  }, [balance, bet]);

  const rollDice = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'roll' }));
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
          <h3 className="text-xl font-bold text-white">Hood Craps</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 tracking-wider uppercase">7s n 10s</span>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={false} gameId={gameId} initialRoom={initialRoom || undefined} authError={authError} onWatch={watchRoom} />
        <div className="border border-white/[0.06] bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-500 text-sm mb-2">Create or join a room to play</p>
          <p className="text-zinc-700 text-xs">Street dice. 7s n 10s. No cap.</p>
        </div>
      </div>
    );
  }

  const { phase, shooterId, dice, diceTotal, bettingTimeLeft, roundNumber, rollHistory, results, playerBets, streak } = serverState;
  const isShooter = myId === shooterId;
  const isBetting = phase === 'betting';
  const isRolling = phase === 'rolling';
  const myBets = playerBets.find(pb => pb.playerId === myId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Hood Craps</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 tracking-wider uppercase">7s n 10s</span>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <span className="text-zinc-600 text-xs">Round #{roundNumber}</span>
      </div>

      <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={connected} gameId={gameId} initialRoom={initialRoom || undefined} authError={authError} onWatch={watchRoom} />
      <SpectatorBadge count={spectatorCount} isSpectating={isSpectating} />

      {/* Roll history */}
      {rollHistory.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin -mx-1 px-1">
          {rollHistory.slice(0, 15).map((h, i) => (
            <motion.div key={`${h.total}-${i}`}
              initial={i === 0 ? { scale: 0 } : {}} animate={{ scale: 1, opacity: 0.6 + (1 - i / 15) * 0.4 }}
              className={`flex-shrink-0 px-2.5 py-1.5 text-[11px] font-bold ${
                h.total === 7 ? 'bg-red-600/20 text-red-400' :
                h.total === 10 ? 'bg-purple-600/20 text-purple-400' :
                h.doubles ? 'bg-yellow-600/15 text-yellow-400' :
                h.total > 7 ? 'bg-green-600/10 text-green-400' :
                'bg-blue-600/10 text-blue-400'
              }`}
            >
              {DICE_FACES[h.dice[0]]}{DICE_FACES[h.dice[1]]} = {h.total}{h.doubles ? ' D' : ''}
            </motion.div>
          ))}
        </div>
      )}

      {/* Streak indicator */}
      {streak.count >= 2 && (
        <div className="text-center">
          <span className={`text-[10px] font-bold px-3 py-1 tracking-wider uppercase ${
            streak.type === 'seven' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
            streak.type === 'ten' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
            streak.type === 'over' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}>
            {streak.type === 'seven' ? '7' : streak.type === 'ten' ? '10' : streak.type === 'over' ? 'over' : 'under'} streak x{streak.count}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Dice display */}
          <div className="relative border border-white/[0.04] bg-black p-6 sm:p-8 text-center min-h-[180px] flex flex-col items-center justify-center">
            <FloatingReactions reactions={floatingReactions} />
            {/* Payout reference */}
            <div className="absolute top-3 right-3 flex flex-wrap gap-1.5 justify-end">
              {Object.entries(BET_LABELS).map(([key, info]) => (
                <span key={key} className="text-[9px] font-bold px-1.5 py-0.5 bg-white/[0.03] text-zinc-500 border border-white/[0.06]">
                  {info.label} {info.payout}
                </span>
              ))}
            </div>

            {phase === 'waiting' && (
              <p className="text-zinc-500 text-sm tracking-wider uppercase">Waiting for players...</p>
            )}

            {isBetting && (
              <div>
                <p className="text-zinc-500 text-sm tracking-wider uppercase mb-2">
                  Place ya bets
                </p>
                <motion.p key={bettingTimeLeft} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                  className={`text-4xl sm:text-6xl font-black ${bettingTimeLeft <= 2 ? 'text-red-400' : 'text-white'}`}
                >
                  {bettingTimeLeft}s
                </motion.p>
              </div>
            )}

            {(isRolling || phase === 'results') && (
              <div>
                {diceRolling ? (
                  <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 0.4, repeat: 1 }}
                    className="text-5xl sm:text-7xl mb-2"
                  >
                    🎲🎲
                  </motion.div>
                ) : diceTotal > 0 ? (
                  <div>
                    <div className="text-5xl sm:text-7xl mb-2">
                      {DICE_FACES[dice[0]]} {DICE_FACES[dice[1]]}
                    </div>
                    <motion.p initial={{ scale: 1.5 }} animate={{ scale: 1 }}
                      className={`text-3xl sm:text-5xl font-black ${
                        diceTotal === 7 ? 'text-red-400' :
                        diceTotal === 10 ? 'text-purple-400' :
                        dice[0] === dice[1] ? 'text-yellow-400' :
                        diceTotal > 7 ? 'text-green-400' :
                        'text-blue-400'
                      }`}
                    >
                      {diceTotal}
                      {dice[0] === dice[1] && <span className="text-lg ml-2">DOUBLES</span>}
                    </motion.p>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm tracking-wider uppercase">
                    {isShooter ? 'Shoot them joints!' : 'Waiting for shooter...'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Result */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center">
                <p className={`text-2xl sm:text-3xl font-black ${result.win === true ? 'text-green-400' : result.win === false ? 'text-red-400' : 'text-yellow-400'}`}>{result.text}</p>
                <p className={`text-xs mt-1 ${result.win === true ? 'text-green-500/70' : 'text-zinc-600'}`}>{result.sub}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bet controls */}
          {isBetting && !isSpectating && (
            <div className="space-y-3">
              <CountdownTimer totalSeconds={8} remainingSeconds={bettingTimeLeft} label="Street bets" />
              <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.entries(BET_LABELS).map(([key, info]) => (
                  <button key={key} onClick={() => placeBet(key)} disabled={balance < bet}
                    className={`${info.color} text-white py-3 text-xs font-bold tracking-widest uppercase transition-all disabled:opacity-30 flex flex-col items-center gap-0.5`}
                  >
                    <span>{info.label}</span>
                    <span className="text-[9px] opacity-70">{info.payout}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {isBetting && isSpectating && (
            <div className="text-center text-blue-400/70 text-xs py-3 tracking-wider uppercase">
              watching the action...
            </div>
          )}

          {/* Roll button for shooter */}
          {isRolling && isShooter && !isSpectating && (
            <button onClick={rollDice}
              className="w-full bg-red-600 text-white py-5 text-base font-black tracking-widest uppercase hover:bg-red-500 transition-all animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.3)]"
            >
              🎲 SHOOT
            </button>
          )}

          {isRolling && !isShooter && (
            <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">
              waiting for shooter...
            </div>
          )}

          {phase === 'results' && (
            <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">next round starting soon...</div>
          )}

          {/* My bets */}
          {myBets && myBets.bets.length > 0 && (
            <div className="border border-white/[0.04] divide-y divide-white/[0.03]">
              <div className="px-3 py-1.5"><span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Your Bets</span></div>
              {myBets.bets.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5">
                  <span className={`text-[11px] font-bold uppercase ${BET_TEXT_COLORS[b.type] || 'text-zinc-400'}`}>
                    {BET_LABELS[b.type]?.label || b.type}
                  </span>
                  <span className="text-white text-[11px] font-bold font-mono">${b.amount}</span>
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          {phase === 'results' && results.length > 0 && (
            <div className="border border-white/[0.04] divide-y divide-white/[0.03]">
              <div className="px-3 py-1.5"><span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Round Results</span></div>
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5">
                  <span className={`text-[11px] font-bold ${r.playerId === myId ? 'text-red-400' : 'text-zinc-400'}`}>
                    {r.playerId === myId ? 'You' : r.playerName}
                  </span>
                  <span className={`text-[11px] font-bold font-mono ${r.profit > 0 ? 'text-green-400' : r.profit < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {r.profit > 0 ? '+' : ''}{r.profit === 0 ? 'PUSH' : `$${r.profit.toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Shooter info */}
          <div className="border border-white/[0.04] p-3">
            <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold block mb-1">Shooter</span>
            <span className={`text-sm font-bold ${isShooter ? 'text-red-400' : 'text-zinc-400'}`}>
              {isShooter ? 'You' : serverState.shooterOrder.length > 0 ? '🎲 Shooting...' : 'None'}
            </span>
          </div>

          {/* Quick rules */}
          <div className="border border-white/[0.04] p-3">
            <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold block mb-2">Payouts</span>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]"><span className="text-red-400 font-bold">7</span><span className="text-zinc-400">5x</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-purple-400 font-bold">10</span><span className="text-zinc-400">10x</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-green-400 font-bold">Over 7</span><span className="text-zinc-400">2x</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-blue-400 font-bold">Under 7</span><span className="text-zinc-400">2x</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-yellow-400 font-bold">Doubles</span><span className="text-zinc-400">5x</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <EmotePicker onSelect={sendReaction} disabled={!connected} />
          </div>
          <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
        </div>
      </div>
    </div>
  );
}
