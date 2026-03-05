export const CRASH_CHAT_BETTING = [
  'going big this round', 'feeling lucky', 'all in?? nah jk',
  'last round was insane', 'easy 2x incoming', 'moon time',
  'who else is in', 'gl everyone', 'im scared lol',
  'this one crashes at 1.0 watch', 'dont be greedy', 'send it',
  'max bet no fear', 'its giving 10x vibes', 'ready up',
];

export const CRASH_CHAT_FLYING = [
  'HOLD', 'dont cashout yet', 'its going!!', 'MOOON',
  'im out gg', 'paper hands smh', 'diamond hands only',
  'its gonna crash', 'CASH OUT NOW', 'ride it',
  'ahhhhh', 'lets goooo', 'this is insane',
  'hold hold hold', 'no way', 'TO THE MOON',
];

export const CRASH_CHAT_CRASHED = [
  'rip', 'gg', 'knew it', 'should have cashed',
  'LMAO', 'bruhhh', 'pain', 'that was close',
  'next one for sure', 'im down bad', 'easy money',
  'called it', 'whyyy', 'reload time', 'brutal',
];

export const CRASH_CHAT_CASHOUT = [
  'ez money', 'secured the bag', 'not greedy today',
  'lets go!!', 'smart play', 'profit is profit',
];

export const BLACKJACK_CHAT = [
  'hit me', 'dealer is cooked', 'blackjack incoming',
  'bust incoming rip', 'gl table', 'nice hand',
  'oof', 'thats rough', 'double down no balls',
  'dealer always gets 21 smh', 'lets ride', 'push is fine',
  'im on a heater', 'card counting btw', 'jk jk',
  'nice hit', 'dealer has 20 watch', 'gg table',
];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
