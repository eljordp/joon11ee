'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import PartySocket from 'partysocket';
import BetControls from './BetControls';
import MultiplayerChat from './MultiplayerChat';
import PlayerList, { type PlayerListEntry } from './PlayerList';
import CountdownTimer from './CountdownTimer';
import RoomControls, { generateRoomCode } from './RoomControls';
import type { ChatMessage, CashoutEntry } from '@/lib/multiplayer/types';

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
}

interface ServerState {
  phase: 'waiting' | 'betting' | 'flying' | 'crashed';
  roundNumber: number;
  crashPoint: number;
  flyingStartTime: number;
  bettingTimeLeft: number;
  bets: Array<{
    player: { id: string; name: string; avatar: string; isBot?: boolean };
    amount: number;
    cashedOut: boolean;
    cashoutMultiplier: number | null;
    profit: number;
  }>;
  history: { crashPoint: number; roundNumber: number }[];
}

export default function MultiplayerCrash({ balance, onWin, onLose }: Props) {
  const [bet, setBet] = useState(100);
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [cashoutFeed, setCashoutFeed] = useState<CashoutEntry[]>([]);
  const [hasBet, setHasBet] = useState(false);
  const [hasCashed, setHasCashed] = useState(false);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean } | null>(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [trail, setTrail] = useState<number[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);

  const wsRef = useRef<PartySocket | null>(null);
  const prevPhaseRef = useRef<string>('');
  const flyingStartRef = useRef(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate a player name
  const playerName = useRef('Player_' + Math.random().toString(36).slice(2, 6).toUpperCase());

  const connectToRoom = useCallback((id: string) => {
    if (wsRef.current) wsRef.current.close();

    const ws = new PartySocket({
      host: PARTYKIT_HOST,
      party: 'crash',
      room: id,
    });

    ws.addEventListener('open', () => {
      setConnected(true);
      setMyId(ws.id);
      ws.send(JSON.stringify({ type: 'join', name: playerName.current, avatar: '🎮' }));
    });

    ws.addEventListener('message', (evt) => {
      const data = JSON.parse(evt.data);
      handleServerMessage(data, ws.id);
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

        // Phase transitions
        if (state.phase !== prevPhaseRef.current) {
          if (state.phase === 'flying' && prevPhaseRef.current !== 'flying') {
            sounds.spinStart();
            setCashoutFeed([]);
            setTrail([]);
            flyingStartRef.current = state.flyingStartTime;
            // Start local multiplier animation
            if (animRef.current) clearInterval(animRef.current);
            animRef.current = setInterval(() => {
              const elapsed = (Date.now() - flyingStartRef.current) / 1000;
              const m = Math.pow(Math.E, 0.08 * elapsed);
              setMultiplier(m);
              setTrail((t) => [...t.slice(-60), m]);
            }, 50);
          }

          if (state.phase === 'crashed') {
            if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
            setMultiplier(state.crashPoint);

            const myBet = state.bets.find((b) => b.player.id === selfId);
            if (myBet && !myBet.cashedOut) {
              sounds.lose();
              onLose(myBet.amount);
              setResult({ text: `-$${myBet.amount.toLocaleString()}`, sub: `CRASHED at ${state.crashPoint.toFixed(2)}x`, win: false });
            }
          }

          if (state.phase === 'betting') {
            setHasBet(false);
            setHasCashed(false);
            setResult(null);
            setMultiplier(1.0);
            setTrail([]);
          }

          prevPhaseRef.current = state.phase;
        }
        break;
      }

      case 'players': {
        const players = data.players as Array<{ id: string }>;
        setPlayerCount(players.length);
        break;
      }

      case 'player_cashout': {
        const entry: CashoutEntry = {
          id: `co_${Date.now()}_${data.playerId}`,
          playerName: data.playerName as string,
          avatar: data.avatar as string,
          multiplier: data.multiplier as number,
          profit: data.profit as number,
          timestamp: Date.now(),
        };
        setCashoutFeed((prev) => [entry, ...prev.slice(0, 14)]);

        if (data.playerId === selfId) {
          sounds.win();
          const profit = data.profit as number;
          onWin(profit);
          setHasCashed(true);
          setResult({ text: `+$${profit.toLocaleString()}`, sub: `cashed at ${(data.multiplier as number).toFixed(2)}x`, win: true });
          if ((data.multiplier as number) >= 5) sounds.jackpot();
        } else {
          try { sounds.click(); } catch {}
        }
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
          type: 'chat',
        };
        setChatMessages((prev) => [...prev.slice(-100), msg]);
        break;
      }

      case 'countdown': {
        // Handled via state updates
        break;
      }
    }
  }, [onWin, onLose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (animRef.current) clearInterval(animRef.current);
    };
  }, []);

  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    connectToRoom(code);
  }, [connectToRoom]);

  const joinRoom = useCallback((code: string) => {
    connectToRoom(code);
  }, [connectToRoom]);

  const leaveRoom = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    setRoomId(null);
    setConnected(false);
    setServerState(null);
    setHasBet(false);
    setHasCashed(false);
    setResult(null);
    setChatMessages([]);
    setCashoutFeed([]);
    setMultiplier(1.0);
    setTrail([]);
    prevPhaseRef.current = '';
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
  }, []);

  const placeBet = useCallback(() => {
    if (!wsRef.current || hasBet || balance < bet) return;
    wsRef.current.send(JSON.stringify({ type: 'bet', amount: bet }));
    setHasBet(true);
    sounds.bet();
  }, [hasBet, balance, bet]);

  const cashOut = useCallback(() => {
    if (!wsRef.current || !hasBet || hasCashed) return;
    wsRef.current.send(JSON.stringify({ type: 'cashout' }));
  }, [hasBet, hasCashed]);

  const sendChat = useCallback((text: string) => {
    if (wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({ type: 'chat', text }));
    }
  }, [connected]);

  // If not connected, show room controls only
  if (!connected || !serverState) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Crash</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <RoomControls
          roomId={roomId}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onLeaveRoom={leaveRoom}
          playerCount={playerCount}
          connected={false}
        />
        <div className="border border-white/[0.06] bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-500 text-sm mb-2">Create or join a room to play multiplayer crash</p>
          <p className="text-zinc-700 text-xs">Share the room code with friends to play together</p>
        </div>
      </div>
    );
  }

  const { phase, bettingTimeLeft, bets, history, roundNumber } = serverState;
  const isLive = phase === 'flying';
  const rocketY = isLive || phase === 'crashed' ? Math.min(85, (multiplier - 1) * 15) : 0;

  const getMultColor = (m: number) => {
    if (m < 1.5) return 'text-white';
    if (m < 3) return 'text-green-400';
    if (m < 5) return 'text-yellow-400';
    if (m < 10) return 'text-orange-400';
    return 'text-red-400';
  };

  const playerListEntries: PlayerListEntry[] = bets.map((b) => ({
    id: b.player.id,
    name: b.player.name,
    avatar: b.player.avatar,
    bet: b.amount,
    status: phase === 'betting' ? 'betting' :
            b.cashedOut ? `${b.cashoutMultiplier?.toFixed(2)}x` :
            phase === 'crashed' ? 'CRASHED' : 'flying',
    profit: b.cashedOut ? b.profit : phase === 'crashed' ? -b.amount : null,
    isHuman: b.player.id === myId,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Crash</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <span className="text-zinc-600 text-xs">Round #{roundNumber}</span>
      </div>

      <RoomControls
        roomId={roomId}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onLeaveRoom={leaveRoom}
        playerCount={playerCount}
        connected={connected}
      />

      {/* History pills */}
      {history.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin -mx-1 px-1">
          {history.map((h, i) => (
            <motion.div
              key={h.roundNumber}
              initial={i === 0 ? { scale: 0, opacity: 0 } : {}}
              animate={{ scale: 1, opacity: i === 0 ? 1 : 0.6 + (1 - i / history.length) * 0.4 }}
              className={`flex-shrink-0 px-2.5 py-1.5 text-[11px] font-bold ${
                h.crashPoint < 1.5 ? 'bg-red-600/20 text-red-400' :
                h.crashPoint < 2 ? 'bg-orange-600/15 text-orange-400' :
                h.crashPoint < 5 ? 'bg-zinc-800/50 text-zinc-300' :
                h.crashPoint < 10 ? 'bg-green-600/15 text-green-400' :
                'bg-yellow-600/15 text-yellow-400'
              }`}
            >
              {h.crashPoint.toFixed(2)}x
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Rocket display */}
          <div className="relative h-48 sm:h-56 border border-white/[0.04] bg-black overflow-hidden">
            {phase === 'crashed' && <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />}
            {hasCashed && phase !== 'betting' && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="absolute left-0 right-0 border-t border-white/[0.03]" style={{ bottom: `${i * 20}%` }}>
                <span className="text-zinc-800 text-[9px] absolute right-1 -top-3">
                  {(1 + i * (multiplier > 5 ? multiplier / 5 : 1)).toFixed(1)}x
                </span>
              </div>
            ))}

            {phase !== 'betting' && trail.length > 1 && (
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke={phase === 'crashed' && !hasCashed ? '#ef4444' : hasCashed ? '#facc15' : '#22c55e'}
                  strokeWidth="2"
                  strokeOpacity="0.5"
                  points={trail.map((m, i) => {
                    const x = (i / 60) * 100;
                    const y = 100 - Math.min(90, (m - 1) * 15);
                    return `${x}%,${y}%`;
                  }).join(' ')}
                />
              </svg>
            )}

            <motion.div
              animate={{
                bottom: phase === 'betting' || phase === 'waiting' ? '10%' : phase === 'crashed' ? '5%' : `${10 + rocketY}%`,
                x: phase === 'crashed' ? [0, -3, 3, -3, 0] : 0,
              }}
              transition={phase === 'crashed' ? { duration: 0.3 } : { duration: 0.1 }}
              className="absolute left-1/2 -translate-x-1/2 text-3xl sm:text-4xl"
            >
              {phase === 'crashed' ? '💥' : hasCashed ? '👻' : '🚀'}
            </motion.div>

            <div className="absolute inset-0 flex items-center justify-center">
              {phase === 'betting' || phase === 'waiting' ? (
                <div className="text-center">
                  <p className="text-zinc-500 text-sm tracking-wider uppercase mb-1">
                    {phase === 'waiting' ? 'Waiting for players' : 'Place your bets'}
                  </p>
                  {phase === 'betting' && (
                    <motion.p key={bettingTimeLeft} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                      className={`text-4xl sm:text-6xl font-black ${bettingTimeLeft <= 2 ? 'text-red-400' : 'text-white'}`}
                    >
                      {bettingTimeLeft}s
                    </motion.p>
                  )}
                </div>
              ) : (
                <motion.span
                  key={phase === 'crashed' ? 'crashed' : multiplier.toFixed(1)}
                  initial={phase === 'crashed' ? { scale: 1.5 } : {}}
                  animate={{ scale: 1 }}
                  className={`text-4xl sm:text-6xl font-black ${phase === 'crashed' ? 'text-red-500' : getMultColor(multiplier)}`}
                >
                  {multiplier.toFixed(2)}x
                </motion.span>
              )}
            </div>

            {phase === 'crashed' && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 text-xs font-bold tracking-widest uppercase"
              >
                CRASHED
              </motion.div>
            )}
            {hasCashed && phase !== 'betting' && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-1 text-xs font-bold tracking-widest uppercase"
              >
                CASHED
              </motion.div>
            )}
          </div>

          {/* Result */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center">
                <p className={`text-2xl sm:text-3xl font-black ${result.win ? 'text-green-400' : 'text-red-400'}`}>{result.text}</p>
                <p className={`text-xs mt-1 ${result.win ? 'text-green-500/70' : 'text-zinc-600'}`}>{result.sub}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          {phase === 'betting' && !hasBet && (
            <div className="space-y-3">
              <CountdownTimer totalSeconds={7} remainingSeconds={bettingTimeLeft} label="Betting closes in" />
              <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />
              <button onClick={placeBet} disabled={balance < bet}
                className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                PLACE BET ${bet.toLocaleString()}
              </button>
            </div>
          )}

          {phase === 'betting' && hasBet && (
            <div className="text-center text-green-400/60 text-xs font-bold py-4 animate-pulse tracking-wider uppercase">
              Bet placed — waiting for launch...
            </div>
          )}

          {phase === 'flying' && hasBet && !hasCashed && (
            <button onClick={cashOut}
              className="w-full bg-green-600 text-white py-5 text-base font-black tracking-widest uppercase hover:bg-green-500 transition-all animate-pulse shadow-[0_0_30px_rgba(34,197,94,0.3)]"
            >
              CASH OUT ${Math.floor(bet * multiplier).toLocaleString()}
            </button>
          )}

          {phase === 'flying' && hasCashed && (
            <div className="text-center text-yellow-400/60 text-xs font-bold py-4 animate-pulse tracking-wider uppercase">
              cashed out — watching for crash...
            </div>
          )}

          {phase === 'flying' && !hasBet && (
            <div className="text-center text-zinc-600 text-xs py-4 tracking-wider uppercase">watching round...</div>
          )}

          {phase === 'crashed' && (
            <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">next round starting soon...</div>
          )}

          {/* Cashout feed */}
          {cashoutFeed.length > 0 && phase !== 'betting' && (
            <div className="border border-white/[0.04] divide-y divide-white/[0.03]">
              <div className="px-3 py-1.5 border-b border-white/[0.04]">
                <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Cashouts</span>
              </div>
              {cashoutFeed.slice(0, 8).map((entry, i) => (
                <motion.div key={entry.id} initial={i === 0 ? { opacity: 0, x: -10 } : {}} animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{entry.avatar}</span>
                    <span className="text-zinc-400 text-[11px] font-bold">{entry.playerName}</span>
                    <span className="text-green-500/70 text-[10px]">{entry.multiplier.toFixed(2)}x</span>
                  </div>
                  <span className="text-green-400 text-[11px] font-bold font-mono">+${entry.profit.toLocaleString()}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-3">
          <PlayerList players={playerListEntries} title="Players" />
          <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
        </div>
      </div>
    </div>
  );
}
