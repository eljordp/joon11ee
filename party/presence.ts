import type * as Party from "partykit/server";

interface PresenceInfo {
  username: string;
  game?: string;
  room?: string;
  lastSeen: number;
}

export default class PresenceServer implements Party.Server {
  presenceMap = new Map<string, PresenceInfo>();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    const users: Record<string, PresenceInfo> = {};
    for (const [id, info] of this.presenceMap) {
      users[id] = info;
    }
    conn.send(JSON.stringify({ type: "presence", users }));
  }

  onClose(conn: Party.Connection) {
    const info = this.presenceMap.get(conn.id);
    this.presenceMap.delete(conn.id);
    if (info) {
      this.broadcast({ type: "presence_left", connId: conn.id, username: info.username });
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    let data: Record<string, unknown>;
    try { data = JSON.parse(message as string); } catch { return; }

    if (data.type === "heartbeat") {
      const info: PresenceInfo = {
        username: String(data.username || ""),
        game: data.game ? String(data.game) : undefined,
        room: data.room ? String(data.room) : undefined,
        lastSeen: Date.now(),
      };
      if (!info.username) return;
      this.presenceMap.set(sender.id, info);
      this.broadcast({ type: "presence_update", connId: sender.id, info });
    }
  }

  private broadcast(data: Record<string, unknown>) {
    const msg = JSON.stringify(data);
    for (const conn of this.room.getConnections()) conn.send(msg);
  }
}
