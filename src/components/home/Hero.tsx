'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import ParticleBackground from '@/components/ui/ParticleBackground';
import MagneticButton from '@/components/ui/MagneticButton';

export default function Hero() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-black">
        {/* Hero background image */}
        <Image
          src="/hero-bg.jpg"
          alt=""
          fill
          className="object-cover opacity-40"
          sizes="100vw"
          priority
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black z-10" />

        {/* Red accent light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(800px,150vw)] h-[min(800px,150vw)] bg-red-600/10 rounded-full blur-[150px] z-[5]" />
      </div>

      <div className="hidden md:block">
        <ParticleBackground count={40} />
      </div>

      {/* Content */}
      <div className="relative z-20 mx-auto max-w-7xl px-6 text-center">
        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={loaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 text-zinc-400 text-xs tracking-[0.3em] uppercase">
            <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
            San Francisco &middot; Los Angeles &middot; Miami
          </span>
        </motion.div>

        {/* Title */}
        <div className="overflow-hidden mb-6">
          <motion.h1
            initial={{ opacity: 0, y: 100, skewY: 5 }}
            animate={loaded ? { opacity: 1, y: 0, skewY: 0 } : {}}
            transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-hero text-white"
          >
            EXOTIC
          </motion.h1>
        </div>
        <div className="overflow-hidden mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 100, skewY: 5 }}
            animate={loaded ? { opacity: 1, y: 0, skewY: 0 } : {}}
            transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-hero"
          >
            <span className="text-red-600">RENTALS</span>
          </motion.h1>
        </div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={loaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-zinc-400 text-base md:text-xl max-w-lg mx-auto mb-8 md:mb-12 leading-relaxed px-2"
        >
          Drive the world&apos;s most exclusive vehicles. Three cities. One unforgettable experience.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={loaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <MagneticButton>
            <Link
              href="/book"
              className="inline-block bg-red-600 text-white px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all duration-300"
            >
              Reserve Your Ride
            </Link>
          </MagneticButton>
          <MagneticButton>
            <Link
              href="/fleet"
              className="inline-block border border-white/20 text-white px-10 py-4 text-sm font-bold tracking-widest uppercase hover:border-white/40 hover:bg-white/5 transition-all duration-300"
            >
              View Fleet
            </Link>
          </MagneticButton>
        </motion.div>
      </div>

      {/* Bottom red line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />
    </section>
  );
}
