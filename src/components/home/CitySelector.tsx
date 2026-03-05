'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cities, getCarsByCity, type City } from '@/data/fleet';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import Link from 'next/link';

export default function CitySelector() {
  const [activeCity, setActiveCity] = useState<City>('sf');
  const cityData = cities[activeCity];
  const cityCars = getCarsByCity(activeCity);

  return (
    <section className="relative py-16 md:py-32 overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[150px]" />

      <div className="mx-auto max-w-7xl px-6">
        <RevealOnScroll>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-[1px] bg-red-600" />
            <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold">
              Our Locations
            </span>
          </div>
          <h2 className="text-section-title text-white mb-8 md:mb-16">
            Three Cities.<br />
            <span className="text-zinc-500">Endless Possibilities.</span>
          </h2>
        </RevealOnScroll>

        {/* City tabs */}
        <div className="flex gap-1 sm:gap-2 mb-8 md:mb-16">
          {(Object.keys(cities) as City[]).map((city) => (
            <button
              key={city}
              onClick={() => setActiveCity(city)}
              className={`relative px-4 py-3 sm:px-8 sm:py-4 text-xs sm:text-sm font-bold tracking-wider sm:tracking-widest uppercase transition-all duration-300 ${
                activeCity === city
                  ? 'text-white'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
              data-hover
            >
              {cities[city].fullName}
              {activeCity === city && (
                <motion.div
                  layoutId="cityTab"
                  className="absolute inset-0 bg-red-600/10 border border-red-600/30"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* City content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCity}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12"
          >
            {/* City info */}
            <div className="flex flex-col justify-center">
              <h3 className="text-2xl sm:text-4xl font-bold text-white mb-4">{cityData.fullName}</h3>
              <p className="text-xl text-red-500 mb-6">{cityData.tagline}</p>
              <p className="text-zinc-400 mb-4 leading-relaxed">
                {cityCars.length} exotic vehicles available for rent. From supercars to luxury SUVs, experience the finest automobiles in {cityData.fullName}.
              </p>
              <p className="text-zinc-500 text-sm mb-8">
                <span className="text-zinc-400">Pickup:</span> {cityData.pickupAddress}
              </p>
              <Link
                href={`/fleet?city=${activeCity}`}
                className="inline-flex items-center gap-3 text-red-500 font-semibold text-sm tracking-wide uppercase hover:text-red-400 transition-colors group"
                data-hover
              >
                View {cityData.name} Fleet
                <span className="group-hover:translate-x-2 transition-transform">&rarr;</span>
              </Link>
            </div>

            {/* Car preview grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              {cityCars.slice(0, 4).map((car, i) => (
                <motion.div
                  key={car.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative aspect-[4/3] overflow-hidden border border-white/[0.06] hover:border-red-600/30 transition-all duration-500"
                  data-hover
                >
                  <div
                    className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
                    style={{ background: car.gradient }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider">{car.brand}</p>
                    <p className="text-white font-bold">{car.name}</p>
                    <p className="text-red-500 text-sm font-semibold mt-1">${car.dailyRate}/day</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
