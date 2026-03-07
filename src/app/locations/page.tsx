'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cities, getCarsByCity, formatPrice, type City } from '@/data/fleet';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import ParticleBackground from '@/components/ui/ParticleBackground';

const cityImages: Record<City, string> = {
  mia: 'linear-gradient(135deg, #0a2a2a 0%, #051a1a 50%, #020f0f 100%)',
  sf: 'linear-gradient(135deg, #1a1a3e 0%, #0a0a2e 50%, #050520 100%)',
  la: 'linear-gradient(135deg, #2a1a0a 0%, #1a100a 50%, #0a0805 100%)',
};

export default function LocationsPage() {
  return (
    <div className="min-h-screen pt-24 md:pt-32 pb-20">
      {/* Header */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(600px,150vw)] h-[300px] bg-red-600/8 rounded-full blur-[150px]" />
        </div>
        <ParticleBackground count={20} />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <RevealOnScroll>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-[1px] bg-red-600" />
              <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold">
                Locations
              </span>
            </div>
            <h1 className="text-section-title text-white mb-4">
              Where We Operate
            </h1>
            <p className="text-zinc-400 text-lg max-w-lg">
              Three iconic cities. Premium pickup locations. Seamless experience.
            </p>
          </RevealOnScroll>
        </div>
      </section>

      {/* City cards */}
      <section className="mx-auto max-w-7xl px-6">
        <div className="space-y-8">
          {(Object.keys(cities) as City[]).map((city, i) => {
            const cityData = cities[city];
            const cityCars = getCarsByCity(city);
            const minPrice = Math.min(...cityCars.map((c) => c.dailyRate));

            return (
              <RevealOnScroll key={city} delay={i * 0.15}>
                <div className="group relative overflow-hidden border border-white/[0.06] hover:border-red-600/20 transition-all duration-500">
                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* City visual */}
                    <div className="relative aspect-[16/9] lg:aspect-auto overflow-hidden">
                      <div
                        className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                        style={{ background: cityImages[city] }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50 hidden lg:block" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent lg:hidden" />

                      {/* City name overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.h2
                          className="text-4xl sm:text-6xl md:text-8xl font-bold text-white/10 tracking-tighter"
                          whileHover={{ scale: 1.05 }}
                        >
                          {cityData.name}
                        </motion.h2>
                      </div>
                    </div>

                    {/* City info */}
                    <div className="p-5 sm:p-8 lg:p-12 flex flex-col justify-center bg-black/50">
                      <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">{cityData.fullName}</h3>
                      <p className="text-red-500 text-lg mb-6">{cityData.tagline}</p>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="p-4 border border-white/[0.06]">
                          <p className="text-2xl font-bold text-white">{cityCars.length}</p>
                          <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1">Vehicles</p>
                        </div>
                        <div className="p-4 border border-white/[0.06]">
                          <p className="text-2xl font-bold text-white">From {formatPrice(minPrice)}</p>
                          <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1">Per Day</p>
                        </div>
                      </div>

                      <div className="mb-8">
                        <p className="text-zinc-500 text-xs tracking-wider uppercase mb-2">Pickup Address</p>
                        <p className="text-zinc-300 text-sm">{cityData.pickupAddress}</p>
                      </div>

                      {/* Preview cars */}
                      <div className="flex gap-2 sm:gap-3 mb-8">
                        {cityCars.slice(0, 3).map((car) => (
                          <div key={car.id} className="flex-1 p-2 sm:p-3 border border-white/[0.06] bg-white/[0.02]">
                            <p className="text-zinc-500 text-[10px] tracking-wider uppercase">{car.brand}</p>
                            <p className="text-white text-xs font-semibold">{car.name}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <Link
                          href={`/fleet?city=${city}`}
                          className="bg-red-600 text-white px-6 py-3 text-xs font-bold tracking-widest uppercase hover:bg-red-500 transition-all text-center"
                          data-hover
                        >
                          View Fleet
                        </Link>
                        <Link
                          href={`/book?city=${city}`}
                          className="border border-white/20 text-white px-6 py-3 text-xs font-bold tracking-widest uppercase hover:border-white/40 transition-all text-center"
                          data-hover
                        >
                          Book Now
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>
      </section>
    </div>
  );
}
