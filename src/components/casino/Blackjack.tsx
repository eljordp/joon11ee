'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createSeededDeck, generateSeed, hashSeed, handValue, isRed, type Card } from '@/lib/casino';
import { sounds } from '@/lib/sounds';
import BetControls from './BetControls';

interface Props {
  balance: number;
  onWin: (amount: number, wagered?: number) => void;
  onLose: (amount: number) => void;
}

type GameState = 'betting' | 'shuffling' | 'playing' | 'dealer' | 'done';

function PlayingCard({ card, hidden = false, index }: { card: Card; hidden?: boolean; index: number }) {
  const red = !hidden && isRed(card.suit);
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, rotateZ: -10 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      transition={{ delay: index * 0.12, duration: 0.4, type: 'spring', stiffness: 200 }}
      className={`relative w-16 h-[96px] sm:w-24 sm:h-[140px] rounded-lg flex-shrink-0 ${
        hidden
          ? 'bg-gradient-to-br from-red-900 to-red-950 border-2 border-red-800'
          : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-white/15'
      } shadow-xl`}
    >
      {hidden ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-14 border-2 border-red-700/50 rounded flex items-center justify-center">
            <span className="text-red-700 text-lg font-bold">J</span>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute top-2 left-2">
            <p className={`text-sm font-black leading-none ${red ? 'text-red-500' : 'text-white'}`}>{card.rank}</p>
            <p className={`text-xs leading-none ${red ? 'text-red-500' : 'text-white/70'}`}>{card.suit}</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-3xl sm:text-4xl ${red ? 'text-red-500' : 'text-white/80'}`}>{card.suit}</span>
          </div>
          <div className="absolute bottom-2 right-2 rotate-180">
            <p className={`text-sm font-black leading-none ${red ? 'text-red-500' : 'text-white'}`}>{card.rank}</p>
            <p className={`text-xs leading-none ${red ? 'text-red-500' : 'text-white/70'}`}>{card.suit}</p>
          </div>
        </>
      )}
    </motion.div>
  );
}

function ShuffleAnimation() {
  const suits = ['♠', '♥', '♦', '♣'];
  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-900/80 backdrop-blur-sm">
      <div className="relative w-32 h-32">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-12 h-[72px] rounded-md bg-gradient-to-br from-red-900 to-red-950 border border-red-800 shadow-lg flex items-center justify-center"
            initial={{ x: 0, y: 0, rotate: 0, scale: 0.8 }}
            animate={{
              x: [0, (i % 2 === 0 ? 40 : -40), 0, (i % 2 === 0 ? -30 : 30), 0],
              y: [0, (i < 4 ? -20 : 20), 0, (i < 4 ? 15 : -15), 0],
              rotate: [0, (i % 2 === 0 ? 15 : -15), 0, (i % 2 === 0 ? -10 : 10), 0],
              scale: [0.8, 1, 0.9, 1, 0.8],
            }}
            transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeInOut' }}
            style={{ left: `${40 + (i - 4) * 3}px`, top: `${30 + (i - 4) * 2}px` }}
          >
            <span className="text-red-600/60 text-sm">{suits[i % 4]}</span>
          </motion.div>
        ))}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.8, times: [0, 0.2, 0.8, 1] }}
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-zinc-400 text-xs tracking-widest uppercase whitespace-nowrap font-bold"
        >
          Shuffling...
        </motion.p>
      </div>
    </div>
  );
}

export default function Blackjack({ balance, onWin, onLose }: Props) {
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<GameState>('betting');
  const [bet, setBet] = useState(100);
  const [doubled, setDoubled] = useState(false);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean | null } | null>(null);
  const [lastBet, setLastBet] = useState<number | null>(null);
  const [streakCelebration, setStreakCelebration] = useState<number | null>(null);
  const [stats, setStats] = useState({ hands: 0, wins: 0, losses: 0, pushes: 0, streak: 0, bestWin: 0, sessionProfit: 0 });
  // Split state
  const [splitHands, setSplitHands] = useState<Card[][] | null>(null);
  const [activeSplitIndex, setActiveSplitIndex] = useState(0);
  const [splitDoubled, setSplitDoubled] = useState<boolean[]>([false, false]);
  const [splitResults, setSplitResults] = useState<Array<{ text: string; win: boolean | null }> | null>(null);
  // Insurance state
  const [showInsurance, setShowInsurance] = useState(false);
  const [insuranceBet, setInsuranceBet] = useState<number | null>(null);
  // Side bets state
  const [perfectPairsBet, setPerfectPairsBet] = useState(0);
  const [twentyOnePlusThreeBet, setTwentyOnePlusThreeBet] = useState(0);
  const [sideBetResults, setSideBetResults] = useState<Array<{ name: string; win: number }> | null>(null);

  const updateStats = useCallback((outcome: 'win' | 'loss' | 'push', amount: number) => {
    setStats(prev => {
      const newStreak = outcome === 'win' ? (prev.streak > 0 ? prev.streak + 1 : 1)
        : outcome === 'loss' ? (prev.streak < 0 ? prev.streak - 1 : -1) : 0;
      const profit = outcome === 'win' ? amount : outcome === 'loss' ? -amount : 0;
      // Streak celebration at milestones
      if (newStreak === 3 || newStreak === 5 || newStreak === 10) {
        setStreakCelebration(newStreak);
        setTimeout(() => sounds.hotStreak(), 500);
        setTimeout(() => setStreakCelebration(null), 1800);
      }
      return {
        hands: prev.hands + 1,
        wins: prev.wins + (outcome === 'win' ? 1 : 0),
        losses: prev.losses + (outcome === 'loss' ? 1 : 0),
        pushes: prev.pushes + (outcome === 'push' ? 1 : 0),
        streak: newStreak,
        bestWin: outcome === 'win' ? Math.max(prev.bestWin, amount) : prev.bestWin,
        sessionProfit: prev.sessionProfit + profit,
      };
    });
  }, []);

  // Side bet evaluation helpers
  const evaluatePerfectPairs = (c1: Card, c2: Card): number => {
    if (c1.rank !== c2.rank) return 0;
    if (c1.suit === c2.suit) return 30; // Perfect pair
    const redSuits = ['♥', '♦'];
    if (redSuits.includes(c1.suit) === redSuits.includes(c2.suit)) return 10; // Colored pair
    return 5; // Mixed pair
  };

  const evaluate21Plus3 = (c1: Card, c2: Card, c3: Card): number => {
    const cards = [c1, c2, c3];
    const ranks = cards.map(c => c.value).sort((a, b) => a - b);
    const suits = cards.map(c => c.suit);
    const allSameSuit = suits[0] === suits[1] && suits[1] === suits[2];
    const allSameRank = c1.rank === c2.rank && c2.rank === c3.rank;
    const isStraight = (ranks[2] - ranks[1] === 1 && ranks[1] - ranks[0] === 1) ||
      (ranks[0] === 1 && ranks[1] === 12 && ranks[2] === 13); // A-Q-K
    if (allSameRank && allSameSuit) return 100; // Suited trips
    if (isStraight && allSameSuit) return 40; // Straight flush
    if (allSameRank) return 30; // Three of a kind
    if (isStraight) return 10; // Straight
    if (allSameSuit) return 5; // Flush
    return 0;
  };

  // Provably fair state
  const [serverSeed, setServerSeed] = useState('');
  const [clientSeed, setClientSeed] = useState('');
  const [seedHash, setSeedHash] = useState('');
  const [showFairPanel, setShowFairPanel] = useState(false);
  const [revealedSeed, setRevealedSeed] = useState('');

  // Prep next round seed on mount and after each game
  const prepSeed = useCallback(async () => {
    const ss = generateSeed();
    const cs = generateSeed();
    const hash = await hashSeed(ss);
    setServerSeed(ss);
    setClientSeed(cs);
    setSeedHash(hash);
    setRevealedSeed('');
  }, []);

  useEffect(() => { prepSeed(); }, [prepSeed]);

  const deal = useCallback(async () => {
    if (balance < bet) return;
    sounds.bet();
    setLastBet(bet);

    // Show shuffle animation
    setGameState('shuffling');
    setResult(null);
    setDoubled(false);
    setSplitHands(null);
    setSplitDoubled([false, false]);
    setSplitResults(null);
    setActiveSplitIndex(0);
    setPlayerHand([]);
    setDealerHand([]);
    setShowInsurance(false);
    setInsuranceBet(null);
    setSideBetResults(null);

    // Use the current seeds to create the deck
    const currentServerSeed = serverSeed;
    const currentClientSeed = clientSeed;

    setTimeout(() => {
      const newDeck = createSeededDeck(currentServerSeed, currentClientSeed);
      const pHand = [newDeck.pop()!, newDeck.pop()!];
      const dHand = [newDeck.pop()!, newDeck.pop()!];
      setDeck(newDeck);
      setPlayerHand(pHand);
      setDealerHand(dHand);
      setGameState('playing');
      setTimeout(() => sounds.cardDeal(), 50);
      setTimeout(() => sounds.cardDeal(), 200);
      setTimeout(() => sounds.cardDeal(), 350);
      setTimeout(() => sounds.cardDeal(), 500);

      // Evaluate side bets immediately
      const sbResults: Array<{ name: string; win: number }> = [];
      if (perfectPairsBet > 0) {
        const mult = evaluatePerfectPairs(pHand[0], pHand[1]);
        if (mult > 0) {
          const winAmt = perfectPairsBet * mult;
          sbResults.push({ name: `Perfect Pairs ${mult}:1`, win: winAmt });
          onWin(winAmt, perfectPairsBet);
        } else {
          sbResults.push({ name: 'Perfect Pairs', win: -perfectPairsBet });
          onLose(perfectPairsBet);
        }
      }
      if (twentyOnePlusThreeBet > 0) {
        const mult = evaluate21Plus3(pHand[0], pHand[1], dHand[0]);
        if (mult > 0) {
          const winAmt = twentyOnePlusThreeBet * mult;
          sbResults.push({ name: `21+3 ${mult}:1`, win: winAmt });
          onWin(winAmt, twentyOnePlusThreeBet);
        } else {
          sbResults.push({ name: '21+3', win: -twentyOnePlusThreeBet });
          onLose(twentyOnePlusThreeBet);
        }
      }
      if (sbResults.length > 0) setSideBetResults(sbResults);

      // Check for insurance offer (dealer shows Ace)
      if (dHand[0].rank === 'A' && handValue(pHand) !== 21) {
        setShowInsurance(true);
        return; // Wait for insurance decision before continuing
      }

      if (handValue(pHand) === 21) {
        finishGame(pHand, dHand, newDeck, false, currentServerSeed);
      }
    }, 900);
  }, [balance, bet, serverSeed, clientSeed, perfectPairsBet, twentyOnePlusThreeBet]); // eslint-disable-line react-hooks/exhaustive-deps

  const hit = useCallback(() => {
    sounds.cardDeal();
    const newDeck = [...deck];

    if (splitHands) {
      const hands = splitHands.map(h => [...h]);
      hands[activeSplitIndex].push(newDeck.pop()!);
      setDeck(newDeck);
      setSplitHands(hands);
      const hv = handValue(hands[activeSplitIndex]);
      if (hv > 21) {
        // Bust this hand, advance
        if (activeSplitIndex === 0) {
          setActiveSplitIndex(1);
        } else {
          finishGame(playerHand, dealerHand, newDeck, doubled, serverSeed, hands);
        }
      } else if (hv === 21) {
        if (activeSplitIndex === 0) {
          setActiveSplitIndex(1);
        } else {
          finishGame(playerHand, dealerHand, newDeck, doubled, serverSeed, hands);
        }
      }
      return;
    }

    const newHand = [...playerHand, newDeck.pop()!];
    setDeck(newDeck);
    setPlayerHand(newHand);

    if (handValue(newHand) > 21) {
      const actualBet = doubled ? bet * 2 : bet;
      sounds.lose();
      setGameState('done');
      setRevealedSeed(serverSeed);
      onLose(actualBet);
      updateStats('loss', actualBet);
      setResult({ text: `-$${actualBet.toLocaleString()}`, sub: 'BUST', win: false });
    } else if (handValue(newHand) === 21) {
      finishGame(newHand, dealerHand, newDeck, doubled, serverSeed);
    }
  }, [deck, playerHand, dealerHand, bet, doubled, onLose, serverSeed, splitHands, activeSplitIndex]);

  const stand = useCallback(() => {
    sounds.click();
    if (splitHands) {
      if (activeSplitIndex === 0) {
        setActiveSplitIndex(1);
      } else {
        finishGame(playerHand, dealerHand, deck, doubled, serverSeed, splitHands);
      }
      return;
    }
    finishGame(playerHand, dealerHand, deck, doubled, serverSeed);
  }, [playerHand, dealerHand, deck, doubled, serverSeed, splitHands, activeSplitIndex]);

  const doubleDown = useCallback(() => {
    if (splitHands) {
      // Double on active split hand
      const handBet = bet;
      if (balance < handBet * 2 || splitHands[activeSplitIndex].length !== 2) return;
      sounds.bet();
      sounds.cardDeal();
      const newDoubled = [...splitDoubled];
      newDoubled[activeSplitIndex] = true;
      setSplitDoubled(newDoubled);
      const newDeck = [...deck];
      const hands = splitHands.map(h => [...h]);
      hands[activeSplitIndex].push(newDeck.pop()!);
      setDeck(newDeck);
      setSplitHands(hands);
      if (activeSplitIndex === 0) {
        setActiveSplitIndex(1);
      } else {
        finishGame(playerHand, dealerHand, newDeck, doubled, serverSeed, hands);
      }
      return;
    }

    if (balance < bet * 2 || playerHand.length !== 2) return;
    sounds.bet();
    sounds.cardDeal();
    setDoubled(true);
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()!];
    setDeck(newDeck);
    setPlayerHand(newHand);

    if (handValue(newHand) > 21) {
      sounds.lose();
      setGameState('done');
      setRevealedSeed(serverSeed);
      onLose(bet * 2);
      updateStats('loss', bet * 2);
      setResult({ text: `-$${(bet * 2).toLocaleString()}`, sub: 'doubled and busted', win: false });
    } else {
      finishGame(newHand, dealerHand, newDeck, true, serverSeed);
    }
  }, [deck, playerHand, dealerHand, bet, balance, onLose, serverSeed, splitHands, activeSplitIndex, splitDoubled, doubled]);

  const splitAction = useCallback(() => {
    if (!playerHand.length || playerHand.length !== 2) return;
    if (playerHand[0].rank !== playerHand[1].rank) return;
    if (balance < bet * 2) return;
    sounds.bet();
    const newDeck = [...deck];
    const hand1 = [playerHand[0], newDeck.pop()!];
    const hand2 = [playerHand[1], newDeck.pop()!];
    setDeck(newDeck);
    setSplitHands([hand1, hand2]);
    setSplitDoubled([false, false]);
    setActiveSplitIndex(0);
    // If splitting aces, auto-stand both (standard rule)
    if (playerHand[0].rank === 'A') {
      setTimeout(() => {
        finishGame(playerHand, dealerHand, newDeck, false, serverSeed, [hand1, hand2]);
      }, 500);
    }
  }, [playerHand, deck, bet, balance, dealerHand, serverSeed]);

  const evaluateHand = (pHand: Card[], dVal: number, dealerBust: boolean, handBet: number): { profit: number; text: string; sub: string; win: boolean | null } => {
    const pVal = handValue(pHand);
    if (pVal > 21) return { profit: -handBet, text: `-$${handBet.toLocaleString()}`, sub: 'BUST', win: false };
    if (dealerBust) {
      return { profit: handBet, text: `+$${handBet.toLocaleString()}`, sub: 'dealer busted', win: true };
    }
    if (pVal > dVal) {
      const isBJ = pVal === 21 && pHand.length === 2;
      const profit = isBJ ? Math.floor(handBet * 1.5) : handBet;
      return { profit, text: `+$${profit.toLocaleString()}`, sub: isBJ ? 'BLACKJACK' : `${pVal} vs ${dVal}`, win: true };
    }
    if (pVal < dVal) return { profit: -handBet, text: `-$${handBet.toLocaleString()}`, sub: `${pVal} vs ${dVal}`, win: false };
    return { profit: 0, text: 'PUSH', sub: `both ${pVal}`, win: null };
  };

  const finishGame = (pHand: Card[], dHand: Card[], currentDeck: Card[], isDoubled: boolean, seed: string, splits?: Card[][]) => {
    setGameState('dealer');
    const newDeck = [...currentDeck];
    let newDealerHand = [...dHand];

    setTimeout(() => {
      sounds.cardFlip();
      while (handValue(newDealerHand) < 17) {
        newDealerHand = [...newDealerHand, newDeck.pop()!];
      }
      setDeck(newDeck);
      setDealerHand(newDealerHand);

      const dVal = handValue(newDealerHand);
      const dealerBust = dVal > 21;

      setTimeout(() => {
        setGameState('done');
        setRevealedSeed(seed);

        // Resolve insurance
        if (insuranceBet !== null && insuranceBet > 0) {
          const dealerHasBJ = handValue(newDealerHand) === 21 && newDealerHand.length === 2;
          if (dealerHasBJ) {
            onWin(insuranceBet * 2, insuranceBet); // 2:1 payout (bet never deducted)
          } else {
            onLose(insuranceBet);
          }
          setInsuranceBet(null);
        }

        if (splits) {
          // Evaluate each split hand
          const hand1Bet = splitDoubled[0] ? bet * 2 : bet;
          const hand2Bet = splitDoubled[1] ? bet * 2 : bet;
          const r1 = evaluateHand(splits[0], dVal, dealerBust, hand1Bet);
          const r2 = evaluateHand(splits[1], dVal, dealerBust, hand2Bet);
          const totalProfit = r1.profit + r2.profit;

          setSplitResults([
            { text: r1.text, win: r1.win },
            { text: r2.text, win: r2.win },
          ]);

          if (totalProfit > 0) {
            sounds.win();
            onWin(totalProfit, hand1Bet + hand2Bet);
            updateStats('win', totalProfit);
            setResult({ text: `+$${totalProfit.toLocaleString()}`, sub: 'split total', win: true });
          } else if (totalProfit < 0) {
            sounds.lose();
            onLose(Math.abs(totalProfit));
            updateStats('loss', Math.abs(totalProfit));
            setResult({ text: `-$${Math.abs(totalProfit).toLocaleString()}`, sub: 'split total', win: false });
          } else {
            updateStats('push', 0);
            setResult({ text: 'PUSH', sub: 'split total — even', win: null });
          }
        } else {
          const actualBet = isDoubled ? bet * 2 : bet;
          const r = evaluateHand(pHand, dVal, dealerBust, actualBet);
          if (r.win === true) {
            if (handValue(pHand) === 21 && pHand.length === 2) sounds.jackpot(); else sounds.win();
            onWin(r.profit, actualBet);
            updateStats('win', r.profit);
          } else if (r.win === false) {
            sounds.lose();
            onLose(actualBet);
            updateStats('loss', actualBet);
          } else {
            updateStats('push', 0);
          }
          setResult({ text: r.text, sub: r.sub, win: r.win });
        }
      }, 400);
    }, 600);
  };

  const showDealerCards = gameState === 'dealer' || gameState === 'done';
  const activeHand = splitHands ? splitHands[activeSplitIndex] : playerHand;
  const canDouble = gameState === 'playing' && activeHand.length === 2 && balance >= bet * 2 && !doubled && !(splitHands && splitDoubled[activeSplitIndex]);
  const canSplit = gameState === 'playing' && !splitHands && playerHand.length === 2 && playerHand[0].rank === playerHand[1].rank && balance >= bet * 2;

  return (
    <div className="border border-white/[0.06] bg-zinc-950/50 p-6 sm:p-8 relative overflow-hidden">
      {result?.win === true && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

      {/* Streak celebration overlay */}
      <AnimatePresence>
        {streakCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <div className={`text-center ${streakCelebration >= 10 ? 'text-yellow-400' : streakCelebration >= 5 ? 'text-green-400' : 'text-white'}`}>
              <p className="text-5xl font-black">W{streakCelebration}</p>
              <p className="text-sm tracking-[0.3em] uppercase font-bold mt-1">
                {streakCelebration >= 10 ? 'LEGENDARY' : streakCelebration >= 5 ? 'ON FIRE' : 'HOT STREAK'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Blackjack</h3>
          <div className="flex items-center gap-2">
            {doubled && gameState !== 'betting' && gameState !== 'shuffling' && (
              <span className="text-xs font-bold px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400">2x</span>
            )}
            {insuranceBet !== null && insuranceBet > 0 && (
              <span className="text-xs font-bold px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400/70">INS</span>
            )}
            {stats.streak !== 0 && (
              <span className={`text-xs font-bold px-2 py-1 ${stats.streak > 0 ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'}`}>
                {stats.streak > 0 ? `W${stats.streak}` : `L${Math.abs(stats.streak)}`}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowFairPanel(!showFairPanel)}
          className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-green-500/70 border border-green-500/20 hover:bg-green-500/10 transition-all"
        >
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          Fair
        </button>
      </div>

      {/* Provably Fair Panel */}
      <AnimatePresence>
        {showFairPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="border border-green-500/10 bg-green-500/5 p-3 space-y-2">
              <p className="text-green-400 text-[10px] font-bold tracking-wider uppercase">Provably Fair</p>
              <p className="text-zinc-500 text-[10px] leading-relaxed">
                Before each deal, a server seed is hashed. After the hand, the seed is revealed so you can verify the shuffle was predetermined and not rigged.
              </p>
              <div className="space-y-1.5">
                <div>
                  <span className="text-zinc-600 text-[9px] tracking-wider uppercase block mb-0.5">SHA-256 Hash (shown before deal)</span>
                  <p className="text-[10px] font-mono text-zinc-400 break-all select-all bg-black/30 px-2 py-1">{seedHash || '...'}</p>
                </div>
                {revealedSeed ? (
                  <>
                    <div>
                      <span className="text-zinc-600 text-[9px] tracking-wider uppercase block mb-0.5">Server Seed (revealed after hand)</span>
                      <p className="text-[10px] font-mono text-green-400 break-all select-all bg-black/30 px-2 py-1">{revealedSeed}</p>
                    </div>
                    <div>
                      <span className="text-zinc-600 text-[9px] tracking-wider uppercase block mb-0.5">Client Seed</span>
                      <p className="text-[10px] font-mono text-zinc-400 break-all select-all bg-black/30 px-2 py-1">{clientSeed}</p>
                    </div>
                    <p className="text-zinc-600 text-[9px]">
                      Verify: SHA-256 of the server seed above should match the hash. The deck order is deterministic from server_seed:client_seed.
                    </p>
                  </>
                ) : (
                  <p className="text-zinc-600 text-[9px]">Server seed will be revealed after the hand completes.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session stats */}
      {stats.hands > 0 && (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-4 px-3 py-2 bg-zinc-900/30 border border-white/[0.04] text-[10px] tracking-wider uppercase">
          <span className="text-zinc-600">Hands <span className="text-zinc-400 font-bold">{stats.hands}</span></span>
          <span className="text-zinc-600">W <span className="text-green-400 font-bold">{stats.wins}</span></span>
          <span className="text-zinc-600">L <span className="text-red-400 font-bold">{stats.losses}</span></span>
          {stats.hands > 0 && (
            <span className="text-zinc-600">Win% <span className="text-white font-bold">{Math.round((stats.wins / stats.hands) * 100)}%</span></span>
          )}
          {stats.bestWin > 0 && (
            <span className="text-zinc-600 hidden sm:inline">Best <span className="text-yellow-400 font-bold">+${stats.bestWin.toLocaleString()}</span></span>
          )}
          <span className={`font-bold font-mono ml-auto ${stats.sessionProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.sessionProfit >= 0 ? '+' : ''}${stats.sessionProfit.toLocaleString()}
          </span>
        </div>
      )}

      {/* Table area */}
      <div className="bg-zinc-900/50 border border-white/[0.04] p-3 sm:p-6 mb-4 sm:mb-6 min-h-[260px] sm:min-h-[320px] relative">
        {/* Shuffle animation overlay */}
        <AnimatePresence>
          {gameState === 'shuffling' && <ShuffleAnimation />}
        </AnimatePresence>

        {/* Dealer */}
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-zinc-500 text-[10px] sm:text-xs tracking-wider uppercase">Dealer</span>
            {showDealerCards && dealerHand.length > 0 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-zinc-400 text-sm font-mono font-bold"
              >
                {handValue(dealerHand)}
              </motion.span>
            )}
          </div>
          <div className="flex gap-1.5 sm:gap-3 min-h-[96px] sm:min-h-[140px] overflow-x-auto">
            {dealerHand.map((card, i) => (
              <PlayingCard key={`d-${i}-${card.rank}${card.suit}`} card={card} hidden={i === 1 && !showDealerCards} index={i} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-white/[0.06] mb-4 sm:mb-8" />

        {/* Player */}
        {splitHands ? (
          <div className="grid grid-cols-2 gap-3">
            {splitHands.map((hand, hi) => (
              <div key={hi} className={`p-2 rounded ${activeSplitIndex === hi && gameState === 'playing' ? 'ring-1 ring-green-500/50 bg-green-500/5' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-500 text-[10px] tracking-wider uppercase">Hand {hi + 1}</span>
                  <div className="flex items-center gap-1">
                    {splitDoubled[hi] && <span className="text-[9px] font-bold text-yellow-400">2x</span>}
                    {splitResults && (
                      <span className={`text-[10px] font-bold ${splitResults[hi].win === true ? 'text-green-400' : splitResults[hi].win === false ? 'text-red-400' : 'text-yellow-400'}`}>
                        {splitResults[hi].text}
                      </span>
                    )}
                    {hand.length > 0 && (
                      <span className={`text-xs font-mono font-bold ${
                        handValue(hand) === 21 ? 'text-green-400' : handValue(hand) > 21 ? 'text-red-400' : 'text-white'
                      }`}>
                        {handValue(hand)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 min-h-[80px] sm:min-h-[120px] overflow-x-auto">
                  {hand.map((card, i) => (
                    <PlayingCard key={`s${hi}-${i}-${card.rank}${card.suit}`} card={card} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-zinc-500 text-[10px] sm:text-xs tracking-wider uppercase">You</span>
              {playerHand.length > 0 && (
                <span className={`text-sm font-mono font-bold ${
                  handValue(playerHand) === 21 ? 'text-green-400' : handValue(playerHand) > 21 ? 'text-red-400' : 'text-white'
                }`}>
                  {handValue(playerHand)}
                  {handValue(playerHand) === 21 && playerHand.length === 2 && ' BJ!'}
                </span>
              )}
            </div>
            <div className="flex gap-1.5 sm:gap-3 min-h-[96px] sm:min-h-[140px] overflow-x-auto">
              {playerHand.map((card, i) => (
                <PlayingCard key={`p-${i}-${card.rank}${card.suit}`} card={card} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center mb-6"
          >
            <p className={`text-2xl sm:text-3xl font-black ${
              result.win === true ? 'text-green-400' : result.win === false ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {result.text}
            </p>
            <p className={`text-xs mt-1 ${result.win === true ? 'text-green-500/70' : result.win === false ? 'text-zinc-600' : 'text-yellow-500/70'}`}>
              {result.sub}
            </p>
            {sideBetResults && sideBetResults.length > 0 && (
              <div className="flex gap-2 justify-center mt-2">
                {sideBetResults.map((sb, i) => (
                  <span key={i} className={`text-[10px] font-bold px-2 py-0.5 border ${
                    sb.win > 0 ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-red-500/20 text-red-400/60'
                  }`}>
                    {sb.name}: {sb.win > 0 ? `+$${sb.win.toLocaleString()}` : `-$${Math.abs(sb.win).toLocaleString()}`}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      {gameState === 'betting' && (
        <>
          <div className="mb-4">
            <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />
          </div>

          {/* Side bets */}
          <div className="mb-4 border border-white/[0.04] p-3">
            <p className="text-zinc-500 text-[10px] font-bold tracking-wider uppercase mb-2">Side Bets (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-zinc-600 text-[9px] mb-1">Perfect Pairs (5-30:1)</p>
                <div className="flex gap-1">
                  {[0, 25, 50, 100].map(v => (
                    <button
                      key={v}
                      onClick={() => setPerfectPairsBet(v)}
                      disabled={v > 0 && balance < bet + v + twentyOnePlusThreeBet}
                      className={`px-2 py-1 text-[10px] font-bold transition-all ${
                        perfectPairsBet === v
                          ? 'bg-purple-600 text-white'
                          : 'border border-white/10 text-zinc-500 hover:text-white disabled:opacity-30'
                      }`}
                    >
                      {v === 0 ? 'Off' : `$${v}`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-zinc-600 text-[9px] mb-1">21+3 (5-100:1)</p>
                <div className="flex gap-1">
                  {[0, 25, 50, 100].map(v => (
                    <button
                      key={v}
                      onClick={() => setTwentyOnePlusThreeBet(v)}
                      disabled={v > 0 && balance < bet + v + perfectPairsBet}
                      className={`px-2 py-1 text-[10px] font-bold transition-all ${
                        twentyOnePlusThreeBet === v
                          ? 'bg-blue-600 text-white'
                          : 'border border-white/10 text-zinc-500 hover:text-white disabled:opacity-30'
                      }`}
                    >
                      {v === 0 ? 'Off' : `$${v}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={deal}
            disabled={balance < bet + perfectPairsBet + twentyOnePlusThreeBet}
            className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            DEAL{perfectPairsBet + twentyOnePlusThreeBet > 0 ? ` (+ $${(perfectPairsBet + twentyOnePlusThreeBet).toLocaleString()} side)` : ''}
          </button>
        </>
      )}

      {gameState === 'shuffling' && (
        <div className="text-center text-zinc-500 text-sm py-4 animate-pulse tracking-wider uppercase">
          shuffling deck...
        </div>
      )}

      {/* Insurance prompt */}
      <AnimatePresence>
        {showInsurance && gameState === 'playing' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 border border-yellow-500/30 bg-yellow-500/5 p-4 text-center"
          >
            <p className="text-yellow-400 text-xs font-bold tracking-wider uppercase mb-1">Insurance?</p>
            <p className="text-zinc-500 text-[10px] mb-3">Dealer shows Ace. Bet ${Math.floor(bet / 2).toLocaleString()} for 2:1 if dealer has blackjack.</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  const insBet = Math.floor(bet / 2);
                  if (balance >= insBet) {
                    setInsuranceBet(insBet);
                  }
                  setShowInsurance(false);
                  if (handValue(playerHand) === 21) {
                    finishGame(playerHand, dealerHand, deck, false, serverSeed);
                  }
                }}
                disabled={balance < Math.floor(bet / 2)}
                className="px-4 py-2 bg-yellow-600 text-white text-[10px] font-bold tracking-wider uppercase hover:bg-yellow-500 transition-all disabled:opacity-30"
              >
                Yes (${Math.floor(bet / 2).toLocaleString()})
              </button>
              <button
                onClick={() => {
                  setShowInsurance(false);
                  if (handValue(playerHand) === 21) {
                    finishGame(playerHand, dealerHand, deck, false, serverSeed);
                  }
                }}
                className="px-4 py-2 border border-white/10 text-zinc-400 text-[10px] font-bold tracking-wider uppercase hover:text-white transition-all"
              >
                No
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState === 'playing' && !showInsurance && (
        <div className={`grid ${canDouble && canSplit ? 'grid-cols-4' : canDouble || canSplit ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
          <button
            onClick={hit}
            className="bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all"
          >
            HIT
          </button>
          <button
            onClick={stand}
            className="border border-white/20 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-white/5 transition-all"
          >
            STAND
          </button>
          {canDouble && (
            <button
              onClick={doubleDown}
              className="bg-yellow-600/80 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-yellow-500/80 transition-all"
            >
              2x
            </button>
          )}
          {canSplit && (
            <button
              onClick={splitAction}
              className="bg-purple-600/80 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-purple-500/80 transition-all"
            >
              SPLIT
            </button>
          )}
        </div>
      )}

      {gameState === 'dealer' && (
        <div className="text-center text-zinc-500 text-sm py-4 animate-pulse">
          dealer flipping...
        </div>
      )}

      {gameState === 'done' && (
        <div className="grid grid-cols-2 gap-3">
          {lastBet && balance >= lastBet && (
            <button
              onClick={() => {
                setBet(lastBet);
                setPlayerHand([]);
                setDealerHand([]);
                setResult(null);
                setDoubled(false);
                setSplitHands(null);
                setSplitDoubled([false, false]);
                setSplitResults(null);
                setActiveSplitIndex(0);
                setInsuranceBet(null);
                setShowInsurance(false);
                setSideBetResults(null);
                prepSeed();
                // Auto-deal after tiny delay for seed prep
                setGameState('shuffling');
                setTimeout(() => {
                  const ss = serverSeed || generateSeed();
                  const cs = clientSeed || generateSeed();
                  const newDeck = createSeededDeck(ss, cs);
                  const pHand = [newDeck.pop()!, newDeck.pop()!];
                  const dHand = [newDeck.pop()!, newDeck.pop()!];
                  setDeck(newDeck);
                  setPlayerHand(pHand);
                  setDealerHand(dHand);
                  setGameState('playing');
                  sounds.bet();
                  setTimeout(() => sounds.cardDeal(), 50);
                  setTimeout(() => sounds.cardDeal(), 200);
                  if (handValue(pHand) === 21) {
                    finishGame(pHand, dHand, newDeck, false, ss);
                  }
                }, 900);
              }}
              className="bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all"
            >
              SAME BET ${lastBet.toLocaleString()}
            </button>
          )}
          <button
            onClick={() => {
              setGameState('betting');
              setPlayerHand([]);
              setDealerHand([]);
              setResult(null);
              setDoubled(false);
              setSplitHands(null);
              setSplitDoubled([false, false]);
              setSplitResults(null);
              setActiveSplitIndex(0);
              setInsuranceBet(null);
              setShowInsurance(false);
              setSideBetResults(null);
              prepSeed();
            }}
            className={`${lastBet && balance >= lastBet ? 'border border-white/20 text-white hover:bg-white/5' : 'bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)]'} py-4 text-sm font-bold tracking-widest uppercase transition-all`}
          >
            {lastBet && balance >= lastBet ? 'CHANGE BET' : 'NEW HAND'}
          </button>
        </div>
      )}
    </div>
  );
}
