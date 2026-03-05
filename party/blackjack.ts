import type * as Party from "partykit/server";

// === Card Logic (self-contained, no external imports) ===
type Card = { suit: string; rank: string; value: number };

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({ suit, rank: RANKS[i], value: i === 0 ? 11 : Math.min(i + 1, 10) });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handValue(hand: Card[]): number {
  let total = hand.reduce((s, c) => s + c.value, 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

// === Types ===
type Phase = "waiting" | "betting" | "dealing" | "player_turns" | "dealer_turn" | "results";
type SeatStatus = "empty" | "waiting" | "betting" | "playing" | "stood" | "busted" | "blackjack" | "done";

interface Player { id: string; name: string; avatar: string; }

interface Seat {
  index: number;
  player: Player | null;
  bet: number;
  hand: Card[];
  handValue: number;
  status: SeatStatus;
  doubled: boolean;
  profit: number;
}

interface GameState {
  phase: Phase;
  seats: Seat[];
  dealerHand: Card[];
  dealerHandValue: number;
  dealerRevealed: boolean;
  activeSeatIndex: number | null;
  turnTimeLeft: number;
  roundNumber: number;
  bettingTimeLeft: number;
}

// === Constants ===
const TOTAL_SEATS = 5;
const BETTING_DURATION = 10;
const HUMAN_TURN_TIMER = 15;
const DEALER_HIT_DELAY = 600;
const RESULTS_DURATION = 5;

export default class BlackjackServer implements Party.Server {
  players = new Map<string, Player>();
  seatMap = new Map<string, number>(); // playerId -> seatIndex
  state: GameState;
  deck: Card[] = [];
  timers: ReturnType<typeof setTimeout>[] = [];
  countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {
    this.state = this.emptyState();
  }

  private emptyState(): GameState {
    return {
      phase: "waiting",
      seats: Array.from({ length: TOTAL_SEATS }, (_, i) => this.emptySeat(i)),
      dealerHand: [],
      dealerHandValue: 0,
      dealerRevealed: false,
      activeSeatIndex: null,
      turnTimeLeft: 0,
      roundNumber: 0,
      bettingTimeLeft: BETTING_DURATION,
    };
  }

  private emptySeat(index: number): Seat {
    return { index, player: null, bet: 0, hand: [], handValue: 0, status: "empty", doubled: false, profit: 0 };
  }

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "state", state: this.sanitizeState(conn.id) }));
    conn.send(JSON.stringify({ type: "players", players: Array.from(this.players.values()) }));
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    if (player) {
      // Clear their seat
      const seatIdx = this.seatMap.get(conn.id);
      if (seatIdx !== undefined) {
        this.state.seats[seatIdx] = this.emptySeat(seatIdx);
        this.seatMap.delete(conn.id);

        // If it was their turn, advance
        if (this.state.activeSeatIndex === seatIdx && this.state.phase === "player_turns") {
          this.advanceToNextTurn();
        }
      }

      this.players.delete(conn.id);
      this.broadcast({ type: "player_left", playerId: conn.id, playerName: player.name });
      this.broadcastPlayers();
      this.broadcastState();
    }

    if (this.players.size === 0) {
      this.stopAllTimers();
      this.state = this.emptyState();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    let data: Record<string, unknown>;
    try { data = JSON.parse(message); } catch { return; }

    switch (data.type) {
      case "join": this.handleJoin(sender, data); break;
      case "take_seat": this.handleTakeSeat(sender, data); break;
      case "bet": this.handleBet(sender, data); break;
      case "hit": this.handleHit(sender); break;
      case "stand": this.handleStand(sender); break;
      case "double": this.handleDouble(sender); break;
      case "chat": this.handleChat(sender, data); break;
    }
  }

  // === Handlers ===

  private handleJoin(conn: Party.Connection, data: Record<string, unknown>) {
    const player: Player = {
      id: conn.id,
      name: (data.name as string) || "Anon",
      avatar: (data.avatar as string) || "🎮",
    };
    this.players.set(conn.id, player);
    this.broadcast({ type: "player_joined", player });
    this.broadcastPlayers();
    conn.send(JSON.stringify({ type: "state", state: this.sanitizeState(conn.id) }));
  }

  private handleTakeSeat(conn: Party.Connection, data: Record<string, unknown>) {
    const player = this.players.get(conn.id);
    if (!player) return;
    if (this.seatMap.has(conn.id)) return; // Already seated

    const seatIdx = Number(data.seatIndex);
    if (seatIdx < 0 || seatIdx >= TOTAL_SEATS) return;
    if (this.state.seats[seatIdx].player !== null) return;

    this.state.seats[seatIdx] = { ...this.emptySeat(seatIdx), player, status: "waiting" };
    this.seatMap.set(conn.id, seatIdx);

    this.broadcast({ type: "seat_taken", seatIndex: seatIdx, player });
    this.broadcastState();

    // Start game if we have seated players and in waiting phase
    if (this.state.phase === "waiting") {
      this.startBetting();
    }
  }

  private handleBet(conn: Party.Connection, data: Record<string, unknown>) {
    if (this.state.phase !== "betting") return;
    const seatIdx = this.seatMap.get(conn.id);
    if (seatIdx === undefined) return;
    const seat = this.state.seats[seatIdx];
    if (!seat.player || seat.status === "betting") return;

    seat.bet = Math.max(10, Math.floor(Number(data.amount) || 100));
    seat.status = "betting";
    this.broadcastState();
  }

  private handleHit(conn: Party.Connection) {
    if (this.state.phase !== "player_turns") return;
    const seatIdx = this.seatMap.get(conn.id);
    if (seatIdx === undefined || this.state.activeSeatIndex !== seatIdx) return;
    const seat = this.state.seats[seatIdx];
    if (seat.status !== "playing") return;

    this.dealToSeat(seatIdx);
    if (seat.handValue > 21) {
      seat.status = "busted";
      this.broadcastState();
      this.advanceToNextTurn();
    } else if (seat.handValue === 21) {
      seat.status = "stood";
      this.broadcastState();
      this.advanceToNextTurn();
    } else {
      this.broadcastState();
    }
  }

  private handleStand(conn: Party.Connection) {
    if (this.state.phase !== "player_turns") return;
    const seatIdx = this.seatMap.get(conn.id);
    if (seatIdx === undefined || this.state.activeSeatIndex !== seatIdx) return;
    const seat = this.state.seats[seatIdx];
    if (seat.status !== "playing") return;

    seat.status = "stood";
    this.broadcastState();
    this.advanceToNextTurn();
  }

  private handleDouble(conn: Party.Connection) {
    if (this.state.phase !== "player_turns") return;
    const seatIdx = this.seatMap.get(conn.id);
    if (seatIdx === undefined || this.state.activeSeatIndex !== seatIdx) return;
    const seat = this.state.seats[seatIdx];
    if (seat.status !== "playing" || seat.hand.length !== 2 || seat.doubled) return;

    seat.doubled = true;
    seat.bet *= 2;
    this.dealToSeat(seatIdx);
    seat.status = seat.handValue > 21 ? "busted" : "stood";
    this.broadcastState();
    this.advanceToNextTurn();
  }

  private handleChat(conn: Party.Connection, data: Record<string, unknown>) {
    const player = this.players.get(conn.id);
    if (!player) return;
    const text = String(data.text || "").slice(0, 100);
    if (!text) return;
    this.broadcast({ type: "chat", playerId: conn.id, playerName: player.name, avatar: player.avatar, text });
  }

  // === Game Loop ===

  private startBetting() {
    this.stopAllTimers();
    this.state.roundNumber++;
    this.state.phase = "betting";
    this.state.bettingTimeLeft = BETTING_DURATION;
    this.state.dealerHand = [];
    this.state.dealerHandValue = 0;
    this.state.dealerRevealed = false;
    this.state.activeSeatIndex = null;

    for (const seat of this.state.seats) {
      if (seat.player) {
        seat.hand = [];
        seat.handValue = 0;
        seat.bet = 0;
        seat.status = "waiting";
        seat.doubled = false;
        seat.profit = 0;
      }
    }

    this.broadcastState();

    let remaining = BETTING_DURATION;
    this.countdownInterval = setInterval(() => {
      remaining--;
      this.state.bettingTimeLeft = Math.max(0, remaining);
      this.broadcast({ type: "countdown", remaining });
      if (remaining <= 0) {
        this.clearCountdown();
        this.startDealing();
      }
    }, 1000);
  }

  private startDealing() {
    // Check if anyone actually bet
    const bettors = this.state.seats.filter((s) => s.player && s.bet > 0);
    if (bettors.length === 0) {
      // No bets, restart betting
      this.startBetting();
      return;
    }

    this.state.phase = "dealing";
    this.deck = createDeck();

    // Deal 2 cards to each bettor
    for (const seat of this.state.seats) {
      if (seat.player && seat.bet > 0) {
        this.dealToSeat(seat.index);
        this.dealToSeat(seat.index);
        if (seat.handValue === 21) seat.status = "blackjack";
      }
    }

    // Dealer gets 2 cards
    this.state.dealerHand = [this.deck.pop()!, this.deck.pop()!];
    this.state.dealerHandValue = handValue(this.state.dealerHand);

    this.broadcastState();

    // Start player turns after brief delay
    const t = setTimeout(() => this.startPlayerTurns(), 1500);
    this.timers.push(t);
  }

  private startPlayerTurns() {
    this.state.phase = "player_turns";
    const first = this.findNextActiveSeat(-1);
    if (first === null) {
      this.startDealerTurn();
      return;
    }
    this.activateSeat(first);
  }

  private activateSeat(seatIdx: number) {
    const seat = this.state.seats[seatIdx];
    if (!seat.player || seat.bet === 0 || seat.status === "blackjack") {
      this.advanceToNextTurn();
      return;
    }

    seat.status = "playing";
    this.state.activeSeatIndex = seatIdx;
    this.state.turnTimeLeft = HUMAN_TURN_TIMER;
    this.broadcastState();

    // Turn countdown
    this.countdownInterval = setInterval(() => {
      this.state.turnTimeLeft--;
      this.broadcast({ type: "turn_tick", remaining: this.state.turnTimeLeft });
      if (this.state.turnTimeLeft <= 0) {
        this.clearCountdown();
        seat.status = "stood"; // Auto-stand on timeout
        this.broadcastState();
        this.advanceToNextTurn();
      }
    }, 1000);
  }

  private advanceToNextTurn() {
    this.clearCountdown();
    const current = this.state.activeSeatIndex;
    if (current === null) { this.startDealerTurn(); return; }
    const next = this.findNextActiveSeat(current);
    if (next === null) { this.startDealerTurn(); }
    else { this.activateSeat(next); }
  }

  private findNextActiveSeat(after: number): number | null {
    for (let i = after + 1; i < TOTAL_SEATS; i++) {
      const s = this.state.seats[i];
      if (s.player && s.bet > 0 && s.status !== "blackjack" && s.status !== "busted" && s.status !== "stood" && s.status !== "done") {
        return i;
      }
    }
    return null;
  }

  private startDealerTurn() {
    this.stopAllTimers();
    this.state.phase = "dealer_turn";
    this.state.activeSeatIndex = null;
    this.state.dealerRevealed = true;
    this.broadcastState();

    // Check if any non-busted players
    const active = this.state.seats.filter((s) => s.player && s.bet > 0 && (s.status === "stood" || s.status === "blackjack"));
    if (active.length === 0) {
      const t = setTimeout(() => this.startResults(), 800);
      this.timers.push(t);
      return;
    }

    const dealerHit = () => {
      if (handValue(this.state.dealerHand) < 17 && this.deck.length > 0) {
        this.state.dealerHand.push(this.deck.pop()!);
        this.state.dealerHandValue = handValue(this.state.dealerHand);
        this.broadcastState();
        const t = setTimeout(dealerHit, DEALER_HIT_DELAY);
        this.timers.push(t);
      } else {
        const t = setTimeout(() => this.startResults(), 600);
        this.timers.push(t);
      }
    };
    const t = setTimeout(dealerHit, DEALER_HIT_DELAY);
    this.timers.push(t);
  }

  private startResults() {
    this.state.phase = "results";
    const dVal = handValue(this.state.dealerHand);
    const dealerBust = dVal > 21;

    for (const seat of this.state.seats) {
      if (!seat.player || seat.bet === 0 || seat.hand.length === 0) continue;
      seat.status = "done";
      const pVal = seat.handValue;

      if (pVal > 21) {
        seat.profit = -seat.bet;
      } else if (pVal === 21 && seat.hand.length === 2) {
        // Blackjack
        if (dVal === 21 && this.state.dealerHand.length === 2) seat.profit = 0;
        else seat.profit = Math.floor(seat.bet * 1.5);
      } else if (dealerBust || pVal > dVal) {
        seat.profit = seat.bet;
      } else if (pVal === dVal) {
        seat.profit = 0;
      } else {
        seat.profit = -seat.bet;
      }
    }

    this.broadcastState();

    const t = setTimeout(() => {
      // Check if any seated players remain
      const seatedPlayers = this.state.seats.some((s) => s.player && this.players.has(s.player.id));
      if (seatedPlayers) this.startBetting();
      else this.state.phase = "waiting";
    }, RESULTS_DURATION * 1000);
    this.timers.push(t);
  }

  // === Helpers ===

  private dealToSeat(seatIdx: number) {
    const seat = this.state.seats[seatIdx];
    if (this.deck.length === 0) return;
    seat.hand.push(this.deck.pop()!);
    seat.handValue = handValue(seat.hand);
  }

  private broadcast(data: Record<string, unknown>) {
    const msg = JSON.stringify(data);
    for (const conn of this.room.getConnections()) conn.send(msg);
  }

  private broadcastState() {
    // Send sanitized state to each connection
    for (const conn of this.room.getConnections()) {
      conn.send(JSON.stringify({ type: "state", state: this.sanitizeState(conn.id) }));
    }
  }

  private broadcastPlayers() {
    this.broadcast({ type: "players", players: Array.from(this.players.values()) });
  }

  private sanitizeState(forPlayerId?: string): GameState {
    return {
      ...this.state,
      seats: this.state.seats.map((s) => ({ ...s, hand: [...s.hand] })),
      dealerHand: this.state.dealerRevealed
        ? [...this.state.dealerHand]
        : this.state.dealerHand.length > 0
          ? [this.state.dealerHand[0], { suit: "?", rank: "?", value: 0 }]
          : [],
    };
  }

  private clearCountdown() {
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }

  private stopAllTimers() {
    this.clearCountdown();
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }
}
