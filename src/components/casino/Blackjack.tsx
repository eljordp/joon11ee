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
  const [wins, setWins] = useState(0);

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

    // Show shuffle animation
    setGameState('shuffling');
    setResult(null);
    setDoubled(false);
    setPlayerHand([]);
    setDealerHand([]);

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

      if (handValue(pHand) === 21) {
        finishGame(pHand, dHand, newDeck, false, currentServerSeed);
      }
    }, 900);
  }, [balance, bet, serverSeed, clientSeed]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setRevealedSeed(serverSeed);
      onLose(actualBet);
      setWins(0);
      setResult({ text: `-$${actualBet.toLocaleString()}`, sub: 'BUST', win: false });
    } else if (handValue(newHand) === 21) {
      finishGame(newHand, dealerHand, newDeck, doubled, serverSeed);
    }
  }, [deck, playerHand, dealerHand, bet, doubled, onLose, serverSeed]);

  const stand = useCallback(() => {
    sounds.click();
    finishGame(playerHand, dealerHand, deck, doubled, serverSeed);
  }, [playerHand, dealerHand, deck, doubled, serverSeed]);

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
      setRevealedSeed(serverSeed);
      onLose(bet * 2);
      setWins(0);
      setResult({ text: `-$${(bet * 2).toLocaleString()}`, sub: 'doubled and busted', win: false });
    } else {
      finishGame(newHand, dealerHand, newDeck, true, serverSeed);
    }
  }, [deck, playerHand, dealerHand, bet, balance, onLose, serverSeed]);

  const finishGame = (pHand: Card[], dHand: Card[], currentDeck: Card[], isDoubled: boolean, seed: string) => {
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
        setRevealedSeed(seed);
        if (dVal > 21) {
          const winAmount = actualBet * 2;
          sounds.win();
          onWin(winAmount, actualBet);
          setWins((w) => w + 1);
          setResult({ text: `+$${winAmount.toLocaleString()}`, sub: 'dealer busted', win: true });
        } else if (pVal > dVal) {
          const isBlackjack = pVal === 21 && pHand.length === 2;
          const winAmount = isBlackjack ? Math.floor(actualBet * 2.5) : actualBet * 2;
          if (isBlackjack) sounds.jackpot(); else sounds.win();
          onWin(winAmount, actualBet);
          setWins((w) => w + 1);
          setResult({
            text: `+$${winAmount.toLocaleString()}`,
            sub: isBlackjack ? 'BLACKJACK' : `${pVal} vs ${dVal}`,
            win: true,
          });
        } else if (pVal < dVal) {
          sounds.lose();
          onLose(actualBet);
          setWins(0);
          setResult({ text: `-$${actualBet.toLocaleString()}`, sub: `${pVal} vs ${dVal}`, win: false });
        } else {
          setResult({ text: 'PUSH', sub: `both ${pVal} — bet returned`, win: null });
        }
      }, 400);
    }, 600);
  };

  const showDealerCards = gameState === 'dealer' || gameState === 'done';
  const canDouble = gameState === 'playing' && playerHand.length === 2 && balance >= bet * 2 && !doubled;

  return (
    <div className="border border-white/[0.06] bg-zinc-950/50 p-6 sm:p-8 relative overflow-hidden">
      {result?.win === true && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Blackjack</h3>
          <div className="flex items-center gap-2">
            {doubled && gameState !== 'betting' && gameState !== 'shuffling' && (
              <span className="text-xs font-bold px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400">2x</span>
            )}
            {wins > 0 && (
              <span className="text-xs font-bold px-2 py-1 bg-green-500/20 border border-green-500/30 text-green-400">
                W{wins}
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
          <div className="mb-4">
            <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />
          </div>
          <button
            onClick={deal}
            disabled={balance < bet}
            className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            DEAL
          </button>
        </>
      )}

      {gameState === 'shuffling' && (
        <div className="text-center text-zinc-500 text-sm py-4 animate-pulse tracking-wider uppercase">
          shuffling deck...
        </div>
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
          dealer flipping...
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
            prepSeed();
          }}
          className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all"
        >
          RUN IT BACK
        </button>
      )}
    </div>
  );
}
