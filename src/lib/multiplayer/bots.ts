import type { MultiplayerPlayer } from './types';

export const BOT_NAMES = [
  'xX_Degen_Xx', 'LuckyVibes', 'CryptoKid99', 'MoonBoy', 'DiamondHandz',
  'YOLOSwaggins', 'SatoshiJr', 'NightOwl42', 'HighRoller', 'BetMaster',
  'RocketMan', 'GoldDigger', 'TheWhale', 'SmallFish', 'JustHere4Fun',
  'NoRagrets', 'SendItBro', 'CashMeOut', 'AllInAndy', 'PaperHands',
  'ChipStacker', 'TableKing', 'QuietGrinder', 'BigBluff', 'EasyMoney',
  'HotStreak', 'ColdDeck', 'NitPicker', 'WildCard', 'StayCalm',
];

export const BOT_AVATARS = [
  '😎', '🤑', '🧠', '🔥', '💀', '👻', '🐺', '🦊', '🐻', '🦁',
  '🎭', '🤡', '👽', '🤖', '🥷', '🧙', '🎩', '🕶️', '💎', '🌙',
];

// === Crash Bot Profiles ===
export type CrashBotStrategy = 'conservative' | 'moderate' | 'aggressive' | 'yolo' | 'random';

export interface CrashBotProfile {
  strategy: CrashBotStrategy;
  betRange: [number, number];
  targetMultiplier: [number, number];
  betProbability: number;
}

export const CRASH_BOT_PROFILES: Record<CrashBotStrategy, CrashBotProfile> = {
  conservative: { strategy: 'conservative', betRange: [50, 300], targetMultiplier: [1.2, 1.8], betProbability: 0.9 },
  moderate: { strategy: 'moderate', betRange: [100, 1000], targetMultiplier: [1.5, 3.0], betProbability: 0.85 },
  aggressive: { strategy: 'aggressive', betRange: [500, 3000], targetMultiplier: [2.5, 8.0], betProbability: 0.75 },
  yolo: { strategy: 'yolo', betRange: [1000, 10000], targetMultiplier: [5.0, 50.0], betProbability: 0.5 },
  random: { strategy: 'random', betRange: [50, 5000], targetMultiplier: [1.1, 20.0], betProbability: 0.7 },
};

// === Blackjack Bot Profiles ===
export type BlackjackBotStrategy = 'basic_strategy' | 'conservative' | 'aggressive' | 'chaotic';

export interface BlackjackBotProfile {
  strategy: BlackjackBotStrategy;
  betRange: [number, number];
  hitThreshold: number;
  doubleThreshold: number;
  thinkTimeMs: [number, number];
}

export const BLACKJACK_BOT_PROFILES: Record<BlackjackBotStrategy, BlackjackBotProfile> = {
  basic_strategy: { strategy: 'basic_strategy', betRange: [100, 1000], hitThreshold: 17, doubleThreshold: 10, thinkTimeMs: [800, 2500] },
  conservative: { strategy: 'conservative', betRange: [50, 500], hitThreshold: 15, doubleThreshold: 11, thinkTimeMs: [1000, 3000] },
  aggressive: { strategy: 'aggressive', betRange: [500, 5000], hitThreshold: 18, doubleThreshold: 9, thinkTimeMs: [400, 1500] },
  chaotic: { strategy: 'chaotic', betRange: [100, 3000], hitThreshold: 14 + Math.floor(Math.random() * 6), doubleThreshold: 8 + Math.floor(Math.random() * 4), thinkTimeMs: [200, 4000] },
};

const CRASH_STRATEGIES: CrashBotStrategy[] = ['conservative', 'moderate', 'moderate', 'aggressive', 'yolo', 'random'];
const BJ_STRATEGIES: BlackjackBotStrategy[] = ['basic_strategy', 'basic_strategy', 'conservative', 'aggressive', 'chaotic'];

let nameIndex = 0;

export function createBot(existingIds: Set<string>): {
  player: MultiplayerPlayer;
  crashProfile: CrashBotProfile;
  blackjackProfile: BlackjackBotProfile;
} {
  let id: string;
  do {
    id = `bot_${Math.random().toString(36).slice(2, 8)}`;
  } while (existingIds.has(id));

  const name = BOT_NAMES[nameIndex % BOT_NAMES.length];
  nameIndex++;
  const avatar = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)];
  const crashStrategy = CRASH_STRATEGIES[Math.floor(Math.random() * CRASH_STRATEGIES.length)];
  const bjStrategy = BJ_STRATEGIES[Math.floor(Math.random() * BJ_STRATEGIES.length)];

  return {
    player: { id, name, avatar, type: 'bot', balance: 5000 + Math.floor(Math.random() * 45000) },
    crashProfile: CRASH_BOT_PROFILES[crashStrategy],
    blackjackProfile: BLACKJACK_BOT_PROFILES[bjStrategy],
  };
}

export function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max));
}
