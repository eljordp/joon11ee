'use client';

interface Props {
  count: number;
  isSpectating?: boolean;
}

export default function SpectatorBadge({ count, isSpectating }: Props) {
  if (count === 0 && !isSpectating) return null;

  return (
    <div className="flex items-center gap-2">
      {isSpectating && (
        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 tracking-wider uppercase">
          Watching
        </span>
      )}
      {count > 0 && (
        <span className="text-zinc-600 text-[10px] flex items-center gap-1">
          <span>👁</span> {count} watching
        </span>
      )}
    </div>
  );
}
