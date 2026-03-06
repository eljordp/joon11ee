'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import { isRed, type Card } from '@/lib/casino';
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

interface SeatData {
  id: string; name: string; avatar: string;
  holeCards: Card[] | null; hasCards: boolean;
  chips: number; currentBet: number; totalBetThisHand: number;
  folded: boolean; allIn: boolean; lastAction: string | null;
}

interface ResultData {
  playerId: string; playerName: string; handDesc: string; potWon: number; holeCards: Card[];
}

interface ServerState {
  phase: 'waiting' | 'pre_flop' | 'flop_betting' | 'turn_betting' | 'river_betting' | 'showdown' | 'results';
  communityCards: Card[];
  pot: number; sidePots: { amount: number; eligibleIds: string[] }[];
  currentBet: number; minRaise: number;
  dealerIndex: number; activePlayerIndex: number;
  turnTimeLeft: number; roundNumber: number;
  smallBlind: number; bigBlind: number;
  readyPlayers: string[];
  seats: SeatData[];
  results: ResultData[] | null;
}

function PokerCard({ card, hidden, index, small }: { card: Card; hidden?: boolean; index: number; small?: boolean }) {
  const red = !hidden && isRed(card.suit);
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, rotateZ: -5 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3, type: 'spring' }}
      className={`relative flex-shrink-0 rounded-lg ${small ? 'w-10 h-[60px]' : 'w-14 h-[84px] sm:w-16 sm:h-[96px]'}
        ${hidden ? 'bg-gradient-to-br from-blue-900 to-blue-950 border-2 border-blue-800' :
          'bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-white/15'} shadow-xl`}
    >
      {hidden ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-blue-700 text-xs font-bold">♠</span>
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

export default function MultiplayerPoker({ balance, onWin, onLose, onLeaderboardEntry, username }: Props) {
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean | null } | null>(null);
  const [turnTimeLeft, setTurnTimeLeft] = useState(0);
  const [raiseAmount, setRaiseAmount] = useState(200);

  const wsRef = useRef<PartySocket | null>(null);
  const prevPhaseRef = useRef<string>('');
  const playerName = useRef(username || 'Player_' + Math.random().toString(36).slice(2, 6).toUpperCase());
  useEffect(() => { if (username) playerName.current = username; }, [username]);

  const connectToRoom = useCallback((id: string) => {
    if (wsRef.current) wsRef.current.close();
    const ws = new PartySocket({ host: PARTYKIT_HOST, party: 'poker', room: id });
    ws.addEventListener('open', () => {
      setConnected(true); setMyId(ws.id);
      ws.send(JSON.stringify({ type: 'join', name: playerName.current, avatar: '🂡' }));
    });
    ws.addEventListener('message', (evt) => handleServerMessage(JSON.parse(evt.data), ws.id));
    ws.addEventListener('close', () => setConnected(false));
    wsRef.current = ws; setRoomId(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleServerMessage = useCallback((data: Record<string, unknown>, selfId: string) => {
    switch (data.type) {
      case 'state': {
        const state = data.state as ServerState;
        setServerState(state);
        if (state.phase !== prevPhaseRef.current) {
          if (state.phase === 'pre_flop') {
            sounds.cardDeal(); setResult(null);
          }
          if (['flop_betting', 'turn_betting', 'river_betting'].includes(state.phase)) sounds.cardFlip();
          if (state.phase === 'showdown' || state.phase === 'results') {
            if (state.results) {
              const myResult = state.results.find(r => r.playerId === selfId);
              if (myResult && myResult.potWon > 0) {
                const mySeat = state.seats.find(s => s.id === selfId);
                const profit = myResult.potWon - (mySeat?.totalBetThisHand || 0);
                if (profit > 0) {
                  sounds.jackpot(); onWin(profit);
                  setResult({ text: `+$${profit.toLocaleString()}`, sub: myResult.handDesc, win: true });
                } else {
                  setResult({ text: myResult.handDesc, sub: 'won pot but broke even', win: null });
                }
              } else {
                const mySeat = state.seats.find(s => s.id === selfId);
                if (mySeat && mySeat.totalBetThisHand > 0) {
                  sounds.lose(); onLose(mySeat.totalBetThisHand);
                  setResult({ text: `-$${mySeat.totalBetThisHand.toLocaleString()}`, sub: 'better luck next hand', win: false });
                }
              }
              // Leaderboard
              if (onLeaderboardEntry) {
                state.results.forEach(r => {
                  if (r.playerId !== selfId && r.potWon >= 500) {
                    onLeaderboardEntry({ player: r.playerName, game: 'Poker', emoji: '🂡', amount: r.potWon });
                  }
                });
              }
            }
          }
          prevPhaseRef.current = state.phase;
        }
        break;
      }
      case 'players': setPlayerCount((data.players as unknown[]).length); break;
      case 'turn_tick': setTurnTimeLeft(data.remaining as number); break;
      case 'action': sounds.chipStack(); break;
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

  const toggleReady = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'ready' })); sounds.click(); }, []);
  const fold = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'fold' })); sounds.cardFlip(); }, []);
  const check = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'check' })); sounds.click(); }, []);
  const call = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'call' })); sounds.bet(); }, []);
  const raise = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'raise', amount: raiseAmount })); sounds.bet(); }, [raiseAmount]);
  const allIn = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'all_in' })); sounds.bet(); }, []);
  const sendChat = useCallback((text: string) => { wsRef.current?.send(JSON.stringify({ type: 'chat', text })); }, []);

  if (!connected || !serverState) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Texas Hold&apos;em</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={false} />
        <div className="border border-white/[0.06] bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-500 text-sm mb-2">Create or join a room to play poker</p>
          <p className="text-zinc-700 text-xs">2-8 players, Texas Hold&apos;em</p>
        </div>
      </div>
    );
  }

  const { phase, communityCards, pot, currentBet, minRaise, dealerIndex, activePlayerIndex, seats, readyPlayers, roundNumber, results: showdownResults } = serverState;
  const mySeatIdx = seats.findIndex(s => s.id === myId);
  const mySeat = mySeatIdx !== -1 ? seats[mySeatIdx] : null;
  const isMyTurn = mySeatIdx === activePlayerIndex && ['pre_flop', 'flop_betting', 'turn_betting', 'river_betting'].includes(phase);
  const canCheck = isMyTurn && mySeat && mySeat.currentBet >= currentBet;
  const callAmount = mySeat ? currentBet - mySeat.currentBet : 0;

  const phaseLabel = phase === 'pre_flop' ? 'Pre-Flop' : phase === 'flop_betting' ? 'Flop' : phase === 'turn_betting' ? 'Turn' : phase === 'river_betting' ? 'River' : phase === 'showdown' ? 'Showdown' : phase;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Texas Hold&apos;em</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <span className="text-zinc-600 text-xs">Hand #{roundNumber}</span>
      </div>

      <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={connected} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Table */}
          <div className="border border-white/[0.04] bg-black p-4 sm:p-6">
            {/* Pot & community cards */}
            <div className="text-center mb-4">
              {phase !== 'waiting' && (
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-[10px] text-zinc-600 tracking-wider uppercase">{phaseLabel}</span>
                  <span className="text-sm font-bold font-mono text-yellow-400">Pot: ${pot.toLocaleString()}</span>
                </div>
              )}
              {communityCards.length > 0 && (
                <div className="flex gap-1.5 sm:gap-2 justify-center mb-4">
                  {communityCards.map((card, i) => (
                    <PokerCard key={`cc-${i}-${card.rank}${card.suit}`} card={card} index={i} />
                  ))}
                </div>
              )}
            </div>

            {/* Seats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {seats.map((seat, idx) => {
                const isActive = idx === activePlayerIndex;
                const isMe = seat.id === myId;
                const showCards = seat.holeCards && seat.holeCards.length > 0;

                return (
                  <div key={idx} className={`border p-2 sm:p-3 min-h-[100px] transition-all ${
                    isActive ? 'border-yellow-500/50 bg-yellow-500/5' :
                    seat.folded ? 'border-white/[0.03] opacity-40' :
                    isMe ? 'border-red-600/30 bg-red-600/5' : 'border-white/[0.06]'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        {idx === dealerIndex && <span className="text-[9px] px-1 bg-yellow-500/30 text-yellow-400 font-bold">D</span>}
                        <span className={`text-[10px] font-bold truncate ${isMe ? 'text-red-400' : 'text-zinc-400'}`}>
                          {isMe ? 'You' : seat.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-mono">${seat.chips}</span>
                    </div>

                    {showCards ? (
                      <div className="flex gap-0.5 mb-1">
                        {seat.holeCards!.map((c, ci) => (
                          <PokerCard key={`s${idx}-${ci}`} card={c} index={ci} small />
                        ))}
                      </div>
                    ) : seat.hasCards && !seat.folded ? (
                      <div className="flex gap-0.5 mb-1">
                        <PokerCard card={{ suit: '?', rank: '?', value: 0 }} hidden index={0} small />
                        <PokerCard card={{ suit: '?', rank: '?', value: 0 }} hidden index={1} small />
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between">
                      {seat.currentBet > 0 && (
                        <span className="text-yellow-400/80 text-[10px] font-mono">${seat.currentBet}</span>
                      )}
                      <span className={`text-[9px] font-bold uppercase ${
                        seat.folded ? 'text-red-400' : seat.allIn ? 'text-yellow-400' :
                        seat.lastAction ? 'text-zinc-500' : ''
                      }`}>
                        {seat.folded ? 'FOLD' : seat.allIn ? 'ALL-IN' : seat.lastAction || ''}
                      </span>
                    </div>

                    {/* Showdown results */}
                    {(phase === 'showdown' || phase === 'results') && showdownResults && (() => {
                      const r = showdownResults.find(r => r.playerId === seat.id);
                      if (!r) return null;
                      return (
                        <div className="mt-1 border-t border-white/[0.06] pt-1">
                          <span className="text-[9px] text-zinc-500">{r.handDesc}</span>
                          {r.potWon > 0 && <span className="text-[9px] text-green-400 ml-1 font-bold">+${r.potWon}</span>}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Turn timer */}
            {isMyTurn && (
              <div className="mt-3">
                <CountdownTimer totalSeconds={15} remainingSeconds={turnTimeLeft} label="Your turn" />
              </div>
            )}
            {!isMyTurn && ['pre_flop', 'flop_betting', 'turn_betting', 'river_betting'].includes(phase) && seats[activePlayerIndex] && (
              <div className="mt-3">
                <CountdownTimer totalSeconds={15} remainingSeconds={turnTimeLeft}
                  label={`${seats[activePlayerIndex]?.name || 'Player'}'s turn`} />
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

          {/* Actions */}
          {isMyTurn && mySeat && !mySeat.folded && !mySeat.allIn && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button onClick={fold} className="border border-red-600/30 text-red-400 py-3 text-xs font-bold tracking-widest uppercase hover:bg-red-600/10 transition-all">FOLD</button>
                {canCheck ? (
                  <button onClick={check} className="border border-white/20 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-white/5 transition-all">CHECK</button>
                ) : (
                  <button onClick={call} className="bg-green-700 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-green-600 transition-all">
                    CALL ${callAmount}
                  </button>
                )}
                <button onClick={raise} disabled={mySeat.chips < currentBet + minRaise - mySeat.currentBet}
                  className="bg-yellow-700 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-yellow-600 transition-all disabled:opacity-30"
                >
                  RAISE ${raiseAmount}
                </button>
                <button onClick={allIn} className="bg-red-600 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-red-500 transition-all">
                  ALL IN ${mySeat.chips}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-600 text-[10px]">Raise:</span>
                <input type="range"
                  min={currentBet + minRaise}
                  max={mySeat.chips + mySeat.currentBet}
                  step={minRaise}
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  className="flex-1 accent-yellow-500 h-1"
                />
                <span className="text-yellow-400 text-[11px] font-mono font-bold w-16 text-right">${raiseAmount}</span>
              </div>
            </div>
          )}

          {/* Waiting */}
          {phase === 'waiting' && (
            <div className="text-center space-y-3">
              <p className="text-zinc-500 text-sm">
                {playerCount < 2 ? 'Need at least 2 players' : `${readyPlayers.length}/${playerCount} ready`}
              </p>
              {playerCount >= 2 && (
                <button onClick={toggleReady}
                  className={`px-6 py-3 text-sm font-bold tracking-widest uppercase transition-all ${
                    readyPlayers.includes(myId!) ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {readyPlayers.includes(myId!) ? '✓ READY' : 'READY UP'}
                </button>
              )}
            </div>
          )}

          {phase === 'showdown' && <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">showdown...</div>}
          {phase === 'results' && <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">next hand starting soon...</div>}
        </div>

        <div className="space-y-3">
          <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
        </div>
      </div>
    </div>
  );
}
