'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { fleet, cities, formatPrice, type City, type Car } from '@/data/fleet';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import ParticleBackground from '@/components/ui/ParticleBackground';
import { Suspense } from 'react';

function FleetContent() {
  const searchParams = useSearchParams();
  const initialCity = (searchParams.get('city') as City) || 'all';
  const [activeFilter, setActiveFilter] = useState<City | 'all'>(initialCity);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredCars = fleet.filter((car) => {
    const cityMatch = activeFilter === 'all' || car.city === activeFilter;
    const catMatch = categoryFilter === 'all' || car.category === categoryFilter;
    return cityMatch && catMatch;
  });

  const categories = ['all', 'supercar', 'luxury', 'exotic', 'suv'];

  return (
    <div className="min-h-screen pt-32 pb-20">
      {/* Hero section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/8 rounded-full blur-[150px]" />
        </div>
        <ParticleBackground count={20} />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <RevealOnScroll>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-[1px] bg-red-600" />
              <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold">
                Our Collection
              </span>
            </div>
            <h1 className="text-section-title text-white mb-4">
              The Fleet
            </h1>
            <p className="text-zinc-400 text-lg max-w-lg">
              Browse our curated selection of the world&apos;s most exclusive vehicles.
            </p>
          </RevealOnScroll>
        </div>
      </section>

      {/* Filters */}
      <section className="mx-auto max-w-7xl px-6 mb-12">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          {/* City filter */}
          <div className="flex gap-2 flex-wrap">
            <FilterButton
              active={activeFilter === 'all'}
              onClick={() => setActiveFilter('all')}
              label="All Cities"
            />
            {(Object.keys(cities) as City[]).map((city) => (
              <FilterButton
                key={city}
                active={activeFilter === city}
                onClick={() => setActiveFilter(city)}
                label={cities[city].fullName}
              />
            ))}
          </div>

          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <FilterButton
                key={cat}
                active={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat)}
                label={cat === 'all' ? 'All Types' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              />
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-zinc-600 text-sm mt-6">
          {filteredCars.length} vehicle{filteredCars.length !== 1 ? 's' : ''} available
        </p>
      </section>

      {/* Car grid */}
      <section className="mx-auto max-w-7xl px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeFilter}-${categoryFilter}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredCars.map((car, i) => (
              <CarCard key={car.id} car={car} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredCars.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-lg">No vehicles match your filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${
        active
          ? 'bg-red-600 text-white'
          : 'border border-white/10 text-zinc-500 hover:text-white hover:border-white/20'
      }`}
      data-hover
    >
      {label}
    </button>
  );
}

function CarCard({ car, index }: { car: Car; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5 }}
    >
      <Link href={`/fleet/${car.slug}`} className="group block" data-hover>
        <div className="relative overflow-hidden border border-white/[0.06] hover:border-red-600/30 transition-all duration-500">
          {/* Image placeholder */}
          <div className="relative aspect-[16/10] overflow-hidden">
            <div
              className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
              style={{ background: car.gradient }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-3 py-1 bg-black/60 backdrop-blur-sm border border-white/10 text-xs text-zinc-300 tracking-wider uppercase">
                {car.city.toUpperCase()}
              </span>
              <span className="px-3 py-1 bg-black/60 backdrop-blur-sm border border-white/10 text-xs text-zinc-300 tracking-wider uppercase">
                {car.category}
              </span>
            </div>

            <div className="absolute top-4 right-4">
              <span className="text-red-500 font-bold text-lg">
                {formatPrice(car.dailyRate)}
                <span className="text-zinc-500 text-xs font-normal">/day</span>
              </span>
            </div>

            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-red-600/10 to-transparent" />
          </div>

          <div className="p-6 bg-black/50">
            <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase mb-1">{car.brand}</p>
            <h3 className="text-white font-bold text-xl mb-3">{car.name}</h3>

            <div className="flex items-center gap-4 text-zinc-500 text-xs mb-4">
              <span>{car.specs.hp} HP</span>
              <span className="w-1 h-1 bg-zinc-700 rounded-full" />
              <span>{car.specs.zeroToSixty}</span>
              <span className="w-1 h-1 bg-zinc-700 rounded-full" />
              <span>{car.specs.topSpeed}</span>
            </div>

            <div className="flex gap-2 flex-wrap">
              {car.features.slice(0, 3).map((f) => (
                <span key={f} className="px-2 py-1 bg-white/[0.03] border border-white/[0.06] text-zinc-500 text-[10px] tracking-wider uppercase">
                  {f}
                </span>
              ))}
            </div>

            <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-red-600 group-hover:w-full transition-all duration-500" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function FleetPage() {
  return (
    <Suspense>
      <FleetContent />
    </Suspense>
  );
}
