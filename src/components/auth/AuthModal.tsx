'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { login, signup, type UserData } from '@/lib/auth';

interface Props {
  open: boolean;
  onClose: () => void;
  onAuth: (user: UserData) => void;
  required?: boolean;
}

export default function AuthModal({ open, onClose, onAuth, required }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>(required ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (mode === 'login') {
        const result = login(email, password);
        if (typeof result === 'string') {
          setError(result);
          setLoading(false);
        } else {
          onAuth(result);
        }
      } else {
        if (!name.trim()) { setError('Name is required.'); setLoading(false); return; }
        if (password.length < 4) { setError('Password must be at least 4 characters.'); setLoading(false); return; }
        const result = signup(email, name, password);
        if (typeof result === 'string') {
          setError(result);
          setLoading(false);
        } else {
          onAuth(result);
        }
      }
    }, 300);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={required ? undefined : onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md border border-white/[0.08] bg-black p-8"
          >
            {/* Close */}
            {!required && (
              <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors text-xl">
                &times;
              </button>
            )}

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-12 h-12 border-2 border-red-600 flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">J</span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                {mode === 'login' ? 'Sign in to track your rentals and casino stats' : 'Join JOON11EE for the full experience'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Username</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
                    maxLength={16}
                    className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                    placeholder="Pick a username"
                    required
                  />
                  <p className="text-zinc-700 text-[10px] mt-1">Letters, numbers, _ and . only</p>
                </div>
              )}

              <div>
                <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                  placeholder="you@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                  placeholder="Enter password"
                  required
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-50"
              >
                {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                className="text-zinc-500 text-sm hover:text-white transition-colors"
              >
                {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
