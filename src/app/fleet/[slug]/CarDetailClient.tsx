'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatPrice, type Car } from '@/data/fleet';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import MagneticButton from '@/components/ui/MagneticButton';
import ParticleBackground from '@/components/ui/ParticleBackground';

interface CarDetailClientProps {
  car: Car;
  city: { name: string; fullName: string; tagline: string; pickupAddress: string };
}

export default function CarDetailClient({ car, city }: CarDetailClientProps) {
  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* Hero */}
      <section className="relative py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 opacity-40"
            style={{ background: car.gradient }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[min(500px,150vw)] h-[min(500px,150vw)] bg-red-600/10 rounded-full blur-[150px]" />
        </div>

        <ParticleBackground count={20} />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          {/* Breadcrumb */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm mb-12"
          >
            <Link href="/fleet" className="text-zinc-500 hover:text-white transition-colors" data-hover>
              Fleet
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-400">{car.brand} {car.name}</span>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            {/* Car visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative aspect-[4/3] overflow-hidden border border-white/[0.06]"
            >
              <div
                className="absolute inset-0"
                style={{ background: car.gradient }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              {/* Color badge */}
              <div className="absolute bottom-6 left-6">
                <span className="px-3 py-1 bg-black/60 backdrop-blur-sm border border-white/10 text-xs text-zinc-300 tracking-wider">
                  {car.color}
                </span>
              </div>
            </motion.div>

            {/* Car info */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 border border-red-600/30 text-red-500 text-xs tracking-wider uppercase">
                    {city.name}
                  </span>
                  <span className="px-3 py-1 border border-white/10 text-zinc-400 text-xs tracking-wider uppercase">
                    {car.category}
                  </span>
                </div>

                <p className="text-zinc-500 text-sm tracking-[0.2em] uppercase mt-6 mb-1">
                  {car.brand}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-2">
                  {car.name}
                </h1>
                <p className="text-zinc-500 text-lg mb-8">{car.year}</p>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-10">
                  <span className="text-4xl font-bold text-red-600">
                    {formatPrice(car.dailyRate)}
                  </span>
                  <span className="text-zinc-500 text-lg">/day</span>
                </div>

                {/* Quick specs */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-10">
                  <div className="p-3 sm:p-4 border border-white/[0.06] text-center">
                    <p className="text-lg sm:text-2xl font-bold text-white">{car.specs.hp}</p>
                    <p className="text-zinc-500 text-[10px] sm:text-xs tracking-wider uppercase mt-1">Horsepower</p>
                  </div>
                  <div className="p-3 sm:p-4 border border-white/[0.06] text-center">
                    <p className="text-lg sm:text-2xl font-bold text-white">{car.specs.zeroToSixty}</p>
                    <p className="text-zinc-500 text-[10px] sm:text-xs tracking-wider uppercase mt-1">0-60 mph</p>
                  </div>
                  <div className="p-3 sm:p-4 border border-white/[0.06] text-center">
                    <p className="text-lg sm:text-2xl font-bold text-white">{car.specs.topSpeed}</p>
                    <p className="text-zinc-500 text-[10px] sm:text-xs tracking-wider uppercase mt-1">Top Speed</p>
                  </div>
                </div>

                {/* Book CTA */}
                <MagneticButton>
                  <Link
                    href={`/book?car=${car.slug}`}
                    className="inline-block w-full text-center bg-red-600 text-white px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all duration-300"
                  >
                    Book This Car
                  </Link>
                </MagneticButton>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Specs section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <RevealOnScroll>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-12 h-[1px] bg-red-600" />
              <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold">
                Specifications
              </span>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <RevealOnScroll>
              <div className="space-y-6">
                <SpecRow label="Engine" value={car.specs.engine} />
                <SpecRow label="Horsepower" value={`${car.specs.hp} HP`} />
                <SpecRow label="0-60 mph" value={car.specs.zeroToSixty} />
                <SpecRow label="Top Speed" value={car.specs.topSpeed} />
                <SpecRow label="Transmission" value={car.specs.transmission} />
                <SpecRow label="Seats" value={car.specs.seats.toString()} />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.2}>
              <div>
                <h3 className="text-white font-bold text-lg mb-6">Features</h3>
                <div className="flex flex-wrap gap-3">
                  {car.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-4 py-2 border border-white/[0.08] text-zinc-400 text-sm hover:border-red-600/30 hover:text-white transition-all duration-300"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Pickup info */}
                <div className="mt-12 p-6 border border-white/[0.06] bg-white/[0.02]">
                  <h4 className="text-white font-semibold mb-2">Pickup Location</h4>
                  <p className="text-zinc-500 text-sm">{city.fullName}</p>
                  <p className="text-zinc-400 text-sm mt-1">{city.pickupAddress}</p>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
      <span className="text-zinc-500 text-sm tracking-wider uppercase">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}
