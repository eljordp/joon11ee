'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import PartySocket from 'partysocket';
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
}

interface DominoTile { id: number; high: number; low: number; isDouble: boolean; totalPips: number; }
interface PlacedTile { tile: DominoTile; end: 'left' | 'right' | 'first'; }
interface DomPlayer { id: string; name: string; avatar: string; tileCount: number; score: number; }

interface ServerState {
  phase: 'waiting' | 'playing' | 'round_end' | 'game_end';
  playerOrder: string[];
  activePlayerId: string | null;
  board: PlacedTile[];
  openEnds: [number, number];
  turnTimeLeft: number;
  roundNumber: number;
  scores: Record<string, number>;
  readyPlayers: string[];
  lastAction: string;
  targetScore: number;
  winnerId: string | null;
  myHand: DominoTile[];
  boneyardCount: number;
  players: DomPlayer[];
}

const PIP_DISPLAY: Record<number, string> = { 0: ' ', 1: '·', 2: ':', 3: '∴', 4: '∷', 5: '⁙', 6: '⠿' };

function TileView({ tile, onClick, playable, small }: { tile: DominoTile; onClick?: () => void; playable?: boolean; small?: boolean }) {
  return (
    <motion.button
      whileHover={playable ? { scale: 1.1, y: -4 } : {}}
      whileTap={playable ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={!playable}
      className={`inline-flex items-center border-2 ${small ? 'px-1 py-0.5' : 'px-2 py-1'} transition-all ${
        playable ? 'border-yellow-500/60 bg-zinc-800 hover:bg-zinc-700 cursor-pointer shadow-[0_0_10px_rgba(234,179,8,0.2)]' :
        onClick ? 'border-white/10 bg-zinc-900 opacity-40 cursor-not-allowed' :
        'border-white/10 bg-zinc-900'
      }`}
    >
      <span className={`font-mono font-bold ${small ? 'text-[10px]' : 'text-sm'} text-white`}>
        {tile.low}
      </span>
      <span className={`${small ? 'text-[8px] mx-0.5' : 'text-xs mx-1'} text-zinc-600`}>|</span>
      <span className={`font-mono font-bold ${small ? 'text-[10px]' : 'text-sm'} text-white`}>
        {tile.high}
      </span>
    </motion.button>
  );
}

export default function MultiplayerDominoes({ balance, onWin, onLose, onLeaderboardEntry, username, initialRoom, gameId }: Props) {
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [turnTimeLeft, setTurnTimeLeft] = useState(0);
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
    const ws = new PartySocket({ host: PARTYKIT_HOST, party: 'dominoes', room: id });
    ws.addEventListener('open', () => {
      setConnected(true); setMyId(ws.id);
      ws.send(JSON.stringify({ type: 'join', name: playerName.current, avatar: '🁣', password: passwordRef.current, ...(spectate ? { spectate: true } : {}) }));
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
          if (state.phase === 'playing' && prevPhaseRef.current !== 'playing') sounds.cardDeal();
          if (state.phase === 'game_end') {
            if (state.winnerId === selfId) {
              sounds.jackpot();
              onWin(state.scores[selfId] * 10, 0);
            } else {
              sounds.lose();
              onLose(100);
            }
            // Leaderboard
            if (onLeaderboardEntry && state.winnerId && state.winnerId !== selfId) {
              const winner = state.players.find(p => p.id === state.winnerId);
              if (winner && state.scores[state.winnerId] * 10 >= 500) {
                onLeaderboardEntry({ player: winner.name, game: 'Dominoes', emoji: '🁣', amount: state.scores[state.winnerId] * 10 });
              }
            }
          }
          prevPhaseRef.current = state.phase;
        }
        break;
      }
      case 'players': setPlayerCount((data.players as unknown[]).length); break;
      case 'tile_played': sounds.tilePlace(); break;
      case 'tile_drawn': sounds.cardDeal(); break;
      case 'turn_tick': setTurnTimeLeft(data.remaining as number); break;
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
      case 'spectator_count': setSpectatorCount(data.count as number); break;
      case 'joined_as_spectator': setIsSpectating(true); break;
    }
  }, [onWin, onLose, onLeaderboardEntry]);

  useEffect(() => { return () => { if (wsRef.current) wsRef.current.close(); }; }, []);

  const createRoom = useCallback((code?: string, password?: string) => connectToRoom(code || generateRoomCode(), password), [connectToRoom]);
  const joinRoom = useCallback((code: string, password?: string) => connectToRoom(code, password), [connectToRoom]);
  const watchRoom = useCallback((code: string, password?: string) => connectToRoom(code, password, true), [connectToRoom]);
  const leaveRoom = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null; setRoomId(null); setConnected(false); setServerState(null);
    setChatMessages([]); prevPhaseRef.current = ''; setIsSpectating(false); setSpectatorCount(0);
  }, []);

  const toggleReady = useCallback(() => { wsRef.current?.send(JSON.stringify({ type: 'ready' })); sounds.click(); }, []);

  const playTile = useCallback((tileId: number, end: 'left' | 'right') => {
    wsRef.current?.send(JSON.stringify({ type: 'play', tileId, end }));
    setSelectedTile(null);
    sounds.tilePlace();
  }, []);

  const drawTile = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'draw' }));
    sounds.cardDeal();
  }, []);

  const sendChat = useCallback((text: string) => { wsRef.current?.send(JSON.stringify({ type: 'chat', text })); }, []);

  const sendReaction = useCallback((emoji: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'reaction', emoji }));
  }, []);

  if (!connected || !serverState) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Dominoes</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} onWatch={watchRoom} playerCount={playerCount} connected={false} gameId={gameId} initialRoom={initialRoom || undefined} authError={authError} />
        <div className="border border-white/[0.06] bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-500 text-sm mb-2">Create or join a room to play dominoes</p>
          <p className="text-zinc-700 text-xs">2-4 players, play to 100 points</p>
        </div>
      </div>
    );
  }

  const { phase, activePlayerId, board, openEnds, myHand, boneyardCount, players, scores, readyPlayers, lastAction, roundNumber, winnerId, targetScore } = serverState;
  const isMyTurn = myId === activePlayerId;
  const isFirstPlay = board.length === 0;

  const canPlayTile = (tile: DominoTile) => {
    if (isFirstPlay) return true;
    return tile.high === openEnds[0] || tile.low === openEnds[0] || tile.high === openEnds[1] || tile.low === openEnds[1];
  };

  const getPlayableEnds = (tile: DominoTile): ('left' | 'right')[] => {
    if (isFirstPlay) return ['left'];
    const ends: ('left' | 'right')[] = [];
    if (tile.high === openEnds[0] || tile.low === openEnds[0]) ends.push('left');
    if (tile.high === openEnds[1] || tile.low === openEnds[1]) ends.push('right');
    return ends;
  };

  const hasPlayable = myHand.some(t => canPlayTile(t));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Dominoes</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">Live</span>
        </div>
        <span className="text-zinc-600 text-xs">Round #{roundNumber} · Target: {targetScore}</span>
      </div>

      <RoomControls roomId={roomId} onCreateRoom={createRoom} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} onWatch={watchRoom} playerCount={playerCount} connected={connected} gameId={gameId} initialRoom={initialRoom || undefined} authError={authError} />
      <SpectatorBadge count={spectatorCount} isSpectating={isSpectating} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Board */}
          <div className="relative border border-white/[0.04] bg-black p-4 min-h-[120px]">
            <FloatingReactions reactions={floatingReactions} />
            {board.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-zinc-700 text-xs tracking-wider uppercase">
                {phase === 'playing' ? 'First tile...' : 'Board empty'}
              </div>
            ) : (
              <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin items-center justify-center flex-wrap">
                {board.map((pt, i) => (
                  <TileView key={pt.tile.id} tile={pt.tile} small />
                ))}
              </div>
            )}
            {board.length > 0 && (
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-zinc-600">← {openEnds[0]}</span>
                <span className="text-[10px] text-zinc-600">{openEnds[1]} →</span>
              </div>
            )}
          </div>

          {/* Last action */}
          {lastAction && (
            <div className="text-center text-zinc-500 text-xs">{lastAction}</div>
          )}

          {/* My hand */}
          {phase === 'playing' && !isSpectating && (
            <div className="border border-white/[0.04] bg-zinc-950/50 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Your Hand ({myHand.length})</span>
                {isMyTurn && <span className="text-yellow-400 text-[10px] font-bold animate-pulse">YOUR TURN</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {myHand.map(tile => {
                  const playable = isMyTurn && canPlayTile(tile);
                  const ends = getPlayableEnds(tile);
                  return (
                    <div key={tile.id} className="relative">
                      {selectedTile === tile.id && ends.length > 0 ? (
                        <div className="flex gap-1">
                          {ends.map(end => (
                            <button key={end} onClick={() => playTile(tile.id, end)}
                              className="px-2 py-1 bg-yellow-600 text-white text-[10px] font-bold tracking-wider uppercase hover:bg-yellow-500 transition-all"
                            >
                              {end === 'left' ? '← Left' : 'Right →'}
                            </button>
                          ))}
                          <button onClick={() => setSelectedTile(null)}
                            className="px-1 py-1 text-zinc-500 text-[10px] hover:text-white"
                          >✕</button>
                        </div>
                      ) : (
                        <TileView
                          tile={tile}
                          playable={playable}
                          onClick={playable ? () => {
                            if (ends.length === 1) playTile(tile.id, ends[0]);
                            else setSelectedTile(tile.id);
                          } : undefined}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {isMyTurn && !hasPlayable && boneyardCount > 0 && (
                <button onClick={drawTile}
                  className="mt-3 w-full bg-blue-700 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-blue-600 transition-all"
                >
                  DRAW FROM BONEYARD ({boneyardCount} left)
                </button>
              )}
              {isMyTurn && !hasPlayable && boneyardCount === 0 && (
                <p className="mt-3 text-center text-zinc-600 text-xs">No playable tiles and boneyard empty — passing...</p>
              )}
            </div>
          )}

          {/* Turn timer */}
          {phase === 'playing' && activePlayerId && (
            <CountdownTimer
              totalSeconds={15} remainingSeconds={turnTimeLeft}
              label={isMyTurn ? 'Your turn' : `${players.find(p => p.id === activePlayerId)?.name || 'Player'}'s turn`}
            />
          )}

          {/* Waiting / Ready */}
          {phase === 'waiting' && (
            <div className="text-center space-y-3">
              <p className="text-zinc-500 text-sm">
                {players.length < 2 ? 'Need at least 2 players' : `${readyPlayers.length}/${players.length} ready`}
              </p>
              {!isSpectating && players.length >= 2 && (
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

          {/* Round end */}
          {phase === 'round_end' && (
            <div className="text-center text-zinc-500 text-sm py-3 animate-pulse">
              {lastAction} · Next round starting soon...
            </div>
          )}

          {/* Game end */}
          {phase === 'game_end' && winnerId && (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center py-6">
              <p className="text-3xl font-black text-yellow-400 mb-2">
                {winnerId === myId ? 'YOU WIN!' : `${players.find(p => p.id === winnerId)?.name} WINS!`}
              </p>
              <p className="text-zinc-500 text-sm">Game restarting soon...</p>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Scores */}
          <div className="border border-white/[0.04]">
            <div className="px-3 py-2 border-b border-white/[0.04]">
              <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Players & Scores</span>
            </div>
            {players.map(p => (
              <div key={p.id} className={`flex items-center justify-between px-3 py-2 ${p.id === activePlayerId ? 'bg-yellow-500/5' : ''}`}>
                <div className="flex items-center gap-2">
                  {p.id === activePlayerId && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />}
                  <span className={`text-[11px] font-bold ${p.id === myId ? 'text-red-400' : 'text-zinc-400'}`}>
                    {p.id === myId ? 'You' : p.name}
                  </span>
                  {phase === 'playing' && <span className="text-zinc-700 text-[10px]">{p.tileCount} tiles</span>}
                </div>
                <span className="text-white text-[11px] font-bold font-mono">{p.score} pts</span>
              </div>
            ))}
          </div>

          {boneyardCount > 0 && phase === 'playing' && (
            <div className="border border-white/[0.04] px-3 py-2">
              <span className="text-zinc-600 text-[10px]">Boneyard: {boneyardCount} tiles</span>
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
