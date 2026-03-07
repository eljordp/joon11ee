'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isRed, type Card } from '@/lib/casino';
import PartySocket from 'partysocket';
import MultiplayerChat from './MultiplayerChat';
import EmotePicker, { FloatingReactions } from './EmotePicker';
import RoomControls, { generateRoomCode } from './RoomControls';
import TournamentLobby from './TournamentLobby';
import TournamentBracket from './TournamentBracket';
import type { ChatMessage } from '@/lib/multiplayer/types';

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

interface Props {
  balance: number;
  onWin: (amount: number, wagered?: number) => void;
  onLose: (amount: number) => void;
  username?: string;
  initialRoom?: string | null;
  gameId?: string;
}

interface Player { id: string; name: string; avatar: string; }
interface MatchResult { player1: string; player2: string; winner: string; p1Wins: number; p2Wins: number; }

interface TournamentState {
  phase: 'lobby' | 'round_1' | 'round_2' | 'finals' | 'complete';
  players: Player[];
  bracket: { round1: [MatchResult | null, MatchResult | null]; finals: MatchResult | null };
  currentMatch: {
    player1: string; player2: string;
    p1Hand: Card[]; p2Hand: Card[]; dealerHand: Card[];
    p1Value: number; p2Value: number; dealerValue: number;
    p1Done: boolean; p2Done: boolean;
    handNumber: number; p1Wins: number; p2Wins: number;
    matchPhase: 'dealing' | 'player_turns' | 'dealer' | 'result';
  } | null;
  winner: string | null;
  prizePool: number;
  hostId: string | null;
}

function PlayingCard({ card, small }: { card: Card; small?: boolean }) {
  if (card.rank === '?') {
    return (
      <div className={`${small ? 'w-8 h-11' : 'w-12 h-16'} border border-blue-500/30 bg-blue-900/30 flex items-center justify-center`}>
        <span className={`${small ? 'text-xs' : 'text-sm'} text-blue-400`}>?</span>
      </div>
    );
  }
  const red = isRed(card.suit);
  return (
    <div className={`${small ? 'w-8 h-11' : 'w-12 h-16'} border border-white/10 bg-zinc-900 flex flex-col items-center justify-center`}>
      <span className={`${small ? 'text-[9px]' : 'text-xs'} font-bold ${red ? 'text-red-400' : 'text-white'}`}>{card.rank}</span>
      <span className={`${small ? 'text-[8px]' : 'text-[10px]'} ${red ? 'text-red-400/60' : 'text-white/40'}`}>{card.suit}</span>
    </div>
  );
}

export default function MultiplayerTournament({ balance, onWin, onLose, username, initialRoom, gameId }: Props) {
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<TournamentState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [authError, setAuthError] = useState<string | undefined>();
  const [hasPassword, setHasPassword] = useState(false);

  const wsRef = useRef<PartySocket | null>(null);
  const playerName = useRef(username || 'Player_' + Math.random().toString(36).slice(2, 6).toUpperCase());
  useEffect(() => { if (username) playerName.current = username; }, [username]);
  const passwordRef = useRef<string | null>(null);
  const reactionCounter = useRef(0);

  const myId = wsRef.current?.id;
  const isHost = gameState?.hostId === myId;
  const match = gameState?.currentMatch;

  // Am I in this match?
  const isInMatch = match && (match.player1 === myId || match.player2 === myId);
  const isP1 = match?.player1 === myId;
  const myHand = match ? (isP1 ? match.p1Hand : match.p2Hand) : [];
  const myValue = match ? (isP1 ? match.p1Value : match.p2Value) : 0;
  const myDone = match ? (isP1 ? match.p1Done : match.p2Done) : true;

  const connectToRoom = useCallback((id: string, password?: string) => {
    if (wsRef.current) { wsRef.current.close(); }
    if (password) passwordRef.current = password;

    const ws = new PartySocket({ host: PARTYKIT_HOST, party: 'tournament', room: id });
    wsRef.current = ws;
    setRoomId(id);

    ws.addEventListener('open', () => {
      setConnected(true);
      setAuthError(undefined);
      ws.send(JSON.stringify({ type: 'join', name: playerName.current, avatar: '🏆', password: passwordRef.current }));
    });

    ws.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      switch (data.type) {
        case 'state': setGameState(data.state); break;
        case 'players': setPlayers(data.players); break;
        case 'chat': {
          const msg: ChatMessage = {
            id: Date.now().toString() + Math.random(),
            playerId: data.playerId, playerName: data.playerName,
            avatar: data.avatar, text: data.text,
            timestamp: Date.now(),
            type: data.chatType === 'system' ? 'system' : 'chat',
          };
          setChatMessages(prev => [...prev.slice(-100), msg]);
          break;
        }
        case 'reaction': {
          const id = reactionCounter.current++;
          setFloatingReactions(prev => [...prev, { id, emoji: data.emoji, x: 10 + Math.random() * 80 }]);
          setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2000);
          break;
        }
        case 'auth_error': setAuthError(data.message); break;
        case 'tournament_complete': {
          if (data.winner === wsRef.current?.id) {
            onWin(data.prize, 5000);
          }
          break;
        }
      }
    });

    ws.addEventListener('close', () => { setConnected(false); });
  }, [onWin]);

  const createRoom = useCallback((code?: string, password?: string) => {
    if (password) passwordRef.current = password;
    connectToRoom(code || generateRoomCode(), password);
  }, [connectToRoom]);

  const joinRoom = useCallback((code: string, password?: string) => {
    if (password) passwordRef.current = password;
    connectToRoom(code, password);
  }, [connectToRoom]);

  const leaveRoom = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setRoomId(null);
    setGameState(null);
    setPlayers([]);
    setChatMessages([]);
  }, []);

  const sendChat = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }));
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'reaction', emoji }));
  }, []);

  const handleHit = () => wsRef.current?.send(JSON.stringify({ type: 'hit' }));
  const handleStand = () => wsRef.current?.send(JSON.stringify({ type: 'stand' }));
  const handleStart = () => wsRef.current?.send(JSON.stringify({ type: 'start' }));

  // Not connected
  if (!connected) {
    return (
      <div className="border border-white/[0.06]">
        <div className="p-6 text-center">
          <h2 className="text-white font-bold text-xl mb-1 tracking-wider">Tournament</h2>
          <p className="text-zinc-500 text-xs">4-Player Single Elimination Blackjack</p>
        </div>
        <RoomControls
          roomId={null}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onLeaveRoom={leaveRoom}
          playerCount={0}
          connected={false}
          gameId={gameId}
          initialRoom={initialRoom || undefined}
          authError={authError}
        />
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] relative">
      <FloatingReactions reactions={floatingReactions} />

      <RoomControls
        roomId={roomId}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onLeaveRoom={leaveRoom}
        playerCount={players.length}
        connected={connected}
        gameId={gameId}
        authError={authError}
        hasPassword={!!passwordRef.current}
      />

      <div className="p-4 space-y-4">
        {/* Lobby */}
        {gameState?.phase === 'lobby' && (
          <TournamentLobby
            players={gameState.players}
            isHost={isHost}
            prizePool={gameState.prizePool || 20000}
            onStart={handleStart}
          />
        )}

        {/* Bracket (always show once tournament started) */}
        {gameState && gameState.phase !== 'lobby' && (
          <TournamentBracket
            players={gameState.players}
            bracket={gameState.bracket}
            winner={gameState.winner}
            currentPhase={gameState.phase}
          />
        )}

        {/* Current match */}
        {match && (
          <div className="space-y-4 mt-4">
            <div className="text-center text-zinc-500 text-[10px] uppercase tracking-wider">
              Hand {match.handNumber} of Best of 3 — {match.p1Wins}-{match.p2Wins}
            </div>

            {/* Dealer hand */}
            <div className="text-center">
              <span className="text-zinc-600 text-[9px] uppercase tracking-wider block mb-1">Dealer</span>
              <div className="flex gap-1 justify-center">
                {match.dealerHand.map((c, i) => <PlayingCard key={i} card={c} />)}
              </div>
              {(match.matchPhase === 'dealer' || match.matchPhase === 'result') && (
                <span className="text-white text-xs font-mono font-bold mt-1 block">{match.dealerValue}</span>
              )}
            </div>

            {/* Players' hands */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: match.player1, hand: match.p1Hand, value: match.p1Value, done: match.p1Done, wins: match.p1Wins },
                { id: match.player2, hand: match.p2Hand, value: match.p2Value, done: match.p2Done, wins: match.p2Wins },
              ].map((p) => {
                const player = gameState?.players.find(pl => pl.id === p.id);
                const isMe = p.id === myId;
                return (
                  <div key={p.id} className={`border p-3 ${isMe ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-white/[0.04]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold ${isMe ? 'text-yellow-400' : 'text-zinc-400'}`}>
                        {player?.avatar} {player?.name || 'Player'}
                      </span>
                      <span className="text-zinc-600 text-[9px]">{p.wins}W</span>
                    </div>
                    <div className="flex gap-1 flex-wrap mb-1">
                      {p.hand.map((c, i) => <PlayingCard key={i} card={c} small />)}
                    </div>
                    {p.hand.length > 0 && p.hand[0].rank !== '?' && (
                      <span className={`text-xs font-mono font-bold ${
                        p.value === 21 ? 'text-green-400' : p.value > 21 ? 'text-red-400' : 'text-white'
                      }`}>
                        {p.value}
                      </span>
                    )}
                    {p.done && match.matchPhase === 'player_turns' && (
                      <span className="text-zinc-600 text-[9px] ml-2">stood</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hit / Stand controls */}
            {isInMatch && match.matchPhase === 'player_turns' && !myDone && (
              <div className="flex gap-2 justify-center">
                <button onClick={handleHit} className="px-6 py-2.5 bg-green-600 text-white text-xs font-bold tracking-wider uppercase hover:bg-green-500 transition-all">
                  Hit
                </button>
                <button onClick={handleStand} className="px-6 py-2.5 border border-white/10 text-zinc-400 text-xs font-bold tracking-wider uppercase hover:text-white transition-all">
                  Stand
                </button>
              </div>
            )}

            {isInMatch && match.matchPhase === 'player_turns' && myDone && (
              <p className="text-center text-zinc-600 text-xs">Waiting for opponent...</p>
            )}

            {!isInMatch && match.matchPhase === 'player_turns' && (
              <p className="text-center text-zinc-600 text-xs">Watching match...</p>
            )}
          </div>
        )}

        {/* Winner announcement with claim */}
        {gameState?.phase === 'complete' && gameState.winner === myId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6 border border-yellow-500/30 bg-yellow-500/5"
          >
            <span className="text-4xl block mb-2">🏆</span>
            <span className="text-yellow-400 font-bold text-xl block">You Won!</span>
            <span className="text-green-400 text-sm font-mono block mt-1">+${gameState.prizePool.toLocaleString()}</span>
          </motion.div>
        )}
      </div>

      {/* Emotes + Chat */}
      {connected && (
        <div className="px-4 pb-2">
          <EmotePicker onSelect={sendReaction} />
        </div>
      )}
      <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
    </div>
  );
}
