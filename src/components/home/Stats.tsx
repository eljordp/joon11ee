'use client';

import RevealOnScroll from '@/components/ui/RevealOnScroll';
import CounterAnimation from '@/components/ui/CounterAnimation';

const stats = [
  { value: 15, suffix: '+', label: 'Exotic Vehicles' },
  { value: 3, suffix: '', label: 'Major Cities' },
  { value: 500, suffix: '+', label: 'Happy Clients' },
  { value: 24, suffix: '/7', label: 'Concierge Support' },
];

export default function Stats() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-red-950/5 to-black" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {stats.map((stat, i) => (
            <RevealOnScroll key={stat.label} delay={i * 0.15}>
              <div className="text-center p-8 border border-white/[0.04] hover:border-red-600/20 transition-colors duration-500">
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  <CounterAnimation
                    target={stat.value}
                    suffix={stat.suffix}
                    duration={2000}
                  />
                </div>
                <p className="text-zinc-500 text-sm tracking-wider uppercase">{stat.label}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
