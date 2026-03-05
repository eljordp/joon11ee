'use client';

import { useState, useMemo, useCallback } from 'react';
import { sounds } from '@/lib/sounds';

interface BetControlsProps {
  balance: number;
  bet: number;
  setBet: (amount: number) => void;
  disabled?: boolean;
}

/**
 * Rounds a number to a "nice" value for bet buttons.
 * e.g. 4823 -> 5000, 127 -> 125, 53 -> 50, 7 -> 10
 */
function roundToNice(n: number): number {
  if (n <= 0) return 10;
  if (n < 10) return 10;
  if (n < 25) return Math.round(n / 5) * 5 || 10;
  if (n < 100) return Math.round(n / 25) * 25;
  if (n < 500) return Math.round(n / 50) * 50;
  if (n < 1000) return Math.round(n / 100) * 100;
  if (n < 5000) return Math.round(n / 250) * 250;
  if (n < 25000) return Math.round(n / 1000) * 1000;
  if (n < 100000) return Math.round(n / 5000) * 5000;
  return Math.round(n / 10000) * 10000;
}

function formatAmount(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 10000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `$${n.toLocaleString()}`;
}

function generatePresets(balance: number): number[] {
  const MIN_BET = 10;
  if (balance < MIN_BET) return [];

  const percentages = [0.01, 0.05, 0.10, 0.25, 0.50];
  const seen = new Set<number>();
  const presets: number[] = [];

  for (const pct of percentages) {
    let amount = roundToNice(Math.floor(balance * pct));
    if (amount < MIN_BET) amount = MIN_BET;
    if (amount > balance) amount = balance;
    if (!seen.has(amount)) {
      seen.add(amount);
      presets.push(amount);
    }
  }

  return presets;
}

export default function BetControls({ balance, bet, setBet, disabled = false }: BetControlsProps) {
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const MIN_BET = 10;
  const presets = useMemo(() => generatePresets(balance), [balance]);

  const applyBet = useCallback((amount: number) => {
    if (disabled) return;
    const clamped = Math.max(MIN_BET, Math.min(amount, balance));
    sounds.click();
    setBet(clamped);
  }, [disabled, balance, setBet]);

  const handleCustomSubmit = useCallback(() => {
    const parsed = parseInt(customInput, 10);
    if (isNaN(parsed) || parsed < MIN_BET) {
      applyBet(MIN_BET);
    } else {
      applyBet(parsed);
    }
    setCustomInput('');
    setShowCustom(false);
  }, [customInput, applyBet]);

  const handleHalf = useCallback(() => {
    const half = Math.max(MIN_BET, Math.floor(bet / 2));
    applyBet(half);
  }, [bet, applyBet]);

  const handleAllIn = useCallback(() => {
    applyBet(balance);
  }, [balance, applyBet]);

  if (balance < MIN_BET) {
    return (
      <div className="text-center py-3">
        <p className="text-red-400 text-xs font-bold">Minimum bet is $10</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Preset bet buttons */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <span className="text-zinc-600 text-[10px] tracking-wider uppercase">Bet</span>
        {presets.map((amount) => (
          <button
            key={amount}
            onClick={() => applyBet(amount)}
            disabled={disabled}
            className={`px-3 py-2 text-xs font-bold transition-all ${
              bet === amount
                ? 'bg-red-600 text-white'
                : 'border border-white/10 text-zinc-500 hover:text-white hover:border-white/20'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {formatAmount(amount)}
          </button>
        ))}
      </div>

      {/* Half / Custom / All In row */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          onClick={handleHalf}
          disabled={disabled || bet <= MIN_BET}
          className="px-3 py-2 text-xs font-bold border border-white/10 text-zinc-500 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Half
        </button>

        {showCustom ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleCustomSubmit(); }}
            className="flex items-center gap-1"
          >
            <span className="text-zinc-500 text-xs">$</span>
            <input
              type="number"
              min={MIN_BET}
              max={balance}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onBlur={() => { if (!customInput) setShowCustom(false); }}
              autoFocus
              placeholder={`${MIN_BET}-${balance.toLocaleString()}`}
              className="w-28 px-2 py-2 text-xs font-bold bg-black border border-white/20 text-white outline-none focus:border-red-600 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="submit"
              className="px-3 py-2 text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition-all"
            >
              Set
            </button>
          </form>
        ) : (
          <button
            onClick={() => { if (!disabled) { sounds.click(); setShowCustom(true); } }}
            disabled={disabled}
            className="px-3 py-2 text-xs font-bold border border-dashed border-white/10 text-zinc-500 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Custom
          </button>
        )}

        <button
          onClick={handleAllIn}
          disabled={disabled}
          className="px-3 py-2 text-xs font-bold border border-red-600/40 text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          All In
        </button>
      </div>

      {/* Current bet display when using custom amount not in presets */}
      {!presets.includes(bet) && (
        <div className="text-center">
          <span className="text-zinc-500 text-[10px] tracking-wider uppercase">Current: </span>
          <span className="text-white text-xs font-bold">${bet.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
