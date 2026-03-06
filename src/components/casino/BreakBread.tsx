'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Friend } from '@/lib/auth';

interface Props {
  open: boolean;
  onClose: () => void;
  balance: number;
  onSend: (toUsername: string, amount: number) => string | true;
  friends?: Friend[];
  tablePlayers?: { name: string }[];
  myUsername?: string;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

export default function BreakBread({ open, onClose, balance, onSend, friends, tablePlayers, myUsername }: Props) {
  const [tab, setTab] = useState<'friends' | 'table'>('friends');
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setSelected(null);
    setAmount(100);
    setCustomAmount('');
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = () => {
    if (!selected) return;
    const sendAmount = customAmount ? parseInt(customAmount) : amount;
    if (!sendAmount || sendAmount <= 0) { setError('Enter a valid amount.'); return; }
    if (sendAmount > balance) { setError('Insufficient balance.'); return; }

    setLoading(true);
    setError('');
    setSuccess('');

    // Small delay for feel
    setTimeout(() => {
      const result = onSend(selected, sendAmount);
      if (result === true) {
        setSuccess(`Sent $${sendAmount.toLocaleString()} to @${selected}`);
        setSelected(null);
        setCustomAmount('');
      } else {
        setError(result);
      }
      setLoading(false);
    }, 200);
  };

  // Filter table players to exclude self
  const filteredTable = (tablePlayers || []).filter(
    p => p.name.toLowerCase() !== (myUsername || '').toLowerCase()
  );

  const hasFriends = friends && friends.length > 0;
  const hasTable = filteredTable.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md border border-white/[0.08] bg-black p-6"
          >
            {/* Close */}
            <button onClick={handleClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors text-xl">
              &times;
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🍞</div>
              <h2 className="text-xl font-bold text-white">Break Bread</h2>
              <p className="text-zinc-500 text-xs mt-1">Send chips to a friend or player</p>
              <p className="text-zinc-600 text-[10px] mt-1 font-mono">
                Balance: ${balance.toLocaleString()}
              </p>
            </div>

            {/* Tabs */}
            {hasTable && (
              <div className="flex gap-1 mb-4">
                <button
                  onClick={() => { setTab('friends'); setSelected(null); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 text-[10px] font-bold tracking-widest uppercase transition-all ${
                    tab === 'friends' ? 'bg-red-600 text-white' : 'bg-white/[0.04] text-zinc-500 hover:text-white'
                  }`}
                >
                  Friends
                </button>
                <button
                  onClick={() => { setTab('table'); setSelected(null); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 text-[10px] font-bold tracking-widest uppercase transition-all ${
                    tab === 'table' ? 'bg-red-600 text-white' : 'bg-white/[0.04] text-zinc-500 hover:text-white'
                  }`}
                >
                  At Table
                </button>
              </div>
            )}

            {/* Success message */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 text-center py-3 bg-green-600/10 border border-green-500/20"
                >
                  <p className="text-green-400 text-sm font-bold">{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Player list */}
            {!selected && (
              <div className="max-h-[200px] overflow-y-auto space-y-1 mb-4">
                {tab === 'friends' && (
                  <>
                    {hasFriends ? friends!.map((f) => (
                      <button
                        key={f.username}
                        onClick={() => { setSelected(f.username); setError(''); setSuccess(''); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 border border-white/[0.06] hover:border-red-600/30 hover:bg-red-600/5 transition-all text-left"
                      >
                        <span className="text-white text-sm font-bold">@{f.username}</span>
                        <span className="text-zinc-600 text-[10px]">friend</span>
                      </button>
                    )) : (
                      <div className="text-center py-6">
                        <p className="text-zinc-600 text-sm">No friends added yet</p>
                        <p className="text-zinc-700 text-xs mt-1">Add friends from your profile page</p>
                      </div>
                    )}
                  </>
                )}
                {tab === 'table' && (
                  <>
                    {hasTable ? filteredTable.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => { setSelected(p.name); setError(''); setSuccess(''); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 border border-white/[0.06] hover:border-red-600/30 hover:bg-red-600/5 transition-all text-left"
                      >
                        <span className="text-white text-sm font-bold">@{p.name}</span>
                        <span className="text-zinc-600 text-[10px]">at table</span>
                      </button>
                    )) : (
                      <div className="text-center py-6">
                        <p className="text-zinc-600 text-sm">No other players at the table</p>
                        <p className="text-zinc-700 text-xs mt-1">Join a multiplayer room first</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Selected player - amount selection */}
            {selected && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelected(null); setError(''); }} className="text-zinc-500 hover:text-white text-sm transition-colors">
                    &larr;
                  </button>
                  <span className="text-white text-sm font-bold">Sending to @{selected}</span>
                </div>

                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => { setAmount(a); setCustomAmount(''); setError(''); }}
                      disabled={a > balance}
                      className={`py-2.5 text-xs font-bold tracking-wider transition-all ${
                        amount === a && !customAmount
                          ? 'bg-red-600 text-white'
                          : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-20'
                      }`}
                    >
                      ${a >= 1000 ? `${a / 1000}K` : a}
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <div>
                  <label className="block text-zinc-500 text-[10px] tracking-wider uppercase mb-1">Custom Amount</label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setError(''); }}
                    placeholder="Enter amount..."
                    min={1}
                    max={balance}
                    className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm font-mono"
                  />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  onClick={handleSend}
                  disabled={loading || (!customAmount && !amount)}
                  className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-30"
                >
                  {loading ? '...' : `Send $${(customAmount ? parseInt(customAmount) || 0 : amount).toLocaleString()}`}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
