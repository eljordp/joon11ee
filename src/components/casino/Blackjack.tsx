'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createDeck, handValue, isRed, type Card } from '@/lib/casino';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
}

type GameState = 'betting' | 'playing' | 'dealer' | 'done';

function CardDisplay({ card, hidden = false, index }: { card: Card; hidden?: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -30, rotateY: hidden ? 180 : 0 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ delay: index * 0.15, duration: 0.3 }}
      className={`w-16 h-24 border-2 flex flex-col items-center justify-center text-lg font-bold ${
        hidden
          ? 'bg-red-950 border-red-800'
          : 'bg-zinc-900 border-white/20'
      }`}
    >
      {hidden ? (
        <span className="text-red-600 text-2xl">?</span>
      ) : (
        <>
          <span className={isRed(card.suit) ? 'text-red-500' : 'text-white'}>
            {card.rank}
          </span>
          <span className={`text-xl ${isRed(card.suit) ? 'text-red-500' : 'text-white'}`}>
            {card.suit}
          </span>
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
  const [result, setResult] = useState<{ text: string; win: boolean | null } | null>(null);

  const deal = useCallback(() => {
    if (balance < bet) return;
    const newDeck = createDeck();
    const pHand = [newDeck.pop()!, newDeck.pop()!];
    const dHand = [newDeck.pop()!, newDeck.pop()!];
    setDeck(newDeck);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setGameState('playing');
    setResult(null);

    // Check natural blackjack
    if (handValue(pHand) === 21) {
      finishGame(pHand, dHand, newDeck);
    }
  }, [balance, bet]);

  const hit = useCallback(() => {
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()!];
    setDeck(newDeck);
    setPlayerHand(newHand);

    if (handValue(newHand) > 21) {
      setGameState('done');
      onLose(bet);
      setResult({ text: `BUST! -$${bet.toLocaleString()}`, win: false });
    } else if (handValue(newHand) === 21) {
      finishGame(newHand, dealerHand, newDeck);
    }
  }, [deck, playerHand, dealerHand, bet, onLose]);

  const stand = useCallback(() => {
    finishGame(playerHand, dealerHand, deck);
  }, [playerHand, dealerHand, deck]);

  const finishGame = (pHand: Card[], dHand: Card[], currentDeck: Card[]) => {
    setGameState('dealer');
    const newDeck = [...currentDeck];
    let newDealerHand = [...dHand];

    // Dealer draws
    const drawDealer = () => {
      while (handValue(newDealerHand) < 17) {
        newDealerHand = [...newDealerHand, newDeck.pop()!];
      }
      setDeck(newDeck);
      setDealerHand(newDealerHand);

      const pVal = handValue(pHand);
      const dVal = handValue(newDealerHand);

      setTimeout(() => {
        setGameState('done');
        if (dVal > 21) {
          const winAmount = bet * 2;
          onWin(winAmount);
          setResult({ text: `DEALER BUST! +$${winAmount.toLocaleString()}`, win: true });
        } else if (pVal > dVal) {
          const isBlackjack = pVal === 21 && pHand.length === 2;
          const winAmount = isBlackjack ? Math.floor(bet * 2.5) : bet * 2;
          onWin(winAmount);
          setResult({ text: isBlackjack ? `BLACKJACK! +$${winAmount.toLocaleString()}` : `WIN! +$${winAmount.toLocaleString()}`, win: true });
        } else if (pVal < dVal) {
          onLose(bet);
          setResult({ text: `-$${bet.toLocaleString()}`, win: false });
        } else {
          setResult({ text: 'PUSH — Bet returned', win: null });
        }
      }, 500);
    };

    setTimeout(drawDealer, 600);
  };

  const showDealerCards = gameState === 'dealer' || gameState === 'done';

  return (
    <div className="border border-white/[0.06] p-6 sm:p-8">
      <h3 className="text-xl font-bold text-white mb-6 text-center">Blackjack</h3>

      {/* Dealer hand */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-500 text-xs tracking-wider uppercase">Dealer</span>
          {showDealerCards && dealerHand.length > 0 && (
            <span className="text-zinc-400 text-sm font-mono">{handValue(dealerHand)}</span>
          )}
        </div>
        <div className="flex gap-2 min-h-[96px]">
          {dealerHand.map((card, i) => (
            <CardDisplay
              key={`d-${i}`}
              card={card}
              hidden={i === 1 && !showDealerCards}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Player hand */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-500 text-xs tracking-wider uppercase">You</span>
          {playerHand.length > 0 && (
            <span className="text-white text-sm font-mono font-bold">{handValue(playerHand)}</span>
          )}
        </div>
        <div className="flex gap-2 min-h-[96px]">
          {playerHand.map((card, i) => (
            <CardDisplay key={`p-${i}`} card={card} index={i} />
          ))}
        </div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`text-center mb-4 text-lg font-bold ${
              result.win === true ? 'text-green-400' : result.win === false ? 'text-red-400' : 'text-yellow-400'
            }`}
          >
            {result.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      {gameState === 'betting' && (
        <>
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-zinc-500 text-xs tracking-wider uppercase">Bet</span>
            {[50, 100, 250, 500, 1000].map((amount) => (
              <button
                key={amount}
                onClick={() => setBet(amount)}
                className={`px-3 py-1.5 text-xs font-bold transition-all ${
                  bet === amount
                    ? 'bg-red-600 text-white'
                    : 'border border-white/10 text-zinc-500 hover:text-white'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>
          <button
            onClick={deal}
            disabled={balance < bet}
            className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            DEAL
          </button>
        </>
      )}

      {gameState === 'playing' && (
        <div className="grid grid-cols-2 gap-3">
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
        </div>
      )}

      {gameState === 'dealer' && (
        <div className="text-center text-zinc-500 text-sm py-4 animate-pulse">
          Dealer playing...
        </div>
      )}

      {gameState === 'done' && (
        <button
          onClick={() => {
            setGameState('betting');
            setPlayerHand([]);
            setDealerHand([]);
            setResult(null);
          }}
          className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all"
        >
          NEW HAND
        </button>
      )}
    </div>
  );
}
