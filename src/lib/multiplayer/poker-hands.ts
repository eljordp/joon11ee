import type { Card } from '@/lib/casino';

export type HandRank =
  | 'high_card' | 'pair' | 'two_pair' | 'three_of_a_kind'
  | 'straight' | 'flush' | 'full_house' | 'four_of_a_kind'
  | 'straight_flush' | 'royal_flush';

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const RANK_NAMES: Record<number, string> = {
  2: '2s', 3: '3s', 4: '4s', 5: '5s', 6: '6s', 7: '7s', 8: '8s',
  9: '9s', 10: '10s', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces',
};

export interface HandResult {
  rank: HandRank;
  rankValue: number;
  kickers: number[];
  description: string;
}

function rv(card: Card): number {
  return RANK_VALUES[card.rank] || 0;
}

function evaluateFive(cards: Card[]): HandResult {
  const vals = cards.map(rv).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = vals[0];
  if (vals[0] - vals[4] === 4 && new Set(vals).size === 5) {
    isStraight = true;
  }
  // Ace-low straight (A-2-3-4-5)
  if (!isStraight && vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  // Count ranks
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && isStraight) {
    if (straightHigh === 14) return { rank: 'royal_flush', rankValue: 9, kickers: [14], description: 'Royal Flush' };
    return { rank: 'straight_flush', rankValue: 8, kickers: [straightHigh], description: `Straight Flush, ${straightHigh} high` };
  }

  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = groups[1][0];
    return { rank: 'four_of_a_kind', rankValue: 7, kickers: [quad, kicker], description: `Four ${RANK_NAMES[quad]}` };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { rank: 'full_house', rankValue: 6, kickers: [groups[0][0], groups[1][0]], description: `Full House, ${RANK_NAMES[groups[0][0]]} over ${RANK_NAMES[groups[1][0]]}` };
  }

  if (isFlush) {
    return { rank: 'flush', rankValue: 5, kickers: vals, description: `Flush, ${RANK_NAMES[vals[0]]} high` };
  }

  if (isStraight) {
    return { rank: 'straight', rankValue: 4, kickers: [straightHigh], description: `Straight, ${RANK_NAMES[straightHigh]} high` };
  }

  if (groups[0][1] === 3) {
    const trip = groups[0][0];
    const kicks = groups.slice(1).map(g => g[0]);
    return { rank: 'three_of_a_kind', rankValue: 3, kickers: [trip, ...kicks], description: `Three ${RANK_NAMES[trip]}` };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const hi = Math.max(groups[0][0], groups[1][0]);
    const lo = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2][0];
    return { rank: 'two_pair', rankValue: 2, kickers: [hi, lo, kicker], description: `Two Pair, ${RANK_NAMES[hi]} and ${RANK_NAMES[lo]}` };
  }

  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kicks = groups.slice(1).map(g => g[0]);
    return { rank: 'pair', rankValue: 1, kickers: [pair, ...kicks], description: `Pair of ${RANK_NAMES[pair]}` };
  }

  return { rank: 'high_card', rankValue: 0, kickers: vals, description: `${RANK_NAMES[vals[0]]} high` };
}

function combinations(arr: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: Card[][] = [];
  const [first, ...rest] = arr;
  for (const combo of combinations(rest, k - 1)) result.push([first, ...combo]);
  for (const combo of combinations(rest, k)) result.push(combo);
  return result;
}

export function evaluateHand(cards: Card[]): HandResult {
  const combos = combinations(cards, 5);
  let best: HandResult | null = null;
  for (const combo of combos) {
    const result = evaluateFive(combo);
    if (!best || compareHands(result, best) > 0) best = result;
  }
  return best!;
}

export function compareHands(a: HandResult, b: HandResult): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

export function cardRankValue(card: Card): number {
  return RANK_VALUES[card.rank] || 0;
}
