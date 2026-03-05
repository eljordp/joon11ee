'use client';

import RevealOnScroll from '@/components/ui/RevealOnScroll';
import CounterAnimation from '@/components/ui/CounterAnimation';
import ParticleBackground from '@/components/ui/ParticleBackground';
import MagneticButton from '@/components/ui/MagneticButton';
import Link from 'next/link';

const values = [
  {
    title: 'Uncompromising Quality',
    description: 'Every vehicle in our fleet is meticulously maintained and detailed to showroom standards.',
  },
  {
    title: 'White-Glove Service',
    description: '24/7 concierge support. Door-to-door delivery. We handle every detail so you enjoy the drive.',
  },
  {
    title: 'Curated Selection',
    description: 'We don\'t just stock cars — we curate experiences. Each vehicle is hand-selected for its performance and prestige.',
  },
  {
    title: 'Transparent Pricing',
    description: 'No hidden fees. No surprises. What you see is what you pay. Premium service at fair rates.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-32 pb-20">
      {/* Hero */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-600/8 rounded-full blur-[200px]" />
        </div>
        <ParticleBackground count={25} />

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <RevealOnScroll>
            <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold mb-6 block">
              Our Story
            </span>
            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6">
              Born from<br />
              <span className="text-red-600">Passion.</span>
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Joon11ee was founded on a simple belief: everyone deserves to experience the thrill of driving an exotic car. We make that dream accessible across three of America&apos;s most iconic cities.
            </p>
          </RevealOnScroll>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 border-y border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: 15, suffix: '+', label: 'Exotic Vehicles' },
              { value: 3, label: 'Cities' },
              { value: 500, suffix: '+', label: 'Happy Drivers' },
              { value: 5, label: 'Years Experience' },
            ].map((stat, i) => (
              <RevealOnScroll key={stat.label} delay={i * 0.1}>
                <div className="text-center">
                  <p className="text-4xl md:text-5xl font-bold text-white mb-2">
                    <CounterAnimation target={stat.value} suffix={stat.suffix || ''} />
                  </p>
                  <p className="text-zinc-500 text-sm tracking-wider uppercase">{stat.label}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <RevealOnScroll>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-[1px] bg-red-600" />
              <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold">
                What Sets Us Apart
              </span>
            </div>
            <h2 className="text-section-title text-white mb-16">
              Our Values.
            </h2>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((value, i) => (
              <RevealOnScroll key={value.title} delay={i * 0.1}>
                <div className="p-8 border border-white/[0.06] hover:border-red-600/20 transition-all duration-500 group">
                  <div className="flex items-start gap-4">
                    <span className="text-red-600/30 text-4xl font-bold">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h3 className="text-white font-bold text-xl mb-3 group-hover:text-red-500 transition-colors">
                        {value.title}
                      </h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">{value.description}</p>
                    </div>
                  </div>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <RevealOnScroll>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              Ready to experience it?
            </h2>
            <p className="text-zinc-400 text-lg mb-10">
              Life&apos;s too short to drive boring cars.
            </p>
            <MagneticButton>
              <Link
                href="/book"
                className="inline-block bg-red-600 text-white px-12 py-5 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all animate-pulse-glow"
              >
                Book Now
              </Link>
            </MagneticButton>
          </RevealOnScroll>
        </div>
      </section>
    </div>
  );
}
