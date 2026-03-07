'use client';

import { motion } from 'framer-motion';

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface MatchResult {
  player1: string;
  player2: string;
  winner: string;
  p1Wins: number;
  p2Wins: number;
}

interface Props {
  players: Player[];
  bracket: {
    round1: [MatchResult | null, MatchResult | null];
    finals: MatchResult | null;
  };
  winner: string | null;
  currentPhase: string;
}

function PlayerSlot({ player, isWinner, isActive }: { player?: Player; isWinner?: boolean; isActive?: boolean }) {
  return (
    <div className={`px-3 py-2 border text-sm font-bold flex items-center gap-2 min-w-[120px] ${
      isWinner ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' :
      isActive ? 'border-green-500/20 bg-green-500/5 text-white' :
      player ? 'border-white/10 text-zinc-400' :
      'border-white/[0.04] border-dashed text-zinc-700'
    }`}>
      {player ? (
        <>
          <span className="text-xs">{player.avatar}</span>
          <span className="truncate text-xs">{player.name}</span>
          {isWinner && <span className="ml-auto text-yellow-400 text-[10px]">W</span>}
        </>
      ) : (
        <span className="text-[10px] text-zinc-600">TBD</span>
      )}
    </div>
  );
}

function MatchBox({ match, players, label, isActive }: {
  match: MatchResult | null;
  players: Player[];
  label: string;
  isActive: boolean;
}) {
  const p1 = match ? players.find(p => p.id === match.player1) : undefined;
  const p2 = match ? players.find(p => p.id === match.player2) : undefined;

  return (
    <div className="space-y-1">
      <span className={`text-[9px] uppercase tracking-wider font-bold ${isActive ? 'text-green-400' : 'text-zinc-600'}`}>{label}</span>
      <PlayerSlot player={p1} isWinner={match?.winner === match?.player1} isActive={isActive && !match?.winner} />
      <div className="text-center text-zinc-700 text-[9px]">
        {match ? `${match.p1Wins} - ${match.p2Wins}` : 'vs'}
      </div>
      <PlayerSlot player={p2} isWinner={match?.winner === match?.player2} isActive={isActive && !match?.winner} />
    </div>
  );
}

export default function TournamentBracket({ players, bracket, winner, currentPhase }: Props) {
  const finalsP1 = bracket.round1[0]?.winner ? players.find(p => p.id === bracket.round1[0]!.winner) : undefined;
  const finalsP2 = bracket.round1[1]?.winner ? players.find(p => p.id === bracket.round1[1]!.winner) : undefined;

  // Build synthetic finals match for display if we have the finalists but finals haven't finished
  const finalsForDisplay = bracket.finals || (finalsP1 && finalsP2 ? {
    player1: finalsP1.id, player2: finalsP2.id, winner: '', p1Wins: 0, p2Wins: 0,
  } : null);

  return (
    <div className="space-y-4">
      <h4 className="text-white font-bold text-sm tracking-wider uppercase text-center">Bracket</h4>

      <div className="flex items-center justify-center gap-8">
        {/* Round 1 */}
        <div className="space-y-6">
          <MatchBox
            match={bracket.round1[0] || (players.length >= 2 ? { player1: players[0].id, player2: players[1].id, winner: '', p1Wins: 0, p2Wins: 0 } : null)}
            players={players}
            label="Semi 1"
            isActive={currentPhase === 'round_1' && !bracket.round1[0]}
          />
          <MatchBox
            match={bracket.round1[1] || (players.length >= 4 ? { player1: players[2].id, player2: players[3].id, winner: '', p1Wins: 0, p2Wins: 0 } : null)}
            players={players}
            label="Semi 2"
            isActive={currentPhase === 'round_1' && !!bracket.round1[0] && !bracket.round1[1]}
          />
        </div>

        {/* Connector */}
        <div className="w-8 flex flex-col items-center justify-center gap-4">
          <div className="w-px h-16 bg-white/10" />
          <span className="text-zinc-600 text-[9px]">→</span>
          <div className="w-px h-16 bg-white/10" />
        </div>

        {/* Finals */}
        <div>
          <MatchBox
            match={finalsForDisplay}
            players={players}
            label="Finals"
            isActive={currentPhase === 'finals'}
          />
        </div>
      </div>

      {/* Winner banner */}
      {winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mt-4 py-4 border border-yellow-500/30 bg-yellow-500/5"
        >
          <span className="text-3xl block mb-2">🏆</span>
          <span className="text-yellow-400 font-bold text-lg">{players.find(p => p.id === winner)?.name || 'Champion'}</span>
          <span className="text-zinc-500 text-xs block mt-1">Tournament Champion!</span>
        </motion.div>
      )}
    </div>
  );
}
