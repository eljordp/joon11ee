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

interface Player { id: string; name: string; avatar: string; isBot?: boolean; }

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
  hostId: string | null;
  botIds: string[];
}

// === Bot Config ===
const BOT_PROFILES: Player[] = [
  { id: "bot_ace", name: "Ace", avatar: "🎩", isBot: true },
  { id: "bot_lucky", name: "Lucky", avatar: "🍀", isBot: true },
  { id: "bot_shark", name: "Shark", avatar: "🦈", isBot: true },
];

// === Constants ===
const TOTAL_SEATS = 5;
const BETTING_DURATION = 8;
const HUMAN_TURN_TIMER = 15;
const BOT_TURN_DELAY = 1200;
const DEALER_HIT_DELAY = 600;
const RESULTS_DURATION = 4;

export default class BlackjackServer implements Party.Server {
  players = new Map<string, Player>();
  seatMap = new Map<string, number>(); // playerId -> seatIndex
  state: GameState;
  deck: Card[] = [];
  timers: ReturnType<typeof setTimeout>[] = [];
  countdownInterval: ReturnType<typeof setInterval> | null = null;
  botsSpawned = false;
  hostId: string | null = null;
  roomPassword: string | null = null;
  lastBets = new Map<string, number>(); // playerId -> last bet amount

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
      hostId: this.hostId,
      botIds: this.getActiveBotIds(),
    };
  }

  private getActiveBotIds(): string[] {
    return Array.from(this.seatMap.entries())
      .filter(([id]) => this.players.get(id)?.isBot)
      .map(([id]) => id);
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

    // Transfer host if needed
    if (conn.id === this.hostId) {
      const realPlayers = Array.from(this.players.values()).filter((p) => !p.isBot);
      this.hostId = realPlayers.length > 0 ? realPlayers[0].id : null;
    }

    // Check if any real (non-bot) players remain
    const realPlayers = Array.from(this.players.values()).filter((p) => !p.isBot);
    if (realPlayers.length === 0) {
      this.stopAllTimers();
      this.removeBots();
      this.hostId = null;
      this.roomPassword = null;
      this.lastBets.clear();
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
      case "rebet": this.handleRebet(sender); break;
      case "add_bot": this.handleAddBot(sender); break;
      case "remove_bot": this.handleRemoveBot(sender, data); break;
      case "chat": this.handleChat(sender, data); break;
      case "reaction": this.handleReaction(sender, data); break;
    }
  }

  // === Handlers ===

  private handleJoin(conn: Party.Connection, data: Record<string, unknown>) {
    // First player sets password (if provided)
    if (!this.hostId && data.password) {
      this.roomPassword = String(data.password);
    }

    // Subsequent players must match password
    if (this.roomPassword && conn.id !== this.hostId) {
      const pw = data.password ? String(data.password) : "";
      if (pw !== this.roomPassword) {
        conn.send(JSON.stringify({ type: "auth_error", message: "Wrong password" }));
        return;
      }
    }

    const player: Player = {
      id: conn.id,
      name: (data.name as string) || "Anon",
      avatar: (data.avatar as string) || "🎮",
    };
    this.players.set(conn.id, player);

    // First real player becomes host
    if (!this.hostId) {
      this.hostId = conn.id;
    }

    this.broadcast({ type: "player_joined", player });
    this.broadcastPlayers();
    conn.send(JSON.stringify({ type: "state", state: this.sanitizeState(conn.id) }));

    // Spawn bots when first real player joins
    if (!this.botsSpawned) {
      this.spawnBots();
    }
  }

  private handleTakeSeat(conn: Party.Connection, data: Record<string, unknown>) {
    const player = this.players.get(conn.id);
    if (!player) return;
    if (this.seatMap.has(conn.id)) return; // Already seated

    const seatIdx = Number(data.seatIndex);
    if (seatIdx < 0 || seatIdx >= TOTAL_SEATS) return;
    if (this.state.seats[seatIdx].player !== null) return;

    // Allow sitting down during ANY phase — player just waits for next round
    this.state.seats[seatIdx] = { ...this.emptySeat(seatIdx), player, status: "waiting" };
    this.seatMap.set(conn.id, seatIdx);

    this.broadcast({ type: "seat_taken", seatIndex: seatIdx, player });
    this.broadcastState();

    // Start game if in waiting phase
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

    // Check if all seated players have bet — skip timer
    this.checkAllBetsIn();
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
    if (seat.player && !seat.player.isBot) {
      this.broadcastSystemChat(`${seat.player.name} doubled down for $${seat.bet}! 💰`);
    }
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

  private handleRebet(conn: Party.Connection) {
    if (this.state.phase !== "betting") return;
    const seatIdx = this.seatMap.get(conn.id);
    if (seatIdx === undefined) return;
    const seat = this.state.seats[seatIdx];
    if (!seat.player || seat.status === "betting") return;
    const lastBet = this.lastBets.get(conn.id);
    if (!lastBet) return;
    seat.bet = lastBet;
    seat.status = "betting";
    this.broadcastState();
    this.checkAllBetsIn();
  }

  private handleReaction(conn: Party.Connection, data: Record<string, unknown>) {
    const player = this.players.get(conn.id);
    if (!player) return;
    const seatIdx = this.seatMap.get(conn.id);
    if (seatIdx === undefined) return;
    const emoji = String(data.emoji || "").slice(0, 4);
    if (!emoji) return;
    this.broadcast({ type: "reaction", seatIndex: seatIdx, emoji, playerId: conn.id });
  }

  private handleAddBot(conn: Party.Connection) {
    if (conn.id !== this.hostId) return;
    // Find an available bot profile not already seated
    const activeIds = new Set(this.seatMap.keys());
    const available = BOT_PROFILES.find((b) => !activeIds.has(b.id));
    if (!available) return;

    // Find an empty seat
    const emptySeat = this.state.seats.find((s) => !s.player);
    if (!emptySeat) return;

    this.players.set(available.id, available);
    this.seatMap.set(available.id, emptySeat.index);
    this.state.seats[emptySeat.index] = { ...this.emptySeat(emptySeat.index), player: available, status: "waiting" };

    this.broadcastPlayers();
    this.broadcastState();

    // If in betting phase, have the new bot bet
    if (this.state.phase === "betting") {
      const delay = 800 + Math.random() * 1500;
      const seat = this.state.seats[emptySeat.index];
      const t = setTimeout(() => {
        if (this.state.phase !== "betting" || !seat.player) return;
        const amounts = [50, 100, 150, 200, 250, 500];
        seat.bet = amounts[Math.floor(Math.random() * amounts.length)];
        seat.status = "betting";
        this.broadcastState();
        this.checkAllBetsIn();
      }, delay);
      this.timers.push(t);
    }
  }

  private handleRemoveBot(conn: Party.Connection, data: Record<string, unknown>) {
    if (conn.id !== this.hostId) return;
    const botId = data.botId as string;
    if (!botId) return;

    const bot = this.players.get(botId);
    if (!bot?.isBot) return;

    const seatIdx = this.seatMap.get(botId);
    if (seatIdx !== undefined) {
      // If it's this bot's turn, advance first
      if (this.state.activeSeatIndex === seatIdx && this.state.phase === "player_turns") {
        this.state.seats[seatIdx] = this.emptySeat(seatIdx);
        this.seatMap.delete(botId);
        this.players.delete(botId);
        this.advanceToNextTurn();
      } else {
        this.state.seats[seatIdx] = this.emptySeat(seatIdx);
        this.seatMap.delete(botId);
        this.players.delete(botId);
      }
    } else {
      this.players.delete(botId);
    }

    this.broadcastPlayers();
    this.broadcastState();
  }

  // === Bots ===

  private spawnBots() {
    this.botsSpawned = true;
    // Seat 2 bots in random seats
    const available = [0, 1, 2, 3, 4];
    const shuffled = available.sort(() => Math.random() - 0.5);
    const botCount = 2;

    for (let i = 0; i < botCount && i < BOT_PROFILES.length; i++) {
      const bot = BOT_PROFILES[i];
      const seatIdx = shuffled[i];
      this.players.set(bot.id, bot);
      this.seatMap.set(bot.id, seatIdx);
      this.state.seats[seatIdx] = { ...this.emptySeat(seatIdx), player: bot, status: "waiting" };
    }

    this.broadcastPlayers();
    this.broadcastState();
  }

  private removeBots() {
    for (const bot of BOT_PROFILES) {
      const seatIdx = this.seatMap.get(bot.id);
      if (seatIdx !== undefined) {
        this.state.seats[seatIdx] = this.emptySeat(seatIdx);
        this.seatMap.delete(bot.id);
      }
      this.players.delete(bot.id);
    }
    this.botsSpawned = false;
  }

  private botsBet() {
    for (const bot of BOT_PROFILES) {
      const seatIdx = this.seatMap.get(bot.id);
      if (seatIdx === undefined) continue;
      const seat = this.state.seats[seatIdx];
      if (!seat.player || seat.status !== "waiting") continue;

      // Stagger bot bets
      const delay = 800 + Math.random() * 2000;
      const t = setTimeout(() => {
        if (this.state.phase !== "betting") return;
        const amounts = [50, 100, 150, 200, 250, 500];
        seat.bet = amounts[Math.floor(Math.random() * amounts.length)];
        seat.status = "betting";
        this.broadcastState();
        this.checkAllBetsIn();
      }, delay);
      this.timers.push(t);
    }
  }

  private botPlay(seatIdx: number) {
    const seat = this.state.seats[seatIdx];
    if (!seat.player?.isBot || seat.status !== "playing") return;

    // Simple bot strategy: hit on 16 or less, stand on 17+
    const decide = () => {
      if (this.state.phase !== "player_turns" || this.state.activeSeatIndex !== seatIdx) return;
      if (seat.status !== "playing") return;

      if (seat.handValue <= 11) {
        // Always hit on 11 or less
        this.dealToSeat(seatIdx);
        if (seat.handValue > 21) {
          seat.status = "busted";
          this.broadcastState();
          this.advanceToNextTurn();
        } else {
          this.broadcastState();
          const t = setTimeout(decide, BOT_TURN_DELAY);
          this.timers.push(t);
        }
      } else if (seat.handValue <= 16) {
        // Hit on soft 16 or less
        this.dealToSeat(seatIdx);
        if (seat.handValue > 21) {
          seat.status = "busted";
          this.broadcastState();
          this.advanceToNextTurn();
        } else if (seat.handValue >= 17) {
          seat.status = "stood";
          this.broadcastState();
          this.advanceToNextTurn();
        } else {
          this.broadcastState();
          const t = setTimeout(decide, BOT_TURN_DELAY);
          this.timers.push(t);
        }
      } else {
        // Stand on 17+
        seat.status = "stood";
        this.broadcastState();
        this.advanceToNextTurn();
      }
    };

    const t = setTimeout(decide, BOT_TURN_DELAY);
    this.timers.push(t);
  }

  private checkAllBetsIn() {
    if (this.state.phase !== "betting") return;
    const seatedPlayers = this.state.seats.filter((s) => s.player);
    if (seatedPlayers.length === 0) return;
    const allBet = seatedPlayers.every((s) => s.status === "betting");
    if (allBet) {
      // Everyone bet — skip remaining timer
      this.clearCountdown();
      this.startDealing();
    }
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

    // Bots place bets
    this.botsBet();

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

    // Deal 2 cards to each bettor, track last bets
    for (const seat of this.state.seats) {
      if (seat.player && seat.bet > 0) {
        if (!seat.player.isBot) this.lastBets.set(seat.player.id, seat.bet);
        this.dealToSeat(seat.index);
        this.dealToSeat(seat.index);
        if (seat.handValue === 21) {
          seat.status = "blackjack";
          if (seat.player) this.broadcastSystemChat(`${seat.player.name} hit BLACKJACK! 🃏`);
        }
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

    // If bot, play automatically
    if (seat.player.isBot) {
      this.botPlay(seatIdx);
      return;
    }

    // Turn countdown for human players
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

    if (dealerBust) {
      this.broadcastSystemChat(`Dealer busts with ${dVal}! 💥`);
    }

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

      // System chat for big wins
      if (seat.profit >= 500 && seat.player && !seat.player.isBot) {
        this.broadcastSystemChat(`${seat.player.name} won $${seat.profit}! 🔥`);
      }
    }

    this.broadcastState();

    const t = setTimeout(() => {
      // Check if any seated players remain (non-bot)
      const seatedPlayers = this.state.seats.some((s) => s.player && this.players.has(s.player.id));
      if (seatedPlayers) this.startBetting();
      else this.state.phase = "waiting";
    }, RESULTS_DURATION * 1000);
    this.timers.push(t);
  }

  // === Helpers ===

  private broadcastSystemChat(text: string) {
    this.broadcast({ type: "chat", chatType: "system", playerId: "system", playerName: "Dealer", avatar: "🃏", text });
  }

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
