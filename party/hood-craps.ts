import type * as Party from "partykit/server";

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface HoodBet {
  type: 'seven' | 'ten' | 'over' | 'under' | 'doubles';
  amount: number;
}

interface PlayerBets {
  playerId: string;
  playerName: string;
  bets: HoodBet[];
}

interface HoodCrapsState {
  phase: 'waiting' | 'betting' | 'rolling' | 'results';
  shooterId: string | null;
  shooterOrder: string[];
  dice: [number, number];
  diceTotal: number;
  bettingTimeLeft: number;
  roundNumber: number;
  rollHistory: { dice: [number, number]; total: number; doubles: boolean }[];
  results: { playerId: string; playerName: string; profit: number }[];
  streak: { type: string; count: number };
}

// Payouts: bet $100, win = bet * multiplier (includes original back)
const PAYOUTS: Record<HoodBet['type'], number> = {
  seven: 5,    // 6/36 chance = 16.7%
  ten: 10,     // 3/36 chance = 8.3%
  over: 2,     // 15/36 chance = 41.7% (8-12)
  under: 2,    // 15/36 chance = 41.7% (2-6)
  doubles: 5,  // 6/36 chance = 16.7%
};

const BETTING_DURATION = 8;
const RESULTS_DURATION = 3;

export default class HoodCrapsServer implements Party.Server {
  players = new Map<string, Player>();
  playerBets = new Map<string, HoodBet[]>();
  state: HoodCrapsState;
  bettingTimer: ReturnType<typeof setInterval> | null = null;
  timers: ReturnType<typeof setTimeout>[] = [];
  roomPassword: string | null = null;
  hostId: string | null = null;

  constructor(readonly room: Party.Room) {
    this.state = {
      phase: 'waiting', shooterId: null, shooterOrder: [],
      dice: [0, 0], diceTotal: 0,
      bettingTimeLeft: 0, roundNumber: 0, rollHistory: [], results: [],
      streak: { type: '', count: 0 },
    };
  }

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: 'state', state: this.getState() }));
    conn.send(JSON.stringify({ type: 'players', players: [...this.players.values()] }));
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
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
    if (this.players.size === 0) {
      this.stopAllTimers();
      this.state.phase = 'waiting';
      this.roomPassword = null;
      this.hostId = null;
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'join': this.handleJoin(sender, data); break;
      case 'bet': this.handleBet(sender, data); break;
      case 'roll': this.handleRoll(sender); break;
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
    const player: Player = { id: conn.id, name: (data.name as string) || 'Anon', avatar: (data.avatar as string) || '🎲' };
    this.players.set(conn.id, player);
    if (!this.hostId) this.hostId = conn.id;
    if (!this.state.shooterOrder.includes(conn.id)) this.state.shooterOrder.push(conn.id);
    this.broadcast({ type: 'player_joined', player });
    this.broadcastPlayers();
    if (this.state.phase === 'waiting' && this.players.size >= 1) this.startBetting();
  }

  private handleBet(conn: Party.Connection, data: Record<string, unknown>) {
    if (this.state.phase !== 'betting') return;
    const betType = data.betType as string;
    const amount = data.amount as number;
    if (!amount || amount <= 0) return;

    const validTypes = ['seven', 'ten', 'over', 'under', 'doubles'];
    if (!validTypes.includes(betType)) return;

    const bets = this.playerBets.get(conn.id) || [];
    bets.push({ type: betType as HoodBet['type'], amount });
    this.playerBets.set(conn.id, bets);

    const player = this.players.get(conn.id);
    this.broadcast({ type: 'bet_placed', playerId: conn.id, playerName: player?.name || 'Anon', betType, amount });
    this.broadcastState();
  }

  private handleRoll(conn: Party.Connection) {
    if (this.state.phase !== 'rolling') return;
    if (conn.id !== this.state.shooterId) return;
    this.rollDice();
  }

  private handleChat(conn: Party.Connection, data: Record<string, unknown>) {
    const player = this.players.get(conn.id);
    if (!player) return;
    const text = String(data.text || '').slice(0, 100);
    if (!text) return;
    this.broadcast({ type: 'chat', playerId: conn.id, playerName: player.name, avatar: player.avatar, text });
  }

  private startBetting() {
    this.state.phase = 'betting';
    this.state.roundNumber++;
    this.state.results = [];
    this.playerBets.clear();
    if (!this.state.shooterId && this.state.shooterOrder.length > 0) {
      this.state.shooterId = this.state.shooterOrder[0];
    }
    let remaining = BETTING_DURATION;
    this.state.bettingTimeLeft = remaining;
    this.broadcastState();
    this.bettingTimer = setInterval(() => {
      remaining--;
      this.state.bettingTimeLeft = Math.max(0, remaining);
      this.broadcast({ type: 'countdown', remaining });
      if (remaining <= 0) {
        this.clearBettingTimer();
        this.state.phase = 'rolling';
        this.broadcastState();
      }
    }, 1000);
  }

  private rollDice() {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;
    const doubles = d1 === d2;
    this.state.dice = [d1, d2];
    this.state.diceTotal = total;
    this.state.rollHistory.unshift({ dice: [d1, d2], total, doubles });
    if (this.state.rollHistory.length > 20) this.state.rollHistory.pop();

    // Track streaks
    const hitType = total === 7 ? 'seven' : total === 10 ? 'ten' : total > 7 ? 'over' : 'under';
    if (this.state.streak.type === hitType) {
      this.state.streak.count++;
    } else {
      this.state.streak = { type: hitType, count: 1 };
    }

    this.broadcast({ type: 'dice_roll', dice: [d1, d2], total, doubles });
    this.resolveRound(total, doubles);
  }

  private resolveRound(total: number, doubles: boolean) {
    for (const [pid, bets] of this.playerBets) {
      const player = this.players.get(pid);
      const pname = player?.name || 'Anon';
      for (const bet of bets) {
        let won = false;
        if (bet.type === 'seven' && total === 7) won = true;
        else if (bet.type === 'ten' && total === 10) won = true;
        else if (bet.type === 'over' && total > 7) won = true;
        else if (bet.type === 'under' && total < 7) won = true;
        else if (bet.type === 'doubles' && doubles) won = true;

        if (won) {
          const profit = bet.amount * (PAYOUTS[bet.type] - 1);
          this.addResult(pid, pname, profit);
        } else {
          this.addResult(pid, pname, -bet.amount);
        }
      }
    }

    // Rotate shooter every round
    const idx = this.state.shooterOrder.indexOf(this.state.shooterId!);
    const nextIdx = (idx + 1) % this.state.shooterOrder.length;
    this.state.shooterId = this.state.shooterOrder[nextIdx];
    const newShooter = this.players.get(this.state.shooterId);
    this.broadcast({ type: 'shooter_change', newShooterId: this.state.shooterId, newShooterName: newShooter?.name || 'Anon' });

    this.state.phase = 'results';
    this.broadcast({ type: 'round_result', results: this.state.results });
    this.broadcastState();

    const t = setTimeout(() => {
      if (this.players.size > 0) this.startBetting();
      else this.state.phase = 'waiting';
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
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }
}
