'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import { CrashEngine } from '@/lib/multiplayer/crash-engine';
import type { CrashRoundState, ChatMessage, CashoutEntry } from '@/lib/multiplayer/types';
import BetControls from './BetControls';
import MultiplayerChat from './MultiplayerChat';
import PlayerList, { type PlayerListEntry } from './PlayerList';
import CountdownTimer from './CountdownTimer';

interface Props {
  balance: number;
  onWin: (amount: number) => void;
  onLose: (amount: number) => void;
}

export default function MultiplayerCrash({ balance, onWin, onLose }: Props) {
  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState<CrashRoundState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [cashoutFeed, setCashoutFeed] = useState<CashoutEntry[]>([]);
  const [hasBet, setHasBet] = useState(false);
  const [hasCashed, setHasCashed] = useState(false);
  const [result, setResult] = useState<{ text: string; sub: string; win: boolean } | null>(null);
  const [trail, setTrail] = useState<number[]>([]);

  const engineRef = useRef<CrashEngine | null>(null);
  const prevPhaseRef = useRef<string>('betting');
  const betRef = useRef(bet);
  betRef.current = bet;

  // Initialize engine
  useEffect(() => {
    const engine = new CrashEngine('You');
    engineRef.current = engine;

    const unsub1 = engine.onStateChange((state) => {
      setGameState(state);

      // Track trail for graph
      if (state.phase === 'flying') {
        setTrail((t) => [...t.slice(-60), state.currentMultiplier]);
      }

      // Phase transition effects
      if (state.phase !== prevPhaseRef.current) {
        if (state.phase === 'flying' && prevPhaseRef.current === 'betting') {
          sounds.spinStart();
          setCashoutFeed([]);
          setTrail([]);
        }
        if (state.phase === 'crashed') {
          // Determine human result
          const humanPS = state.playerStates.find((p) => p.player.id === 'human');
          if (humanPS) {
            if (humanPS.cashedOut) {
              // Already handled on cashout
            } else {
              sounds.lose();
              onLose(humanPS.bet);
              setResult({
                text: `-$${humanPS.bet.toLocaleString()}`,
                sub: `CRASHED at ${state.crashPoint.toFixed(2)}x`,
                win: false,
              });
            }
          }
        }
        if (state.phase === 'betting') {
          setHasBet(false);
          setHasCashed(false);
          setResult(null);
        }
        prevPhaseRef.current = state.phase;
      }
    });

    const unsub2 = engine.onChat((msg) => {
      setChatMessages((prev) => [...prev.slice(-100), msg]);
    });

    const unsub3 = engine.onCashout((entry) => {
      setCashoutFeed((prev) => [entry, ...prev.slice(0, 14)]);
      if (entry.playerName !== 'You') {
        // Subtle sound for other player cashouts
        try { sounds.click(); } catch {}
      }
    });

    engine.start();

    return () => {
      unsub1();
      unsub2();
      unsub3();
      engine.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const placeBet = useCallback(() => {
    if (!engineRef.current || hasBet || balance < bet) return;
    const success = engineRef.current.placeHumanBet(bet);
    if (success) {
      setHasBet(true);
      sounds.bet();
    }
  }, [hasBet, balance, bet]);

  const cashOut = useCallback(() => {
    if (!engineRef.current || !hasBet || hasCashed) return;
    const result = engineRef.current.humanCashout();
    if (result) {
      setHasCashed(true);
      sounds.win();
      onWin(result.profit);
      setResult({
        text: `+$${result.profit.toLocaleString()}`,
        sub: `cashed at ${result.multiplier.toFixed(2)}x`,
        win: true,
      });
      if (result.multiplier >= 5) sounds.jackpot();
    }
  }, [hasBet, hasCashed, onWin]);

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

  const { phase, currentMultiplier, crashPoint, bettingTimeLeft, playerStates, history, roundNumber } = gameState;
  const isLive = phase === 'flying';
  const rocketY = isLive || (phase === 'crashed') ? Math.min(85, (currentMultiplier - 1) * 15) : 0;

  const getMultColor = (m: number) => {
    if (m < 1.5) return 'text-white';
    if (m < 3) return 'text-green-400';
    if (m < 5) return 'text-yellow-400';
    if (m < 10) return 'text-orange-400';
    return 'text-red-400';
  };

  // Build player list entries
  const playerListEntries: PlayerListEntry[] = playerStates.map((ps) => ({
    id: ps.player.id,
    name: ps.player.name,
    avatar: ps.player.avatar,
    bet: ps.bet,
    status: phase === 'betting' ? 'betting' :
            ps.cashedOut ? `${ps.cashoutMultiplier?.toFixed(2)}x` :
            phase === 'crashed' ? 'CRASHED' :
            'flying',
    profit: ps.cashedOut ? ps.profit : phase === 'crashed' ? -ps.bet : null,
    isHuman: ps.player.id === 'human',
  }));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Crash</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 tracking-wider uppercase">
            Live
          </span>
        </div>
        <span className="text-zinc-600 text-xs">Round #{roundNumber}</span>
      </div>

      {/* History pills */}
      {history.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin -mx-1 px-1">
          {history.map((h, i) => (
            <motion.div
              key={`${h.roundNumber}`}
              initial={i === 0 ? { scale: 0, opacity: 0 } : {}}
              animate={{ scale: 1, opacity: i === 0 ? 1 : 0.6 + (1 - i / history.length) * 0.4 }}
              className={`flex-shrink-0 px-2.5 py-1.5 text-[11px] font-bold ${
                h.crashPoint < 1.5 ? 'bg-red-600/20 text-red-400' :
                h.crashPoint < 2 ? 'bg-orange-600/15 text-orange-400' :
                h.crashPoint < 5 ? 'bg-zinc-800/50 text-zinc-300' :
                h.crashPoint < 10 ? 'bg-green-600/15 text-green-400' :
                'bg-yellow-600/15 text-yellow-400'
              }`}
            >
              {h.crashPoint.toFixed(2)}x
            </motion.div>
          ))}
        </div>
      )}

      {/* Main content: 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Rocket + controls */}
        <div className="lg:col-span-2 space-y-3">
          {/* Rocket display */}
          <div className="relative h-48 sm:h-56 border border-white/[0.04] bg-black overflow-hidden">
            {phase === 'crashed' && <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />}
            {hasCashed && phase !== 'betting' && <div className="absolute inset-0 bg-green-500/5 pointer-events-none animate-pulse" />}

            {/* Grid lines */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="absolute left-0 right-0 border-t border-white/[0.03]" style={{ bottom: `${i * 20}%` }}>
                <span className="text-zinc-800 text-[9px] absolute right-1 -top-3">
                  {(1 + i * (currentMultiplier > 5 ? currentMultiplier / 5 : 1)).toFixed(1)}x
                </span>
              </div>
            ))}

            {/* Trail */}
            {phase !== 'betting' && trail.length > 1 && (
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke={phase === 'crashed' && !hasCashed ? '#ef4444' : hasCashed ? '#facc15' : '#22c55e'}
                  strokeWidth="2"
                  strokeOpacity="0.5"
                  points={trail.map((m, i) => {
                    const x = (i / 60) * 100;
                    const y = 100 - Math.min(90, (m - 1) * 15);
                    return `${x}%,${y}%`;
                  }).join(' ')}
                />
              </svg>
            )}

            {/* Rocket */}
            <motion.div
              animate={{
                bottom: phase === 'betting' ? '10%' : phase === 'crashed' ? '5%' : `${10 + rocketY}%`,
                x: phase === 'crashed' ? [0, -3, 3, -3, 0] : 0,
              }}
              transition={phase === 'crashed' ? { duration: 0.3 } : { duration: 0.1 }}
              className="absolute left-1/2 -translate-x-1/2 text-3xl sm:text-4xl"
            >
              {phase === 'crashed' ? '💥' : hasCashed ? '👻' : '🚀'}
            </motion.div>

            {/* Multiplier overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              {phase === 'betting' ? (
                <div className="text-center">
                  <p className="text-zinc-500 text-sm tracking-wider uppercase mb-1">Place your bets</p>
                  <motion.p
                    key={bettingTimeLeft}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className={`text-4xl sm:text-6xl font-black ${bettingTimeLeft <= 2 ? 'text-red-400' : 'text-white'}`}
                  >
                    {bettingTimeLeft}s
                  </motion.p>
                </div>
              ) : (
                <motion.span
                  key={phase === 'crashed' ? 'crashed' : currentMultiplier.toFixed(1)}
                  initial={phase === 'crashed' ? { scale: 1.5 } : {}}
                  animate={{ scale: 1 }}
                  className={`text-4xl sm:text-6xl font-black ${
                    phase === 'crashed' ? 'text-red-500' : getMultColor(currentMultiplier)
                  }`}
                >
                  {currentMultiplier.toFixed(2)}x
                </motion.span>
              )}
            </div>

            {/* Status labels */}
            {phase === 'crashed' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 text-xs font-bold tracking-widest uppercase"
              >
                CRASHED
              </motion.div>
            )}
            {hasCashed && phase !== 'betting' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-1 text-xs font-bold tracking-widest uppercase"
              >
                CASHED
              </motion.div>
            )}
          </div>

          {/* Result */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className={`text-2xl sm:text-3xl font-black ${result.win ? 'text-green-400' : 'text-red-400'}`}>
                  {result.text}
                </p>
                <p className={`text-xs mt-1 ${result.win ? 'text-green-500/70' : 'text-zinc-600'}`}>
                  {result.sub}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          {phase === 'betting' && !hasBet && (
            <div className="space-y-3">
              <CountdownTimer totalSeconds={5} remainingSeconds={bettingTimeLeft} label="Betting closes in" />
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

          {phase === 'betting' && hasBet && (
            <div className="text-center text-green-400/60 text-xs font-bold py-4 animate-pulse tracking-wider uppercase">
              Bet placed — waiting for launch...
            </div>
          )}

          {phase === 'flying' && hasBet && !hasCashed && (
            <button
              onClick={cashOut}
              className="w-full bg-green-600 text-white py-5 text-base font-black tracking-widest uppercase hover:bg-green-500 transition-all animate-pulse shadow-[0_0_30px_rgba(34,197,94,0.3)]"
            >
              CASH OUT ${Math.floor(bet * currentMultiplier).toLocaleString()}
            </button>
          )}

          {phase === 'flying' && hasCashed && (
            <div className="text-center text-yellow-400/60 text-xs font-bold py-4 animate-pulse tracking-wider uppercase">
              cashed out — watching for crash...
            </div>
          )}

          {phase === 'flying' && !hasBet && (
            <div className="text-center text-zinc-600 text-xs py-4 tracking-wider uppercase">
              watching round...
            </div>
          )}

          {phase === 'crashed' && (
            <div className="text-center text-zinc-500 text-xs py-3 animate-pulse tracking-wider uppercase">
              next round starting soon...
            </div>
          )}

          {/* Cashout feed */}
          {cashoutFeed.length > 0 && phase !== 'betting' && (
            <div className="border border-white/[0.04] divide-y divide-white/[0.03]">
              <div className="px-3 py-1.5 border-b border-white/[0.04]">
                <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Cashouts</span>
              </div>
              {cashoutFeed.slice(0, 8).map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={i === 0 ? { opacity: 0, x: -10 } : {}}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{entry.avatar}</span>
                    <span className="text-zinc-400 text-[11px] font-bold">{entry.playerName}</span>
                    <span className="text-green-500/70 text-[10px]">{entry.multiplier.toFixed(2)}x</span>
                  </div>
                  <span className="text-green-400 text-[11px] font-bold font-mono">
                    +${entry.profit.toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar: Players + Chat */}
        <div className="space-y-3">
          <PlayerList players={playerListEntries} title="Players" />
          <MultiplayerChat messages={chatMessages} onSend={sendChat} collapsed />
        </div>
      </div>
    </div>
  );
}
