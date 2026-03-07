import type * as Party from "partykit/server";

// === Types ===
type Phase = "waiting" | "betting" | "flying" | "crashed";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isBot?: boolean;
}

interface PlayerBet {
  player: Player;
  amount: number;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  profit: number;
}

interface RoundState {
  phase: Phase;
  roundNumber: number;
  crashPoint: number;
  flyingStartTime: number;
  bettingTimeLeft: number;
  bets: PlayerBet[];
  history: { crashPoint: number; roundNumber: number }[];
}

// === Bot Data ===
const BOT_NAMES = [
  "xX_Degen_Xx", "LuckyVibes", "CryptoKid99", "MoonBoy", "DiamondHandz",
  "YOLOSwaggins", "SatoshiJr", "NightOwl42", "HighRoller", "BetMaster",
  "RocketMan", "GoldDigger", "TheWhale", "SmallFish", "SendItBro",
];
const BOT_AVATARS = [
  "😎", "🤑", "🧠", "🔥", "💀", "👻", "🐺", "🦊", "🐻", "🦁",
  "🎭", "🤡", "👽", "🤖", "🥷",
];
const BOT_CHAT_BETTING = [
  "going big this round", "feeling lucky", "send it", "gl everyone",
  "easy 2x incoming", "moon time", "im scared lol", "max bet no fear",
];
const BOT_CHAT_FLYING = [
  "HOLD", "its going!!", "MOOON", "diamond hands only",
  "CASH OUT NOW", "ride it", "lets goooo", "no way",
];
const BOT_CHAT_CRASHED = [
  "rip", "gg", "knew it", "LMAO", "bruhhh", "pain", "next one for sure",
];
const BOT_CHAT_CASHOUT = [
  "ez money", "secured the bag", "profit is profit", "smart play",
];

interface BotProfile {
  player: Player;
  betRange: [number, number];
  targetMult: [number, number];
  betChance: number;
}

function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// === Constants ===
const BETTING_DURATION = 7;
const CRASHED_DURATION = 3;
const BOT_COUNT = 8;

export default class CrashServer implements Party.Server {
  players = new Map<string, Player>();
  spectators = new Set<string>();
  bots: BotProfile[] = [];
  botTimers: ReturnType<typeof setTimeout>[] = [];
  state: RoundState;
  bettingTimer: ReturnType<typeof setInterval> | null = null;
  crashTimer: ReturnType<typeof setTimeout> | null = null;
  restartTimer: ReturnType<typeof setTimeout> | null = null;
  roomPassword: string | null = null;
  hostId: string | null = null;

  constructor(readonly room: Party.Room) {
    this.state = {
      phase: "waiting",
      roundNumber: 0,
      crashPoint: 0,
      flyingStartTime: 0,
      bettingTimeLeft: BETTING_DURATION,
      bets: [],
      history: [],
    };
    this.initBots();
  }

  private initBots() {
    const usedNames = new Set<string>();
    for (let i = 0; i < BOT_COUNT; i++) {
      let name: string;
      do { name = pick(BOT_NAMES); } while (usedNames.has(name));
      usedNames.add(name);

      const strategies: Array<{ betRange: [number, number]; targetMult: [number, number]; betChance: number }> = [
        { betRange: [50, 300], targetMult: [1.2, 1.8], betChance: 0.9 },
        { betRange: [100, 1000], targetMult: [1.5, 3.0], betChance: 0.85 },
        { betRange: [500, 3000], targetMult: [2.5, 8.0], betChance: 0.7 },
        { betRange: [1000, 10000], targetMult: [5.0, 50.0], betChance: 0.4 },
        { betRange: [50, 5000], targetMult: [1.1, 20.0], betChance: 0.7 },
      ];
      const strat = pick(strategies);

      this.bots.push({
        player: {
          id: `bot_${i}`,
          name,
          avatar: BOT_AVATARS[i % BOT_AVATARS.length],
          isBot: true,
        },
        ...strat,
      });
    }
  }

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "state", state: this.sanitizeState() }));
    conn.send(JSON.stringify({
      type: "players",
      players: [
        ...Array.from(this.players.values()),
        ...this.bots.map((b) => b.player),
      ],
    }));
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
    if (player) {
      this.players.delete(conn.id);
      this.broadcast({ type: "player_left", playerId: conn.id, playerName: player.name });
      this.broadcastPlayers();
    }
    if (this.players.size === 0) {
      this.stopAllTimers();
      this.state.phase = "waiting";
      this.roomPassword = null;
      this.hostId = null;
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    let data: Record<string, unknown>;
    try { data = JSON.parse(message); } catch { return; }

    switch (data.type) {
      case "join": this.handleJoin(sender, data); break;
      case "bet": this.handleBet(sender, data); break;
      case "cashout": this.handleCashout(sender); break;
      case "chat": this.handleChat(sender, data); break;
      case "reaction": {
        const p = this.players.get(sender.id);
        if (!p) break;
        const emoji = String(data.emoji || "").slice(0, 4);
        if (emoji) this.broadcast({ type: "reaction", playerId: sender.id, playerName: p.name, emoji });
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
    const player: Player = {
      id: conn.id,
      name: (data.name as string) || "Anon",
      avatar: (data.avatar as string) || "🎮",
    };
    this.players.set(conn.id, player);
    if (data.spectate) {
      this.spectators.add(conn.id);
      conn.send(JSON.stringify({ type: "joined_as_spectator" }));
      conn.send(JSON.stringify({ type: "state", state: this.sanitizeState() }));
      this.broadcast({ type: "spectator_count", count: this.spectators.size });
      this.broadcastPlayers();
      return;
    }
    if (!this.hostId) this.hostId = conn.id;
    this.broadcast({ type: "player_joined", player });
    this.broadcastPlayers();

    if (this.state.phase === "waiting" && this.players.size >= 1) {
      this.startBetting();
    }
  }

  private handleBet(conn: Party.Connection, data: Record<string, unknown>) {
    if (this.spectators.has(conn.id)) return;
    if (this.state.phase !== "betting") return;
    const player = this.players.get(conn.id);
    if (!player) return;
    if (this.state.bets.find((b) => b.player.id === conn.id)) return;

    const amount = Math.max(10, Math.floor(Number(data.amount) || 100));
    this.addBet(player, amount);
  }

  private handleCashout(conn: Party.Connection) {
    if (this.spectators.has(conn.id)) return;
    if (this.state.phase !== "flying") return;
    const bet = this.state.bets.find((b) => b.player.id === conn.id);
    if (!bet || bet.cashedOut) return;

    const elapsed = (Date.now() - this.state.flyingStartTime) / 1000;
    const multiplier = Math.pow(Math.E, 0.08 * elapsed);
    if (multiplier >= this.state.crashPoint) return;

    this.doCashout(bet, multiplier);
  }

  private handleChat(conn: Party.Connection, data: Record<string, unknown>) {
    const player = this.players.get(conn.id);
    if (!player) return;
    const text = String(data.text || "").slice(0, 100);
    if (!text) return;
    this.broadcast({ type: "chat", playerId: conn.id, playerName: player.name, avatar: player.avatar, text });
  }

  // === Shared Actions ===

  private addBet(player: Player, amount: number) {
    const bet: PlayerBet = {
      player, amount, cashedOut: false, cashoutMultiplier: null, profit: -amount,
    };
    this.state.bets.push(bet);
    this.broadcast({
      type: "bet_placed", playerId: player.id, playerName: player.name,
      avatar: player.avatar, amount, isBot: !!player.isBot,
    });
    this.broadcastState();
  }

  private doCashout(bet: PlayerBet, multiplier: number) {
    bet.cashedOut = true;
    bet.cashoutMultiplier = parseFloat(multiplier.toFixed(2));
    bet.profit = Math.floor(bet.amount * multiplier);
    this.broadcast({
      type: "player_cashout", playerId: bet.player.id, playerName: bet.player.name,
      avatar: bet.player.avatar, multiplier: bet.cashoutMultiplier, profit: bet.profit,
    });
    this.broadcastState();
  }

  // === Bot Logic ===

  private scheduleBotBets() {
    for (const bot of this.bots) {
      if (Math.random() > bot.betChance) continue;
      const delay = randInt(500, 5000);
      const t = setTimeout(() => {
        if (this.state.phase !== "betting") return;
        if (this.state.bets.find((b) => b.player.id === bot.player.id)) return;
        const amount = randInt(bot.betRange[0], bot.betRange[1]);
        this.addBet(bot.player, amount);
      }, delay);
      this.botTimers.push(t);
    }
  }

  private scheduleBotCashouts() {
    for (const bot of this.bots) {
      const bet = this.state.bets.find((b) => b.player.id === bot.player.id);
      if (!bet) continue;
      const target = bot.targetMult[0] + Math.random() * (bot.targetMult[1] - bot.targetMult[0]);
      const jittered = target * (0.85 + Math.random() * 0.3);
      // Time when multiplier hits target: t = ln(target) / 0.08
      const cashoutTime = Math.log(jittered) / 0.08 * 1000;

      const t = setTimeout(() => {
        if (this.state.phase !== "flying") return;
        if (bet.cashedOut) return;
        const elapsed = (Date.now() - this.state.flyingStartTime) / 1000;
        const mult = Math.pow(Math.E, 0.08 * elapsed);
        if (mult >= this.state.crashPoint) return;
        this.doCashout(bet, mult);

        // Bot chat on cashout
        if (Math.random() < 0.3) {
          setTimeout(() => {
            this.broadcast({
              type: "chat", playerId: bot.player.id, playerName: bot.player.name,
              avatar: bot.player.avatar, text: pick(BOT_CHAT_CASHOUT),
            });
          }, randInt(200, 800));
        }
      }, cashoutTime);
      this.botTimers.push(t);
    }
  }

  private scheduleBotChat(pool: string[], count: number) {
    for (let i = 0; i < count; i++) {
      const delay = randInt(500, 4000);
      const t = setTimeout(() => {
        const bot = pick(this.bots);
        this.broadcast({
          type: "chat", playerId: bot.player.id, playerName: bot.player.name,
          avatar: bot.player.avatar, text: pick(pool),
        });
      }, delay);
      this.botTimers.push(t);
    }
  }

  private clearBotTimers() {
    this.botTimers.forEach((t) => clearTimeout(t));
    this.botTimers = [];
  }

  // === Game Loop ===

  private startBetting() {
    this.clearBotTimers();
    this.state.roundNumber++;
    this.state.phase = "betting";
    this.state.bettingTimeLeft = BETTING_DURATION;
    this.state.bets = [];
    this.state.crashPoint = 0;
    this.state.flyingStartTime = 0;

    this.broadcastState();
    this.scheduleBotBets();
    this.scheduleBotChat(BOT_CHAT_BETTING, 2);

    let remaining = BETTING_DURATION;
    this.bettingTimer = setInterval(() => {
      remaining--;
      this.state.bettingTimeLeft = Math.max(0, remaining);
      this.broadcast({ type: "countdown", remaining });
      if (remaining <= 0) {
        this.clearBettingTimer();
        this.startFlying();
      }
    }, 1000);
  }

  private startFlying() {
    this.clearBotTimers();
    const r = Math.random();
    const crash = Math.max(1.0, (1 / (1 - r)) * 0.97);
    this.state.crashPoint = Math.min(crash, 100);
    this.state.phase = "flying";
    this.state.flyingStartTime = Date.now();

    this.broadcastState();
    this.scheduleBotCashouts();
    this.scheduleBotChat(BOT_CHAT_FLYING, 2);

    const crashTimeMs = (Math.log(this.state.crashPoint) / 0.08) * 1000;
    this.crashTimer = setTimeout(() => this.doCrash(), crashTimeMs);
  }

  private doCrash() {
    this.clearBotTimers();
    this.state.phase = "crashed";

    for (const bet of this.state.bets) {
      if (!bet.cashedOut) bet.profit = -bet.amount;
    }

    this.state.history = [
      { crashPoint: parseFloat(this.state.crashPoint.toFixed(2)), roundNumber: this.state.roundNumber },
      ...this.state.history.slice(0, 19),
    ];

    this.broadcast({
      type: "crashed",
      crashPoint: parseFloat(this.state.crashPoint.toFixed(2)),
      results: this.state.bets.map((b) => ({
        playerId: b.player.id, playerName: b.player.name,
        profit: b.profit, cashedOut: b.cashedOut, cashoutMultiplier: b.cashoutMultiplier,
      })),
    });
    this.broadcastState();
    this.scheduleBotChat(BOT_CHAT_CRASHED, 1);

    this.restartTimer = setTimeout(() => {
      if (this.players.size > 0) this.startBetting();
      else this.state.phase = "waiting";
    }, CRASHED_DURATION * 1000);
  }

  // === Helpers ===

  private broadcast(data: Record<string, unknown>) {
    const msg = JSON.stringify(data);
    for (const conn of this.room.getConnections()) conn.send(msg);
  }

  private broadcastState() {
    this.broadcast({ type: "state", state: this.sanitizeState() });
  }

  private broadcastPlayers() {
    this.broadcast({
      type: "players",
      players: [
        ...Array.from(this.players.values()),
        ...this.bots.map((b) => b.player),
      ],
    });
  }

  private sanitizeState() {
    return {
      ...this.state,
      crashPoint: this.state.phase === "crashed" ? parseFloat(this.state.crashPoint.toFixed(2)) : 0,
    };
  }

  private clearBettingTimer() {
    if (this.bettingTimer) { clearInterval(this.bettingTimer); this.bettingTimer = null; }
  }

  private stopAllTimers() {
    this.clearBettingTimer();
    this.clearBotTimers();
    if (this.crashTimer) { clearTimeout(this.crashTimer); this.crashTimer = null; }
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
  }
}
