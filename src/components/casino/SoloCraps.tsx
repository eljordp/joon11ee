'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/sounds';
import BetControls from './BetControls';

interface Props {
  balance: number;
  onWin: (amount: number, wagered?: number) => void;
  onLose: (amount: number) => void;
}

interface CrapsBet { type: 'pass' | 'dont_pass' | 'field' | 'place'; amount: number; placeNumber?: number; }
interface BotPlayer { id: string; name: string; avatar: string; bets: CrapsBet[]; }

type Phase = 'betting' | 'rolling' | 'point_betting' | 'point_rolling' | 'results';

const DICE_FACES: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };
const PLACE_ODDS: Record<number, [number, number]> = { 4: [9, 5], 5: [7, 5], 6: [7, 6], 8: [7, 6], 9: [7, 5], 10: [9, 5] };
const PLACE_ODDS_DISPLAY: Record<number, string> = { 4: '9:5', 5: '7:5', 6: '7:6', 8: '7:6', 9: '7:5', 10: '9:5' };
const BETTING_DURATION = 8;
const BOT_BET_AMOUNTS = [50, 100, 100, 200, 200, 500];

const BOTS: Omit<BotPlayer, 'bets'>[] = [
  { id: 'bot_1', name: 'Lucky Lou', avatar: '🎰' },
  { id: 'bot_2', name: 'Snake Eyes', avatar: '🐍' },
  { id: 'bot_3', name: 'Big Mike', avatar: '💪' },
];

function getOutcomeLabel(total: number, point: number | null): { text: string; color: string } | null {
  if (point === null) {
    if (total === 7 || total === 11) return { text: 'NATURAL!', color: 'text-green-400' };
    if (total === 2 || total === 3) return { text: 'CRAPS!', color: 'text-orange-400' };
    if (total === 12) return { text: 'CRAPS! (12)', color: 'text-orange-400' };
    return { text: `POINT IS ${total}`, color: 'text-yellow-400' };
  } else {
    if (total === point) return { text: 'POINT HIT!', color: 'text-yellow-400' };
    if (total === 7) return { text: 'SEVEN OUT!', color: 'text-red-400' };
    return null;
  }
}

export default function SoloCraps({ balance, onWin, onLose }: Props) {
  const [bet, setBet] = useState(100);
  const [phase, setPhase] = useState<Phase>('betting');
  const [point, setPoint] = useState<number | null>(null);
  const [dice, setDice] = useState<[number, number]>([0, 0]);
  const [diceTotal, setDiceTotal] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [rollHistory, setRollHistory] = useState<{ dice: [number, number]; total: number }[]>([]);
  const [bettingTimeLeft, setBettingTimeLeft] = useState(BETTING_DURATION);
  const [myBets, setMyBets] = useState<CrapsBet[]>([]);
  const [bots, setBots] = useState<BotPlayer[]>(() => BOTS.map(b => ({ ...b, bets: [] })));
  const [results, setResults] = useState<{ name: string; profit: number; isMe?: boolean }[]>([]);
  const [diceRolling, setDiceRolling] = useState(false);
  const [outcomeLabel, setOutcomeLabel] = useState<{ text: string; color: string } | null>(null);
  const [resultDisplay, setResultDisplay] = useState<{ text: string; sub: string; win: boolean | null } | null>(null);
  const [roundWagered, setRoundWagered] = useState(0);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bettingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointRef = useRef<number | null>(null);
  const myBetsRef = useRef<CrapsBet[]>([]);
  const botsRef = useRef<BotPlayer[]>(bots);
  const phaseRef = useRef<Phase>('betting');

  // Keep refs in sync
  useEffect(() => { pointRef.current = point; }, [point]);
  useEffect(() => { myBetsRef.current = myBets; }, [myBets]);
  useEffect(() => { botsRef.current = bots; }, [bots]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    if (bettingTimerRef.current) { clearInterval(bettingTimerRef.current); bettingTimerRef.current = null; }
  }, []);

  useEffect(() => { return clearTimers; }, [clearTimers]);

  // Bot betting logic
  const botsBet = useCallback((isPointPhase: boolean) => {
    const currentBots = botsRef.current;
    for (const bot of currentBots) {
      const delay = 500 + Math.random() * 3000;
      const t = setTimeout(() => {
        if (phaseRef.current !== 'betting' && phaseRef.current !== 'point_betting') return;
        const amount = BOT_BET_AMOUNTS[Math.floor(Math.random() * BOT_BET_AMOUNTS.length)];
        let newBet: CrapsBet;

        if (!isPointPhase) {
          const roll = Math.random();
          const betType = roll < 0.55 ? 'pass' : roll < 0.75 ? 'dont_pass' : 'field';
          newBet = { type: betType as CrapsBet['type'], amount };
        } else {
          const roll = Math.random();
          if (roll < 0.4) {
            newBet = { type: 'field', amount };
          } else {
            const placeNums = [4, 5, 6, 8, 9, 10].filter(n => n !== pointRef.current);
            const placeNumber = placeNums[Math.floor(Math.random() * placeNums.length)];
            newBet = { type: 'place', amount, placeNumber };
          }
        }

        setBots(prev => prev.map(b =>
          b.id === bot.id ? { ...b, bets: [...b.bets, newBet] } : b
        ));
      }, delay);
      timersRef.current.push(t);
    }
  }, []);

  // Start betting phase
  const startBetting = useCallback((isPoint: boolean) => {
    const newPhase = isPoint ? 'point_betting' : 'betting';
    setPhase(newPhase);
    setResultDisplay(null);
    setOutcomeLabel(null);
    setResults([]);

    if (!isPoint) {
      setRoundNumber(r => r + 1);
      setMyBets([]);
      setBots(prev => prev.map(b => ({ ...b, bets: [] })));
      setRoundWagered(0);
    }

    let remaining = BETTING_DURATION;
    setBettingTimeLeft(remaining);

    botsBet(isPoint);

    bettingTimerRef.current = setInterval(() => {
      remaining--;
      setBettingTimeLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        if (bettingTimerRef.current) { clearInterval(bettingTimerRef.current); bettingTimerRef.current = null; }
        setPhase(isPoint ? 'point_rolling' : 'rolling');
      }
    }, 1000);
  }, [botsBet]);

  // Auto-start first round
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      startBetting(false);
    }
  }, [startBetting]);

  // Resolve field bets helper
  const resolveFieldBets = useCallback((total: number, playerBets: CrapsBet[], botsList: BotPlayer[]) => {
    const fieldWins = [2, 3, 4, 9, 10, 11, 12].includes(total);
    const doubleField = total === 2 || total === 12;
    const resultUpdates: { name: string; profit: number; isMe?: boolean }[] = [];
    let newPlayerBets = playerBets.filter(b => {
      if (b.type !== 'field') return true;
      const profit = fieldWins ? (doubleField ? b.amount * 2 : b.amount) : -b.amount;
      resultUpdates.push({ name: 'You', profit, isMe: true });
      return false;
    });
    const newBots = botsList.map(bot => {
      const kept: CrapsBet[] = [];
      for (const b of bot.bets) {
        if (b.type === 'field') {
          const profit = fieldWins ? (doubleField ? b.amount * 2 : b.amount) : -b.amount;
          resultUpdates.push({ name: bot.name, profit });
        } else {
          kept.push(b);
        }
      }
      return { ...bot, bets: kept };
    });
    return { newPlayerBets, newBots, resultUpdates };
  }, []);

  // Resolve place bets helper
  const resolvePlaceBets = useCallback((total: number, playerBets: CrapsBet[], botsList: BotPlayer[]) => {
    const resultUpdates: { name: string; profit: number; isMe?: boolean }[] = [];
    // Place bets stay active (correct craps rules) - pay on hit
    for (const b of playerBets) {
      if (b.type === 'place' && b.placeNumber === total) {
        const odds = PLACE_ODDS[total];
        const profit = Math.floor(b.amount * odds[0] / odds[1]);
        resultUpdates.push({ name: 'You', profit, isMe: true });
      }
    }
    for (const bot of botsList) {
      for (const b of bot.bets) {
        if (b.type === 'place' && b.placeNumber === total) {
          const odds = PLACE_ODDS[total];
          const profit = Math.floor(b.amount * odds[0] / odds[1]);
          resultUpdates.push({ name: bot.name, profit });
        }
      }
    }
    return resultUpdates;
  }, []);

  // Roll dice and resolve
  const rollDice = useCallback(() => {
    if (phaseRef.current !== 'rolling' && phaseRef.current !== 'point_rolling') return;

    setDiceRolling(true);
    setOutcomeLabel(null);
    sounds.diceRoll();

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;

    const t = setTimeout(() => {
      setDiceRolling(false);
      setDice([d1, d2]);
      setDiceTotal(total);
      setRollHistory(prev => [{ dice: [d1, d2] as [number, number], total }, ...prev].slice(0, 20));
      sounds.diceLand();

      const currentPoint = pointRef.current;
      const currentBets = myBetsRef.current;
      const currentBots = botsRef.current;

      // Show outcome label
      const label = getOutcomeLabel(total, currentPoint);
      if (label) setOutcomeLabel(label);

      if (currentPoint === null) {
        // Come-out roll
        if (total === 7 || total === 11) {
          resolveRound('pass_wins', total, currentBets, currentBots);
        } else if (total === 2 || total === 3) {
          resolveRound('pass_loses', total, currentBets, currentBots);
        } else if (total === 12) {
          resolveRound('pass_loses_dp_push', total, currentBets, currentBots);
        } else {
          // Set point
          setPoint(total);
          const { newPlayerBets, newBots, resultUpdates } = resolveFieldBets(total, currentBets, currentBots);
          setMyBets(newPlayerBets);
          setBots(newBots);
          if (resultUpdates.length > 0) setResults(prev => mergeResults(prev, resultUpdates));
          const t2 = setTimeout(() => startBetting(true), 1500);
          timersRef.current.push(t2);
        }
      } else {
        // Point roll
        if (total === currentPoint) {
          resolveRound('point_hit', total, currentBets, currentBots);
        } else if (total === 7) {
          resolveRound('seven_out', total, currentBets, currentBots);
        } else {
          // Resolve field + place bets, continue
          const field = resolveFieldBets(total, currentBets, currentBots);
          const place = resolvePlaceBets(total, field.newPlayerBets, field.newBots);
          setMyBets(field.newPlayerBets);
          setBots(field.newBots);
          const allUpdates = [...field.resultUpdates, ...place];
          if (allUpdates.length > 0) setResults(prev => mergeResults(prev, allUpdates));
          const t2 = setTimeout(() => startBetting(true), 1500);
          timersRef.current.push(t2);
        }
      }
    }, 800);
    timersRef.current.push(t);
  }, [resolveFieldBets, resolvePlaceBets, startBetting]);

  // Resolve a full round end
  const resolveRound = useCallback((outcome: string, total: number, playerBets: CrapsBet[], botsList: BotPlayer[]) => {
    const allResults: { name: string; profit: number; isMe?: boolean }[] = [];

    // Resolve pass/dont_pass/place for player
    for (const b of playerBets) {
      if (b.type === 'pass') {
        if (outcome === 'pass_wins' || outcome === 'point_hit') allResults.push({ name: 'You', profit: b.amount, isMe: true });
        else allResults.push({ name: 'You', profit: -b.amount, isMe: true });
      } else if (b.type === 'dont_pass') {
        if (outcome === 'pass_loses' || outcome === 'seven_out') allResults.push({ name: 'You', profit: b.amount, isMe: true });
        else if (outcome === 'pass_loses_dp_push') { /* push */ }
        else allResults.push({ name: 'You', profit: -b.amount, isMe: true });
      } else if (b.type === 'place') {
        if (outcome === 'seven_out') allResults.push({ name: 'You', profit: -b.amount, isMe: true });
      }
    }

    // Resolve for bots
    for (const bot of botsList) {
      for (const b of bot.bets) {
        if (b.type === 'pass') {
          if (outcome === 'pass_wins' || outcome === 'point_hit') allResults.push({ name: bot.name, profit: b.amount });
          else allResults.push({ name: bot.name, profit: -b.amount });
        } else if (b.type === 'dont_pass') {
          if (outcome === 'pass_loses' || outcome === 'seven_out') allResults.push({ name: bot.name, profit: b.amount });
          else if (outcome === 'pass_loses_dp_push') { /* push */ }
          else allResults.push({ name: bot.name, profit: -b.amount });
        } else if (b.type === 'place') {
          if (outcome === 'seven_out') allResults.push({ name: bot.name, profit: -b.amount });
        }
      }
    }

    // Resolve field bets for the final roll
    const field = resolveFieldBets(total, playerBets, botsList);
    allResults.push(...field.resultUpdates);

    // Merge and calculate player result
    const merged = mergeResults([], allResults);
    setResults(merged);

    const myTotal = merged.find(r => r.isMe);
    const wagered = roundWagered;
    if (myTotal) {
      if (myTotal.profit > 0) {
        sounds.win();
        onWin(myTotal.profit, wagered);
        setResultDisplay({ text: `+$${myTotal.profit.toLocaleString()}`, sub: 'nice roll!', win: true });
      } else if (myTotal.profit < 0) {
        sounds.lose();
        onLose(Math.abs(myTotal.profit));
        setResultDisplay({ text: `-$${Math.abs(myTotal.profit).toLocaleString()}`, sub: 'tough break', win: false });
      } else {
        setResultDisplay({ text: 'PUSH', sub: 'no change', win: null });
      }
    }

    setPhase('results');
    setPoint(null);
    setMyBets([]);
    setBots(prev => prev.map(b => ({ ...b, bets: [] })));

    const t = setTimeout(() => startBetting(false), 3000);
    timersRef.current.push(t);
  }, [resolveFieldBets, onWin, onLose, startBetting, roundWagered]);

  // Skip betting timer
  const skipTimer = useCallback(() => {
    if (bettingTimerRef.current) { clearInterval(bettingTimerRef.current); bettingTimerRef.current = null; }
    setBettingTimeLeft(0);
    setPhase(phaseRef.current === 'betting' ? 'rolling' : 'point_rolling');
  }, []);

  // Place a bet
  const placeBet = useCallback((betType: string, placeNumber?: number) => {
    const available = balance - roundWagered;
    if (available < bet) return;
    const newBet: CrapsBet = { type: betType as CrapsBet['type'], amount: bet, placeNumber };
    setMyBets(prev => [...prev, newBet]);
    setRoundWagered(prev => prev + bet);
    sounds.bet();
  }, [balance, bet, roundWagered]);

  const isBetting = phase === 'betting' || phase === 'point_betting';
  const isRolling = phase === 'rolling' || phase === 'point_rolling';
  const totalBetted = myBets.reduce((sum, b) => sum + b.amount, 0);
  const canBet = (balance - roundWagered) >= bet;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white">Craps</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 tracking-wider uppercase">Solo</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-600 text-xs font-mono">#{roundNumber}</span>
        </div>
      </div>

      {/* Players */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold px-2 py-1 bg-red-600/10 text-red-400 border border-red-500/20">
          You
        </span>
        {bots.map(bot => (
          <span key={bot.id} className="text-[10px] font-bold px-2 py-1 bg-white/[0.03] text-zinc-500 border border-white/[0.06]">
            {bot.avatar} {bot.name}
            <span className="text-zinc-700 ml-1">BOT</span>
          </span>
        ))}
      </div>

      {/* Roll history strip */}
      {rollHistory.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin -mx-1 px-1">
          {rollHistory.slice(0, 15).map((h, i) => (
            <motion.div key={`${roundNumber}-${h.total}-${i}`}
              initial={i === 0 ? { scale: 0, opacity: 0 } : {}}
              animate={{ scale: 1, opacity: Math.max(0.3, 1 - i * 0.05) }}
              transition={i === 0 ? { type: 'spring', stiffness: 300, damping: 20 } : {}}
              className={`flex-shrink-0 px-2 py-1 text-[10px] font-bold border ${
                h.total === 7 ? 'bg-red-600/15 text-red-400 border-red-500/20' :
                h.total === 11 ? 'bg-green-600/15 text-green-400 border-green-500/20' :
                [2, 3, 12].includes(h.total) ? 'bg-orange-600/10 text-orange-400 border-orange-500/15' :
                'bg-white/[0.02] text-zinc-400 border-white/[0.04]'
              }`}
            >
              <span className="opacity-60">{DICE_FACES[h.dice[0]]}{DICE_FACES[h.dice[1]]}</span> {h.total}
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3">
        {/* Main area */}
        <div className="space-y-3">
          {/* Phase indicator + Point */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 tracking-wider uppercase ${
              phase === 'betting' ? 'bg-green-600/10 text-green-400 border border-green-500/20' :
              phase === 'rolling' ? 'bg-red-600/10 text-red-400 border border-red-500/20' :
              phase === 'point_betting' ? 'bg-yellow-600/10 text-yellow-400 border border-yellow-500/20' :
              phase === 'point_rolling' ? 'bg-red-600/10 text-red-400 border border-red-500/20' :
              'bg-white/[0.03] text-zinc-400 border border-white/[0.06]'
            }`}>
              {phase === 'betting' ? 'Come-Out Bets' :
               phase === 'rolling' ? 'Rolling' :
               phase === 'point_betting' ? 'Point Bets' :
               phase === 'point_rolling' ? 'Rolling' :
               'Results'}
            </span>
            {point !== null && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="text-[10px] font-black px-2.5 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 tracking-wider uppercase"
              >
                Point: {point}
              </motion.span>
            )}
            <span className="text-[10px] font-bold px-2.5 py-1 tracking-wider bg-red-600/10 text-red-400 border border-red-500/20">
              You Shoot
            </span>
          </div>

          {/* Dice display area */}
          <div className={`relative border bg-black text-center overflow-hidden transition-colors duration-500 ${
            phase === 'results' && resultDisplay?.win === true ? 'border-green-500/20' :
            phase === 'results' && resultDisplay?.win === false ? 'border-red-500/20' :
            'border-white/[0.04]'
          }`}>
            {phase === 'results' && resultDisplay && (
              <div className={`absolute inset-0 pointer-events-none ${
                resultDisplay.win === true ? 'bg-green-600/[0.03]' : resultDisplay.win === false ? 'bg-red-600/[0.03]' : ''
              }`} />
            )}

            <div className="relative p-6 sm:p-10 min-h-[200px] flex flex-col items-center justify-center">
              {isBetting && (
                <div className="space-y-3">
                  <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase">
                    {phase === 'betting' ? 'Place your come-out bets' : 'Place your point bets'}
                  </p>
                  <motion.div key={bettingTimeLeft} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="relative">
                    <span className={`text-5xl sm:text-7xl font-black tabular-nums ${
                      bettingTimeLeft <= 2 ? 'text-red-400' : bettingTimeLeft <= 4 ? 'text-yellow-400' : 'text-white'
                    }`}>
                      {bettingTimeLeft}
                    </span>
                  </motion.div>
                  {totalBetted > 0 && (
                    <p className="text-zinc-600 text-xs">
                      Your bets: <span className="text-white font-bold font-mono">${totalBetted.toLocaleString()}</span>
                    </p>
                  )}
                </div>
              )}

              {(isRolling || phase === 'results') && (
                <div className="space-y-2">
                  {diceRolling ? (
                    <div className="flex items-center justify-center gap-4">
                      <motion.span
                        animate={{ rotate: [0, 180, 360], y: [0, -20, 0] }}
                        transition={{ duration: 0.4, repeat: 1, ease: 'easeInOut' }}
                        className="text-5xl sm:text-7xl inline-block"
                      >🎲</motion.span>
                      <motion.span
                        animate={{ rotate: [0, -180, -360], y: [0, -15, 0] }}
                        transition={{ duration: 0.4, repeat: 1, ease: 'easeInOut', delay: 0.05 }}
                        className="text-5xl sm:text-7xl inline-block"
                      >🎲</motion.span>
                    </div>
                  ) : diceTotal > 0 ? (
                    <div className="space-y-1">
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="flex items-center justify-center gap-3"
                      >
                        <span className="text-5xl sm:text-7xl">{DICE_FACES[dice[0]]}</span>
                        <span className="text-5xl sm:text-7xl">{DICE_FACES[dice[1]]}</span>
                      </motion.div>
                      <motion.p
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                        className={`text-4xl sm:text-6xl font-black ${
                          diceTotal === 7 && point !== null ? 'text-red-400' :
                          diceTotal === 7 || diceTotal === 11 ? 'text-green-400' :
                          [2, 3, 12].includes(diceTotal) ? 'text-orange-400' :
                          diceTotal === point ? 'text-yellow-400' : 'text-white'
                        }`}
                      >
                        {diceTotal}
                      </motion.p>
                      <AnimatePresence>
                        {outcomeLabel && (
                          <motion.p
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`text-sm sm:text-base font-black tracking-[0.15em] uppercase ${outcomeLabel.color}`}
                          >
                            {outcomeLabel.text}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl opacity-30">🎲🎲</div>
                      <p className="text-zinc-500 text-xs tracking-wider uppercase">Your roll — shoot!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Result display */}
          <AnimatePresence mode="wait">
            {resultDisplay && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="text-center py-1"
              >
                <p className={`text-2xl sm:text-3xl font-black ${
                  resultDisplay.win === true ? 'text-green-400' : resultDisplay.win === false ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {resultDisplay.text}
                </p>
                <p className={`text-[11px] mt-0.5 tracking-wider ${
                  resultDisplay.win === true ? 'text-green-500/60' : 'text-zinc-600'
                }`}>
                  {resultDisplay.sub}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bet controls */}
          {isBetting && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="h-1.5 bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full bg-red-600"
                      initial={{ width: '100%' }}
                      animate={{ width: `${(bettingTimeLeft / BETTING_DURATION) * 100}%` }}
                      transition={{ duration: 1, ease: 'linear' }}
                    />
                  </div>
                </div>
                <button onClick={skipTimer}
                  className="px-4 py-2 bg-white/[0.06] text-zinc-400 text-[10px] font-bold tracking-widest uppercase hover:bg-white/[0.1] hover:text-white transition-all border border-white/[0.08]"
                >
                  ROLL NOW
                </button>
              </div>
              <BetControls balance={balance - roundWagered} bet={bet} setBet={setBet} disabled={false} />

              {phase === 'betting' && (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => placeBet('pass')} disabled={!canBet}
                    className="relative bg-green-700/90 text-white py-3.5 text-xs font-bold tracking-widest uppercase hover:bg-green-600 transition-all disabled:opacity-30 group"
                  >
                    <span className="block">PASS</span>
                    <span className="text-[9px] font-mono opacity-60 group-hover:opacity-80">${bet}</span>
                  </button>
                  <button onClick={() => placeBet('dont_pass')} disabled={!canBet}
                    className="relative bg-red-700/90 text-white py-3.5 text-xs font-bold tracking-widest uppercase hover:bg-red-600 transition-all disabled:opacity-30 group"
                  >
                    <span className="block">DON&apos;T PASS</span>
                    <span className="text-[9px] font-mono opacity-60 group-hover:opacity-80">${bet}</span>
                  </button>
                  <button onClick={() => placeBet('field')} disabled={!canBet}
                    className="relative bg-yellow-700/90 text-white py-3.5 text-xs font-bold tracking-widest uppercase hover:bg-yellow-600 transition-all disabled:opacity-30 group"
                  >
                    <span className="block">FIELD</span>
                    <span className="text-[9px] font-mono opacity-60 group-hover:opacity-80">${bet}</span>
                  </button>
                </div>
              )}

              {phase === 'point_betting' && (
                <div className="space-y-2">
                  <button onClick={() => placeBet('field')} disabled={!canBet}
                    className="w-full bg-yellow-700/90 text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-yellow-600 transition-all disabled:opacity-30"
                  >
                    FIELD <span className="font-mono opacity-70">${bet}</span>
                    <span className="text-[9px] opacity-50 ml-2">2,3,4,9,10,11,12</span>
                  </button>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[4, 5, 6, 8, 9, 10].map(n => (
                      <button key={n} onClick={() => placeBet('place', n)} disabled={!canBet || n === point}
                        className={`py-2.5 text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-20 relative ${
                          n === point
                            ? 'bg-yellow-500/10 text-yellow-400/40 border border-yellow-500/20 cursor-not-allowed'
                            : 'bg-blue-700/80 text-white hover:bg-blue-600 border border-blue-600/30'
                        }`}
                      >
                        <span className="block">{n}</span>
                        <span className="text-[8px] font-mono opacity-50">{PLACE_ODDS_DISPLAY[n]}</span>
                        {n === point && (
                          <span className="absolute -top-1 -right-1 text-[7px] font-bold px-1 bg-yellow-500/30 text-yellow-400">PT</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Roll button */}
          {isRolling && !diceRolling && (
            <motion.button
              onClick={rollDice}
              initial={{ scale: 0.95 }}
              animate={{ scale: [0.95, 1.02, 0.95] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              className="w-full bg-red-600 text-white py-5 text-base font-black tracking-widest uppercase hover:bg-red-500 transition-colors shadow-[0_0_40px_rgba(220,38,38,0.25)] border border-red-500/30"
            >
              🎲 ROLL THE DICE
            </motion.button>
          )}

          {phase === 'results' && (
            <div className="text-center py-3">
              <motion.p
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-zinc-600 text-xs tracking-wider uppercase"
              >
                next round starting soon...
              </motion.p>
            </div>
          )}

          {/* My bets */}
          {myBets.length > 0 && (
            <div className="border border-white/[0.04] divide-y divide-white/[0.03]">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Your Bets</span>
                <span className="text-white text-[10px] font-bold font-mono">${totalBetted.toLocaleString()}</span>
              </div>
              {myBets.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      b.type === 'pass' ? 'bg-green-400' : b.type === 'dont_pass' ? 'bg-red-400' :
                      b.type === 'field' ? 'bg-yellow-400' : 'bg-blue-400'
                    }`} />
                    <span className={`text-[11px] font-bold uppercase ${
                      b.type === 'pass' ? 'text-green-400' : b.type === 'dont_pass' ? 'text-red-400' :
                      b.type === 'field' ? 'text-yellow-400' : 'text-blue-400'
                    }`}>
                      {b.type === 'place' ? `Place ${b.placeNumber}` : b.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-white text-[11px] font-bold font-mono">${b.amount}</span>
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          <AnimatePresence>
            {phase === 'results' && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="border border-white/[0.04] divide-y divide-white/[0.03]"
              >
                <div className="px-3 py-2">
                  <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Round Results</span>
                </div>
                {results.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center justify-between px-3 py-2 ${r.isMe ? 'bg-white/[0.02]' : ''}`}
                  >
                    <span className={`text-[11px] font-bold ${r.isMe ? 'text-white' : 'text-zinc-500'}`}>
                      {r.isMe ? '→ You' : r.name}
                    </span>
                    <span className={`text-[11px] font-bold font-mono ${
                      r.profit > 0 ? 'text-green-400' : r.profit < 0 ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {r.profit > 0 ? '+' : ''}{r.profit === 0 ? 'PUSH' : `$${r.profit.toLocaleString()}`}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Bot bets */}
          {bots.some(b => b.bets.length > 0) && (
            <div className="border border-white/[0.04] divide-y divide-white/[0.03]">
              <div className="px-3 py-1.5">
                <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold">Table Bets</span>
              </div>
              {bots.filter(b => b.bets.length > 0).map(bot => (
                <div key={bot.id} className="px-3 py-1.5">
                  <span className="text-[10px] font-bold block mb-0.5 text-zinc-500">
                    {bot.avatar} {bot.name}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {bot.bets.map((b, j) => (
                      <span key={j} className={`text-[9px] font-bold px-1.5 py-0.5 ${
                        b.type === 'pass' ? 'bg-green-600/15 text-green-400' :
                        b.type === 'dont_pass' ? 'bg-red-600/15 text-red-400' :
                        b.type === 'field' ? 'bg-yellow-600/15 text-yellow-400' :
                        'bg-blue-600/15 text-blue-400'
                      }`}>
                        {b.type === 'place' ? `P${b.placeNumber}` : b.type === 'dont_pass' ? 'DP' : b.type.charAt(0).toUpperCase() + b.type.slice(1)} {b.amount}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick rules */}
          <div className="border border-white/[0.04] p-3">
            <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold block mb-2">Come-Out Roll</span>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-green-400 font-bold">7 or 11</span>
                <span className="text-zinc-500">Pass wins</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-orange-400 font-bold">2, 3, 12</span>
                <span className="text-zinc-500">Pass loses</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-yellow-400 font-bold">Other</span>
                <span className="text-zinc-500">Sets point</span>
              </div>
            </div>
            <div className="border-t border-white/[0.04] mt-2 pt-2">
              <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold block mb-1">Point Roll</span>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-yellow-400 font-bold">Hit point</span>
                  <span className="text-zinc-500">Pass wins</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-red-400 font-bold">7 (seven out)</span>
                  <span className="text-zinc-500">Pass loses</span>
                </div>
              </div>
            </div>
            <div className="border-t border-white/[0.04] mt-2 pt-2">
              <span className="text-zinc-600 text-[10px] tracking-wider uppercase font-bold block mb-1">Field</span>
              <div className="flex justify-between text-[10px]">
                <span className="text-yellow-400 font-bold">2,3,4,9,10,11,12</span>
                <span className="text-zinc-500">1:1</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-yellow-300 font-bold">2 or 12</span>
                <span className="text-zinc-500">2:1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Merge results by name, summing profits
function mergeResults(existing: { name: string; profit: number; isMe?: boolean }[], updates: { name: string; profit: number; isMe?: boolean }[]): { name: string; profit: number; isMe?: boolean }[] {
  const map = new Map<string, { name: string; profit: number; isMe?: boolean }>();
  for (const r of existing) map.set(r.name, { ...r });
  for (const u of updates) {
    const key = u.name;
    const existing = map.get(key);
    if (existing) {
      existing.profit += u.profit;
    } else {
      map.set(key, { ...u });
    }
  }
  return [...map.values()];
}
