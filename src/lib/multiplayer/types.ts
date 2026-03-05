import type { Card } from '@/lib/casino';

// === Player Types ===
export type PlayerType = 'human' | 'bot';

export interface MultiplayerPlayer {
  id: string;
  name: string;
  avatar: string;
  type: PlayerType;
  balance: number;
}

// === Chat Types ===
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  avatar: string;
  text: string;
  timestamp: number;
  type: 'chat' | 'system' | 'win' | 'cashout';
}

// === Crash Types ===
export type CrashPhase = 'betting' | 'flying' | 'crashed';

export interface CrashPlayerState {
  player: MultiplayerPlayer;
  bet: number;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  profit: number;
}

export interface CrashRoundState {
  phase: CrashPhase;
  crashPoint: number;
  currentMultiplier: number;
  bettingTimeLeft: number;
  playerStates: CrashPlayerState[];
  roundNumber: number;
  history: { crashPoint: number; roundNumber: number }[];
}

// === Blackjack Types ===
export type BlackjackPhase = 'betting' | 'dealing' | 'player_turns' | 'dealer_turn' | 'results';

export type SeatStatus = 'empty' | 'waiting' | 'betting' | 'playing' | 'stood' | 'busted' | 'blackjack' | 'done';

export interface BlackjackSeat {
  seatIndex: number;
  player: MultiplayerPlayer | null;
  bet: number;
  hand: Card[];
  handValue: number;
  status: SeatStatus;
  doubled: boolean;
  profit: number;
}

export interface BlackjackRoundState {
  phase: BlackjackPhase;
  seats: BlackjackSeat[];
  dealerHand: Card[];
  dealerHandValue: number;
  dealerRevealed: boolean;
  activeSeatIndex: number | null;
  turnTimeLeft: number;
  roundNumber: number;
  bettingTimeLeft: number;
}

// === Cashout Feed Entry ===
export interface CashoutEntry {
  id: string;
  playerName: string;
  avatar: string;
  multiplier: number;
  profit: number;
  timestamp: number;
}
