'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { getFeaturedCars, formatPrice } from '@/data/fleet';
import RevealOnScroll from '@/components/ui/RevealOnScroll';

export default function FeaturedFleet() {
  const featured = getFeaturedCars();

  return (
    <section className="relative py-16 md:py-32 bg-black">
      {/* Section divider */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <RevealOnScroll>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-[1px] bg-red-600" />
            <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold">
              Featured
            </span>
          </div>
          <div className="flex items-end justify-between mb-16">
            <h2 className="text-section-title text-white">
              The Fleet.
            </h2>
            <Link
              href="/fleet"
              className="hidden md:inline-flex items-center gap-3 text-zinc-400 font-medium text-sm tracking-wide uppercase hover:text-white transition-colors group"
              data-hover
            >
              View All
              <span className="group-hover:translate-x-2 transition-transform">&rarr;</span>
            </Link>
          </div>
        </RevealOnScroll>

        {/* Featured cars grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((car, i) => (
            <RevealOnScroll key={car.id} delay={i * 0.1}>
              <Link href={`/fleet/${car.slug}`} className="group block" data-hover>
                <motion.div
                  whileHover={{ y: -8 }}
                  className="relative overflow-hidden border border-white/[0.06] hover:border-red-600/30 transition-all duration-500"
                >
                  {/* Car image placeholder */}
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <div
                      className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
                      style={{ background: car.gradient }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

                    {/* City badge */}
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-black/60 backdrop-blur-sm border border-white/10 text-xs text-zinc-300 tracking-wider uppercase">
                        {car.city.toUpperCase()}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="absolute top-4 right-4">
                      <span className="text-red-500 font-bold text-lg">
                        {formatPrice(car.dailyRate)}
                        <span className="text-zinc-500 text-xs font-normal">/day</span>
                      </span>
                    </div>

                    {/* Hover glow */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-red-600/10 to-transparent" />
                  </div>

                  {/* Info */}
                  <div className="p-6 bg-black/50">
                    <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase mb-1">{car.brand}</p>
                    <h3 className="text-white font-bold text-xl mb-3">{car.name}</h3>
                    <div className="flex items-center gap-4 text-zinc-500 text-xs">
                      <span>{car.specs.hp} HP</span>
                      <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                      <span>{car.specs.zeroToSixty}</span>
                      <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                      <span>{car.specs.topSpeed}</span>
                    </div>

                    {/* Bottom red line on hover */}
                    <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-red-600 group-hover:w-full transition-all duration-500" />
                  </div>
                </motion.div>
              </Link>
            </RevealOnScroll>
          ))}
        </div>

        {/* Mobile view all link */}
        <div className="mt-12 text-center md:hidden">
          <Link
            href="/fleet"
            className="inline-flex items-center gap-3 text-zinc-400 font-medium text-sm tracking-wide uppercase hover:text-white transition-colors"
            data-hover
          >
            View All Cars &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
