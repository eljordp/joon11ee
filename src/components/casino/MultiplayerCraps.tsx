'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import PartySocket from 'partysocket';
import BetControls from './BetControls';
import MultiplayerChat from './MultiplayerChat';
import CountdownTimer from './CountdownTimer';
import RoomControls, { generateRoomCode } from './RoomControls';
import type { ChatMessage } from '@/lib/multiplayer/types';

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
  onLeaderboardEntry?: (entry: { player: string; game: string; emoji: string; amount: number }) => void;
  username?: string;
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

export default function MultiplayerCraps({ balance, onWin, onLose, onLeaderboardEntry, username }: Props) {
  const [bet, setBet] = useState(100);
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean | null } | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);

  const wsRef = useRef<PartySocket | null>(null);
  const prevPhaseRef = useRef<string>('');
  const playerName = useRef(username || 'Player_' + Math.random().toString(36).slice(2, 6).toUpperCase());
  useEffect(() => { if (username) playerName.current = username; }, [username]);

  const connectToRoom = useCallback((id: string) => {
    if (wsRef.current) wsRef.current.close();
    const ws = new PartySocket({ host: PARTYKIT_HOST, party: 'craps', room: id });
    ws.addEventListener('open', () => {
      setConnected(true);
      setMyId(ws.id);
      ws.send(JSON.stringify({ type: 'join', name: playerName.current, avatar: '🎲' }));
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
            if (myResult) {
              if (myResult.profit > 0) {
                sounds.win();
                onWin(myResult.profit);
                setResult({ text: `+$${myResult.profit.toLocaleString()}`, sub: 'nice roll!', win: true });
              } else if (myResult.profit < 0) {
                sounds.lose();
                onLose(Math.abs(myResult.profit));
                setResult({ text: `-$${Math.abs(myResult.profit).toLocaleString()}`, sub: 'tough break', win: false });
              } else {
                setResult({ text: 'PUSH', sub: 'no change', win: null });
              }
            }
            // Report other players' wins
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
          }
          prevPhaseRef.current = state.phase;
        }
        break;
      }
      case 'players': setPlayerCount((data.players as unknown[]).length); break;
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
    }
  }, [onWin, onLose, onLeaderboardEntry]);

  useEffect(() => { return () => { if (wsRef.current) wsRef.current.close(); }; }, []);

  const createRoom = useCallback(() => connectToRoom(generateRoomCode()), [connectToRoom]);
  const joinRoom = useCallback((code: string) => connectToRoom(code), [connectToRoom]);
  const leaveRoom = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null; setRoomId(null); setConnected(false); setServerState(null);
    setResult(null); setChatMessages([]); prevPhaseRef.current = '';
  }, []);

  const placeBet = useCallback((betType: string, placeNumber?: number) => {
    if (!wsRef.current || balance < bet) return;
    wsRef.current.send(JSON.stringify({ type: 'bet', betType, amount: bet, placeNumber }));
    sounds.bet();
  }, [balance, bet]);

  const rollDice = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'roll' }));
  }, []);

  const sendChat = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }));
  }, []);

  if (!connected || !serverState) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Craps</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={false} />
        <div className="border border-white/[0.06] bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-500 text-sm mb-2">Create or join a room to play craps</p>
          <p className="text-zinc-700 text-xs">Roll the bones with friends</p>
        </div>
      </div>
    );
  }

  const { phase, shooterId, point, dice, diceTotal, bettingTimeLeft, roundNumber, rollHistory, results, playerBets } = serverState;
  const isShooter = myId === shooterId;
  const isBetting = phase === 'betting' || phase === 'point_betting';
  const isRolling = phase === 'rolling' || phase === 'point_rolling';
  const myBets = playerBets.find(pb => pb.playerId === myId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Craps</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <span className="text-zinc-600 text-xs">Round #{roundNumber}</span>
      </div>

      <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={connected} />

      {/* Roll history */}
      {rollHistory.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin -mx-1 px-1">
          {rollHistory.slice(0, 15).map((h, i) => (
            <motion.div key={`${h.total}-${i}`}
              initial={i === 0 ? { scale: 0 } : {}} animate={{ scale: 1, opacity: 0.6 + (1 - i / 15) * 0.4 }}
              className={`flex-shrink-0 px-2.5 py-1.5 text-[11px] font-bold ${
                h.total === 7 ? 'bg-red-600/20 text-red-400' :
                h.total === 11 ? 'bg-green-600/15 text-green-400' :
                [2, 3, 12].includes(h.total) ? 'bg-orange-600/15 text-orange-400' :
                'bg-zinc-800/50 text-zinc-300'
              }`}
            >
              {DICE_FACES[h.dice[0]]}{DICE_FACES[h.dice[1]]} = {h.total}
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Dice display */}
          <div className="relative border border-white/[0.04] bg-black p-6 sm:p-8 text-center min-h-[180px] flex flex-col items-center justify-center">
            {point !== null && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 tracking-wider uppercase">
                  Point: {point}
                </span>
              </div>
            )}

            {phase === 'waiting' && (
              <p className="text-zinc-500 text-sm tracking-wider uppercase">Waiting for players...</p>
            )}

            {isBetting && (
              <div>
                <p className="text-zinc-500 text-sm tracking-wider uppercase mb-2">
                  {phase === 'betting' ? 'Place your bets' : 'Point bets open'}
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
                        diceTotal === 7 && point !== null ? 'text-red-400' :
                        diceTotal === 7 || diceTotal === 11 ? 'text-green-400' :
                        [2, 3, 12].includes(diceTotal) ? 'text-orange-400' :
                        diceTotal === point ? 'text-yellow-400' : 'text-white'
                      }`}
                    >
                      {diceTotal}
                    </motion.p>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm tracking-wider uppercase">
                    {isShooter ? 'Your roll!' : 'Waiting for shooter...'}
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
          {isBetting && (
            <div className="space-y-3">
              <CountdownTimer totalSeconds={10} remainingSeconds={bettingTimeLeft} label={phase === 'betting' ? 'Come-out bets' : 'Point bets'} />
              <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />
              <div className={`grid ${phase === 'point_betting' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'} gap-2`}>
                {phase === 'betting' && (
                  <>
                    <button onClick={() => placeBet('pass')} disabled={balance < bet}
                      className="bg-green-700 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-green-600 transition-all disabled:opacity-30"
                    >
                      PASS ${bet}
                    </button>
                    <button onClick={() => placeBet('dont_pass')} disabled={balance < bet}
                      className="bg-red-700 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-red-600 transition-all disabled:opacity-30"
                    >
                      DON&apos;T PASS ${bet}
                    </button>
                    <button onClick={() => placeBet('field')} disabled={balance < bet}
                      className="bg-yellow-700 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-yellow-600 transition-all disabled:opacity-30 sm:col-span-1 col-span-2"
                    >
                      FIELD ${bet}
                    </button>
                  </>
                )}
                {phase === 'point_betting' && (
                  <>
                    <button onClick={() => placeBet('field')} disabled={balance < bet}
                      className="bg-yellow-700 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-yellow-600 transition-all disabled:opacity-30 col-span-2 sm:col-span-4"
                    >
                      FIELD ${bet}
                    </button>
                    {[4, 5, 6, 8, 9, 10].map(n => (
                      <button key={n} onClick={() => placeBet('place', n)} disabled={balance < bet || n === point}
                        className={`py-2.5 text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-30 ${
                          n === point ? 'bg-zinc-800 text-zinc-600' : 'bg-blue-700 text-white hover:bg-blue-600'
                        }`}
                      >
                        Place {n}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Roll button for shooter */}
          {isRolling && isShooter && (
            <button onClick={rollDice}
              className="w-full bg-red-600 text-white py-5 text-base font-black tracking-widest uppercase hover:bg-red-500 transition-all animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.3)]"
            >
              🎲 ROLL THE DICE
            </button>
          )}

          {isRolling && !isShooter && (
            <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">
              waiting for shooter to roll...
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
                  <span className={`text-[11px] font-bold uppercase ${
                    b.type === 'pass' ? 'text-green-400' : b.type === 'dont_pass' ? 'text-red-400' :
                    b.type === 'field' ? 'text-yellow-400' : 'text-blue-400'
                  }`}>
                    {b.type === 'place' ? `Place ${b.placeNumber}` : b.type.replace('_', ' ')}
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
          <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
        </div>
      </div>
    </div>
  );
}
