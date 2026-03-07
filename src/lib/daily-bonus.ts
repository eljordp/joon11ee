const DAILY_BONUS_KEY = 'joon11ee_daily_bonus';

export interface DailyBonusState {
  lastClaim: string;
  streak: number;
}

const STREAK_REWARDS = [500, 1000, 1500, 2000, 3000, 4000, 5000];

export function getStreakReward(streak: number): number {
  return STREAK_REWARDS[Math.min(streak - 1, STREAK_REWARDS.length - 1)];
}

function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getState(): DailyBonusState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(DAILY_BONUS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export function checkDailyBonus(): { canClaim: boolean; streak: number; reward: number } {
  const state = getState();
  const today = getToday();

  if (!state) return { canClaim: true, streak: 1, reward: STREAK_REWARDS[0] };
  if (state.lastClaim === today) return { canClaim: false, streak: state.streak, reward: 0 };

  const newStreak = state.lastClaim === getYesterday() ? state.streak + 1 : 1;
  return { canClaim: true, streak: newStreak, reward: getStreakReward(newStreak) };
}

export function claimDailyBonus(): { streak: number; reward: number } {
  const { streak, reward } = checkDailyBonus();
  const state: DailyBonusState = { lastClaim: getToday(), streak };
  localStorage.setItem(DAILY_BONUS_KEY, JSON.stringify(state));
  return { streak, reward };
}

export function getCurrentStreak(): number {
  const state = getState();
  if (!state) return 0;
  const today = getToday();
  if (state.lastClaim === today || state.lastClaim === getYesterday()) return state.streak;
  return 0;
}
