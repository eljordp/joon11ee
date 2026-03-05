import type { ChatMessage, MultiplayerPlayer } from './types';

export type GameEvent = {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  playerId?: string;
};

type EventCallback = (event: GameEvent) => void;
type ChatCallback = (msg: ChatMessage) => void;

export class LocalTransport {
  private eventListeners = new Set<EventCallback>();
  private chatListeners = new Set<ChatCallback>();
  private connected = false;

  connect(_roomId: string, _player: MultiplayerPlayer): void {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
    this.eventListeners.clear();
    this.chatListeners.clear();
  }

  send(event: GameEvent): void {
    if (!this.connected) return;
    this.emit(event);
  }

  onEvent(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => { this.eventListeners.delete(callback); };
  }

  onChatMessage(callback: ChatCallback): () => void {
    this.chatListeners.add(callback);
    return () => { this.chatListeners.delete(callback); };
  }

  emit(event: GameEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  emitChat(msg: ChatMessage): void {
    this.chatListeners.forEach((cb) => cb(msg));
  }

  isConnected(): boolean {
    return this.connected;
  }
}
