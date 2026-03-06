import type * as Party from "partykit/server";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isBot?: boolean;
}

interface CrapsBet {
  type: 'pass' | 'dont_pass' | 'field' | 'place';
  amount: number;
  placeNumber?: number;
}

interface PlayerBets {
  playerId: string;
  playerName: string;
  bets: CrapsBet[];
}

interface CrapsState {
  phase: 'waiting' | 'betting' | 'rolling' | 'point_betting' | 'point_rolling' | 'results';
  shooterId: string | null;
  shooterOrder: string[];
  point: number | null;
  dice: [number, number];
  diceTotal: number;
  bettingTimeLeft: number;
  roundNumber: number;
  rollHistory: { dice: [number, number]; total: number }[];
  results: { playerId: string; playerName: string; profit: number }[];
}

const BETTING_DURATION = 6;
const RESULTS_DURATION = 3;
const AUTO_ROLL_DELAY = 2000;
const PLACE_ODDS: Record<number, [number, number]> = {
  4: [9, 5], 5: [7, 5], 6: [7, 6], 8: [7, 6], 9: [7, 5], 10: [9, 5],
};

const BOT_NAMES = [
  { name: 'Lucky Lou', avatar: '🎰' },
  { name: 'Snake Eyes', avatar: '🐍' },
  { name: 'Big Mike', avatar: '💪' },
];

const BOT_BET_AMOUNTS = [50, 100, 100, 200, 200, 500];

export default class CrapsServer implements Party.Server {
  players = new Map<string, Player>();
  playerBets = new Map<string, CrapsBet[]>();
  state: CrapsState;
  bettingTimer: ReturnType<typeof setInterval> | null = null;
  timers: ReturnType<typeof setTimeout>[] = [];
  autoRollTimer: ReturnType<typeof setTimeout> | null = null;
  botsSpawned = false;

  constructor(readonly room: Party.Room) {
    this.state = {
      phase: 'waiting', shooterId: null, shooterOrder: [],
      point: null, dice: [0, 0], diceTotal: 0,
      bettingTimeLeft: 0, roundNumber: 0, rollHistory: [], results: [],
    };
  }

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: 'state', state: this.getState() }));
    conn.send(JSON.stringify({ type: 'players', players: [...this.players.values()] }));
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    // Don't remove bots when a real player disconnects
    if (player?.isBot) return;

    this.players.delete(conn.id);
    this.playerBets.delete(conn.id);
    this.state.shooterOrder = this.state.shooterOrder.filter(id => id !== conn.id);
    if (this.state.shooterId === conn.id) {
      this.state.shooterId = this.state.shooterOrder[0] || null;
    }
    if (player) {
      this.broadcast({ type: 'player_left', playerId: conn.id, playerName: player.name });
      this.broadcastPlayers();
    }

    // Check if any real players left
    const realPlayers = [...this.players.values()].filter(p => !p.isBot);
    if (realPlayers.length === 0) {
      this.stopAllTimers();
      this.state.phase = 'waiting';
      // Remove bots too
      this.removeBots();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'join': this.handleJoin(sender, data); break;
      case 'bet': this.handleBet(sender, data); break;
      case 'roll': this.handleRoll(sender); break;
      case 'skip': this.handleSkip(sender); break;
      case 'chat': this.handleChat(sender, data); break;
    }
  }

  private handleJoin(conn: Party.Connection, data: Record<string, unknown>) {
    const player: Player = { id: conn.id, name: (data.name as string) || 'Anon', avatar: (data.avatar as string) || '🎮' };
    this.players.set(conn.id, player);
    if (!this.state.shooterOrder.includes(conn.id)) this.state.shooterOrder.push(conn.id);
    this.broadcast({ type: 'player_joined', player });

    // Spawn bots when first real player joins
    if (!this.botsSpawned) {
      this.spawnBots();
    }

    this.broadcastPlayers();
    if (this.state.phase === 'waiting' && this.players.size >= 1) this.startBetting();
  }

  private handleBet(conn: Party.Connection, data: Record<string, unknown>) {
    if (this.state.phase !== 'betting' && this.state.phase !== 'point_betting') return;
    const betType = data.betType as string;
    const amount = data.amount as number;
    if (!amount || amount <= 0) return;

    const validTypes = ['pass', 'dont_pass', 'field', 'place'];
    if (!validTypes.includes(betType)) return;

    if (betType === 'place' && this.state.phase !== 'point_betting' && this.state.point === null) return;
    const placeNumber = data.placeNumber as number | undefined;
    if (betType === 'place' && (!placeNumber || ![4, 5, 6, 8, 9, 10].includes(placeNumber))) return;
    if (this.state.phase === 'betting' && betType === 'place') return;

    const bets = this.playerBets.get(conn.id) || [];
    bets.push({ type: betType as CrapsBet['type'], amount, placeNumber });
    this.playerBets.set(conn.id, bets);

    const player = this.players.get(conn.id);
    this.broadcast({ type: 'bet_placed', playerId: conn.id, playerName: player?.name || 'Anon', betType, amount, placeNumber });
    this.broadcastState();
  }

  private handleRoll(conn: Party.Connection) {
    if (this.state.phase !== 'rolling' && this.state.phase !== 'point_rolling') return;
    if (conn.id !== this.state.shooterId) return;
    this.clearAutoRoll();
    this.rollDice();
  }

  private handleSkip(conn: Party.Connection) {
    // Only allow skip during betting phases
    if (this.state.phase !== 'betting' && this.state.phase !== 'point_betting') return;
    // Only the player can skip (not bots)
    const player = this.players.get(conn.id);
    if (!player || player.isBot) return;
    // Skip the timer
    this.clearBettingTimer();
    if (this.state.phase === 'betting') {
      this.state.phase = 'rolling';
    } else {
      this.state.phase = 'point_rolling';
    }
    this.state.bettingTimeLeft = 0;
    this.broadcastState();
    this.scheduleAutoRoll();
  }

  private handleChat(conn: Party.Connection, data: Record<string, unknown>) {
    const player = this.players.get(conn.id);
    if (!player) return;
    const text = String(data.text || '').slice(0, 100);
    if (!text) return;
    this.broadcast({ type: 'chat', playerId: conn.id, playerName: player.name, avatar: player.avatar, text });
  }

  // === BOTS ===

  private spawnBots() {
    this.botsSpawned = true;
    const numBots = 2 + Math.floor(Math.random() * 2); // 2-3 bots
    for (let i = 0; i < numBots && i < BOT_NAMES.length; i++) {
      const botId = `bot_${i}_${Date.now()}`;
      const bot: Player = {
        id: botId,
        name: BOT_NAMES[i].name,
        avatar: BOT_NAMES[i].avatar,
        isBot: true,
      };
      this.players.set(botId, bot);
      // Don't add bots to shooter order - only real players shoot
      this.broadcast({ type: 'player_joined', player: bot });
    }
  }

  private removeBots() {
    for (const [id, player] of this.players) {
      if (player.isBot) {
        this.players.delete(id);
        this.playerBets.delete(id);
      }
    }
    this.botsSpawned = false;
  }

  private botsBet() {
    const bots = [...this.players.values()].filter(p => p.isBot);
    for (const bot of bots) {
      // Random delay for each bot (staggered, feels natural)
      const delay = 500 + Math.random() * 2000;
      const t = setTimeout(() => {
        if (this.state.phase !== 'betting' && this.state.phase !== 'point_betting') return;
        const amount = BOT_BET_AMOUNTS[Math.floor(Math.random() * BOT_BET_AMOUNTS.length)];

        if (this.state.phase === 'betting') {
          // Come-out: pass, dont_pass, or field
          const roll = Math.random();
          let betType: string;
          if (roll < 0.55) betType = 'pass';
          else if (roll < 0.75) betType = 'dont_pass';
          else betType = 'field';

          const bets = this.playerBets.get(bot.id) || [];
          bets.push({ type: betType as CrapsBet['type'], amount });
          this.playerBets.set(bot.id, bets);
          this.broadcast({ type: 'bet_placed', playerId: bot.id, playerName: bot.name, betType, amount });
        } else if (this.state.phase === 'point_betting') {
          // Point phase: field or place bets
          const roll = Math.random();
          if (roll < 0.4) {
            const bets = this.playerBets.get(bot.id) || [];
            bets.push({ type: 'field', amount });
            this.playerBets.set(bot.id, bets);
            this.broadcast({ type: 'bet_placed', playerId: bot.id, playerName: bot.name, betType: 'field', amount });
          } else {
            const placeNums = [4, 5, 6, 8, 9, 10].filter(n => n !== this.state.point);
            const placeNumber = placeNums[Math.floor(Math.random() * placeNums.length)];
            const bets = this.playerBets.get(bot.id) || [];
            bets.push({ type: 'place', amount, placeNumber });
            this.playerBets.set(bot.id, bets);
            this.broadcast({ type: 'bet_placed', playerId: bot.id, playerName: bot.name, betType: 'place', amount, placeNumber });
          }
        }
        this.broadcastState();
      }, delay);
      this.timers.push(t);
    }
  }

  // === GAME FLOW ===

  private startBetting() {
    this.state.phase = 'betting';
    this.state.roundNumber++;
    this.state.point = null;
    this.state.results = [];
    this.playerBets.clear();
    if (!this.state.shooterId && this.state.shooterOrder.length > 0) {
      this.state.shooterId = this.state.shooterOrder[0];
    }
    let remaining = BETTING_DURATION;
    this.state.bettingTimeLeft = remaining;
    this.broadcastState();

    // Bots place bets
    this.botsBet();

    this.bettingTimer = setInterval(() => {
      remaining--;
      this.state.bettingTimeLeft = Math.max(0, remaining);
      this.broadcast({ type: 'countdown', remaining });
      if (remaining <= 0) {
        this.clearBettingTimer();
        this.state.phase = 'rolling';
        this.broadcastState();
        this.scheduleAutoRoll();
      }
    }, 1000);
  }

  private startPointBetting() {
    this.state.phase = 'point_betting';
    let remaining = BETTING_DURATION;
    this.state.bettingTimeLeft = remaining;
    this.broadcastState();

    // Bots place point bets (some will, some won't)
    if (Math.random() > 0.3) this.botsBet();

    this.bettingTimer = setInterval(() => {
      remaining--;
      this.state.bettingTimeLeft = Math.max(0, remaining);
      this.broadcast({ type: 'countdown', remaining });
      if (remaining <= 0) {
        this.clearBettingTimer();
        this.state.phase = 'point_rolling';
        this.broadcastState();
        this.scheduleAutoRoll();
      }
    }, 1000);
  }

  private scheduleAutoRoll() {
    this.clearAutoRoll();
    this.autoRollTimer = setTimeout(() => {
      if (this.state.phase === 'rolling' || this.state.phase === 'point_rolling') {
        this.rollDice();
      }
    }, AUTO_ROLL_DELAY);
  }

  private clearAutoRoll() {
    if (this.autoRollTimer) { clearTimeout(this.autoRollTimer); this.autoRollTimer = null; }
  }

  private rollDice() {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;
    this.state.dice = [d1, d2];
    this.state.diceTotal = total;
    this.state.rollHistory.unshift({ dice: [d1, d2], total });
    if (this.state.rollHistory.length > 20) this.state.rollHistory.pop();
    this.broadcast({ type: 'dice_roll', dice: [d1, d2], total });

    if (this.state.point === null) {
      this.resolveComeOut(total);
    } else {
      this.resolvePointRoll(total);
    }
  }

  private resolveComeOut(total: number) {
    if (total === 7 || total === 11) {
      this.resolveRound('pass_wins');
    } else if (total === 2 || total === 3) {
      this.resolveRound('pass_loses');
    } else if (total === 12) {
      this.resolveRound('pass_loses_dp_push');
    } else {
      this.state.point = total;
      this.broadcast({ type: 'point_set', point: total });
      this.resolveFieldBets(total);
      this.startPointBetting();
    }
  }

  private resolvePointRoll(total: number) {
    if (total === this.state.point) {
      this.resolveRound('point_hit');
    } else if (total === 7) {
      this.resolveRound('seven_out');
    } else {
      this.resolveFieldBets(total);
      this.resolvePlaceBets(total);
      this.broadcastState();
      this.startPointBetting();
    }
  }

  private resolveFieldBets(total: number) {
    const fieldWins = [2, 3, 4, 9, 10, 11, 12].includes(total);
    const doubleField = total === 2 || total === 12;
    for (const [pid, bets] of this.playerBets) {
      const newBets: CrapsBet[] = [];
      for (const bet of bets) {
        if (bet.type === 'field') {
          const player = this.players.get(pid);
          const pname = player?.name || 'Anon';
          if (fieldWins) {
            const profit = doubleField ? bet.amount * 2 : bet.amount;
            this.addResult(pid, pname, profit);
          } else {
            this.addResult(pid, pname, -bet.amount);
          }
        } else {
          newBets.push(bet);
        }
      }
      this.playerBets.set(pid, newBets);
    }
  }

  private resolvePlaceBets(total: number) {
    for (const [pid, bets] of this.playerBets) {
      const newBets: CrapsBet[] = [];
      for (const bet of bets) {
        if (bet.type === 'place' && bet.placeNumber === total) {
          const player = this.players.get(pid);
          const odds = PLACE_ODDS[total];
          const profit = Math.floor(bet.amount * odds[0] / odds[1]);
          this.addResult(pid, player?.name || 'Anon', profit);
          newBets.push(bet);
        } else {
          newBets.push(bet);
        }
      }
      this.playerBets.set(pid, newBets);
    }
  }

  private resolveRound(outcome: string) {
    for (const [pid, bets] of this.playerBets) {
      const player = this.players.get(pid);
      const pname = player?.name || 'Anon';
      for (const bet of bets) {
        if (bet.type === 'pass') {
          if (outcome === 'pass_wins' || outcome === 'point_hit') this.addResult(pid, pname, bet.amount);
          else this.addResult(pid, pname, -bet.amount);
        } else if (bet.type === 'dont_pass') {
          if (outcome === 'pass_loses' || outcome === 'seven_out') this.addResult(pid, pname, bet.amount);
          else if (outcome === 'pass_loses_dp_push') { /* push */ }
          else this.addResult(pid, pname, -bet.amount);
        } else if (bet.type === 'field') {
          // Already resolved per-roll
        } else if (bet.type === 'place') {
          if (outcome === 'seven_out') this.addResult(pid, pname, -bet.amount);
        }
      }
    }

    const total = this.state.diceTotal;
    this.resolveFieldBets(total);

    if (outcome === 'seven_out') {
      // Rotate shooter (only among real players)
      const realShooters = this.state.shooterOrder.filter(id => {
        const p = this.players.get(id);
        return p && !p.isBot;
      });
      if (realShooters.length > 0) {
        const idx = realShooters.indexOf(this.state.shooterId!);
        const nextIdx = (idx + 1) % realShooters.length;
        this.state.shooterId = realShooters[nextIdx];
      }
      const newShooter = this.players.get(this.state.shooterId!);
      this.broadcast({ type: 'shooter_change', newShooterId: this.state.shooterId, newShooterName: newShooter?.name || 'Anon' });
    }

    this.state.phase = 'results';
    this.broadcast({ type: 'round_result', results: this.state.results });
    this.broadcastState();

    const t = setTimeout(() => {
      const realPlayers = [...this.players.values()].filter(p => !p.isBot);
      if (realPlayers.length > 0) this.startBetting();
      else {
        this.state.phase = 'waiting';
        this.removeBots();
      }
    }, RESULTS_DURATION * 1000);
    this.timers.push(t);
  }

  private addResult(playerId: string, playerName: string, profit: number) {
    const existing = this.state.results.find(r => r.playerId === playerId);
    if (existing) existing.profit += profit;
    else this.state.results.push({ playerId, playerName, profit });
  }

  private getState() {
    const bets: PlayerBets[] = [];
    for (const [pid, b] of this.playerBets) {
      const player = this.players.get(pid);
      bets.push({ playerId: pid, playerName: player?.name || 'Anon', bets: b });
    }
    return { ...this.state, playerBets: bets };
  }

  private broadcast(data: Record<string, unknown>) {
    const msg = JSON.stringify(data);
    for (const conn of this.room.getConnections()) conn.send(msg);
  }

  private broadcastState() {
    this.broadcast({ type: 'state', state: this.getState() });
  }

  private broadcastPlayers() {
    this.broadcast({ type: 'players', players: [...this.players.values()] });
  }

  private clearBettingTimer() {
    if (this.bettingTimer) { clearInterval(this.bettingTimer); this.bettingTimer = null; }
  }

  private stopAllTimers() {
    this.clearBettingTimer();
    this.clearAutoRoll();
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }
}
