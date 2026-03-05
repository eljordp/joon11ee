export default function Loading() {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="relative">
          <div className="w-16 h-16 border-2 border-red-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-2xl tracking-tighter">J</span>
          </div>
          <div className="absolute inset-0 border-2 border-red-600/30 animate-ping" />
        </div>

        {/* Loading bar */}
        <div className="w-48 h-[2px] bg-zinc-900 overflow-hidden">
          <div className="h-full bg-red-600 animate-shimmer" style={{ width: '60%' }} />
        </div>

        <p className="text-zinc-600 text-xs tracking-[0.3em] uppercase">Loading</p>
      </div>
    </div>
  );
}
