import type * as Party from "partykit/server";

interface Card { suit: string; rank: string; value: number; }
interface Player { id: string; name: string; avatar: string; }

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RV: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };

function createDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (let i = 0; i < RANKS.length; i++) d.push({ suit: s, rank: RANKS[i], value: i === 0 ? 11 : Math.min(i + 1, 10) });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

interface TrickCard { playerId: string; playerName: string; card: Card; seatIndex: number; }

interface SpadesState {
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
}

const TURN_DURATION = 15;

export default class SpadesServer implements Party.Server {
  players = new Map<string, Player>();
  spectators = new Set<string>();
  playerOrder: string[] = [];
  hands = new Map<string, Card[]>();
  state: SpadesState;
  turnTimer: ReturnType<typeof setInterval> | null = null;
  timers: ReturnType<typeof setTimeout>[] = [];
  roomPassword: string | null = null;
  hostId: string | null = null;

  constructor(readonly room: Party.Room) {
    this.state = {
      phase: 'waiting', teams: [[], []], teamScores: [0, 0], teamBags: [0, 0],
      currentTrick: [], trickNumber: 0, tricksWon: {}, bids: {},
      dealerIndex: 0, activePlayerIndex: 0, turnTimeLeft: 0,
      roundNumber: 0, spadesBroken: false, leadSuit: null,
      trickWinnerId: null, readyPlayers: [], targetScore: 500,
    };
  }

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: 'state', state: this.sanitize(conn.id) }));
    conn.send(JSON.stringify({ type: 'players', players: this.getPlayerList() }));
    conn.send(JSON.stringify({ type: "spectator_count", count: this.spectators.size }));
  }

  onClose(conn: Party.Connection) {
    if (this.spectators.has(conn.id)) {
      this.spectators.delete(conn.id);
      this.players.delete(conn.id);
      this.broadcast({ type: "spectator_count", count: this.spectators.size });
      return;
    }
    const player = this.players.get(conn.id);
    this.players.delete(conn.id);
    this.playerOrder = this.playerOrder.filter(id => id !== conn.id);
    this.state.readyPlayers = this.state.readyPlayers.filter(id => id !== conn.id);
    if (player) {
      this.broadcast({ type: 'player_left', playerId: conn.id, playerName: player.name });
      this.broadcastPlayers();
    }
    if (this.players.size < 4 && this.state.phase !== 'waiting') {
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
      case 'bid': this.handleBid(sender, data.amount as number); break;
      case 'play_card': this.handlePlayCard(sender, data.suit as string, data.rank as string); break;
      case 'chat': {
        const p = this.players.get(sender.id);
        if (p) this.broadcast({ type: 'chat', playerId: sender.id, playerName: p.name, avatar: p.avatar, text: String(data.text || '').slice(0, 100) });
        break;
      }
      case 'reaction': {
        const p = this.players.get(sender.id);
        if (!p) break;
        const emoji = String(data.emoji || '').slice(0, 4);
        if (emoji) this.broadcast({ type: 'reaction', playerId: sender.id, playerName: p.name, emoji });
        break;
      }
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
    if (!this.playerOrder.includes(conn.id)) this.playerOrder.push(conn.id);
    if (data.spectate) {
      this.spectators.add(conn.id);
      conn.send(JSON.stringify({ type: "joined_as_spectator" }));
      conn.send(JSON.stringify({ type: 'state', state: this.sanitize(conn.id) }));
      this.broadcast({ type: "spectator_count", count: this.spectators.size });
      this.broadcastPlayers();
      return;
    }
    this.broadcast({ type: 'player_joined', player });
    this.broadcastPlayers();
    this.broadcastState();
  }

  private handleReady(conn: Party.Connection) {
    if (this.spectators.has(conn.id)) return;
    if (this.state.phase !== 'waiting') return;
    if (this.state.readyPlayers.includes(conn.id)) {
      this.state.readyPlayers = this.state.readyPlayers.filter(id => id !== conn.id);
    } else {
      this.state.readyPlayers.push(conn.id);
    }
    this.broadcastState();
    if (this.state.readyPlayers.length === 4 && this.players.size === 4) {
      this.startRound();
    }
  }

  private handleBid(conn: Party.Connection, amount: number) {
    if (this.spectators.has(conn.id)) return;
    if (this.state.phase !== 'bidding') return;
    const seatIdx = this.playerOrder.indexOf(conn.id);
    if (seatIdx !== this.state.activePlayerIndex) return;
    if (amount < 0 || amount > 13) return;

    this.clearTurnTimer();
    this.state.bids[conn.id] = amount;
    const player = this.players.get(conn.id);
    this.broadcast({ type: 'bid_placed', playerId: conn.id, playerName: player?.name || '', bid: amount });

    // Check if all have bid
    const allBid = this.playerOrder.every(pid => this.state.bids[pid] !== null && this.state.bids[pid] !== undefined);
    if (allBid) {
      this.startPlaying();
    } else {
      this.advanceBidder();
    }
  }

  private handlePlayCard(conn: Party.Connection, suit: string, rank: string) {
    if (this.spectators.has(conn.id)) return;
    if (this.state.phase !== 'playing') return;
    const seatIdx = this.playerOrder.indexOf(conn.id);
    if (seatIdx !== this.state.activePlayerIndex) return;

    const hand = this.hands.get(conn.id) || [];
    const cardIdx = hand.findIndex(c => c.suit === suit && c.rank === rank);
    if (cardIdx === -1) return;
    const card = hand[cardIdx];

    // Validate: must follow lead suit if possible
    if (this.state.leadSuit && card.suit !== this.state.leadSuit) {
      const hasLeadSuit = hand.some(c => c.suit === this.state.leadSuit);
      if (hasLeadSuit) return; // Must follow suit
    }

    // Can't lead spades unless broken (or only have spades)
    if (this.state.currentTrick.length === 0 && card.suit === '♠' && !this.state.spadesBroken) {
      const hasNonSpade = hand.some(c => c.suit !== '♠');
      if (hasNonSpade) return;
    }

    this.clearTurnTimer();
    hand.splice(cardIdx, 1);
    this.hands.set(conn.id, hand);

    if (this.state.currentTrick.length === 0) this.state.leadSuit = card.suit;
    if (card.suit === '♠' && !this.state.spadesBroken) {
      this.state.spadesBroken = true;
      this.broadcast({ type: 'spades_broken' });
    }

    const player = this.players.get(conn.id);
    this.state.currentTrick.push({ playerId: conn.id, playerName: player?.name || '', card, seatIndex: seatIdx });
    this.broadcast({ type: 'card_played', playerId: conn.id, playerName: player?.name || '', card, seatIndex: seatIdx });

    if (this.state.currentTrick.length === 4) {
      this.resolveTrick();
    } else {
      this.advancePlayer();
    }
  }

  private startRound() {
    this.state.roundNumber++;
    this.state.phase = 'bidding';
    this.state.bids = {};
    this.state.tricksWon = {};
    this.state.trickNumber = 0;
    this.state.spadesBroken = false;
    this.state.currentTrick = [];
    this.state.leadSuit = null;
    this.state.trickWinnerId = null;

    // Assign teams: 0&2 vs 1&3
    this.state.teams = [
      [this.playerOrder[0], this.playerOrder[2]],
      [this.playerOrder[1], this.playerOrder[3]],
    ];

    for (const pid of this.playerOrder) {
      this.state.bids[pid] = null;
      this.state.tricksWon[pid] = 0;
    }

    // Deal
    const deck = createDeck();
    for (let i = 0; i < 4; i++) {
      this.hands.set(this.playerOrder[i], deck.slice(i * 13, (i + 1) * 13));
    }

    this.state.dealerIndex = (this.state.roundNumber - 1) % 4;
    this.state.activePlayerIndex = (this.state.dealerIndex + 1) % 4;
    this.broadcastState();
    this.startTurnTimer();
  }

  private advanceBidder() {
    let nextIdx = (this.state.activePlayerIndex + 1) % 4;
    while (this.state.bids[this.playerOrder[nextIdx]] !== null && this.state.bids[this.playerOrder[nextIdx]] !== undefined) {
      nextIdx = (nextIdx + 1) % 4;
    }
    this.state.activePlayerIndex = nextIdx;
    this.broadcastState();
    this.startTurnTimer();
  }

  private startPlaying() {
    this.state.phase = 'playing';
    this.state.trickNumber = 1;
    // Player left of dealer leads first
    this.state.activePlayerIndex = (this.state.dealerIndex + 1) % 4;
    this.state.currentTrick = [];
    this.state.leadSuit = null;
    this.broadcastState();
    this.startTurnTimer();
  }

  private advancePlayer() {
    this.state.activePlayerIndex = (this.state.activePlayerIndex + 1) % 4;
    this.broadcastState();
    this.startTurnTimer();
  }

  private resolveTrick() {
    this.clearTurnTimer();
    // Find winner: highest spade if any spade played, else highest of lead suit
    let winnerCard = this.state.currentTrick[0];
    for (const tc of this.state.currentTrick.slice(1)) {
      const wIsSpade = winnerCard.card.suit === '♠';
      const cIsSpade = tc.card.suit === '♠';
      if (cIsSpade && !wIsSpade) { winnerCard = tc; continue; }
      if (wIsSpade && !cIsSpade) continue;
      if (tc.card.suit === winnerCard.card.suit && RV[tc.card.rank] > RV[winnerCard.card.rank]) winnerCard = tc;
    }

    this.state.trickWinnerId = winnerCard.playerId;
    this.state.tricksWon[winnerCard.playerId] = (this.state.tricksWon[winnerCard.playerId] || 0) + 1;
    this.state.phase = 'trick_result';

    this.broadcast({ type: 'trick_won', winnerId: winnerCard.playerId, winnerName: winnerCard.playerName, trickNumber: this.state.trickNumber });
    this.broadcastState();

    const t = setTimeout(() => {
      this.state.trickNumber++;
      if (this.state.trickNumber > 13) {
        this.scoreRound();
      } else {
        this.state.phase = 'playing';
        this.state.currentTrick = [];
        this.state.leadSuit = null;
        // Trick winner leads next
        this.state.activePlayerIndex = this.playerOrder.indexOf(winnerCard.playerId);
        this.broadcastState();
        this.startTurnTimer();
      }
    }, 2000);
    this.timers.push(t);
  }

  private scoreRound() {
    this.state.phase = 'round_scoring';

    for (let teamIdx = 0; teamIdx < 2; teamIdx++) {
      const [p1, p2] = this.state.teams[teamIdx];
      const bid1 = this.state.bids[p1] || 0;
      const bid2 = this.state.bids[p2] || 0;
      const tricks1 = this.state.tricksWon[p1] || 0;
      const tricks2 = this.state.tricksWon[p2] || 0;

      // Handle nil bids
      let nilBonus = 0;
      let teamBid = 0;
      let teamTricks = 0;

      if (bid1 === 0) {
        nilBonus += tricks1 === 0 ? 100 : -100;
      } else {
        teamBid += bid1;
        teamTricks += tricks1;
      }

      if (bid2 === 0) {
        nilBonus += tricks2 === 0 ? 100 : -100;
      } else {
        teamBid += bid2;
        teamTricks += tricks2;
      }

      let roundScore = nilBonus;
      if (teamBid > 0) {
        if (teamTricks >= teamBid) {
          roundScore += teamBid * 10;
          const overtricks = teamTricks - teamBid;
          roundScore += overtricks;
          this.state.teamBags[teamIdx] += overtricks;
          if (this.state.teamBags[teamIdx] >= 10) {
            roundScore -= 100;
            this.state.teamBags[teamIdx] -= 10;
          }
        } else {
          roundScore -= teamBid * 10;
        }
      }

      this.state.teamScores[teamIdx] += roundScore;
    }

    this.broadcast({ type: 'round_scores', teamScores: [...this.state.teamScores], teamBags: [...this.state.teamBags] });
    this.broadcastState();

    // Check game end
    const gameOver = this.state.teamScores[0] >= this.state.targetScore || this.state.teamScores[1] >= this.state.targetScore;
    if (gameOver) {
      this.state.phase = 'game_end';
      const winningTeam = this.state.teamScores[0] >= this.state.teamScores[1] ? 0 : 1;
      this.broadcast({ type: 'game_over', winningTeam, finalScores: [...this.state.teamScores] });
      this.broadcastState();
      const t = setTimeout(() => {
        this.state.phase = 'waiting';
        this.state.readyPlayers = [];
        this.state.teamScores = [0, 0];
        this.state.teamBags = [0, 0];
        this.state.roundNumber = 0;
        this.broadcastState();
      }, 8000);
      this.timers.push(t);
    } else {
      const t = setTimeout(() => {
        if (this.players.size === 4) this.startRound();
        else { this.state.phase = 'waiting'; this.state.readyPlayers = []; this.broadcastState(); }
      }, 5000);
      this.timers.push(t);
    }
  }

  private getPlayerList() {
    return this.playerOrder.map((pid, i) => {
      const p = this.players.get(pid);
      return {
        id: pid, name: p?.name || 'Anon', avatar: p?.avatar || '🎮',
        seatIndex: i, teamIndex: i % 2,
        bid: this.state.bids[pid] ?? null, tricksWon: this.state.tricksWon[pid] || 0,
        handCount: (this.hands.get(pid) || []).length,
      };
    });
  }

  private sanitize(forPlayerId: string) {
    return {
      ...this.state,
      myHand: (this.hands.get(forPlayerId) || []).sort((a, b) => {
        const suitOrder = ['♠', '♥', '♦', '♣'];
        const si = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        if (si !== 0) return si;
        return RV[b.rank] - RV[a.rank];
      }),
      players: this.getPlayerList(),
    };
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
        if (this.state.phase === 'bidding') {
          this.handleBid({ id: this.playerOrder[this.state.activePlayerIndex] } as Party.Connection, 1);
        } else if (this.state.phase === 'playing') {
          // Auto-play first valid card
          const pid = this.playerOrder[this.state.activePlayerIndex];
          const hand = this.hands.get(pid) || [];
          const validCard = this.findValidCard(hand);
          if (validCard) {
            this.handlePlayCard({ id: pid } as Party.Connection, validCard.suit, validCard.rank);
          }
        }
      }
    }, 1000);
  }

  private findValidCard(hand: Card[]): Card | null {
    if (this.state.leadSuit) {
      const followSuit = hand.filter(c => c.suit === this.state.leadSuit);
      if (followSuit.length > 0) return followSuit[0];
      return hand[0] || null;
    }
    // Leading — play non-spade if possible and spades not broken
    if (!this.state.spadesBroken) {
      const nonSpade = hand.filter(c => c.suit !== '♠');
      if (nonSpade.length > 0) return nonSpade[0];
    }
    return hand[0] || null;
  }

  private broadcast(data: Record<string, unknown>) {
    if (data.type === 'state') {
      for (const conn of this.room.getConnections()) conn.send(JSON.stringify({ type: 'state', state: this.sanitize(conn.id) }));
      return;
    }
    const msg = JSON.stringify(data);
    for (const conn of this.room.getConnections()) conn.send(msg);
  }

  private broadcastState() { this.broadcast({ type: 'state' }); }
  private broadcastPlayers() { const msg = JSON.stringify({ type: 'players', players: this.getPlayerList() }); for (const conn of this.room.getConnections()) conn.send(msg); }
  private clearTurnTimer() { if (this.turnTimer) { clearInterval(this.turnTimer); this.turnTimer = null; } }
  private stopAllTimers() { this.clearTurnTimer(); this.timers.forEach(t => clearTimeout(t)); this.timers = []; }
}
