import type * as Party from "partykit/server";

interface LeaderboardEntry {
  player: string;
  game: string;
  amount: number;
  timestamp: number;
}

export default class LeaderboardServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onConnect(conn: Party.Connection) {
    const daily = await this.getDaily();
    const weekly = await this.getWeekly();
    const allTime = (await this.room.storage.get<LeaderboardEntry[]>("allTime")) || [];
    const jackpot = (await this.room.storage.get<number>("jackpot")) || 10000;
    conn.send(JSON.stringify({ type: "leaderboard", daily, weekly, allTime, jackpot }));
  }

  async onMessage(message: string) {
    let data: Record<string, unknown>;
    try { data = JSON.parse(message as string); } catch { return; }

    if (data.type === "report_win") {
      const entry: LeaderboardEntry = {
        player: String(data.player || ""),
        game: String(data.game || ""),
        amount: Number(data.amount || 0),
        timestamp: Date.now(),
      };
      if (!entry.player || entry.amount <= 0) return;

      // All-time
      const allTime = (await this.room.storage.get<LeaderboardEntry[]>("allTime")) || [];
      allTime.push(entry);
      allTime.sort((a, b) => b.amount - a.amount);
      await this.room.storage.put("allTime", allTime.slice(0, 20));

      // Daily (last 24h)
      const daily = await this.getDaily();
      daily.push(entry);
      daily.sort((a, b) => b.amount - a.amount);
      await this.room.storage.put("daily", daily.slice(0, 20));

      // Weekly (last 7d)
      const weekly = await this.getWeekly();
      weekly.push(entry);
      weekly.sort((a, b) => b.amount - a.amount);
      await this.room.storage.put("weekly", weekly.slice(0, 20));

      const jackpot = (await this.room.storage.get<number>("jackpot")) || 10000;
      this.broadcast({ type: "leaderboard", daily: daily.slice(0, 20), weekly: weekly.slice(0, 20), allTime: allTime.slice(0, 20), jackpot });
    }

    if (data.type === "jackpot_contribution") {
      const amount = Number(data.amount || 0);
      if (amount <= 0) return;
      const jackpot = ((await this.room.storage.get<number>("jackpot")) || 10000) + amount;
      await this.room.storage.put("jackpot", jackpot);
      this.broadcast({ type: "jackpot_update", jackpot });
    }

    if (data.type === "check_jackpot") {
      // 0.1% chance on any win
      if (Math.random() < 0.001) {
        const pool = (await this.room.storage.get<number>("jackpot")) || 10000;
        await this.room.storage.put("jackpot", 10000);
        this.broadcast({ type: "jackpot_won", player: String(data.player || ""), amount: pool });
      }
    }
  }

  private async getDaily(): Promise<LeaderboardEntry[]> {
    const raw = (await this.room.storage.get<LeaderboardEntry[]>("daily")) || [];
    return raw.filter(e => Date.now() - e.timestamp < 86400000);
  }

  private async getWeekly(): Promise<LeaderboardEntry[]> {
    const raw = (await this.room.storage.get<LeaderboardEntry[]>("weekly")) || [];
    return raw.filter(e => Date.now() - e.timestamp < 604800000);
  }

  private broadcast(data: Record<string, unknown>) {
    const msg = JSON.stringify(data);
    for (const conn of this.room.getConnections()) conn.send(msg);
  }
}
