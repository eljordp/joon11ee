import type { CrashRoundState, CrashPlayerState, CrashPhase, MultiplayerPlayer, ChatMessage, CashoutEntry } from './types';
import { createBot, randBetween, randInt, type CrashBotProfile } from './bots';
import { CRASH_CHAT_BETTING, CRASH_CHAT_FLYING, CRASH_CHAT_CRASHED, CRASH_CHAT_CASHOUT, pickRandom } from './chat-messages';

const BETTING_DURATION = 5; // seconds
const CRASHED_DURATION = 3; // seconds
const TICK_MS = 50;
const BOT_COUNT_MIN = 8;
const BOT_COUNT_MAX = 15;

interface BotState {
  player: MultiplayerPlayer;
  profile: CrashBotProfile;
  targetMultiplier: number;
  hasBet: boolean;
  betDelay: number; // ms from phase start
  lastChatTime: number;
}

type StateCallback = (state: CrashRoundState) => void;
type ChatCallback = (msg: ChatMessage) => void;
type CashoutCallback = (entry: CashoutEntry) => void;

export class CrashEngine {
  private state: CrashRoundState;
  private bots: BotState[] = [];
  private humanState: CrashPlayerState | null = null;
  private humanPlayer: MultiplayerPlayer;

  private stateCallbacks = new Set<StateCallback>();
  private chatCallbacks = new Set<ChatCallback>();
  private cashoutCallbacks = new Set<CashoutCallback>();

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private phaseTimeout: ReturnType<typeof setTimeout> | null = null;
  private botTimers: ReturnType<typeof setTimeout>[] = [];
  private startTime = 0;
  private running = false;

  constructor(playerName: string) {
    this.humanPlayer = {
      id: 'human',
      name: playerName || 'You',
      avatar: '🎮',
      type: 'human',
      balance: 0,
    };

    this.state = {
      phase: 'betting',
      crashPoint: 0,
      currentMultiplier: 1.0,
      bettingTimeLeft: BETTING_DURATION,
      playerStates: [],
      roundNumber: 0,
      history: [],
    };

    this.initBots();
  }

  private initBots() {
    const count = randInt(BOT_COUNT_MIN, BOT_COUNT_MAX + 1);
    const ids = new Set<string>(['human']);
    this.bots = [];

    for (let i = 0; i < count; i++) {
      const { player, crashProfile } = createBot(ids);
      ids.add(player.id);
      this.bots.push({
        player,
        profile: crashProfile,
        targetMultiplier: 0,
        hasBet: false,
        betDelay: 0,
        lastChatTime: 0,
      });
    }
  }

  start() {
    this.running = true;
    this.startBettingPhase();
  }

  stop() {
    this.running = false;
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.phaseTimeout) clearTimeout(this.phaseTimeout);
    this.botTimers.forEach((t) => clearTimeout(t));
    this.botTimers = [];
    this.tickInterval = null;
    this.phaseTimeout = null;
  }

  onStateChange(cb: StateCallback): () => void {
    this.stateCallbacks.add(cb);
    return () => { this.stateCallbacks.delete(cb); };
  }

  onChat(cb: ChatCallback): () => void {
    this.chatCallbacks.add(cb);
    return () => { this.chatCallbacks.delete(cb); };
  }

  onCashout(cb: CashoutCallback): () => void {
    this.cashoutCallbacks.add(cb);
    return () => { this.cashoutCallbacks.delete(cb); };
  }

  getState(): CrashRoundState {
    return { ...this.state };
  }

  // === Human Actions ===

  placeHumanBet(amount: number): boolean {
    if (this.state.phase !== 'betting' || this.humanState) return false;

    this.humanState = {
      player: this.humanPlayer,
      bet: amount,
      cashedOut: false,
      cashoutMultiplier: null,
      profit: -amount,
    };

    this.rebuildPlayerStates();
    this.notify();
    return true;
  }

  humanCashout(): { multiplier: number; profit: number } | null {
    if (this.state.phase !== 'flying' || !this.humanState || this.humanState.cashedOut) return null;

    const mult = this.state.currentMultiplier;
    const profit = Math.floor(this.humanState.bet * mult);
    this.humanState.cashedOut = true;
    this.humanState.cashoutMultiplier = mult;
    this.humanState.profit = profit;

    this.emitCashout(this.humanPlayer, mult, profit);
    this.rebuildPlayerStates();
    this.notify();
    return { multiplier: mult, profit };
  }

  // === Phase Management ===

  private startBettingPhase() {
    if (!this.running) return;

    this.state.roundNumber++;
    this.state.phase = 'betting';
    this.state.bettingTimeLeft = BETTING_DURATION;
    this.state.currentMultiplier = 1.0;
    this.state.crashPoint = 0;
    this.humanState = null;

    // Reset bot states for new round
    for (const bot of this.bots) {
      bot.hasBet = false;
      bot.targetMultiplier = randBetween(bot.profile.targetMultiplier[0], bot.profile.targetMultiplier[1]);
      bot.betDelay = randInt(300, 4000);
    }

    this.rebuildPlayerStates();
    this.notify();

    // Schedule bot bets
    this.scheduleBotBets();

    // Bot chat during betting
    this.scheduleBotChat(CRASH_CHAT_BETTING, 0.15, BETTING_DURATION * 1000);

    // Countdown timer
    let remaining = BETTING_DURATION;
    this.tickInterval = setInterval(() => {
      remaining -= 1;
      this.state.bettingTimeLeft = Math.max(0, remaining);
      this.notify();

      if (remaining <= 0) {
        if (this.tickInterval) clearInterval(this.tickInterval);
        this.tickInterval = null;
        this.startFlyingPhase();
      }
    }, 1000);
  }

  private startFlyingPhase() {
    if (!this.running) return;

    // Generate crash point
    const r = Math.random();
    const crash = Math.max(1.0, (1 / (1 - r)) * 0.97);
    const crashPoint = Math.min(crash, 100);

    this.state.phase = 'flying';
    this.state.crashPoint = crashPoint;
    this.state.currentMultiplier = 1.0;
    this.startTime = Date.now();

    // Remove bots that didn't bet (some skip rounds)
    this.rebuildPlayerStates();
    this.notify();

    // Bot chat during flying
    this.scheduleBotChat(CRASH_CHAT_FLYING, 0.2, 30000);

    // Main game tick
    this.tickInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const mult = Math.pow(Math.E, 0.08 * elapsed);

      if (mult >= this.state.crashPoint) {
        this.state.currentMultiplier = this.state.crashPoint;
        this.notify();
        if (this.tickInterval) clearInterval(this.tickInterval);
        this.tickInterval = null;
        this.startCrashedPhase();
        return;
      }

      this.state.currentMultiplier = mult;

      // Check bot cashouts
      for (const bot of this.bots) {
        if (!bot.hasBet) continue;
        const ps = this.state.playerStates.find((p) => p.player.id === bot.player.id);
        if (!ps || ps.cashedOut) continue;

        const jitter = bot.targetMultiplier * (0.85 + Math.random() * 0.3);
        if (mult >= jitter) {
          ps.cashedOut = true;
          ps.cashoutMultiplier = mult;
          ps.profit = Math.floor(ps.bet * mult);
          this.emitCashout(bot.player, mult, ps.profit);
        }
      }

      this.notify();
    }, TICK_MS);
  }

  private startCrashedPhase() {
    if (!this.running) return;

    this.state.phase = 'crashed';

    // Mark non-cashed players as losers
    for (const ps of this.state.playerStates) {
      if (!ps.cashedOut) {
        ps.profit = -ps.bet;
      }
    }

    // Add to history
    this.state.history = [
      { crashPoint: parseFloat(this.state.crashPoint.toFixed(2)), roundNumber: this.state.roundNumber },
      ...this.state.history.slice(0, 19),
    ];

    this.notify();

    // Bot chat on crash
    const chatTimers: ReturnType<typeof setTimeout>[] = [];
    const chatCount = Math.random() > 0.5 ? 2 : 1;
    for (let i = 0; i < chatCount; i++) {
      const t = setTimeout(() => {
        const chatBot = this.bots[randInt(0, this.bots.length)];
        this.emitChatFromBot(chatBot.player, pickRandom(CRASH_CHAT_CRASHED));
      }, randInt(200, 1500));
      chatTimers.push(t);
    }
    this.botTimers.push(...chatTimers);

    // Auto-advance to next round
    this.phaseTimeout = setTimeout(() => {
      this.startBettingPhase();
    }, CRASHED_DURATION * 1000);
  }

  // === Bot Scheduling ===

  private scheduleBotBets() {
    for (const bot of this.bots) {
      if (Math.random() > bot.profile.betProbability) continue;

      const t = setTimeout(() => {
        if (this.state.phase !== 'betting' || !this.running) return;
        bot.hasBet = true;
        const betAmount = randInt(bot.profile.betRange[0], bot.profile.betRange[1]);
        // The player state will be rebuilt when we notify
        this.rebuildPlayerStates();
        // Set the bet on the player state
        const ps = this.state.playerStates.find((p) => p.player.id === bot.player.id);
        if (ps) ps.bet = betAmount;
        this.notify();
      }, bot.betDelay);

      this.botTimers.push(t);
    }
  }

  private scheduleBotChat(pool: string[], chancePerSec: number, durationMs: number) {
    const interval = 1000;
    let elapsed = 0;

    const t = setInterval(() => {
      elapsed += interval;
      if (elapsed > durationMs || !this.running) {
        clearInterval(t);
        return;
      }

      if (Math.random() < chancePerSec) {
        const eligibleBots = this.bots.filter((b) => Date.now() - b.lastChatTime > 3000);
        if (eligibleBots.length > 0) {
          const bot = eligibleBots[randInt(0, eligibleBots.length)];
          bot.lastChatTime = Date.now();
          this.emitChatFromBot(bot.player, pickRandom(pool));
        }
      }
    }, interval);

    this.botTimers.push(t as unknown as ReturnType<typeof setTimeout>);
  }

  // === State Building ===

  private rebuildPlayerStates() {
    const states: CrashPlayerState[] = [];

    // Human first if they bet
    if (this.humanState) {
      states.push(this.humanState);
    }

    // Bots that bet
    for (const bot of this.bots) {
      if (!bot.hasBet && this.state.phase !== 'betting') continue;

      const existing = this.state.playerStates.find((p) => p.player.id === bot.player.id);
      if (existing) {
        states.push(existing);
      } else if (bot.hasBet) {
        states.push({
          player: bot.player,
          bet: randInt(bot.profile.betRange[0], bot.profile.betRange[1]),
          cashedOut: false,
          cashoutMultiplier: null,
          profit: 0,
        });
      }
    }

    this.state.playerStates = states;
  }

  // === Event Emitters ===

  private notify() {
    const snapshot = { ...this.state, playerStates: [...this.state.playerStates] };
    this.stateCallbacks.forEach((cb) => cb(snapshot));
  }

  private emitCashout(player: MultiplayerPlayer, multiplier: number, profit: number) {
    const entry: CashoutEntry = {
      id: `co_${Date.now()}_${player.id}`,
      playerName: player.name,
      avatar: player.avatar,
      multiplier: parseFloat(multiplier.toFixed(2)),
      profit,
      timestamp: Date.now(),
    };
    this.cashoutCallbacks.forEach((cb) => cb(entry));

    // Sometimes bots chat on cashout
    if (player.type === 'bot' && Math.random() < 0.3) {
      setTimeout(() => {
        this.emitChatFromBot(player, pickRandom(CRASH_CHAT_CASHOUT));
      }, randInt(200, 800));
    }
  }

  private emitChatFromBot(player: MultiplayerPlayer, text: string) {
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
}
