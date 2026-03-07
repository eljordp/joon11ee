'use client';

import { motion } from 'framer-motion';

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface Props {
  players: Player[];
  isHost: boolean;
  prizePool: number;
  onStart: () => void;
}

export default function TournamentLobby({ players, isHost, prizePool, onStart }: Props) {
  const slots = [0, 1, 2, 3];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-white font-bold text-lg tracking-wider uppercase">Tournament Lobby</h3>
        <p className="text-zinc-500 text-xs mt-1">4-Player Single Elimination Blackjack</p>
        <div className="mt-3 inline-block px-4 py-1.5 border border-yellow-500/20 bg-yellow-500/5">
          <span className="text-yellow-400 text-xs font-bold tracking-wider">Prize Pool: ${prizePool.toLocaleString()}</span>
        </div>
      </div>

      {/* Player slots */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        {slots.map((i) => {
          const player = players[i];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className={`border p-4 text-center ${
                player
                  ? 'border-green-500/20 bg-green-500/5'
                  : 'border-white/[0.04] border-dashed'
              }`}
            >
              {player ? (
                <>
                  <span className="text-2xl block mb-1">{player.avatar}</span>
                  <span className="text-white text-sm font-bold">{player.name}</span>
                  <span className="text-green-400 text-[9px] block mt-0.5 uppercase tracking-wider">Ready</span>
                </>
              ) : (
                <>
                  <span className="text-zinc-700 text-2xl block mb-1">?</span>
                  <span className="text-zinc-600 text-xs">Waiting...</span>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Start button */}
      {isHost && (
        <div className="text-center">
          <button
            onClick={onStart}
            disabled={players.length < 4}
            className="px-8 py-3 bg-yellow-500 text-black font-bold text-sm tracking-widest uppercase hover:bg-yellow-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {players.length < 4 ? `Waiting for ${4 - players.length} more...` : 'Start Tournament'}
          </button>
        </div>
      )}

      {!isHost && players.length < 4 && (
        <p className="text-center text-zinc-500 text-xs">Waiting for host to start...</p>
      )}
    </div>
  );
}
