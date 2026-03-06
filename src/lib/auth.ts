export interface User {
  id: string;
  email: string;
  name: string;
  instagram?: string;
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

export interface Friend {
  username: string;
  addedAt: string;
}

export interface UserData {
  user: User;
  casinoStats: CasinoDayStat[];
  casinoBalance: number;
  friends?: Friend[];
}

const USERS_KEY = 'joon11ee_users';
const SESSION_KEY = 'joon11ee_session';
const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;

export function validateUsername(name: string): string | null {
  if (!name || name.length < 2) return 'Username must be at least 2 characters.';
  if (name.length > 16) return 'Username must be 16 characters or less.';
  if (!USERNAME_REGEX.test(name)) return 'Letters, numbers, _ and . only.';
  return null;
}

function isUsernameTaken(name: string, excludeEmail?: string): boolean {
  const users = getUsers();
  const target = name.toLowerCase();
  for (const [email, data] of Object.entries(users)) {
    if (excludeEmail && email === excludeEmail.toLowerCase()) continue;
    if (data.user.name.toLowerCase() === target) return true;
  }
  return false;
}

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
  const nameErr = validateUsername(name);
  if (nameErr) return nameErr;

  const users = getUsers();
  const key = email.toLowerCase();
  if (users[key]) return 'Account already exists with this email.';
  if (isUsernameTaken(name)) return 'Username is already taken.';

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
  localStorage.setItem(SESSION_KEY, key);
  return userData;
}

export function login(email: string, password: string): UserData | string {
  const users = getUsers();
  const key = email.toLowerCase();
  if (!users[key]) return 'No account found with this email.';

  const storedPw = localStorage.getItem(`joon11ee_pw_${key}`);
  if (!storedPw || atob(storedPw) !== password) return 'Incorrect password.';

  localStorage.setItem(SESSION_KEY, key);
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
  const key = localStorage.getItem(SESSION_KEY);
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
  localStorage.removeItem(SESSION_KEY);
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

export function updateProfile(email: string, updates: { name?: string; instagram?: string }): string | true {
  if (updates.name) {
    const nameErr = validateUsername(updates.name);
    if (nameErr) return nameErr;
    if (isUsernameTaken(updates.name, email)) return 'Username is already taken.';
  }
  updateUserData(email, (data) => ({
    ...data,
    user: { ...data.user, ...updates },
  }));
  return true;
}

export function findUserByUsername(username: string): UserData | null {
  const users = getUsers();
  const target = username.toLowerCase();
  for (const data of Object.values(users)) {
    if (data.user.name.toLowerCase() === target) return data;
  }
  return null;
}

export function addFriend(email: string, friendUsername: string): string | true {
  const users = getUsers();
  const key = email.toLowerCase();
  const me = users[key];
  if (!me) return 'Not logged in.';

  if (me.user.name.toLowerCase() === friendUsername.toLowerCase()) return 'Cannot add yourself.';

  const friend = findUserByUsername(friendUsername);
  if (!friend) return 'User not found.';

  const friends = me.friends || [];
  if (friends.some((f) => f.username.toLowerCase() === friendUsername.toLowerCase())) {
    return 'Already friends.';
  }

  friends.push({ username: friend.user.name, addedAt: new Date().toISOString() });
  me.friends = friends;
  saveUsers(users);
  return true;
}

export function removeFriend(email: string, friendUsername: string) {
  updateUserData(email, (data) => ({
    ...data,
    friends: (data.friends || []).filter((f) => f.username.toLowerCase() !== friendUsername.toLowerCase()),
  }));
}

export function sendMoney(fromEmail: string, toUsername: string, amount: number): string | true {
  if (!amount || amount <= 0) return 'Enter a valid amount.';
  const users = getUsers();
  const fromKey = fromEmail.toLowerCase();
  const sender = users[fromKey];
  if (!sender) return 'Not logged in.';
  if (sender.user.name.toLowerCase() === toUsername.toLowerCase()) return 'Cannot send to yourself.';
  if (sender.casinoBalance < amount) return 'Insufficient balance.';

  // Find recipient by username
  let recipientKey: string | null = null;
  for (const [email, data] of Object.entries(users)) {
    if (data.user.name.toLowerCase() === toUsername.toLowerCase()) {
      recipientKey = email;
      break;
    }
  }
  if (!recipientKey) return 'User not found.';

  sender.casinoBalance -= amount;
  users[recipientKey].casinoBalance += amount;
  saveUsers(users);
  return true;
}
