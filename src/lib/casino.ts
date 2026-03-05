const BALANCE_KEY = 'joon11ee_casino_balance';
const DEFAULT_BALANCE = 10000;

export function getBalance(): number {
  if (typeof window === 'undefined') return DEFAULT_BALANCE;
  const saved = localStorage.getItem(BALANCE_KEY);
  return saved ? parseFloat(saved) : DEFAULT_BALANCE;
}

export function setBalance(amount: number): void {
  localStorage.setItem(BALANCE_KEY, Math.max(0, amount).toString());
}

export function addBalance(amount: number): number {
  const newBalance = getBalance() + amount;
  setBalance(newBalance);
  return newBalance;
}

export function subtractBalance(amount: number): number | false {
  const current = getBalance();
  if (current < amount) return false;
  const newBalance = current - amount;
  setBalance(newBalance);
  return newBalance;
}

export function resetBalance(): number {
  setBalance(DEFAULT_BALANCE);
  return DEFAULT_BALANCE;
}

export const SLOT_SYMBOLS = ['🍒', '🍋', '💎', '7️⃣', '🔔', '🍀', '⭐', '🏎️'] as const;

export const SLOT_PAYOUTS: Record<string, number> = {
  '🏎️': 50,
  '💎': 25,
  '7️⃣': 15,
  '⭐': 10,
  '🔔': 8,
  '🍀': 5,
  '🍒': 3,
  '🍋': 2,
};

export const ROULETTE_NUMBERS = [
  { num: 0, color: 'green' as const },
  { num: 1, color: 'red' as const }, { num: 2, color: 'black' as const },
  { num: 3, color: 'red' as const }, { num: 4, color: 'black' as const },
  { num: 5, color: 'red' as const }, { num: 6, color: 'black' as const },
  { num: 7, color: 'red' as const }, { num: 8, color: 'black' as const },
  { num: 9, color: 'red' as const }, { num: 10, color: 'black' as const },
  { num: 11, color: 'black' as const }, { num: 12, color: 'red' as const },
  { num: 13, color: 'black' as const }, { num: 14, color: 'red' as const },
  { num: 15, color: 'black' as const }, { num: 16, color: 'red' as const },
  { num: 17, color: 'black' as const }, { num: 18, color: 'red' as const },
  { num: 19, color: 'red' as const }, { num: 20, color: 'black' as const },
  { num: 21, color: 'red' as const }, { num: 22, color: 'black' as const },
  { num: 23, color: 'red' as const }, { num: 24, color: 'black' as const },
  { num: 25, color: 'red' as const }, { num: 26, color: 'black' as const },
  { num: 27, color: 'red' as const }, { num: 28, color: 'black' as const },
  { num: 29, color: 'black' as const }, { num: 30, color: 'red' as const },
  { num: 31, color: 'black' as const }, { num: 32, color: 'red' as const },
  { num: 33, color: 'black' as const }, { num: 34, color: 'red' as const },
  { num: 35, color: 'black' as const }, { num: 36, color: 'red' as const },
];

export type Card = { suit: string; rank: string; value: number };

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      const rank = RANKS[i];
      const value = i === 0 ? 11 : Math.min(i + 1, 10);
      deck.push({ suit, rank, value });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function handValue(hand: Card[]): number {
  let total = hand.reduce((sum, c) => sum + c.value, 0);
  let aces = hand.filter((c) => c.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isRed(suit: string): boolean {
  return suit === '♥' || suit === '♦';
}

// --- Provably Fair ---

export function generateSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashSeed(seed: string): Promise<string> {
  const data = new TextEncoder().encode(seed);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededDeck(serverSeed: string, clientSeed: string): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({ suit, rank: RANKS[i], value: i === 0 ? 11 : Math.min(i + 1, 10) });
    }
  }
  const combined = serverSeed + ':' + clientSeed;
  let seedNum = 0;
  for (let i = 0; i < combined.length; i++) {
    seedNum = ((seedNum << 5) - seedNum + combined.charCodeAt(i)) | 0;
  }
  const rng = mulberry32(Math.abs(seedNum));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// --- Username ---

const USERNAME_KEY = 'joon11ee_username';

export function getUsername(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(USERNAME_KEY) || '';
}

export function setUsername(name: string): void {
  localStorage.setItem(USERNAME_KEY, name.trim().slice(0, 16));
}
