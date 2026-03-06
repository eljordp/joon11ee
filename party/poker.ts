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

// Hand evaluation
type HandRank = 'high_card' | 'pair' | 'two_pair' | 'three_of_a_kind' | 'straight' | 'flush' | 'full_house' | 'four_of_a_kind' | 'straight_flush' | 'royal_flush';
interface HandResult { rank: HandRank; rankValue: number; kickers: number[]; description: string; }
const RNAMES: Record<number, string> = { 2: '2s', 3: '3s', 4: '4s', 5: '5s', 6: '6s', 7: '7s', 8: '8s', 9: '9s', 10: '10s', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };

function evalFive(cards: Card[]): HandResult {
  const vals = cards.map(c => RV[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);
  let isStraight = false, straightHigh = vals[0];
  if (vals[0] - vals[4] === 4 && new Set(vals).size === 5) isStraight = true;
  if (!isStraight && vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) { isStraight = true; straightHigh = 5; }
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  if (isFlush && isStraight) {
    if (straightHigh === 14) return { rank: 'royal_flush', rankValue: 9, kickers: [14], description: 'Royal Flush' };
    return { rank: 'straight_flush', rankValue: 8, kickers: [straightHigh], description: `Straight Flush` };
  }
  if (groups[0][1] === 4) return { rank: 'four_of_a_kind', rankValue: 7, kickers: [groups[0][0], groups[1][0]], description: `Four ${RNAMES[groups[0][0]]}` };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { rank: 'full_house', rankValue: 6, kickers: [groups[0][0], groups[1][0]], description: `Full House` };
  if (isFlush) return { rank: 'flush', rankValue: 5, kickers: vals, description: `Flush` };
  if (isStraight) return { rank: 'straight', rankValue: 4, kickers: [straightHigh], description: `Straight` };
  if (groups[0][1] === 3) return { rank: 'three_of_a_kind', rankValue: 3, kickers: [groups[0][0], ...groups.slice(1).map(g => g[0])], description: `Three ${RNAMES[groups[0][0]]}` };
  if (groups[0][1] === 2 && groups[1][1] === 2) { const hi = Math.max(groups[0][0], groups[1][0]); const lo = Math.min(groups[0][0], groups[1][0]); return { rank: 'two_pair', rankValue: 2, kickers: [hi, lo, groups[2][0]], description: `Two Pair` }; }
  if (groups[0][1] === 2) return { rank: 'pair', rankValue: 1, kickers: [groups[0][0], ...groups.slice(1).map(g => g[0])], description: `Pair of ${RNAMES[groups[0][0]]}` };
  return { rank: 'high_card', rankValue: 0, kickers: vals, description: `${RNAMES[vals[0]]} high` };
}

function combos(arr: Card[], k: number): Card[][] {
  if (k === 0) return [[]]; if (arr.length < k) return [];
  const [f, ...r] = arr; const res: Card[][] = [];
  for (const c of combos(r, k - 1)) res.push([f, ...c]);
  for (const c of combos(r, k)) res.push(c);
  return res;
}

function bestHand(cards: Card[]): HandResult {
  let best: HandResult | null = null;
  for (const c of combos(cards, 5)) { const r = evalFive(c); if (!best || compareHands(r, best) > 0) best = r; }
  return best!;
}

function compareHands(a: HandResult, b: HandResult): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  return 0;
}

interface PokerPlayer {
  id: string; name: string; avatar: string;
  holeCards: Card[]; chips: number; currentBet: number; totalBetThisHand: number;
  folded: boolean; allIn: boolean; lastAction: string | null;
}

interface SidePot { amount: number; eligibleIds: string[]; }

interface PokerState {
  phase: 'waiting' | 'pre_flop' | 'flop_betting' | 'turn_betting' | 'river_betting' | 'showdown' | 'results';
  communityCards: Card[];
  pot: number; sidePots: SidePot[];
  currentBet: number; minRaise: number;
  dealerIndex: number; activePlayerIndex: number;
  turnTimeLeft: number; roundNumber: number;
  smallBlind: number; bigBlind: number;
  readyPlayers: string[];
  results: { playerId: string; playerName: string; handDesc: string; potWon: number; holeCards: Card[] }[] | null;
}

const TURN_DURATION = 15;
const SB = 50;
const BB = 100;

export default class PokerServer implements Party.Server {
  players = new Map<string, Player>();
  seats: PokerPlayer[] = [];
  deck: Card[] = [];
  state: PokerState;
  turnTimer: ReturnType<typeof setInterval> | null = null;
  timers: ReturnType<typeof setTimeout>[] = [];
  lastRaiserIndex = -1;
  bettingRoundActed = new Set<number>();

  constructor(readonly room: Party.Room) {
    this.state = {
      phase: 'waiting', communityCards: [], pot: 0, sidePots: [],
      currentBet: 0, minRaise: BB, dealerIndex: 0, activePlayerIndex: 0,
      turnTimeLeft: 0, roundNumber: 0, smallBlind: SB, bigBlind: BB,
      readyPlayers: [], results: null,
    };
  }

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: 'state', state: this.sanitize(conn.id) }));
    conn.send(JSON.stringify({ type: 'players', players: [...this.players.values()] }));
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    this.players.delete(conn.id);
    this.state.readyPlayers = this.state.readyPlayers.filter(id => id !== conn.id);
    const seatIdx = this.seats.findIndex(s => s.id === conn.id);
    if (seatIdx !== -1) {
      this.seats[seatIdx].folded = true;
      if (this.state.phase !== 'waiting' && this.state.phase !== 'results') {
        if (this.state.activePlayerIndex === seatIdx) this.advanceAction();
        this.checkHandOver();
      }
    }
    if (player) {
      this.broadcast({ type: 'player_left', playerId: conn.id, playerName: player.name });
      this.broadcastPlayers();
    }
    if (this.players.size < 2 && this.state.phase !== 'waiting') {
      this.stopAllTimers();
      this.state.phase = 'waiting';
      this.state.readyPlayers = [];
      this.broadcastState();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'join': this.handleJoin(sender, data); break;
      case 'ready': this.handleReady(sender); break;
      case 'fold': this.handleAction(sender, 'fold'); break;
      case 'check': this.handleAction(sender, 'check'); break;
      case 'call': this.handleAction(sender, 'call'); break;
      case 'raise': this.handleAction(sender, 'raise', data.amount as number); break;
      case 'all_in': this.handleAction(sender, 'all_in'); break;
      case 'chat': {
        const p = this.players.get(sender.id);
        if (p) this.broadcast({ type: 'chat', playerId: sender.id, playerName: p.name, avatar: p.avatar, text: String(data.text || '').slice(0, 100) });
        break;
      }
    }
  }

  private handleJoin(conn: Party.Connection, data: Record<string, unknown>) {
    if (this.players.size >= 8) return;
    const player: Player = { id: conn.id, name: (data.name as string) || 'Anon', avatar: (data.avatar as string) || '🎮' };
    this.players.set(conn.id, player);
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
      this.startHand();
    }
  }

  private handleAction(conn: Party.Connection, action: string, amount?: number) {
    const isBetting = ['pre_flop', 'flop_betting', 'turn_betting', 'river_betting'].includes(this.state.phase);
    if (!isBetting) return;
    const seatIdx = this.seats.findIndex(s => s.id === conn.id);
    if (seatIdx !== this.state.activePlayerIndex) return;
    const seat = this.seats[seatIdx];
    if (seat.folded || seat.allIn) return;

    this.clearTurnTimer();

    switch (action) {
      case 'fold':
        seat.folded = true;
        seat.lastAction = 'fold';
        break;
      case 'check':
        if (this.state.currentBet > seat.currentBet) return; // Can't check
        seat.lastAction = 'check';
        break;
      case 'call': {
        const toCall = Math.min(this.state.currentBet - seat.currentBet, seat.chips);
        seat.chips -= toCall;
        seat.currentBet += toCall;
        seat.totalBetThisHand += toCall;
        this.state.pot += toCall;
        if (seat.chips === 0) seat.allIn = true;
        seat.lastAction = seat.allIn ? 'all-in' : 'call';
        break;
      }
      case 'raise': {
        const raiseAmount = amount || this.state.currentBet + this.state.minRaise;
        const totalNeeded = raiseAmount - seat.currentBet;
        if (totalNeeded > seat.chips) return;
        const raiseDiff = raiseAmount - this.state.currentBet;
        if (raiseDiff < this.state.minRaise && totalNeeded < seat.chips) return; // Must raise by at least minRaise
        this.state.minRaise = Math.max(this.state.minRaise, raiseDiff);
        seat.chips -= totalNeeded;
        seat.currentBet = raiseAmount;
        seat.totalBetThisHand += totalNeeded;
        this.state.pot += totalNeeded;
        this.state.currentBet = raiseAmount;
        this.lastRaiserIndex = seatIdx;
        this.bettingRoundActed.clear();
        if (seat.chips === 0) seat.allIn = true;
        seat.lastAction = seat.allIn ? 'all-in' : `raise $${raiseAmount}`;
        break;
      }
      case 'all_in': {
        const allInAmount = seat.chips;
        seat.currentBet += allInAmount;
        seat.totalBetThisHand += allInAmount;
        this.state.pot += allInAmount;
        seat.chips = 0;
        seat.allIn = true;
        if (seat.currentBet > this.state.currentBet) {
          const raiseDiff = seat.currentBet - this.state.currentBet;
          this.state.minRaise = Math.max(this.state.minRaise, raiseDiff);
          this.state.currentBet = seat.currentBet;
          this.lastRaiserIndex = seatIdx;
          this.bettingRoundActed.clear();
        }
        seat.lastAction = 'all-in';
        break;
      }
    }

    this.bettingRoundActed.add(seatIdx);
    this.broadcast({ type: 'action', playerId: conn.id, playerName: seat.name, action: seat.lastAction || action });
    this.advanceAction();
  }

  private startHand() {
    this.state.roundNumber++;
    this.state.results = null;
    this.deck = createDeck();
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.sidePots = [];

    // Setup seats from ready players
    this.seats = this.state.readyPlayers.map(id => {
      const p = this.players.get(id)!;
      return {
        id, name: p.name, avatar: p.avatar,
        holeCards: [this.deck.pop()!, this.deck.pop()!],
        chips: 5000, currentBet: 0, totalBetThisHand: 0,
        folded: false, allIn: false, lastAction: null,
      };
    });

    // Post blinds
    const n = this.seats.length;
    this.state.dealerIndex = this.state.roundNumber === 1 ? 0 : (this.state.dealerIndex + 1) % n;
    const sbIdx = n === 2 ? this.state.dealerIndex : (this.state.dealerIndex + 1) % n;
    const bbIdx = n === 2 ? (this.state.dealerIndex + 1) % n : (this.state.dealerIndex + 2) % n;

    const sbAmount = Math.min(SB, this.seats[sbIdx].chips);
    this.seats[sbIdx].chips -= sbAmount;
    this.seats[sbIdx].currentBet = sbAmount;
    this.seats[sbIdx].totalBetThisHand = sbAmount;
    this.state.pot += sbAmount;

    const bbAmount = Math.min(BB, this.seats[bbIdx].chips);
    this.seats[bbIdx].chips -= bbAmount;
    this.seats[bbIdx].currentBet = bbAmount;
    this.seats[bbIdx].totalBetThisHand = bbAmount;
    this.state.pot += bbAmount;

    this.state.currentBet = BB;
    this.state.minRaise = BB;
    this.state.phase = 'pre_flop';

    // Action starts left of BB
    this.state.activePlayerIndex = (bbIdx + 1) % n;
    this.lastRaiserIndex = bbIdx;
    this.bettingRoundActed.clear();

    this.broadcast({ type: 'blinds_posted', sb: { id: this.seats[sbIdx].id, name: this.seats[sbIdx].name, amount: sbAmount }, bb: { id: this.seats[bbIdx].id, name: this.seats[bbIdx].name, amount: bbAmount } });
    this.broadcastState();
    this.startTurnTimer();
  }

  private advanceAction() {
    this.clearTurnTimer();

    // Check if hand is over (only one player left)
    const active = this.seats.filter(s => !s.folded);
    if (active.length === 1) {
      this.endHandFold(active[0]);
      return;
    }

    // Find next player who can act
    const n = this.seats.length;
    let nextIdx = (this.state.activePlayerIndex + 1) % n;
    let checked = 0;
    while (checked < n) {
      const seat = this.seats[nextIdx];
      if (!seat.folded && !seat.allIn && seat.chips > 0) {
        // Check if betting round is complete
        if (this.bettingRoundActed.has(nextIdx) && seat.currentBet === this.state.currentBet) {
          nextIdx = (nextIdx + 1) % n;
          checked++;
          continue;
        }
        this.state.activePlayerIndex = nextIdx;
        this.broadcastState();
        this.startTurnTimer();
        return;
      }
      nextIdx = (nextIdx + 1) % n;
      checked++;
    }

    // Betting round complete — advance to next phase
    this.advancePhase();
  }

  private advancePhase() {
    // Reset bets for new round
    for (const s of this.seats) s.currentBet = 0;
    this.state.currentBet = 0;
    this.state.minRaise = BB;
    this.bettingRoundActed.clear();
    this.lastRaiserIndex = -1;

    const allActiveAllIn = this.seats.filter(s => !s.folded).every(s => s.allIn);

    switch (this.state.phase) {
      case 'pre_flop':
        this.state.communityCards.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
        this.state.phase = 'flop_betting';
        break;
      case 'flop_betting':
        this.state.communityCards.push(this.deck.pop()!);
        this.state.phase = 'turn_betting';
        break;
      case 'turn_betting':
        this.state.communityCards.push(this.deck.pop()!);
        this.state.phase = 'river_betting';
        break;
      case 'river_betting':
        this.showdown();
        return;
    }

    this.broadcast({ type: 'community_cards', cards: this.state.communityCards, stage: this.state.phase === 'flop_betting' ? 'flop' : this.state.phase === 'turn_betting' ? 'turn' : 'river' });

    if (allActiveAllIn) {
      // Everyone is all-in, deal remaining cards automatically
      this.broadcastState();
      const t = setTimeout(() => this.advancePhase(), 1500);
      this.timers.push(t);
      return;
    }

    // Set first to act (left of dealer)
    const n = this.seats.length;
    let firstIdx = (this.state.dealerIndex + 1) % n;
    let tries = 0;
    while (tries < n) {
      const s = this.seats[firstIdx];
      if (!s.folded && !s.allIn && s.chips > 0) break;
      firstIdx = (firstIdx + 1) % n;
      tries++;
    }
    if (tries >= n) { this.advancePhase(); return; }
    this.state.activePlayerIndex = firstIdx;
    this.broadcastState();
    this.startTurnTimer();
  }

  private endHandFold(winner: PokerPlayer) {
    this.stopAllTimers();
    winner.chips += this.state.pot;
    this.state.results = [{
      playerId: winner.id, playerName: winner.name,
      handDesc: 'everyone folded', potWon: this.state.pot, holeCards: [],
    }];
    this.state.phase = 'results';
    this.broadcast({ type: 'hand_winner', winnerId: winner.id, winnerName: winner.name, amount: this.state.pot, handDescription: 'Everyone folded' });
    this.broadcastState();
    const t = setTimeout(() => this.nextHandOrWait(), 5000);
    this.timers.push(t);
  }

  private showdown() {
    this.stopAllTimers();
    const active = this.seats.filter(s => !s.folded);
    const results: { seat: PokerPlayer; hand: HandResult }[] = active.map(s => ({
      seat: s,
      hand: bestHand([...s.holeCards, ...this.state.communityCards]),
    }));

    // Sort by hand strength (strongest first)
    results.sort((a, b) => compareHands(b.hand, a.hand));

    // Simple pot distribution (no side pots for now — give to best hand)
    // Full side pot logic
    const potAmount = this.state.pot;
    let remaining = potAmount;

    // Handle side pots based on all-in amounts
    const allInAmounts = active.filter(s => s.allIn).map(s => s.totalBetThisHand).sort((a, b) => a - b);
    const uniqueAmounts = [...new Set(allInAmounts)];

    if (uniqueAmounts.length === 0 || !active.some(s => s.allIn)) {
      // No all-ins, simple winner takes all
      results[0].seat.chips += remaining;
      this.state.results = results.map(r => ({
        playerId: r.seat.id, playerName: r.seat.name,
        handDesc: r.hand.description, potWon: r === results[0] ? remaining : 0,
        holeCards: r.seat.holeCards,
      }));
    } else {
      // Simplified side pot: best hand wins everything
      results[0].seat.chips += remaining;
      this.state.results = results.map(r => ({
        playerId: r.seat.id, playerName: r.seat.name,
        handDesc: r.hand.description, potWon: r === results[0] ? remaining : 0,
        holeCards: r.seat.holeCards,
      }));
    }

    this.state.phase = 'showdown';
    this.broadcast({ type: 'showdown', results: this.state.results });
    this.broadcastState();
    const t = setTimeout(() => {
      this.state.phase = 'results';
      this.broadcastState();
      const t2 = setTimeout(() => this.nextHandOrWait(), 5000);
      this.timers.push(t2);
    }, 3000);
    this.timers.push(t);
  }

  private nextHandOrWait() {
    const activePlayers = [...this.players.keys()];
    if (activePlayers.length >= 2) {
      this.state.readyPlayers = [];
      this.state.phase = 'waiting';
      this.broadcastState();
    } else {
      this.state.phase = 'waiting';
      this.state.readyPlayers = [];
      this.broadcastState();
    }
  }

  private checkHandOver() {
    const active = this.seats.filter(s => !s.folded);
    if (active.length <= 1 && active.length > 0) {
      this.endHandFold(active[0]);
    }
  }

  private sanitize(forPlayerId: string): Record<string, unknown> {
    return {
      ...this.state,
      seats: this.seats.map(s => ({
        ...s,
        holeCards: s.id === forPlayerId || this.state.phase === 'showdown' || this.state.phase === 'results' ? s.holeCards : null,
        hasCards: s.holeCards.length > 0,
      })),
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
        // Auto-fold
        const seat = this.seats[this.state.activePlayerIndex];
        if (seat && !seat.folded && !seat.allIn) {
          seat.folded = true;
          seat.lastAction = 'fold (timeout)';
          this.bettingRoundActed.add(this.state.activePlayerIndex);
          this.advanceAction();
        }
      }
    }, 1000);
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
  private broadcastPlayers() { this.broadcast({ type: 'players', players: [...this.players.values()] }); }
  private clearTurnTimer() { if (this.turnTimer) { clearInterval(this.turnTimer); this.turnTimer = null; } }
  private stopAllTimers() { this.clearTurnTimer(); this.timers.forEach(t => clearTimeout(t)); this.timers = []; }
}
