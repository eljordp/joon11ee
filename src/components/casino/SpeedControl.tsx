'use client';

import { sounds } from '@/lib/sounds';

const SPEEDS = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '5x', value: 5 },
];

interface Props {
  speed: number;
  setSpeed: (s: number) => void;
  disabled?: boolean;
}

export default function SpeedControl({ speed, setSpeed, disabled }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-600 text-[10px] tracking-wider uppercase mr-1">Speed</span>
      {SPEEDS.map((s) => (
        <button
          key={s.value}
          onClick={() => { if (!disabled) { sounds.click(); setSpeed(s.value); } }}
          className={`px-2.5 py-1 text-[11px] font-bold transition-all ${
            speed === s.value
              ? 'bg-white/10 text-white'
              : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
