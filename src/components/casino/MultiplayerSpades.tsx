'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import { isRed, type Card } from '@/lib/casino';
import PartySocket from 'partysocket';
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
}

interface TrickCard { playerId: string; playerName: string; card: Card; seatIndex: number; }
interface SpadesPlayer {
  id: string; name: string; avatar: string;
  seatIndex: number; teamIndex: number;
  bid: number | null; tricksWon: number; handCount: number;
}

interface ServerState {
  phase: 'waiting' | 'bidding' | 'playing' | 'trick_result' | 'round_scoring' | 'game_end';
  teams: [string[], string[]];
  teamScores: [number, number];
  teamBags: [number, number];
  currentTrick: TrickCard[];
  trickNumber: number;
  tricksWon: Record<string, number>;
  bids: Record<string, number | null>;
  dealerIndex: number;
  activePlayerIndex: number;
  turnTimeLeft: number;
  roundNumber: number;
  spadesBroken: boolean;
  leadSuit: string | null;
  trickWinnerId: string | null;
  readyPlayers: string[];
  targetScore: number;
  myHand: Card[];
  players: SpadesPlayer[];
}

function SpadesCard({ card, onClick, playable, small }: { card: Card; onClick?: () => void; playable?: boolean; small?: boolean }) {
  const red = isRed(card.suit);
  return (
    <motion.button
      whileHover={playable ? { y: -8, scale: 1.05 } : {}}
      whileTap={playable ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={!playable}
      className={`relative flex-shrink-0 rounded-lg ${small ? 'w-10 h-[60px]' : 'w-12 h-[72px] sm:w-14 sm:h-[84px]'}
        bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-xl transition-all
        ${playable ? 'border-2 border-yellow-500/60 cursor-pointer hover:shadow-[0_0_15px_rgba(234,179,8,0.3)]' :
          onClick === undefined ? 'border border-white/10' : 'border border-white/5 opacity-40 cursor-not-allowed'}`}
    >
      <div className={`absolute top-0.5 left-1 ${small ? 'text-[7px]' : 'text-[9px] sm:text-[10px]'}`}>
        <p className={`font-black leading-none ${red ? 'text-red-500' : 'text-white'}`}>{card.rank}</p>
        <p className={`leading-none ${red ? 'text-red-500' : 'text-white/70'}`}>{card.suit}</p>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${small ? 'text-base' : 'text-xl sm:text-2xl'} ${red ? 'text-red-500' : 'text-white/80'}`}>{card.suit}</span>
      </div>
    </motion.button>
  );
}

export default function MultiplayerSpades({ balance, onWin, onLose, onLeaderboardEntry, username }: Props) {
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [turnTimeLeft, setTurnTimeLeft] = useState(0);
  const [selectedBid, setSelectedBid] = useState(3);

  const wsRef = useRef<PartySocket | null>(null);
  const prevPhaseRef = useRef<string>('');
  const playerName = useRef(username || 'Player_' + Math.random().toString(36).slice(2, 6).toUpperCase());
  useEffect(() => { if (username) playerName.current = username; }, [username]);

  const connectToRoom = useCallback((id: string) => {
    if (wsRef.current) wsRef.current.close();
    const ws = new PartySocket({ host: PARTYKIT_HOST, party: 'spades', room: id });
    ws.addEventListener('open', () => {
      setConnected(true); setMyId(ws.id);
      ws.send(JSON.stringify({ type: 'join', name: playerName.current, avatar: '♠️' }));
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
          if (state.phase === 'bidding') sounds.cardDeal();
          if (state.phase === 'playing' && prevPhaseRef.current === 'bidding') sounds.click();
          if (state.phase === 'trick_result') sounds.chipStack();
          if (state.phase === 'game_end') {
            // Determine if my team won
            const me = state.players.find(p => p.id === selfId);
            if (me) {
              const myTeam = me.teamIndex;
              const won = state.teamScores[myTeam] >= state.targetScore &&
                state.teamScores[myTeam] >= state.teamScores[1 - myTeam];
              if (won) {
                sounds.jackpot(); onWin(state.teamScores[myTeam] * 2, 0);
              } else {
                sounds.lose(); onLose(200);
              }
            }
          }
          prevPhaseRef.current = state.phase;
        }
        break;
      }
      case 'players': setPlayerCount((data.players as unknown[]).length); break;
      case 'turn_tick': setTurnTimeLeft(data.remaining as number); break;
      case 'card_played': sounds.cardFlip(); break;
      case 'trick_won': sounds.win(); break;
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
  }, [onWin, onLose]);

  useEffect(() => { return () => { if (wsRef.current) wsRef.current.close(); }; }, []);

  const createRoom = useCallback(() => connectToRoom(generateRoomCode()), [connectToRoom]);
  const joinRoom = useCallback((code: string) => connectToRoom(code), [connectToRoom]);
  const leaveRoom = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null; setRoomId(null); setConnected(false); setServerState(null);
    setChatMessages([]); prevPhaseRef.current = '';
  }, []);

  const toggleReady = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'ready' })); sounds.click(); }, []);
  const placeBid = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'bid', amount: selectedBid }));
    sounds.bet();
  }, [selectedBid]);
  const playCard = useCallback((card: Card) => {
    wsRef.current?.send(JSON.stringify({ type: 'play_card', suit: card.suit, rank: card.rank }));
    sounds.cardFlip();
  }, []);
  const sendChat = useCallback((text: string) => { wsRef.current?.send(JSON.stringify({ type: 'chat', text })); }, []);

  if (!connected || !serverState) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Spades</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={false} />
        <div className="border border-white/[0.06] bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-500 text-sm mb-2">Create or join a room to play spades</p>
          <p className="text-zinc-700 text-xs">Exactly 4 players, 2v2 teams</p>
        </div>
      </div>
    );
  }

  const { phase, teams, teamScores, teamBags, currentTrick, trickNumber, bids, dealerIndex, activePlayerIndex, spadesBroken, leadSuit, trickWinnerId, readyPlayers, roundNumber, targetScore, myHand, players } = serverState;
  const mySeatIdx = players.findIndex(p => p.id === myId);
  const myPlayer = mySeatIdx !== -1 ? players[mySeatIdx] : null;
  const isMyTurn = mySeatIdx === activePlayerIndex;
  const activePlayer = players[activePlayerIndex];

  // Card playability
  const canPlayCard = (card: Card) => {
    if (!isMyTurn || phase !== 'playing') return false;
    if (leadSuit && card.suit !== leadSuit) {
      const hasLeadSuit = myHand.some(c => c.suit === leadSuit);
      if (hasLeadSuit) return false;
    }
    if (currentTrick.length === 0 && card.suit === '♠' && !spadesBroken) {
      const hasNonSpade = myHand.some(c => c.suit !== '♠');
      if (hasNonSpade) return false;
    }
    return true;
  };

  // Team labels
  const getTeamLabel = (teamIdx: number) => {
    const members = teams[teamIdx];
    if (!members || members.length === 0) return `Team ${teamIdx + 1}`;
    return members.map(id => {
      if (id === myId) return 'You';
      const p = players.find(pl => pl.id === id);
      return p?.name || 'Player';
    }).join(' & ');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Spades</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <span className="text-zinc-600 text-xs">Round #{roundNumber} · Trick {trickNumber}/13</span>
      </div>

      <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} playerCount={playerCount} connected={connected} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Score bar */}
          {phase !== 'waiting' && (
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map(ti => (
                <div key={ti} className={`border p-2 ${myPlayer && myPlayer.teamIndex === ti ? 'border-red-600/30 bg-red-600/5' : 'border-white/[0.06]'}`}>
                  <span className="text-[10px] text-zinc-500 tracking-wider uppercase block">{getTeamLabel(ti)}</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-lg font-black text-white font-mono">{teamScores[ti]}</span>
                    <span className="text-[10px] text-zinc-600">bags: {teamBags[ti]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Players & trick area */}
          <div className="border border-white/[0.04] bg-black p-4 sm:p-6 min-h-[200px]">
            {/* Player positions */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {players.map((p, idx) => {
                const isActive = idx === activePlayerIndex;
                const isMe = p.id === myId;
                const bid = bids[p.id];
                return (
                  <div key={p.id} className={`text-center p-2 border transition-all ${
                    isActive ? 'border-yellow-500/50 bg-yellow-500/5' :
                    isMe ? 'border-red-600/30' : 'border-white/[0.04]'
                  }`}>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {idx === dealerIndex && <span className="text-[8px] px-1 bg-yellow-500/30 text-yellow-400 font-bold">D</span>}
                      <span className={`text-[10px] font-bold truncate ${isMe ? 'text-red-400' : 'text-zinc-400'}`}>
                        {isMe ? 'You' : p.name}
                      </span>
                    </div>
                    <div className="text-[9px] text-zinc-600">
                      {bid !== null && bid !== undefined ? `Bid: ${bid}` : phase === 'bidding' ? '...' : ''}
                      {(phase === 'playing' || phase === 'trick_result') && ` · Won: ${p.tricksWon}`}
                    </div>
                    <div className="text-[9px] text-zinc-700">{p.handCount} cards</div>
                  </div>
                );
              })}
            </div>

            {/* Current trick */}
            {(phase === 'playing' || phase === 'trick_result') && (
              <div className="flex gap-2 justify-center min-h-[84px] items-center">
                {currentTrick.length === 0 && (
                  <span className="text-zinc-700 text-xs">
                    {isMyTurn ? 'Lead a card' : `Waiting for ${activePlayer?.name || 'player'}...`}
                  </span>
                )}
                {currentTrick.map((tc, i) => (
                  <div key={i} className="text-center">
                    <SpadesCard card={tc.card} small />
                    <span className={`text-[9px] mt-0.5 block ${tc.playerId === trickWinnerId ? 'text-yellow-400 font-bold' : 'text-zinc-600'}`}>
                      {tc.playerId === myId ? 'You' : tc.playerName}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {phase === 'trick_result' && trickWinnerId && (
              <motion.p initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-center text-yellow-400 text-sm font-bold mt-2">
                {trickWinnerId === myId ? 'You' : players.find(p => p.id === trickWinnerId)?.name} takes the trick!
              </motion.p>
            )}
          </div>

          {/* Turn timer */}
          {(phase === 'bidding' || phase === 'playing') && activePlayer && (
            <CountdownTimer totalSeconds={15} remainingSeconds={turnTimeLeft}
              label={isMyTurn ? (phase === 'bidding' ? 'Your bid' : 'Your turn') : `${activePlayer.name}'s ${phase === 'bidding' ? 'bid' : 'turn'}`}
            />
          )}

          {/* Bidding */}
          {phase === 'bidding' && isMyTurn && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <span className="text-zinc-500 text-sm">Your bid:</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(n => (
                    <button key={n} onClick={() => setSelectedBid(n)}
                      className={`w-8 h-8 text-xs font-bold transition-all ${
                        selectedBid === n ? 'bg-red-600 text-white' :
                        n === 0 ? 'bg-zinc-800 text-yellow-400 hover:bg-zinc-700' :
                        'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {n === 0 ? 'Nil' : n}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={placeBid}
                className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all"
              >
                BID {selectedBid === 0 ? 'NIL' : selectedBid}
              </button>
            </div>
          )}

          {/* My hand */}
          {(phase === 'playing' || phase === 'trick_result' || phase === 'bidding') && myHand.length > 0 && (
            <div className="border border-white/[0.04] bg-zinc-950/50 p-3 sm:p-4">
              <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold block mb-2">Your Hand</span>
              {!spadesBroken && phase === 'playing' && (
                <span className="text-zinc-700 text-[9px] block mb-2">Spades not yet broken</span>
              )}
              <div className="flex gap-1 flex-wrap justify-center">
                {myHand.map((card, i) => {
                  const playable = canPlayCard(card);
                  return (
                    <SpadesCard
                      key={`${card.rank}${card.suit}`}
                      card={card}
                      playable={playable}
                      onClick={playable ? () => playCard(card) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Waiting */}
          {phase === 'waiting' && (
            <div className="text-center space-y-3">
              <p className="text-zinc-500 text-sm">
                {playerCount < 4 ? `Need 4 players (${playerCount}/4)` : `${readyPlayers.length}/4 ready`}
              </p>
              {playerCount === 4 && (
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

          {/* Round scoring */}
          {phase === 'round_scoring' && (
            <div className="text-center text-zinc-500 text-sm py-3 animate-pulse">Scoring round... next round starting soon</div>
          )}

          {/* Game end */}
          {phase === 'game_end' && (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center py-6">
              <p className="text-3xl font-black text-yellow-400 mb-2">
                {myPlayer && teamScores[myPlayer.teamIndex] >= teamScores[1 - myPlayer.teamIndex] ? 'YOUR TEAM WINS!' : 'GAME OVER'}
              </p>
              <p className="text-zinc-500 text-sm">
                {teamScores[0]} — {teamScores[1]}
              </p>
              <p className="text-zinc-600 text-xs mt-2">Game restarting soon...</p>
            </motion.div>
          )}
        </div>

        <div className="space-y-3">
          {/* Bids & tricks */}
          {phase !== 'waiting' && (
            <div className="border border-white/[0.04]">
              <div className="px-3 py-2 border-b border-white/[0.04]">
                <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Bids & Tricks</span>
              </div>
              {players.map(p => (
                <div key={p.id} className={`flex items-center justify-between px-3 py-1.5 ${p.id === myId ? 'bg-white/[0.02]' : ''}`}>
                  <span className={`text-[11px] font-bold ${p.id === myId ? 'text-red-400' : 'text-zinc-400'}`}>
                    {p.id === myId ? 'You' : p.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-600 text-[10px]">
                      Bid: {p.bid !== null && p.bid !== undefined ? (p.bid === 0 ? 'Nil' : p.bid) : '—'}
                    </span>
                    <span className="text-white text-[10px] font-mono font-bold">{p.tricksWon}/{p.bid ?? '?'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
        </div>
      </div>
    </div>
  );
}
