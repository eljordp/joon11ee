import type * as Party from "partykit/server";

// === Card / Hand helpers (embedded mini BJ engine) ===
interface Card { suit: string; rank: string; value: number; }

function createDeck(): Card[] {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = [
    { rank: '2', value: 2 }, { rank: '3', value: 3 }, { rank: '4', value: 4 },
    { rank: '5', value: 5 }, { rank: '6', value: 6 }, { rank: '7', value: 7 },
    { rank: '8', value: 8 }, { rank: '9', value: 9 }, { rank: '10', value: 10 },
    { rank: 'J', value: 10 }, { rank: 'Q', value: 10 }, { rank: 'K', value: 10 },
    { rank: 'A', value: 11 },
  ];
  const deck: Card[] = [];
  for (const suit of suits) for (const r of ranks) deck.push({ suit, rank: r.rank, value: r.value });
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handValue(hand: Card[]): number {
  let total = hand.reduce((s, c) => s + c.value, 0);
  let aces = hand.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

// === Types ===
interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface MatchResult {
  player1: string;
  player2: string;
  winner: string;
  p1Wins: number;
  p2Wins: number;
}

interface TournamentState {
  phase: 'lobby' | 'round_1' | 'round_2' | 'finals' | 'complete';
  players: Player[];
  bracket: {
    round1: [MatchResult | null, MatchResult | null];
    finals: MatchResult | null;
  };
  currentMatch: {
    player1: string;
    player2: string;
    p1Hand: Card[];
    p2Hand: Card[];
    dealerHand: Card[];
    p1Value: number;
    p2Value: number;
    dealerValue: number;
    p1Done: boolean;
    p2Done: boolean;
    handNumber: number;
    p1Wins: number;
    p2Wins: number;
    matchPhase: 'dealing' | 'player_turns' | 'dealer' | 'result';
  } | null;
  winner: string | null;
  prizePool: number;
  hostId: string | null;
}

// === Constants ===
const BEST_OF = 3;
const DEAL_DELAY = 1000;
const RESULT_DELAY = 2500;
const TURN_TIMEOUT = 10000;

export default class TournamentServer implements Party.Server {
  players = new Map<string, Player>();
  state: TournamentState;
  deck: Card[] = [];
  timers: ReturnType<typeof setTimeout>[] = [];
  turnTimer: ReturnType<typeof setTimeout> | null = null;
  roomPassword: string | null = null;

  constructor(readonly room: Party.Room) {
    this.state = {
      phase: 'lobby',
      players: [],
      bracket: { round1: [null, null], finals: null },
      currentMatch: null,
      winner: null,
      prizePool: 0,
      hostId: null,
    };
  }

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: 'state', state: this.sanitizeState(conn.id) }));
    conn.send(JSON.stringify({ type: 'players', players: this.state.players }));
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    this.players.delete(conn.id);

    if (this.state.phase === 'lobby') {
      this.state.players = this.state.players.filter(p => p.id !== conn.id);
      this.broadcastPlayers();
    }

    if (player) {
      this.broadcast({ type: 'player_left', playerId: conn.id, playerName: player.name });
    }

    // Transfer host
    if (this.state.hostId === conn.id) {
      const next = [...this.players.keys()][0] || null;
      this.state.hostId = next;
      this.broadcastState();
    }

    if (this.players.size === 0) {
      this.stopAllTimers();
      this.resetState();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'join': this.handleJoin(sender, data); break;
      case 'start': this.handleStart(sender); break;
      case 'hit': this.handleHit(sender); break;
      case 'stand': this.handleStand(sender); break;
      case 'chat': this.handleChat(sender, data); break;
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
    if (!this.state.hostId && data.password) this.roomPassword = String(data.password);
    if (this.roomPassword && conn.id !== this.state.hostId) {
      if (String(data.password || "") !== this.roomPassword) {
        conn.send(JSON.stringify({ type: "auth_error", message: "Wrong password" }));
        return;
      }
    }

    const player: Player = {
      id: conn.id,
      name: (data.name as string) || 'Anon',
      avatar: (data.avatar as string) || '🏆',
    };
    this.players.set(conn.id, player);

    if (!this.state.hostId) this.state.hostId = conn.id;

    if (this.state.phase === 'lobby' && this.state.players.length < 4) {
      if (!this.state.players.find(p => p.id === conn.id)) {
        this.state.players.push(player);
      }
    }

    this.broadcast({ type: 'player_joined', player });
    this.broadcastPlayers();
    this.broadcastState();
  }

  private handleStart(conn: Party.Connection) {
    if (conn.id !== this.state.hostId) return;
    if (this.state.phase !== 'lobby') return;
    if (this.state.players.length < 4) return;

    // Calculate prize pool: $5K per player entry
    this.state.prizePool = 20000;

    // Shuffle players for bracket
    const shuffled = [...this.state.players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.state.players = shuffled;

    this.state.phase = 'round_1';
    this.broadcastSystemChat('Tournament started! Round 1 — Best of 3 hands.');
    this.broadcastState();

    // Start first match: player 0 vs player 1
    const t = setTimeout(() => this.startMatch(0, 1, 'round_1', 0), DEAL_DELAY);
    this.timers.push(t);
  }

  private startMatch(p1Idx: number, p2Idx: number, round: string, matchIdx: number) {
    const p1 = this.state.players[p1Idx];
    const p2 = this.state.players[p2Idx];

    this.state.currentMatch = {
      player1: p1.id,
      player2: p2.id,
      p1Hand: [],
      p2Hand: [],
      dealerHand: [],
      p1Value: 0,
      p2Value: 0,
      dealerValue: 0,
      p1Done: false,
      p2Done: false,
      handNumber: 1,
      p1Wins: 0,
      p2Wins: 0,
      matchPhase: 'dealing',
    };

    this.broadcastSystemChat(`Match: ${p1.name} vs ${p2.name} — Hand 1`);
    this.broadcastState();

    const t = setTimeout(() => this.dealHand(), DEAL_DELAY);
    this.timers.push(t);
  }

  private dealHand() {
    const match = this.state.currentMatch;
    if (!match) return;

    this.deck = createDeck();
    match.p1Hand = [this.deck.pop()!, this.deck.pop()!];
    match.p2Hand = [this.deck.pop()!, this.deck.pop()!];
    match.dealerHand = [this.deck.pop()!, this.deck.pop()!];
    match.p1Value = handValue(match.p1Hand);
    match.p2Value = handValue(match.p2Hand);
    match.dealerValue = handValue(match.dealerHand);
    match.p1Done = false;
    match.p2Done = false;
    match.matchPhase = 'player_turns';

    // Auto-stand on blackjack
    if (match.p1Value === 21) match.p1Done = true;
    if (match.p2Value === 21) match.p2Done = true;

    this.broadcastState();

    if (match.p1Done && match.p2Done) {
      const t = setTimeout(() => this.startDealer(), DEAL_DELAY);
      this.timers.push(t);
    } else {
      // Set turn timer
      this.setTurnTimer();
    }
  }

  private handleHit(conn: Party.Connection) {
    const match = this.state.currentMatch;
    if (!match || match.matchPhase !== 'player_turns') return;

    if (conn.id === match.player1 && !match.p1Done) {
      match.p1Hand.push(this.deck.pop()!);
      match.p1Value = handValue(match.p1Hand);
      if (match.p1Value >= 21) match.p1Done = true;
    } else if (conn.id === match.player2 && !match.p2Done) {
      match.p2Hand.push(this.deck.pop()!);
      match.p2Value = handValue(match.p2Hand);
      if (match.p2Value >= 21) match.p2Done = true;
    } else {
      return;
    }

    this.broadcastState();
    this.clearTurnTimer();

    if (match.p1Done && match.p2Done) {
      const t = setTimeout(() => this.startDealer(), DEAL_DELAY);
      this.timers.push(t);
    } else {
      this.setTurnTimer();
    }
  }

  private handleStand(conn: Party.Connection) {
    const match = this.state.currentMatch;
    if (!match || match.matchPhase !== 'player_turns') return;

    if (conn.id === match.player1 && !match.p1Done) match.p1Done = true;
    else if (conn.id === match.player2 && !match.p2Done) match.p2Done = true;
    else return;

    this.broadcastState();
    this.clearTurnTimer();

    if (match.p1Done && match.p2Done) {
      const t = setTimeout(() => this.startDealer(), DEAL_DELAY);
      this.timers.push(t);
    } else {
      this.setTurnTimer();
    }
  }

  private setTurnTimer() {
    this.clearTurnTimer();
    this.turnTimer = setTimeout(() => {
      const match = this.state.currentMatch;
      if (!match) return;
      if (!match.p1Done) match.p1Done = true;
      if (!match.p2Done) match.p2Done = true;
      this.broadcastState();
      const t = setTimeout(() => this.startDealer(), DEAL_DELAY);
      this.timers.push(t);
    }, TURN_TIMEOUT);
  }

  private clearTurnTimer() {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
  }

  private startDealer() {
    const match = this.state.currentMatch;
    if (!match) return;

    match.matchPhase = 'dealer';

    // Dealer hits until 17+
    while (handValue(match.dealerHand) < 17) {
      match.dealerHand.push(this.deck.pop()!);
    }
    match.dealerValue = handValue(match.dealerHand);

    this.broadcastState();

    const t = setTimeout(() => this.resolveHand(), DEAL_DELAY);
    this.timers.push(t);
  }

  private resolveHand() {
    const match = this.state.currentMatch;
    if (!match) return;

    match.matchPhase = 'result';
    const dVal = match.dealerValue;
    const dealerBust = dVal > 21;

    const score = (pVal: number): number => {
      if (pVal > 21) return -1; // bust
      if (dealerBust) return 1; // dealer bust, player wins
      if (pVal > dVal) return 1;
      if (pVal === dVal) return 0;
      return -1;
    };

    const p1Score = score(match.p1Value);
    const p2Score = score(match.p2Value);

    // Compare: both beat dealer? Compare values. Both lose? Tie. One wins one loses? Winner.
    let handWinner: string | null = null;
    if (p1Score > p2Score) handWinner = match.player1;
    else if (p2Score > p1Score) handWinner = match.player2;
    else {
      // Same result vs dealer — compare values directly
      if (match.p1Value > 21 && match.p2Value > 21) handWinner = null; // both bust = tie
      else if (match.p1Value > match.p2Value && match.p1Value <= 21) handWinner = match.player1;
      else if (match.p2Value > match.p1Value && match.p2Value <= 21) handWinner = match.player2;
      // else tie
    }

    if (handWinner === match.player1) match.p1Wins++;
    else if (handWinner === match.player2) match.p2Wins++;

    const p1Name = this.state.players.find(p => p.id === match.player1)?.name || 'P1';
    const p2Name = this.state.players.find(p => p.id === match.player2)?.name || 'P2';

    if (handWinner) {
      const winnerName = handWinner === match.player1 ? p1Name : p2Name;
      this.broadcastSystemChat(`${winnerName} wins hand ${match.handNumber}! (${match.p1Wins}-${match.p2Wins})`);
    } else {
      this.broadcastSystemChat(`Hand ${match.handNumber} is a tie! (${match.p1Wins}-${match.p2Wins})`);
    }

    this.broadcastState();

    // Check if match is over
    const winsNeeded = Math.ceil(BEST_OF / 2);
    if (match.p1Wins >= winsNeeded || match.p2Wins >= winsNeeded) {
      const matchWinner = match.p1Wins >= winsNeeded ? match.player1 : match.player2;
      const matchWinnerName = matchWinner === match.player1 ? p1Name : p2Name;

      const result: MatchResult = {
        player1: match.player1,
        player2: match.player2,
        winner: matchWinner,
        p1Wins: match.p1Wins,
        p2Wins: match.p2Wins,
      };

      this.broadcastSystemChat(`${matchWinnerName} wins the match ${match.p1Wins}-${match.p2Wins}!`);

      const t = setTimeout(() => this.advanceBracket(result), RESULT_DELAY);
      this.timers.push(t);
    } else {
      // Next hand
      match.handNumber++;
      const t = setTimeout(() => this.dealHand(), RESULT_DELAY);
      this.timers.push(t);
    }
  }

  private advanceBracket(result: MatchResult) {
    if (this.state.phase === 'round_1') {
      if (!this.state.bracket.round1[0]) {
        this.state.bracket.round1[0] = result;
        this.state.currentMatch = null;
        this.broadcastState();
        // Start second match: player 2 vs player 3
        const t = setTimeout(() => this.startMatch(2, 3, 'round_1', 1), DEAL_DELAY);
        this.timers.push(t);
      } else {
        this.state.bracket.round1[1] = result;
        this.state.phase = 'finals';
        this.state.currentMatch = null;
        this.broadcastSystemChat('Finals! The last match.');
        this.broadcastState();
        // Start finals
        const w1 = this.state.bracket.round1[0].winner;
        const w2 = result.winner;
        const w1Idx = this.state.players.findIndex(p => p.id === w1);
        const w2Idx = this.state.players.findIndex(p => p.id === w2);
        const t = setTimeout(() => this.startMatch(w1Idx, w2Idx, 'finals', 0), DEAL_DELAY);
        this.timers.push(t);
      }
    } else if (this.state.phase === 'finals') {
      this.state.bracket.finals = result;
      this.state.phase = 'complete';
      this.state.winner = result.winner;
      this.state.currentMatch = null;

      const winnerName = this.state.players.find(p => p.id === result.winner)?.name || 'Winner';
      this.broadcastSystemChat(`🏆 ${winnerName} wins the tournament and $${this.state.prizePool.toLocaleString()}!`);
      this.broadcast({ type: 'tournament_complete', winner: result.winner, winnerName, prize: this.state.prizePool });
      this.broadcastState();
    }
  }

  private handleChat(conn: Party.Connection, data: Record<string, unknown>) {
    const player = this.players.get(conn.id);
    if (!player) return;
    const text = String(data.text || '').slice(0, 100);
    if (!text) return;
    this.broadcast({ type: 'chat', playerId: conn.id, playerName: player.name, avatar: player.avatar, text });
  }

  private sanitizeState(connId: string): Record<string, unknown> {
    const s = { ...this.state };
    const match = s.currentMatch;
    if (match) {
      // Hide opponent's hand if they're still playing, and hide dealer hole card
      const sanitizedMatch = { ...match };
      if (match.matchPhase === 'player_turns' || match.matchPhase === 'dealing') {
        if (connId !== match.player1) sanitizedMatch.p1Hand = match.p1Hand.map((c, i) => i === 0 ? c : { suit: '?', rank: '?', value: 0 });
        if (connId !== match.player2) sanitizedMatch.p2Hand = match.p2Hand.map((c, i) => i === 0 ? c : { suit: '?', rank: '?', value: 0 });
        sanitizedMatch.dealerHand = match.dealerHand.map((c, i) => i === 0 ? c : { suit: '?', rank: '?', value: 0 });
      }
      return { ...s, currentMatch: sanitizedMatch };
    }
    return s as unknown as Record<string, unknown>;
  }

  private broadcastSystemChat(text: string) {
    this.broadcast({ type: 'chat', chatType: 'system', playerId: 'system', playerName: 'Tournament', avatar: '🏆', text });
  }

  private broadcast(data: Record<string, unknown>) {
    for (const conn of this.room.getConnections()) {
      // Send sanitized state for state broadcasts
      if (data.type === 'state') {
        conn.send(JSON.stringify({ type: 'state', state: this.sanitizeState(conn.id) }));
      } else {
        conn.send(JSON.stringify(data));
      }
    }
  }

  private broadcastState() {
    for (const conn of this.room.getConnections()) {
      conn.send(JSON.stringify({ type: 'state', state: this.sanitizeState(conn.id) }));
    }
  }

  private broadcastPlayers() {
    const msg = JSON.stringify({ type: 'players', players: this.state.players });
    for (const conn of this.room.getConnections()) conn.send(msg);
  }

  private resetState() {
    this.state = {
      phase: 'lobby',
      players: [],
      bracket: { round1: [null, null], finals: null },
      currentMatch: null,
      winner: null,
      prizePool: 0,
      hostId: null,
    };
  }

  private stopAllTimers() {
    this.clearTurnTimer();
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }
}
