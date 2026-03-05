'use client';

import Link from 'next/link';
import MagneticButton from '@/components/ui/MagneticButton';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import ParticleBackground from '@/components/ui/ParticleBackground';

export default function CTA() {
  return (
    <section className="relative py-40 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-black to-black" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[200px]" />
      </div>

      <ParticleBackground count={25} />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <RevealOnScroll>
          <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold mb-6 block">
            Limited Availability
          </span>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
            Your Dream Car<br />
            <span className="text-red-600">Awaits.</span>
          </h2>
          <p className="text-zinc-400 text-lg md:text-xl max-w-lg mx-auto mb-12 leading-relaxed">
            Don&apos;t just admire them. Drive them. Book your exotic rental experience today.
          </p>
          <MagneticButton>
            <Link
              href="/book"
              className="inline-block bg-red-600 text-white px-12 py-5 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all duration-300 animate-pulse-glow"
            >
              Book Your Experience
            </Link>
          </MagneticButton>
        </RevealOnScroll>
      </div>
    </section>
  );
}
