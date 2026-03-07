const ACHIEVEMENTS_KEY = 'joon11ee_achievements';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface AchievementContext {
  winAmount?: number;
  betAmount?: number;
  balance?: number;
  streak?: number;
  isBlackjack?: boolean;
  splitWonBoth?: boolean;
  crashMultiplier?: number;
  isAllIn?: boolean;
  isMultiplayer?: boolean;
  dailyStreak?: number;
  friendCount?: number;
  totalProfit?: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', name: 'First Blood', description: 'Win your first hand', icon: '🏆' },
  { id: 'blackjack', name: 'Blackjack!', description: 'Hit a natural 21', icon: '🃏' },
  { id: 'streak_3', name: 'Hot Streak', description: 'Win 3 in a row', icon: '🔥' },
  { id: 'streak_5', name: 'On Fire', description: 'Win 5 in a row', icon: '💥' },
  { id: 'streak_10', name: 'Unstoppable', description: 'Win 10 in a row', icon: '👑' },
  { id: 'high_roller', name: 'High Roller', description: 'Place a $10,000+ bet', icon: '💎' },
  { id: 'profit_100k', name: 'Six Figures', description: 'Reach $100K total profit', icon: '💰' },
  { id: 'split_win', name: 'Double Trouble', description: 'Win both split hands', icon: '✌️' },
  { id: 'crash_5x', name: 'To The Moon', description: 'Cash out at 5x+ on Crash', icon: '🚀' },
  { id: 'crash_10x', name: 'Diamond Hands', description: 'Cash out at 10x+ on Crash', icon: '💎' },
  { id: 'daily_7', name: 'Dedicated', description: '7-day login streak', icon: '📅' },
  { id: 'friends_5', name: 'Social Butterfly', description: 'Add 5 friends', icon: '🦋' },
  { id: 'mp_game', name: 'Table Ready', description: 'Play a multiplayer game', icon: '🎮' },
  { id: 'all_in_win', name: 'YOLO', description: 'Go all-in and win', icon: '🎯' },
  { id: 'big_win', name: 'Big Score', description: 'Win $5,000+ in a single hand', icon: '🤑' },
];

function getUnlocked(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(ACHIEVEMENTS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function saveUnlocked(data: Record<string, string>) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data));
  }
}

export function getUnlockedAchievements(): Record<string, string> {
  return getUnlocked();
}

export function getUnlockedCount(): number {
  return Object.keys(getUnlocked()).length;
}

export function checkAndUnlock(ctx: AchievementContext): string[] {
  const unlocked = getUnlocked();
  const newlyUnlocked: string[] = [];

  const tryUnlock = (id: string) => {
    if (!unlocked[id]) {
      unlocked[id] = new Date().toISOString();
      newlyUnlocked.push(id);
    }
  };

  if (ctx.winAmount && ctx.winAmount > 0) tryUnlock('first_win');
  if (ctx.isBlackjack) tryUnlock('blackjack');
  if (ctx.streak && ctx.streak >= 3) tryUnlock('streak_3');
  if (ctx.streak && ctx.streak >= 5) tryUnlock('streak_5');
  if (ctx.streak && ctx.streak >= 10) tryUnlock('streak_10');
  if (ctx.betAmount && ctx.betAmount >= 10000) tryUnlock('high_roller');
  if (ctx.totalProfit && ctx.totalProfit >= 100000) tryUnlock('profit_100k');
  if (ctx.splitWonBoth) tryUnlock('split_win');
  if (ctx.crashMultiplier && ctx.crashMultiplier >= 5) tryUnlock('crash_5x');
  if (ctx.crashMultiplier && ctx.crashMultiplier >= 10) tryUnlock('crash_10x');
  if (ctx.dailyStreak && ctx.dailyStreak >= 7) tryUnlock('daily_7');
  if (ctx.friendCount && ctx.friendCount >= 5) tryUnlock('friends_5');
  if (ctx.isMultiplayer) tryUnlock('mp_game');
  if (ctx.isAllIn && ctx.winAmount && ctx.winAmount > 0) tryUnlock('all_in_win');
  if (ctx.winAmount && ctx.winAmount >= 5000) tryUnlock('big_win');

  if (newlyUnlocked.length > 0) saveUnlocked(unlocked);
  return newlyUnlocked;
}
