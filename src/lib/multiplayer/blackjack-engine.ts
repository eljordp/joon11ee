import type { BlackjackRoundState, BlackjackSeat, BlackjackPhase, MultiplayerPlayer, ChatMessage, SeatStatus } from './types';
import type { Card } from '@/lib/casino';
import { createDeck, handValue } from '@/lib/casino';
import { createBot, randInt, type BlackjackBotProfile } from './bots';
import { BLACKJACK_CHAT, pickRandom } from './chat-messages';

const BETTING_DURATION = 8;
const DEALING_DELAY = 1500;
const BOT_TURN_TIMER = 12;
const HUMAN_TURN_TIMER = 15;
const DEALER_HIT_DELAY = 500;
const RESULTS_DURATION = 4;
const TOTAL_SEATS = 5;
const BOT_COUNT_MIN = 2;
const BOT_COUNT_MAX = 4;

interface BotSeatState {
  seatIndex: number;
  player: MultiplayerPlayer;
  profile: BlackjackBotProfile;
}

type StateCallback = (state: BlackjackRoundState) => void;
type ChatCallback = (msg: ChatMessage) => void;

export class BlackjackEngine {
  private state: BlackjackRoundState;
  private deck: Card[] = [];
  private bots: BotSeatState[] = [];
  private humanSeatIndex: number | null = null;
  private humanPlayer: MultiplayerPlayer;
  private humanHasBet = false;

  private stateCallbacks = new Set<StateCallback>();
  private chatCallbacks = new Set<ChatCallback>();

  private timers: ReturnType<typeof setTimeout>[] = [];
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(playerName: string) {
    this.humanPlayer = {
      id: 'human',
      name: playerName || 'You',
      avatar: '🎮',
      type: 'human',
      balance: 0,
    };

    this.state = this.emptyState();
    this.initBots();
  }

  private emptyState(): BlackjackRoundState {
    return {
      phase: 'betting',
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

  private emptySeat(index: number): BlackjackSeat {
    return {
      seatIndex: index,
      player: null,
      bet: 0,
      hand: [],
      handValue: 0,
      status: 'empty',
      doubled: false,
      profit: 0,
    };
  }

  private initBots() {
    const botCount = randInt(BOT_COUNT_MIN, BOT_COUNT_MAX + 1);
    const ids = new Set<string>(['human']);

    // Place bots in random seats (leave at least 1 open for human)
    const availableSeats = [0, 1, 2, 3, 4];
    // Shuffle seats
    for (let i = availableSeats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableSeats[i], availableSeats[j]] = [availableSeats[j], availableSeats[i]];
    }

    this.bots = [];
    for (let i = 0; i < Math.min(botCount, TOTAL_SEATS - 1); i++) {
      const { player, blackjackProfile } = createBot(ids);
      ids.add(player.id);
      const seatIdx = availableSeats[i];

      this.bots.push({
        seatIndex: seatIdx,
        player,
        profile: blackjackProfile,
      });

      this.state.seats[seatIdx] = {
        ...this.emptySeat(seatIdx),
        player,
        status: 'waiting',
      };
    }
  }

  start() {
    this.running = true;
    this.startBettingPhase();
  }

  stop() {
    this.running = false;
    this.clearTimers();
  }

  private clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  onStateChange(cb: StateCallback): () => void {
    this.stateCallbacks.add(cb);
    return () => { this.stateCallbacks.delete(cb); };
  }

  onChat(cb: ChatCallback): () => void {
    this.chatCallbacks.add(cb);
    return () => { this.chatCallbacks.delete(cb); };
  }

  getState(): BlackjackRoundState {
    return { ...this.state };
  }

  getHumanSeatIndex(): number | null {
    return this.humanSeatIndex;
  }

  // === Human Actions ===

  takeSeat(seatIndex: number): boolean {
    if (seatIndex < 0 || seatIndex >= TOTAL_SEATS) return false;
    if (this.humanSeatIndex !== null) return false;
    if (this.state.seats[seatIndex].player !== null) return false;

    this.humanSeatIndex = seatIndex;
    this.state.seats[seatIndex] = {
      ...this.emptySeat(seatIndex),
      player: this.humanPlayer,
      status: 'waiting',
    };
    this.notify();
    return true;
  }

  placeHumanBet(amount: number): boolean {
    if (this.state.phase !== 'betting' || this.humanSeatIndex === null || this.humanHasBet) return false;
    const seat = this.state.seats[this.humanSeatIndex];
    if (!seat.player || seat.player.id !== 'human') return false;

    seat.bet = amount;
    seat.status = 'betting';
    this.humanHasBet = true;
    this.notify();
    return true;
  }

  humanHit(): boolean {
    if (this.state.phase !== 'player_turns' || this.humanSeatIndex === null) return false;
    if (this.state.activeSeatIndex !== this.humanSeatIndex) return false;
    const seat = this.state.seats[this.humanSeatIndex];
    if (seat.status !== 'playing') return false;

    this.dealCardToSeat(this.humanSeatIndex);
    if (seat.handValue > 21) {
      seat.status = 'busted';
      this.notify();
      this.advanceToNextTurn();
    } else if (seat.handValue === 21) {
      seat.status = 'stood';
      this.notify();
      this.advanceToNextTurn();
    } else {
      this.notify();
    }
    return true;
  }

  humanStand(): boolean {
    if (this.state.phase !== 'player_turns' || this.humanSeatIndex === null) return false;
    if (this.state.activeSeatIndex !== this.humanSeatIndex) return false;
    const seat = this.state.seats[this.humanSeatIndex];
    if (seat.status !== 'playing') return false;

    seat.status = 'stood';
    this.notify();
    this.advanceToNextTurn();
    return true;
  }

  humanDoubleDown(): boolean {
    if (this.state.phase !== 'player_turns' || this.humanSeatIndex === null) return false;
    if (this.state.activeSeatIndex !== this.humanSeatIndex) return false;
    const seat = this.state.seats[this.humanSeatIndex];
    if (seat.status !== 'playing' || seat.hand.length !== 2 || seat.doubled) return false;

    seat.doubled = true;
    seat.bet *= 2;
    this.dealCardToSeat(this.humanSeatIndex);

    if (seat.handValue > 21) {
      seat.status = 'busted';
    } else {
      seat.status = 'stood';
    }
    this.notify();
    this.advanceToNextTurn();
    return true;
  }

  // === Phase Management ===

  private startBettingPhase() {
    if (!this.running) return;
    this.clearTimers();

    this.state.roundNumber++;
    this.state.phase = 'betting';
    this.state.bettingTimeLeft = BETTING_DURATION;
    this.state.dealerHand = [];
    this.state.dealerHandValue = 0;
    this.state.dealerRevealed = false;
    this.state.activeSeatIndex = null;
    this.state.turnTimeLeft = 0;
    this.humanHasBet = false;

    // Reset seats (keep players, clear hands)
    for (const seat of this.state.seats) {
      if (seat.player) {
        seat.hand = [];
        seat.handValue = 0;
        seat.bet = 0;
        seat.status = 'waiting';
        seat.doubled = false;
        seat.profit = 0;
      }
    }

    this.notify();

    // Bot bets staggered
    for (const bot of this.bots) {
      const delay = randInt(500, 5000);
      const t = setTimeout(() => {
        if (!this.running || this.state.phase !== 'betting') return;
        const seat = this.state.seats[bot.seatIndex];
        if (!seat.player) return;
        seat.bet = randInt(bot.profile.betRange[0], bot.profile.betRange[1]);
        seat.status = 'betting';
        this.notify();
      }, delay);
      this.timers.push(t);
    }

    // Bot chat
    this.scheduleBotChat(2);

    // Countdown
    let remaining = BETTING_DURATION;
    this.countdownInterval = setInterval(() => {
      remaining--;
      this.state.bettingTimeLeft = Math.max(0, remaining);
      this.notify();
      if (remaining <= 0) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        this.startDealingPhase();
      }
    }, 1000);
  }

  private startDealingPhase() {
    if (!this.running) return;
    this.clearTimers();

    this.state.phase = 'dealing';
    this.deck = createDeck();

    // Ensure bots have bets
    for (const bot of this.bots) {
      const seat = this.state.seats[bot.seatIndex];
      if (seat.player && seat.bet === 0) {
        seat.bet = randInt(bot.profile.betRange[0], bot.profile.betRange[1]);
        seat.status = 'betting';
      }
    }

    this.notify();

    // Deal cards after a brief delay
    const t = setTimeout(() => {
      if (!this.running) return;

      // Deal 2 cards to each seated player with a bet
      for (const seat of this.state.seats) {
        if (seat.player && seat.bet > 0) {
          this.dealCardToSeat(seat.seatIndex);
          this.dealCardToSeat(seat.seatIndex);
        }
      }

      // Deal dealer cards
      this.state.dealerHand = [this.deck.pop()!, this.deck.pop()!];
      this.state.dealerHandValue = handValue(this.state.dealerHand);

      // Check for naturals
      for (const seat of this.state.seats) {
        if (seat.player && seat.bet > 0 && seat.handValue === 21) {
          seat.status = 'blackjack';
        }
      }

      this.notify();

      // Start player turns after dealing animation
      const t2 = setTimeout(() => {
        this.startPlayerTurns();
      }, 800);
      this.timers.push(t2);
    }, DEALING_DELAY);
    this.timers.push(t);
  }

  private startPlayerTurns() {
    if (!this.running) return;

    this.state.phase = 'player_turns';

    // Find first active seat
    const firstSeat = this.findNextActiveSeat(-1);
    if (firstSeat === null) {
      this.startDealerTurn();
      return;
    }

    this.activateSeat(firstSeat);
  }

  private activateSeat(seatIndex: number) {
    if (!this.running) return;

    const seat = this.state.seats[seatIndex];
    if (!seat.player || seat.bet === 0 || seat.status === 'blackjack') {
      this.advanceToNextTurn();
      return;
    }

    seat.status = 'playing';
    this.state.activeSeatIndex = seatIndex;
    const isHuman = seat.player.id === 'human';
    const timerDuration = isHuman ? HUMAN_TURN_TIMER : BOT_TURN_TIMER;
    this.state.turnTimeLeft = timerDuration;
    this.notify();

    if (isHuman) {
      // Countdown for human
      this.countdownInterval = setInterval(() => {
        this.state.turnTimeLeft--;
        this.notify();
        if (this.state.turnTimeLeft <= 0) {
          if (this.countdownInterval) clearInterval(this.countdownInterval);
          this.countdownInterval = null;
          // Auto-stand on timeout
          seat.status = 'stood';
          this.notify();
          this.advanceToNextTurn();
        }
      }, 1000);
    } else {
      // Bot plays
      this.playBotTurn(seatIndex);
    }
  }

  private playBotTurn(seatIndex: number) {
    const botState = this.bots.find((b) => b.seatIndex === seatIndex);
    if (!botState) {
      this.advanceToNextTurn();
      return;
    }

    const seat = this.state.seats[seatIndex];
    const profile = botState.profile;

    const think = () => {
      const thinkTime = randInt(profile.thinkTimeMs[0], profile.thinkTimeMs[1]);
      const t = setTimeout(() => {
        if (!this.running || this.state.phase !== 'player_turns') return;

        // Double down logic
        if (seat.hand.length === 2 && !seat.doubled &&
            seat.handValue >= profile.doubleThreshold - 1 &&
            seat.handValue <= profile.doubleThreshold + 1 &&
            Math.random() > 0.3) {
          seat.doubled = true;
          seat.bet *= 2;
          this.dealCardToSeat(seatIndex);
          seat.status = seat.handValue > 21 ? 'busted' : 'stood';
          this.notify();
          this.advanceToNextTurn();
          return;
        }

        // Hit or stand
        if (seat.handValue < profile.hitThreshold) {
          this.dealCardToSeat(seatIndex);
          this.notify();

          if (seat.handValue > 21) {
            seat.status = 'busted';
            this.notify();
            this.advanceToNextTurn();
          } else if (seat.handValue === 21) {
            seat.status = 'stood';
            this.notify();
            this.advanceToNextTurn();
          } else {
            think(); // Continue thinking
          }
        } else {
          seat.status = 'stood';
          this.notify();
          this.advanceToNextTurn();
        }
      }, thinkTime);
      this.timers.push(t);
    };

    think();
  }

  private advanceToNextTurn() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    const currentSeat = this.state.activeSeatIndex;
    if (currentSeat === null) {
      this.startDealerTurn();
      return;
    }

    const nextSeat = this.findNextActiveSeat(currentSeat);
    if (nextSeat === null) {
      this.startDealerTurn();
    } else {
      this.activateSeat(nextSeat);
    }
  }

  private findNextActiveSeat(afterIndex: number): number | null {
    for (let i = afterIndex + 1; i < TOTAL_SEATS; i++) {
      const seat = this.state.seats[i];
      if (seat.player && seat.bet > 0 && seat.status !== 'blackjack' && seat.status !== 'busted' && seat.status !== 'stood' && seat.status !== 'done') {
        return i;
      }
    }
    return null;
  }

  private startDealerTurn() {
    if (!this.running) return;
    this.clearTimers();

    this.state.phase = 'dealer_turn';
    this.state.activeSeatIndex = null;
    this.state.dealerRevealed = true;
    this.notify();

    // Check if any players are still in (not all busted)
    const activePlayers = this.state.seats.filter(
      (s) => s.player && s.bet > 0 && (s.status === 'stood' || s.status === 'blackjack')
    );

    if (activePlayers.length === 0) {
      // All busted, skip dealer
      const t = setTimeout(() => this.startResultsPhase(), 800);
      this.timers.push(t);
      return;
    }

    // Dealer hits to 17
    const dealerHit = () => {
      if (!this.running) return;
      if (handValue(this.state.dealerHand) < 17 && this.deck.length > 0) {
        this.state.dealerHand.push(this.deck.pop()!);
        this.state.dealerHandValue = handValue(this.state.dealerHand);
        this.notify();
        const t = setTimeout(dealerHit, DEALER_HIT_DELAY);
        this.timers.push(t);
      } else {
        const t = setTimeout(() => this.startResultsPhase(), 600);
        this.timers.push(t);
      }
    };

    const t = setTimeout(dealerHit, DEALER_HIT_DELAY);
    this.timers.push(t);
  }

  private startResultsPhase() {
    if (!this.running) return;

    this.state.phase = 'results';
    const dVal = handValue(this.state.dealerHand);
    const dealerBust = dVal > 21;

    for (const seat of this.state.seats) {
      if (!seat.player || seat.bet === 0) continue;

      const pVal = seat.handValue;
      seat.status = 'done';

      if (seat.hand.length === 0) {
        // Didn't play
        seat.profit = 0;
        continue;
      }

      if (pVal > 21) {
        // Busted
        seat.profit = -seat.bet;
      } else if (pVal === 21 && seat.hand.length === 2) {
        // Blackjack
        if (dVal === 21 && this.state.dealerHand.length === 2) {
          seat.profit = 0; // Push
        } else {
          seat.profit = Math.floor(seat.bet * 1.5); // BJ pays 3:2
        }
      } else if (dealerBust || pVal > dVal) {
        seat.profit = seat.bet; // Win
      } else if (pVal === dVal) {
        seat.profit = 0; // Push
      } else {
        seat.profit = -seat.bet; // Lose
      }
    }

    this.notify();

    // Bot chat on results
    this.scheduleBotChat(1);

    // Auto-advance
    const t = setTimeout(() => {
      this.startBettingPhase();
    }, RESULTS_DURATION * 1000);
    this.timers.push(t);
  }

  // === Helpers ===

  private dealCardToSeat(seatIndex: number) {
    const seat = this.state.seats[seatIndex];
    if (this.deck.length === 0) return;
    seat.hand.push(this.deck.pop()!);
    seat.handValue = handValue(seat.hand);
  }

  private scheduleBotChat(count: number) {
    for (let i = 0; i < count; i++) {
      const delay = randInt(500, 3000);
      const t = setTimeout(() => {
        if (!this.running) return;
        const bot = this.bots[randInt(0, this.bots.length)];
        if (!bot) return;
        this.emitChat(bot.player, pickRandom(BLACKJACK_CHAT));
      }, delay);
      this.timers.push(t);
    }
  }

  private emitChat(player: MultiplayerPlayer, text: string) {
    const msg: ChatMessage = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      playerId: player.id,
      playerName: player.name,
      avatar: player.avatar,
      text,
      timestamp: Date.now(),
      type: 'chat',
    };
    this.chatCallbacks.forEach((cb) => cb(msg));
  }

  private notify() {
    const snapshot: BlackjackRoundState = {
      ...this.state,
      seats: this.state.seats.map((s) => ({ ...s, hand: [...s.hand] })),
      dealerHand: [...this.state.dealerHand],
    };
    this.stateCallbacks.forEach((cb) => cb(snapshot));
  }
}
