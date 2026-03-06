export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface CasinoDayStat {
  date: string;
  gamesPlayed: number;
  totalWagered: number;
  totalWon: number;
  netProfit: number;
  biggestWin: number;
  biggestLoss: number;
}

export interface UserData {
  user: User;
  casinoStats: CasinoDayStat[];
  casinoBalance: number;
}

const USERS_KEY = 'joon11ee_users';
const SESSION_KEY = 'joon11ee_session';

function getUsers(): Record<string, UserData> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch { return {}; }
}

function saveUsers(users: Record<string, UserData>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function signup(email: string, name: string, password: string): UserData | string {
  const users = getUsers();
  const key = email.toLowerCase();
  if (users[key]) return 'Account already exists with this email.';

  const userData: UserData = {
    user: {
      id: `U-${Date.now().toString(36).toUpperCase()}`,
      email: key,
      name,
      createdAt: new Date().toISOString(),
    },
    casinoStats: [],
    casinoBalance: 10000,
  };

  users[key] = userData;
  // Store password hash (simple for localStorage — not production security)
  localStorage.setItem(`joon11ee_pw_${key}`, btoa(password));
  saveUsers(users);
  sessionStorage.setItem(SESSION_KEY, key);
  return userData;
}

export function login(email: string, password: string): UserData | string {
  const users = getUsers();
  const key = email.toLowerCase();
  if (!users[key]) return 'No account found with this email.';

  const storedPw = localStorage.getItem(`joon11ee_pw_${key}`);
  if (!storedPw || atob(storedPw) !== password) return 'Incorrect password.';

  sessionStorage.setItem(SESSION_KEY, key);
  return users[key];
}

// Migrate bad date entries (e.g. 2026-03-06 recorded on Mar 5 due to timezone bug)
function migrateBadDates(data: UserData): UserData {
  const BAD_DATES: Record<string, string> = { '2026-03-06': '2026-03-05' };
  let changed = false;

  for (const [bad, correct] of Object.entries(BAD_DATES)) {
    const badIdx = data.casinoStats.findIndex((s) => s.date === bad);
    if (badIdx === -1) continue;
    changed = true;
    const badEntry = data.casinoStats[badIdx];
    const goodIdx = data.casinoStats.findIndex((s) => s.date === correct);

    if (goodIdx !== -1) {
      // Merge into correct date
      const g = data.casinoStats[goodIdx];
      g.gamesPlayed += badEntry.gamesPlayed;
      g.totalWagered += badEntry.totalWagered;
      g.totalWon += badEntry.totalWon;
      g.netProfit += badEntry.netProfit;
      g.biggestWin = Math.max(g.biggestWin, badEntry.biggestWin);
      g.biggestLoss = Math.max(g.biggestLoss, badEntry.biggestLoss);
    } else {
      // Just fix the date
      badEntry.date = correct;
    }
    if (goodIdx !== -1) data.casinoStats.splice(badIdx, 1);
  }

  return changed ? data : data;
}

export function getSession(): UserData | null {
  if (typeof window === 'undefined') return null;
  const key = sessionStorage.getItem(SESSION_KEY);
  if (!key) return null;
  const users = getUsers();
  if (!users[key]) return null;

  // Run migration on load
  const hasBad = users[key].casinoStats.some((s) => s.date === '2026-03-06');
  if (hasBad) {
    users[key] = migrateBadDates(users[key]);
    saveUsers(users);
  }

  return users[key];
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function updateUserData(email: string, updater: (data: UserData) => UserData) {
  const users = getUsers();
  const key = email.toLowerCase();
  if (!users[key]) return;
  users[key] = updater(users[key]);
  saveUsers(users);
}

export function recordCasinoGame(
  email: string,
  wagered: number,
  won: number,
) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const net = won - wagered;

  updateUserData(email, (data) => {
    const existing = data.casinoStats.find((s) => s.date === today);
    if (existing) {
      existing.gamesPlayed += 1;
      existing.totalWagered += wagered;
      existing.totalWon += won;
      existing.netProfit += net;
      if (net > 0 && won > existing.biggestWin) existing.biggestWin = won;
      if (net < 0 && wagered > existing.biggestLoss) existing.biggestLoss = wagered;
    } else {
      data.casinoStats.unshift({
        date: today,
        gamesPlayed: 1,
        totalWagered: wagered,
        totalWon: won,
        netProfit: net,
        biggestWin: net > 0 ? won : 0,
        biggestLoss: net < 0 ? wagered : 0,
      });
    }
    return data;
  });
}

export function updateCasinoBalance(email: string, balance: number) {
  updateUserData(email, (data) => ({ ...data, casinoBalance: balance }));
}
