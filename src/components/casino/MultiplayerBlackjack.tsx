'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import { isRed, type Card } from '@/lib/casino';
import { BlackjackEngine } from '@/lib/multiplayer/blackjack-engine';
import type { BlackjackRoundState, ChatMessage } from '@/lib/multiplayer/types';
import BetControls from './BetControls';
import MultiplayerChat from './MultiplayerChat';
import CountdownTimer from './CountdownTimer';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
}

function PlayingCard({ card, hidden = false, index, small = false }: { card: Card; hidden?: boolean; index: number; small?: boolean }) {
  const red = !hidden && isRed(card.suit);
  return (
    <motion.div
      initial={{ opacity: 0, y: -30, rotateZ: -8 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35, type: 'spring', stiffness: 200 }}
      className={`relative flex-shrink-0 rounded-lg ${
        small ? 'w-10 h-[60px]' : 'w-14 h-[84px] sm:w-20 sm:h-[120px]'
      } ${
        hidden
          ? 'bg-gradient-to-br from-red-900 to-red-950 border-2 border-red-800'
          : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-white/15'
      } shadow-xl`}
    >
      {hidden ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-red-700 text-xs font-bold">J</span>
        </div>
      ) : (
        <>
          <div className={`absolute top-1 left-1 ${small ? 'text-[8px]' : 'text-[10px] sm:text-xs'}`}>
            <p className={`font-black leading-none ${red ? 'text-red-500' : 'text-white'}`}>{card.rank}</p>
            <p className={`leading-none ${red ? 'text-red-500' : 'text-white/70'}`}>{card.suit}</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${small ? 'text-lg' : 'text-2xl sm:text-3xl'} ${red ? 'text-red-500' : 'text-white/80'}`}>{card.suit}</span>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function MultiplayerBlackjack({ balance, onWin, onLose }: Props) {
  const [gameState, setGameState] = useState<BlackjackRoundState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [bet, setBet] = useState(100);
  const [hasBet, setHasBet] = useState(false);
  const [seated, setSeated] = useState(false);
  const [humanSeat, setHumanSeat] = useState<number | null>(null);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean | null } | null>(null);

  const engineRef = useRef<BlackjackEngine | null>(null);
  const prevPhaseRef = useRef<string>('betting');

  useEffect(() => {
    const engine = new BlackjackEngine('You');
    engineRef.current = engine;

    const unsub1 = engine.onStateChange((state) => {
      setGameState(state);

      // Phase transition sounds & logic
      if (state.phase !== prevPhaseRef.current) {
        if (state.phase === 'dealing') {
          setTimeout(() => sounds.cardDeal(), 100);
          setTimeout(() => sounds.cardDeal(), 300);
          setTimeout(() => sounds.cardDeal(), 500);
          setTimeout(() => sounds.cardDeal(), 700);
        }

        if (state.phase === 'player_turns') {
          const humanIdx = engine.getHumanSeatIndex();
          if (humanIdx !== null && state.activeSeatIndex === humanIdx) {
            sounds.click();
          }
        }

        if (state.phase === 'dealer_turn') {
          sounds.cardFlip();
        }

        if (state.phase === 'results') {
          const humanIdx = engine.getHumanSeatIndex();
          if (humanIdx !== null) {
            const seat = state.seats[humanIdx];
            if (seat && seat.bet > 0 && seat.hand.length > 0) {
              if (seat.profit > 0) {
                sounds.win();
                onWin(seat.profit + seat.bet); // Return bet + profit
                const isBlackjack = seat.handValue === 21 && seat.hand.length === 2;
                setResult({
                  text: `+$${seat.profit.toLocaleString()}`,
                  sub: isBlackjack ? 'BLACKJACK' : `${seat.handValue} vs ${state.dealerHandValue}`,
                  win: true,
                });
                if (isBlackjack) sounds.jackpot();
              } else if (seat.profit < 0) {
                sounds.lose();
                onLose(Math.abs(seat.profit));
                setResult({
                  text: `-$${Math.abs(seat.profit).toLocaleString()}`,
                  sub: seat.handValue > 21 ? 'BUST' : `${seat.handValue} vs ${state.dealerHandValue}`,
                  win: false,
                });
              } else {
                setResult({
                  text: 'PUSH',
                  sub: `both ${seat.handValue}`,
                  win: null,
                });
              }
            }
          }
        }

        if (state.phase === 'betting') {
          setHasBet(false);
          setResult(null);
        }

        prevPhaseRef.current = state.phase;
      }
    });

    const unsub2 = engine.onChat((msg) => {
      setChatMessages((prev) => [...prev.slice(-100), msg]);
    });

    engine.start();

    return () => {
      unsub1();
      unsub2();
      engine.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sitDown = useCallback((seatIndex: number) => {
    if (!engineRef.current || seated) return;
    const success = engineRef.current.takeSeat(seatIndex);
    if (success) {
      setSeated(true);
      setHumanSeat(seatIndex);
      sounds.click();
    }
  }, [seated]);

  const placeBet = useCallback(() => {
    if (!engineRef.current || hasBet || balance < bet) return;
    const success = engineRef.current.placeHumanBet(bet);
    if (success) {
      setHasBet(true);
      sounds.bet();
    }
  }, [hasBet, balance, bet]);

  const hit = useCallback(() => {
    if (!engineRef.current) return;
    if (engineRef.current.humanHit()) {
      sounds.cardDeal();
    }
  }, []);

  const stand = useCallback(() => {
    if (!engineRef.current) return;
    if (engineRef.current.humanStand()) {
      sounds.click();
    }
  }, []);

  const doubleDown = useCallback(() => {
    if (!engineRef.current || balance < bet * 2) return;
    if (engineRef.current.humanDoubleDown()) {
      sounds.bet();
      sounds.cardDeal();
    }
  }, [balance, bet]);

  const sendChat = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: `chat_human_${Date.now()}`,
      playerId: 'human',
      playerName: 'You',
      avatar: '🎮',
      text,
      timestamp: Date.now(),
      type: 'chat',
    };
    setChatMessages((prev) => [...prev.slice(-100), msg]);
  }, []);

  if (!gameState) return null;

  const { phase, seats, dealerHand, dealerHandValue, dealerRevealed, activeSeatIndex, turnTimeLeft, roundNumber, bettingTimeLeft } = gameState;
  const isMyTurn = humanSeat !== null && activeSeatIndex === humanSeat && phase === 'player_turns';
  const mySeat = humanSeat !== null ? seats[humanSeat] : null;
  const canDouble = isMyTurn && mySeat && mySeat.hand.length === 2 && !mySeat.doubled && balance >= bet * 2;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Blackjack Table</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">
            Live
          </span>
        </div>
        <span className="text-zinc-600 text-xs">Round #{roundNumber}</span>
      </div>

      {/* Main table area */}
      <div className="border border-white/[0.06] bg-zinc-950/50 p-4 sm:p-6">
        {/* Dealer section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-500 text-[10px] tracking-wider uppercase">Dealer</span>
            {dealerRevealed && dealerHand.length > 0 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-sm font-mono font-bold ${dealerHandValue > 21 ? 'text-red-400' : 'text-white'}`}
              >
                {dealerHandValue}{dealerHandValue > 21 ? ' BUST' : ''}
              </motion.span>
            )}
          </div>
          <div className="flex gap-1.5 sm:gap-2 min-h-[84px] sm:min-h-[120px] justify-center">
            {dealerHand.map((card, i) => (
              <PlayingCard
                key={`d-${i}-${card.rank}${card.suit}`}
                card={card}
                hidden={i === 1 && !dealerRevealed}
                index={i}
              />
            ))}
            {dealerHand.length === 0 && (
              <div className="flex items-center justify-center text-zinc-800 text-xs">waiting for deal...</div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-white/[0.06] mb-6" />

        {/* Seats grid */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {seats.map((seat, idx) => {
            const isActive = activeSeatIndex === idx;
            const isHuman = seat.player?.id === 'human';
            const isEmpty = !seat.player;

            return (
              <div
                key={idx}
                className={`border p-2 sm:p-3 min-h-[140px] sm:min-h-[200px] flex flex-col transition-all ${
                  isActive
                    ? 'border-yellow-500/50 bg-yellow-500/5 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                    : isHuman
                    ? 'border-red-600/30 bg-red-600/5'
                    : isEmpty
                    ? 'border-dashed border-white/[0.06] hover:border-white/[0.12] cursor-pointer'
                    : 'border-white/[0.06]'
                }`}
                onClick={() => {
                  if (isEmpty && !seated && phase === 'betting') sitDown(idx);
                }}
              >
                {isEmpty ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-1">
                    <span className="text-zinc-700 text-xl">+</span>
                    <span className="text-zinc-700 text-[9px] tracking-wider uppercase">
                      {seated ? '' : 'Sit'}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Player info */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs">{seat.player!.avatar}</span>
                      <span className={`text-[10px] font-bold truncate ${isHuman ? 'text-red-400' : 'text-zinc-400'}`}>
                        {isHuman ? 'You' : seat.player!.name}
                      </span>
                    </div>

                    {/* Bet */}
                    {seat.bet > 0 && (
                      <div className="text-[10px] text-zinc-500 font-mono mb-1">
                        ${seat.bet.toLocaleString()}
                        {seat.doubled && <span className="text-yellow-400 ml-1">2x</span>}
                      </div>
                    )}

                    {/* Cards */}
                    <div className="flex gap-0.5 flex-wrap mb-1 flex-1">
                      {seat.hand.map((card, ci) => (
                        <PlayingCard key={`s${idx}-${ci}`} card={card} index={ci} small />
                      ))}
                    </div>

                    {/* Hand value + status */}
                    {seat.hand.length > 0 && (
                      <div className="flex items-center justify-between mt-auto">
                        <span className={`text-xs font-mono font-bold ${
                          seat.handValue === 21 ? 'text-green-400' :
                          seat.handValue > 21 ? 'text-red-400' : 'text-white'
                        }`}>
                          {seat.handValue}
                        </span>
                        <span className={`text-[9px] font-bold uppercase ${
                          seat.status === 'blackjack' ? 'text-yellow-400' :
                          seat.status === 'busted' ? 'text-red-400' :
                          seat.status === 'stood' ? 'text-zinc-500' :
                          seat.status === 'playing' ? 'text-green-400' :
                          seat.status === 'done' ? (
                            seat.profit > 0 ? 'text-green-400' : seat.profit < 0 ? 'text-red-400' : 'text-yellow-400'
                          ) :
                          'text-zinc-600'
                        }`}>
                          {seat.status === 'blackjack' ? 'BJ!' :
                           seat.status === 'busted' ? 'BUST' :
                           seat.status === 'playing' ? (isActive ? 'TURN' : '...') :
                           seat.status === 'stood' ? 'STAND' :
                           seat.status === 'done' ? (
                             seat.profit > 0 ? `+$${seat.profit}` :
                             seat.profit < 0 ? `-$${Math.abs(seat.profit)}` :
                             'PUSH'
                           ) :
                           ''}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Active turn indicator */}
        {phase === 'player_turns' && activeSeatIndex !== null && (
          <div className="mt-3">
            <CountdownTimer
              totalSeconds={seats[activeSeatIndex]?.player?.id === 'human' ? 15 : 12}
              remainingSeconds={turnTimeLeft}
              label={
                activeSeatIndex === humanSeat
                  ? 'Your turn'
                  : `${seats[activeSeatIndex]?.player?.name || 'Player'}'s turn`
              }
            />
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
            className="text-center"
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

      {/* Controls area */}
      <div className="space-y-3">
        {/* Not seated yet */}
        {!seated && phase === 'betting' && (
          <div className="text-center border border-dashed border-white/[0.08] py-6">
            <p className="text-zinc-500 text-sm mb-1">Click an empty seat to sit down</p>
            <p className="text-zinc-700 text-xs">Pick your spot at the table</p>
          </div>
        )}

        {/* Seated, betting phase */}
        {seated && phase === 'betting' && !hasBet && (
          <div className="space-y-3">
            <CountdownTimer totalSeconds={8} remainingSeconds={bettingTimeLeft} label="Betting closes in" />
            <BetControls balance={balance} bet={bet} setBet={setBet} disabled={false} />
            <button
              onClick={placeBet}
              disabled={balance < bet}
              className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              PLACE BET ${bet.toLocaleString()}
            </button>
          </div>
        )}

        {seated && phase === 'betting' && hasBet && (
          <div className="text-center text-green-400/60 text-xs font-bold py-3 animate-pulse tracking-wider uppercase">
            Bet placed — dealing soon...
          </div>
        )}

        {/* Player turn controls */}
        {isMyTurn && (
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

        {/* Waiting for others */}
        {seated && phase === 'player_turns' && !isMyTurn && activeSeatIndex !== null && (
          <div className="text-center text-zinc-500 text-sm py-3 animate-pulse">
            {seats[activeSeatIndex]?.player?.name || 'Player'} is playing...
          </div>
        )}

        {phase === 'dealing' && (
          <div className="text-center text-zinc-500 text-sm py-3 animate-pulse">
            dealing cards...
          </div>
        )}

        {phase === 'dealer_turn' && (
          <div className="text-center text-zinc-500 text-sm py-3 animate-pulse">
            dealer&apos;s turn...
          </div>
        )}

        {phase === 'results' && (
          <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">
            next round starting soon...
          </div>
        )}
      </div>

      {/* Chat */}
      <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
    </div>
  );
}
