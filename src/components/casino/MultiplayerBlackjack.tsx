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
  onWin: (amount: number, wagered?: number) => void;
  onLose: (amount: number) => void;
  onLeaderboardEntry?: (entry: { player: string; game: string; emoji: string; amount: number }) => void;
  username?: string;
  initialRoom?: string | null;
  gameId?: string;
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

export default function MultiplayerBlackjack({ balance, onWin, onLose, onLeaderboardEntry, username, initialRoom, gameId }: Props) {
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

  const wsRef = useRef<PartySocket | null>(null);
  const prevPhaseRef = useRef<string>('');
  const playerName = useRef(username || 'Player_' + Math.random().toString(36).slice(2, 6).toUpperCase());
  useEffect(() => { if (username) playerName.current = username; }, [username]);

  const connectToRoom = useCallback((id: string) => {
    if (wsRef.current) wsRef.current.close();

    const ws = new PartySocket({
      host: PARTYKIT_HOST,
      party: 'blackjack',
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

        // Check if we're seated
        const mySeat = state.seats.find((s) => s.player?.id === selfId);
        if (mySeat) {
          setSeated(true);
          setMySeatIndex(mySeat.index);
        }

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
              if (mySeat.profit > 0) {
                sounds.win();
                onWin(mySeat.profit + mySeat.bet, mySeat.bet);
                const isBJ = mySeat.handValue === 21 && mySeat.hand.length === 2;
                setResult({ text: `+$${mySeat.profit.toLocaleString()}`, sub: isBJ ? 'BLACKJACK' : `${mySeat.handValue} vs ${state.dealerHandValue}`, win: true });
                if (isBJ) sounds.jackpot();
              } else if (mySeat.profit < 0) {
                sounds.lose();
                onLose(Math.abs(mySeat.profit));
                setResult({ text: `-$${Math.abs(mySeat.profit).toLocaleString()}`, sub: mySeat.handValue > 21 ? 'BUST' : `${mySeat.handValue} vs ${state.dealerHandValue}`, win: false });
              } else {
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
        setPlayerCount((data.players as unknown[]).length);
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
          type: 'chat',
        };
        setChatMessages((prev) => [...prev.slice(-100), msg]);
        break;
      }
    }
  }, [onWin, onLose]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const createRoom = useCallback(() => connectToRoom(generateRoomCode()), [connectToRoom]);
  const joinRoom = useCallback((code: string) => connectToRoom(code), [connectToRoom]);
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
    prevPhaseRef.current = '';
  }, []);

  const sitDown = useCallback((seatIndex: number) => {
    if (!wsRef.current || seated) return;
    wsRef.current.send(JSON.stringify({ type: 'take_seat', seatIndex }));
    sounds.click();
  }, [seated]);

  const placeBet = useCallback(() => {
    if (!wsRef.current || hasBet || balance < bet) return;
    wsRef.current.send(JSON.stringify({ type: 'bet', amount: bet }));
    setHasBet(true);
    sounds.bet();
  }, [hasBet, balance, bet]);

  const hit = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'hit' })); sounds.cardDeal(); }, []);
  const stand = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'stand' })); sounds.click(); }, []);
  const doubleDown = useCallback(() => {
    if (balance < bet * 2) return;
    wsRef.current?.send(JSON.stringify({ type: 'double' }));
    sounds.bet();
  }, [balance, bet]);

  const sendChat = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }));
  }, []);

  // Not connected
  if (!connected || !serverState) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Blackjack Table</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={false} gameId={gameId} initialRoom={initialRoom || undefined} />
        <div className="border border-white/[0.06] bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-500 text-sm mb-2">Create or join a room to play multiplayer blackjack</p>
          <p className="text-zinc-700 text-xs">Share the room code with friends — no bots, real players only</p>
        </div>
      </div>
    );
  }

  const { phase, seats, dealerHand, dealerHandValue, dealerRevealed, activeSeatIndex, roundNumber, bettingTimeLeft } = serverState;
  const isMyTurn = mySeatIndex !== null && activeSeatIndex === mySeatIndex && phase === 'player_turns';
  const mySeat = mySeatIndex !== null ? seats[mySeatIndex] : null;
  const canDouble = isMyTurn && mySeat && mySeat.hand.length === 2 && !mySeat.doubled && balance >= bet * 2;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Blackjack Table</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <span className="text-zinc-600 text-xs">Round #{roundNumber}</span>
      </div>

      <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={connected} gameId={gameId} initialRoom={initialRoom || undefined} />

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

            return (
              <div key={idx}
                className={`border p-2 sm:p-3 min-h-[140px] sm:min-h-[200px] flex flex-col transition-all ${
                  isActive ? 'border-yellow-500/50 bg-yellow-500/5 shadow-[0_0_15px_rgba(234,179,8,0.1)]' :
                  isMe ? 'border-red-600/30 bg-red-600/5' :
                  isEmpty ? 'border-dashed border-white/[0.06] hover:border-white/[0.12] cursor-pointer' :
                  'border-white/[0.06]'
                }`}
                onClick={() => { if (isEmpty && !seated) sitDown(idx); }}
              >
                {isEmpty ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-1">
                    <span className="text-zinc-700 text-xl">+</span>
                    <span className="text-zinc-700 text-[9px] tracking-wider uppercase">{seated ? '' : 'Sit'}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs">{seat.player!.avatar}</span>
                      <span className={`text-[10px] font-bold truncate ${isMe ? 'text-red-400' : 'text-zinc-400'}`}>
                        {isMe ? 'You' : seat.player!.name}
                      </span>
                    </div>
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
        {!seated && (
          <div className="text-center border border-dashed border-white/[0.08] py-6">
            <p className="text-zinc-500 text-sm mb-1">Click an empty seat to sit down</p>
            <p className="text-zinc-700 text-xs">{phase !== 'waiting' && phase !== 'betting' ? 'You\'ll play next round' : 'Pick your spot at the table'}</p>
          </div>
        )}

        {seated && phase === 'betting' && !hasBet && (
          <div className="space-y-3">
            <CountdownTimer totalSeconds={8} remainingSeconds={bettingTimeLeft} label="Betting closes in" />
            <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />
            <button onClick={placeBet} disabled={balance < bet}
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
            <button onClick={hit} className="bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all">HIT</button>
            <button onClick={stand} className="border border-white/20 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-white/5 transition-all">STAND</button>
            {canDouble && (
              <button onClick={doubleDown} className="bg-yellow-600/80 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-yellow-500/80 transition-all">2x</button>
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

      <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
    </div>
  );
}
