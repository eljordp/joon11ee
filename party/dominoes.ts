import type * as Party from "partykit/server";

interface DominoTile { id: number; high: number; low: number; isDouble: boolean; totalPips: number; }
interface Player { id: string; name: string; avatar: string; }
interface PlacedTile { tile: DominoTile; end: 'left' | 'right' | 'first'; }

function createTileSet(): DominoTile[] {
  const tiles: DominoTile[] = [];
  let id = 0;
  for (let h = 0; h <= 6; h++) for (let l = 0; l <= h; l++) tiles.push({ id: id++, high: h, low: l, isDouble: h === l, totalPips: h + l });
  return tiles;
}
function shuffleTiles(tiles: DominoTile[]): DominoTile[] {
  const s = [...tiles]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } return s;
}

interface DomState {
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
}

const TURN_DURATION = 15;
const RESULT_DURATION = 5;
const TILES_PER_PLAYER = 7;

export default class DominoesServer implements Party.Server {
  players = new Map<string, Player>();
  hands = new Map<string, DominoTile[]>();
  boneyard: DominoTile[] = [];
  state: DomState;
  turnTimer: ReturnType<typeof setInterval> | null = null;
  timers: ReturnType<typeof setTimeout>[] = [];
  roomPassword: string | null = null;
  hostId: string | null = null;

  constructor(readonly room: Party.Room) {
    this.state = {
      phase: 'waiting', playerOrder: [], activePlayerId: null,
      board: [], openEnds: [-1, -1], turnTimeLeft: 0,
      roundNumber: 0, scores: {}, readyPlayers: [], lastAction: '',
      targetScore: 100, winnerId: null,
    };
  }

  onConnect(conn: Party.Connection) {
    this.sendState(conn);
    conn.send(JSON.stringify({ type: 'players', players: this.getPlayerList() }));
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    this.players.delete(conn.id);
    this.hands.delete(conn.id);
    this.state.playerOrder = this.state.playerOrder.filter(id => id !== conn.id);
    this.state.readyPlayers = this.state.readyPlayers.filter(id => id !== conn.id);
    if (player) {
      this.broadcast({ type: 'player_left', playerId: conn.id, playerName: player.name });
      this.broadcastPlayers();
    }
    if (this.state.phase === 'playing' && this.state.activePlayerId === conn.id) this.advanceTurn();
    if (this.players.size < 2 && this.state.phase === 'playing') {
      this.stopAllTimers();
      this.state.phase = 'waiting';
      this.state.readyPlayers = [];
      this.broadcastState();
    }
    if (this.players.size === 0) {
      this.roomPassword = null;
      this.hostId = null;
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'join': this.handleJoin(sender, data); break;
      case 'ready': this.handleReady(sender); break;
      case 'play': this.handlePlay(sender, data); break;
      case 'draw': this.handleDraw(sender); break;
      case 'chat': this.handleChat(sender, data); break;
    }
  }

  private handleJoin(conn: Party.Connection, data: Record<string, unknown>) {
    if (!this.hostId && data.password) this.roomPassword = String(data.password);
    if (this.roomPassword && conn.id !== this.hostId) {
      if (String(data.password || "") !== this.roomPassword) {
        conn.send(JSON.stringify({ type: "auth_error", message: "Wrong password" }));
        return;
      }
    }
    if (this.players.size >= 4) return;
    const player: Player = { id: conn.id, name: (data.name as string) || 'Anon', avatar: (data.avatar as string) || '🎮' };
    this.players.set(conn.id, player);
    if (!this.hostId) this.hostId = conn.id;
    if (!this.state.playerOrder.includes(conn.id)) this.state.playerOrder.push(conn.id);
    if (!this.state.scores[conn.id]) this.state.scores[conn.id] = 0;
    this.broadcast({ type: 'player_joined', player });
    this.broadcastPlayers();
    this.broadcastState();
  }

  private handleReady(conn: Party.Connection) {
    if (this.state.phase !== 'waiting') return;
    if (this.state.readyPlayers.includes(conn.id)) {
      this.state.readyPlayers = this.state.readyPlayers.filter(id => id !== conn.id);
    } else {
      this.state.readyPlayers.push(conn.id);
    }
    this.broadcastState();
    if (this.state.readyPlayers.length >= 2 && this.state.readyPlayers.length === this.players.size) {
      this.startRound();
    }
  }

  private handlePlay(conn: Party.Connection, data: Record<string, unknown>) {
    if (this.state.phase !== 'playing' || conn.id !== this.state.activePlayerId) return;
    const tileId = data.tileId as number;
    const end = data.end as 'left' | 'right';
    const hand = this.hands.get(conn.id) || [];
    const tileIdx = hand.findIndex(t => t.id === tileId);
    if (tileIdx === -1) return;
    const tile = hand[tileIdx];

    if (this.state.board.length === 0) {
      // First tile
      this.state.board.push({ tile, end: 'first' });
      this.state.openEnds = [tile.low, tile.high];
      hand.splice(tileIdx, 1);
      this.hands.set(conn.id, hand);
      const player = this.players.get(conn.id);
      this.state.lastAction = `${player?.name} played [${tile.low}|${tile.high}]`;
      this.broadcast({ type: 'tile_played', playerId: conn.id, playerName: player?.name || '', tile, end: 'first' });
    } else {
      // Must match an open end
      const matchesLeft = tile.high === this.state.openEnds[0] || tile.low === this.state.openEnds[0];
      const matchesRight = tile.high === this.state.openEnds[1] || tile.low === this.state.openEnds[1];
      if (end === 'left' && !matchesLeft) return;
      if (end === 'right' && !matchesRight) return;
      if (!matchesLeft && !matchesRight) return;

      const targetEnd = end === 'left' ? this.state.openEnds[0] : this.state.openEnds[1];
      const newOpen = tile.high === targetEnd ? tile.low : tile.high;
      if (end === 'left') this.state.openEnds[0] = newOpen;
      else this.state.openEnds[1] = newOpen;

      this.state.board.push({ tile, end });
      hand.splice(tileIdx, 1);
      this.hands.set(conn.id, hand);
      const player = this.players.get(conn.id);
      this.state.lastAction = `${player?.name} played [${tile.low}|${tile.high}]`;
      this.broadcast({ type: 'tile_played', playerId: conn.id, playerName: player?.name || '', tile, end });
    }

    // Check if player won
    if (hand.length === 0) {
      this.endRound(conn.id);
      return;
    }
    this.advanceTurn();
  }

  private handleDraw(conn: Party.Connection) {
    if (this.state.phase !== 'playing' || conn.id !== this.state.activePlayerId) return;
    if (this.boneyard.length === 0) return;
    const tile = this.boneyard.pop()!;
    const hand = this.hands.get(conn.id) || [];
    hand.push(tile);
    this.hands.set(conn.id, hand);
    const player = this.players.get(conn.id);
    this.state.lastAction = `${player?.name} drew a tile`;
    this.broadcast({ type: 'tile_drawn', playerId: conn.id, playerName: player?.name || '' });
    // Don't advance turn — player gets to play the drawn tile if valid
    this.broadcastState();
  }

  private handleChat(conn: Party.Connection, data: Record<string, unknown>) {
    const player = this.players.get(conn.id);
    if (!player) return;
    this.broadcast({ type: 'chat', playerId: conn.id, playerName: player.name, avatar: player.avatar, text: String(data.text || '').slice(0, 100) });
  }

  private startRound() {
    this.state.phase = 'playing';
    this.state.roundNumber++;
    this.state.board = [];
    this.state.openEnds = [-1, -1];
    this.state.lastAction = 'Round started';
    this.state.readyPlayers = [];

    const tiles = shuffleTiles(createTileSet());
    const n = this.state.playerOrder.length;
    let idx = 0;
    for (const pid of this.state.playerOrder) {
      this.hands.set(pid, tiles.slice(idx, idx + TILES_PER_PLAYER));
      idx += TILES_PER_PLAYER;
    }
    this.boneyard = tiles.slice(idx);

    // First player with highest double, or first player
    let firstPlayer = this.state.playerOrder[0];
    let highestDouble = -1;
    for (const pid of this.state.playerOrder) {
      const hand = this.hands.get(pid) || [];
      for (const t of hand) {
        if (t.isDouble && t.high > highestDouble) { highestDouble = t.high; firstPlayer = pid; }
      }
    }
    this.state.activePlayerId = firstPlayer;
    this.startTurnTimer();
    this.broadcastState();
  }

  private advanceTurn() {
    this.clearTurnTimer();
    const idx = this.state.playerOrder.indexOf(this.state.activePlayerId!);
    let nextIdx = (idx + 1) % this.state.playerOrder.length;
    let checked = 0;

    // Check if game is blocked
    while (checked < this.state.playerOrder.length) {
      const pid = this.state.playerOrder[nextIdx];
      const hand = this.hands.get(pid) || [];
      const canPlay = this.state.board.length === 0 || hand.some(t =>
        t.high === this.state.openEnds[0] || t.low === this.state.openEnds[0] ||
        t.high === this.state.openEnds[1] || t.low === this.state.openEnds[1]
      );
      if (canPlay || this.boneyard.length > 0) {
        this.state.activePlayerId = pid;
        this.startTurnTimer();
        this.broadcastState();
        return;
      }
      nextIdx = (nextIdx + 1) % this.state.playerOrder.length;
      checked++;
    }

    // Game is blocked — nobody can play
    this.endRoundBlocked();
  }

  private endRound(winnerId: string) {
    this.clearTurnTimer();
    this.state.phase = 'round_end';
    let points = 0;
    for (const pid of this.state.playerOrder) {
      if (pid === winnerId) continue;
      const hand = this.hands.get(pid) || [];
      points += hand.reduce((sum, t) => sum + t.totalPips, 0);
    }
    this.state.scores[winnerId] = (this.state.scores[winnerId] || 0) + points;
    const winner = this.players.get(winnerId);
    this.state.lastAction = `${winner?.name} won the round! (+${points} pts)`;
    this.broadcast({ type: 'round_over', winnerId, winnerName: winner?.name || '', points, allScores: { ...this.state.scores } });
    this.broadcastState();

    if ((this.state.scores[winnerId] || 0) >= this.state.targetScore) {
      this.state.phase = 'game_end';
      this.state.winnerId = winnerId;
      this.broadcast({ type: 'game_over', winnerId, winnerName: winner?.name || '', finalScores: { ...this.state.scores } });
      this.broadcastState();
      const t = setTimeout(() => {
        this.state.phase = 'waiting';
        this.state.readyPlayers = [];
        for (const pid of this.state.playerOrder) this.state.scores[pid] = 0;
        this.state.winnerId = null;
        this.state.roundNumber = 0;
        this.broadcastState();
      }, 8000);
      this.timers.push(t);
    } else {
      const t = setTimeout(() => {
        if (this.players.size >= 2) {
          this.state.readyPlayers = [];
          this.state.phase = 'waiting';
          this.broadcastState();
          // Auto-start next round
          this.startRound();
        }
      }, RESULT_DURATION * 1000);
      this.timers.push(t);
    }
  }

  private endRoundBlocked() {
    this.clearTurnTimer();
    this.state.phase = 'round_end';
    let lowestPips = Infinity;
    let winnerId = this.state.playerOrder[0];
    for (const pid of this.state.playerOrder) {
      const hand = this.hands.get(pid) || [];
      const pips = hand.reduce((sum, t) => sum + t.totalPips, 0);
      if (pips < lowestPips) { lowestPips = pips; winnerId = pid; }
    }
    let points = 0;
    for (const pid of this.state.playerOrder) {
      if (pid === winnerId) continue;
      points += (this.hands.get(pid) || []).reduce((sum, t) => sum + t.totalPips, 0);
    }
    points -= lowestPips;
    if (points < 0) points = 0;
    this.state.scores[winnerId] = (this.state.scores[winnerId] || 0) + points;
    const winner = this.players.get(winnerId);
    this.state.lastAction = `Blocked! ${winner?.name} wins (+${points} pts)`;
    this.broadcast({ type: 'round_over', winnerId, winnerName: winner?.name || '', points, allScores: { ...this.state.scores } });
    this.broadcastState();

    const t = setTimeout(() => {
      if (this.players.size >= 2) this.startRound();
      else { this.state.phase = 'waiting'; this.broadcastState(); }
    }, RESULT_DURATION * 1000);
    this.timers.push(t);
  }

  private startTurnTimer() {
    let remaining = TURN_DURATION;
    this.state.turnTimeLeft = remaining;
    this.turnTimer = setInterval(() => {
      remaining--;
      this.state.turnTimeLeft = Math.max(0, remaining);
      this.broadcast({ type: 'turn_tick', remaining });
      if (remaining <= 0) {
        this.clearTurnTimer();
        // Auto: try to draw, then pass
        const pid = this.state.activePlayerId!;
        const hand = this.hands.get(pid) || [];
        const canPlayAny = this.state.board.length === 0 || hand.some(t =>
          t.high === this.state.openEnds[0] || t.low === this.state.openEnds[0] ||
          t.high === this.state.openEnds[1] || t.low === this.state.openEnds[1]
        );
        if (!canPlayAny && this.boneyard.length > 0) {
          const tile = this.boneyard.pop()!;
          hand.push(tile);
          this.hands.set(pid, hand);
          this.broadcast({ type: 'tile_drawn', playerId: pid, playerName: this.players.get(pid)?.name || '' });
        }
        this.advanceTurn();
      }
    }, 1000);
  }

  private getPlayerList() {
    return this.state.playerOrder.map(pid => {
      const p = this.players.get(pid);
      return { id: pid, name: p?.name || 'Anon', avatar: p?.avatar || '🎮', tileCount: (this.hands.get(pid) || []).length, score: this.state.scores[pid] || 0 };
    });
  }

  private sanitizeState(forPlayerId: string) {
    return {
      ...this.state,
      myHand: this.hands.get(forPlayerId) || [],
      boneyardCount: this.boneyard.length,
      players: this.getPlayerList(),
    };
  }

  private sendState(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: 'state', state: this.sanitizeState(conn.id) }));
  }

  private broadcast(data: Record<string, unknown>) {
    if (data.type === 'state') {
      // Per-player sanitized state
      for (const conn of this.room.getConnections()) {
        conn.send(JSON.stringify({ type: 'state', state: this.sanitizeState(conn.id) }));
      }
      return;
    }
    const msg = JSON.stringify(data);
    for (const conn of this.room.getConnections()) conn.send(msg);
  }

  private broadcastState() {
    this.broadcast({ type: 'state' });
  }

  private broadcastPlayers() {
    const msg = JSON.stringify({ type: 'players', players: this.getPlayerList() });
    for (const conn of this.room.getConnections()) conn.send(msg);
  }

  private clearTurnTimer() {
    if (this.turnTimer) { clearInterval(this.turnTimer); this.turnTimer = null; }
  }

  private stopAllTimers() {
    this.clearTurnTimer();
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }
}
