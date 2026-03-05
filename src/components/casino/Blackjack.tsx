'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createDeck, handValue, isRed, type Card } from '@/lib/casino';
import { sounds } from '@/lib/sounds';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
}

type GameState = 'betting' | 'playing' | 'dealer' | 'done';

function PlayingCard({ card, hidden = false, index }: { card: Card; hidden?: boolean; index: number }) {
  const red = !hidden && isRed(card.suit);
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, rotateZ: -10 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      transition={{ delay: index * 0.12, duration: 0.4, type: 'spring', stiffness: 200 }}
      className={`relative w-20 h-[120px] sm:w-24 sm:h-[140px] rounded-lg flex-shrink-0 ${
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
          {/* Top left */}
          <div className="absolute top-2 left-2">
            <p className={`text-sm font-black leading-none ${red ? 'text-red-500' : 'text-white'}`}>{card.rank}</p>
            <p className={`text-xs leading-none ${red ? 'text-red-500' : 'text-white/70'}`}>{card.suit}</p>
          </div>
          {/* Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-3xl sm:text-4xl ${red ? 'text-red-500' : 'text-white/80'}`}>{card.suit}</span>
          </div>
          {/* Bottom right */}
          <div className="absolute bottom-2 right-2 rotate-180">
            <p className={`text-sm font-black leading-none ${red ? 'text-red-500' : 'text-white'}`}>{card.rank}</p>
            <p className={`text-xs leading-none ${red ? 'text-red-500' : 'text-white/70'}`}>{card.suit}</p>
          </div>
        </>
      )}
    </motion.div>
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
  const [wins, setWins] = useState(0);

  const deal = useCallback(() => {
    if (balance < bet) return;
    sounds.bet();
    const newDeck = createDeck();
    const pHand = [newDeck.pop()!, newDeck.pop()!];
    const dHand = [newDeck.pop()!, newDeck.pop()!];
    setDeck(newDeck);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setGameState('playing');
    setResult(null);
    setDoubled(false);
    setTimeout(() => sounds.cardDeal(), 50);
    setTimeout(() => sounds.cardDeal(), 200);
    setTimeout(() => sounds.cardDeal(), 350);
    setTimeout(() => sounds.cardDeal(), 500);

    if (handValue(pHand) === 21) {
      finishGame(pHand, dHand, newDeck, false);
    }
  }, [balance, bet]);

  const hit = useCallback(() => {
    sounds.cardDeal();
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()!];
    setDeck(newDeck);
    setPlayerHand(newHand);

    if (handValue(newHand) > 21) {
      const actualBet = doubled ? bet * 2 : bet;
      sounds.lose();
      setGameState('done');
      onLose(actualBet);
      setWins(0);
      setResult({ text: `-$${actualBet.toLocaleString()}`, sub: 'BUST 💀 rip your chips', win: false });
    } else if (handValue(newHand) === 21) {
      finishGame(newHand, dealerHand, newDeck, doubled);
    }
  }, [deck, playerHand, dealerHand, bet, doubled, onLose]);

  const stand = useCallback(() => {
    sounds.click();
    finishGame(playerHand, dealerHand, deck, doubled);
  }, [playerHand, dealerHand, deck, doubled]);

  const doubleDown = useCallback(() => {
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
      onLose(bet * 2);
      setWins(0);
      setResult({ text: `-$${(bet * 2).toLocaleString()}`, sub: 'doubled and busted 😭', win: false });
    } else {
      finishGame(newHand, dealerHand, newDeck, true);
    }
  }, [deck, playerHand, dealerHand, bet, balance, onLose]);

  const finishGame = (pHand: Card[], dHand: Card[], currentDeck: Card[], isDoubled: boolean) => {
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

      const pVal = handValue(pHand);
      const dVal = handValue(newDealerHand);
      const actualBet = isDoubled ? bet * 2 : bet;

      setTimeout(() => {
        setGameState('done');
        if (dVal > 21) {
          const winAmount = actualBet * 2;
          sounds.win();
          onWin(winAmount);
          setWins((w) => w + 1);
          setResult({ text: `+$${winAmount.toLocaleString()}`, sub: 'dealer busted lmao 😂', win: true });
        } else if (pVal > dVal) {
          const isBlackjack = pVal === 21 && pHand.length === 2;
          const winAmount = isBlackjack ? Math.floor(actualBet * 2.5) : actualBet * 2;
          if (isBlackjack) sounds.jackpot(); else sounds.win();
          onWin(winAmount);
          setWins((w) => w + 1);
          setResult({
            text: `+$${winAmount.toLocaleString()}`,
            sub: isBlackjack ? 'BLACKJACK BABY 🃏🔥' : `${pVal} vs ${dVal} — you cooked 🧑‍🍳`,
            win: true,
          });
        } else if (pVal < dVal) {
          sounds.lose();
          onLose(actualBet);
          setWins(0);
          setResult({ text: `-$${actualBet.toLocaleString()}`, sub: `${pVal} vs ${dVal} — not it 😔`, win: false });
        } else {
          setResult({ text: 'PUSH', sub: `both ${pVal} — bet returned 🤝`, win: null });
        }
      }, 400);
    }, 600);
  };

  const showDealerCards = gameState === 'dealer' || gameState === 'done';
  const canDouble = gameState === 'playing' && playerHand.length === 2 && balance >= bet * 2 && !doubled;

  return (
    <div className="border border-white/[0.06] bg-zinc-950/50 p-6 sm:p-8 relative overflow-hidden">
      {result?.win === true && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Blackjack</h3>
        <div className="flex items-center gap-3">
          {doubled && gameState !== 'betting' && (
            <span className="text-xs font-bold px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400">2x</span>
          )}
          {wins > 0 && (
            <span className="text-xs font-bold px-2 py-1 bg-green-500/20 border border-green-500/30 text-green-400">
              W{wins}
            </span>
          )}
        </div>
      </div>

      {/* Table area */}
      <div className="bg-zinc-900/50 border border-white/[0.04] p-4 sm:p-6 mb-6 min-h-[320px]">
        {/* Dealer */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-xs tracking-wider uppercase">Dealer</span>
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
          <div className="flex gap-[-10px] sm:gap-3 min-h-[120px] sm:min-h-[140px]">
            {dealerHand.map((card, i) => (
              <PlayingCard key={`d-${i}-${card.rank}${card.suit}`} card={card} hidden={i === 1 && !showDealerCards} index={i} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-white/[0.06] mb-8" />

        {/* Player */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-xs tracking-wider uppercase">You</span>
            {playerHand.length > 0 && (
              <span className={`text-sm font-mono font-bold ${
                handValue(playerHand) === 21 ? 'text-green-400' : handValue(playerHand) > 21 ? 'text-red-400' : 'text-white'
              }`}>
                {handValue(playerHand)}
                {handValue(playerHand) === 21 && playerHand.length === 2 && ' BJ!'}
              </span>
            )}
          </div>
          <div className="flex gap-[-10px] sm:gap-3 min-h-[120px] sm:min-h-[140px]">
            {playerHand.map((card, i) => (
              <PlayingCard key={`p-${i}-${card.rank}${card.suit}`} card={card} index={i} />
            ))}
          </div>
        </div>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      {gameState === 'betting' && (
        <>
          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
            <span className="text-zinc-600 text-[10px] tracking-wider uppercase">Bet</span>
            {[50, 100, 250, 500, 1000].map((amount) => (
              <button
                key={amount}
                onClick={() => setBet(amount)}
                className={`px-3 py-2 text-xs font-bold transition-all ${
                  bet === amount ? 'bg-red-600 text-white' : 'border border-white/10 text-zinc-500 hover:text-white'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>
          <button
            onClick={deal}
            disabled={balance < bet}
            className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            DEAL 🃏
          </button>
        </>
      )}

      {gameState === 'playing' && (
        <div className={`grid ${canDouble ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
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
        </div>
      )}

      {gameState === 'dealer' && (
        <div className="text-center text-zinc-500 text-sm py-4 animate-pulse">
          dealer flipping... 🤔
        </div>
      )}

      {gameState === 'done' && (
        <button
          onClick={() => {
            setGameState('betting');
            setPlayerHand([]);
            setDealerHand([]);
            setResult(null);
            setDoubled(false);
          }}
          className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all"
        >
          RUN IT BACK 🔄
        </button>
      )}
    </div>
  );
}
