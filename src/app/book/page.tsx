'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { fleet, cities, getCarsByCity, getCarBySlug, formatPrice, type City, type Car } from '@/data/fleet';
import { saveBooking, generateBookingId } from '@/lib/bookings';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import ParticleBackground from '@/components/ui/ParticleBackground';

type BookingStep = 1 | 2 | 3 | 4 | 5;

interface BookingData {
  city: City | null;
  startDate: string;
  endDate: string;
  car: Car | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    age: string;
    driversLicense: string;
  };
}

function BookingContent() {
  const searchParams = useSearchParams();
  const preselectedCar = searchParams.get('car');

  const [step, setStep] = useState<BookingStep>(preselectedCar ? 2 : 1);
  const [confirmed, setConfirmed] = useState(false);
  const [booking, setBooking] = useState<BookingData>(() => {
    const car = preselectedCar ? getCarBySlug(preselectedCar) || null : null;
    return {
      city: car?.city || null,
      startDate: '',
      endDate: '',
      car,
      customer: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        age: '',
        driversLicense: '',
      },
    };
  });

  const totalDays = booking.startDate && booking.endDate
    ? Math.max(1, Math.ceil((new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const totalPrice = booking.car ? booking.car.dailyRate * totalDays : 0;

  const steps = [
    { num: 1, label: 'City' },
    { num: 2, label: 'Dates' },
    { num: 3, label: 'Vehicle' },
    { num: 4, label: 'Details' },
    { num: 5, label: 'Confirm' },
  ];

  return (
    <div className="min-h-screen pt-24 md:pt-32 pb-20">
      {/* Header */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(600px,150vw)] h-[300px] bg-red-600/8 rounded-full blur-[150px]" />
        </div>
        <ParticleBackground count={15} />

        <div className="relative z-10 mx-auto max-w-4xl px-6">
          <RevealOnScroll>
            <div className="text-center mb-12">
              <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold mb-4 block">
                Reservation
              </span>
              <h1 className="text-section-title text-white">
                Book Your Ride
              </h1>
            </div>
          </RevealOnScroll>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 md:mb-16 flex-wrap">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <button
                  onClick={() => s.num < step && setStep(s.num as BookingStep)}
                  className={`flex items-center gap-1 sm:gap-2 px-2 py-2 sm:px-4 sm:py-3 text-xs font-semibold tracking-wider uppercase transition-all duration-300 min-h-[44px] ${
                    step === s.num
                      ? 'bg-red-600 text-white'
                      : step > s.num
                      ? 'text-red-500 cursor-pointer hover:text-red-400'
                      : 'text-zinc-600'
                  }`}
                  disabled={s.num > step}
                  data-hover
                >
                  <span className={`w-6 h-6 flex items-center justify-center text-xs border ${
                    step === s.num ? 'border-white/30' : step > s.num ? 'border-red-600/30' : 'border-zinc-700'
                  }`}>
                    {step > s.num ? '✓' : s.num}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className={`w-8 h-[1px] ${step > s.num ? 'bg-red-600/50' : 'bg-zinc-800'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 1: City Selection */}
              {step === 1 && (
                <div className="max-w-2xl mx-auto">
                  <h2 className="text-2xl font-bold text-white mb-8 text-center">Select Your City</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(Object.keys(cities) as City[]).map((city) => (
                      <button
                        key={city}
                        onClick={() => {
                          setBooking({ ...booking, city, car: null });
                          setStep(2);
                        }}
                        className={`p-5 sm:p-8 border text-left transition-all duration-300 hover:border-red-600/50 hover:bg-red-600/5 ${
                          booking.city === city ? 'border-red-600 bg-red-600/10' : 'border-white/[0.08]'
                        }`}
                        data-hover
                      >
                        <p className="text-2xl font-bold text-white mb-1">{cities[city].name}</p>
                        <p className="text-zinc-400 text-sm">{cities[city].fullName}</p>
                        <p className="text-zinc-600 text-xs mt-3">{getCarsByCity(city).length} vehicles</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Date Selection */}
              {step === 2 && (
                <div className="max-w-md mx-auto">
                  <h2 className="text-2xl font-bold text-white mb-8 text-center">Choose Your Dates</h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-zinc-400 text-sm tracking-wider uppercase mb-2">
                        Pickup Date
                      </label>
                      <input
                        type="date"
                        value={booking.startDate}
                        onChange={(e) => setBooking({ ...booking, startDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-sm tracking-wider uppercase mb-2">
                        Return Date
                      </label>
                      <input
                        type="date"
                        value={booking.endDate}
                        onChange={(e) => setBooking({ ...booking, endDate: e.target.value })}
                        min={booking.startDate || new Date().toISOString().split('T')[0]}
                        className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors"
                      />
                    </div>
                    {totalDays > 0 && (
                      <p className="text-zinc-500 text-sm text-center">
                        {totalDays} day{totalDays !== 1 ? 's' : ''} rental
                      </p>
                    )}
                    <button
                      onClick={() => setStep(3)}
                      disabled={!booking.startDate || !booking.endDate}
                      className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      data-hover
                    >
                      Select Vehicle
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Car Selection */}
              {step === 3 && booking.city && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-8 text-center">
                    Choose Your Vehicle — {cities[booking.city].fullName}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getCarsByCity(booking.city).map((car) => (
                      <button
                        key={car.id}
                        onClick={() => {
                          setBooking({ ...booking, car });
                          setStep(4);
                        }}
                        className={`text-left border transition-all duration-300 hover:border-red-600/50 ${
                          booking.car?.id === car.id ? 'border-red-600 bg-red-600/5' : 'border-white/[0.08]'
                        }`}
                        data-hover
                      >
                        <div className="aspect-[16/10] relative overflow-hidden">
                          {car.image ? (
                            <Image src={car.image} alt={`${car.brand} ${car.name}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                          ) : (
                            <div className="absolute inset-0" style={{ background: car.gradient }} />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        </div>
                        <div className="p-4">
                          <p className="text-zinc-500 text-xs tracking-wider uppercase">{car.brand}</p>
                          <p className="text-white font-bold">{car.name}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-zinc-500 text-xs">{car.specs.hp} HP · {car.specs.zeroToSixty}</span>
                            <span className="text-red-500 font-bold">{formatPrice(car.dailyRate)}<span className="text-zinc-600 text-xs font-normal">/day</span></span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Customer Details */}
              {step === 4 && (
                <div className="max-w-lg mx-auto">
                  <h2 className="text-2xl font-bold text-white mb-8 text-center">Your Details</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InputField
                        label="First Name"
                        value={booking.customer.firstName}
                        onChange={(v) => setBooking({ ...booking, customer: { ...booking.customer, firstName: v } })}
                      />
                      <InputField
                        label="Last Name"
                        value={booking.customer.lastName}
                        onChange={(v) => setBooking({ ...booking, customer: { ...booking.customer, lastName: v } })}
                      />
                    </div>
                    <InputField
                      label="Email"
                      type="email"
                      value={booking.customer.email}
                      onChange={(v) => setBooking({ ...booking, customer: { ...booking.customer, email: v } })}
                    />
                    <InputField
                      label="Phone"
                      type="tel"
                      value={booking.customer.phone}
                      onChange={(v) => setBooking({ ...booking, customer: { ...booking.customer, phone: v } })}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InputField
                        label="Age"
                        type="number"
                        value={booking.customer.age}
                        onChange={(v) => setBooking({ ...booking, customer: { ...booking.customer, age: v } })}
                      />
                      <InputField
                        label="Driver's License #"
                        value={booking.customer.driversLicense}
                        onChange={(v) => setBooking({ ...booking, customer: { ...booking.customer, driversLicense: v } })}
                      />
                    </div>
                    {booking.customer.age && parseInt(booking.customer.age) < 18 && (
                      <p className="text-red-500 text-sm">Must be 18 or older to rent.</p>
                    )}
                    <button
                      onClick={() => setStep(5)}
                      disabled={
                        !booking.customer.firstName ||
                        !booking.customer.lastName ||
                        !booking.customer.email ||
                        !booking.customer.phone ||
                        !booking.customer.age ||
                        parseInt(booking.customer.age) < 18 ||
                        !booking.customer.driversLicense
                      }
                      className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed mt-6"
                      data-hover
                    >
                      Review Booking
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Confirmation */}
              {step === 5 && booking.car && booking.city && !confirmed && (
                <div className="max-w-lg mx-auto">
                  <h2 className="text-2xl font-bold text-white mb-8 text-center">Review & Confirm</h2>

                  <div className="border border-white/[0.08] p-4 sm:p-8 space-y-6">
                    {/* Car summary */}
                    <div className="flex items-center gap-4 pb-6 border-b border-white/[0.06]">
                      <div className="w-20 h-14 overflow-hidden flex-shrink-0 relative">
                        {booking.car.image ? (
                          <Image src={booking.car.image} alt={`${booking.car.brand} ${booking.car.name}`} fill className="object-cover" sizes="80px" />
                        ) : (
                          <div className="absolute inset-0" style={{ background: booking.car.gradient }} />
                        )}
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs tracking-wider uppercase">{booking.car.brand}</p>
                        <p className="text-white font-bold">{booking.car.name}</p>
                      </div>
                    </div>

                    <SummaryRow label="Location" value={cities[booking.city].fullName} />
                    <SummaryRow label="Pickup" value={booking.startDate} />
                    <SummaryRow label="Return" value={booking.endDate} />
                    <SummaryRow label="Duration" value={`${totalDays} day${totalDays !== 1 ? 's' : ''}`} />
                    <SummaryRow label="Daily Rate" value={formatPrice(booking.car.dailyRate)} />

                    <div className="pt-6 border-t border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold text-lg">Total</span>
                        <span className="text-red-600 font-bold text-2xl">{formatPrice(totalPrice)}</span>
                      </div>
                    </div>

                    {/* Customer info */}
                    <div className="pt-6 border-t border-white/[0.06]">
                      <p className="text-zinc-500 text-xs tracking-wider uppercase mb-3">Customer</p>
                      <p className="text-white">{booking.customer.firstName} {booking.customer.lastName}</p>
                      <p className="text-zinc-400 text-sm">{booking.customer.email}</p>
                      <p className="text-zinc-400 text-sm">{booking.customer.phone}</p>
                    </div>

                    <button
                      onClick={() => {
                        const bookingData = {
                          id: generateBookingId(),
                          city: booking.city!,
                          cityFullName: cities[booking.city!].fullName,
                          carBrand: booking.car!.brand,
                          carName: booking.car!.name,
                          carSlug: booking.car!.slug,
                          carImage: booking.car!.image,
                          startDate: booking.startDate,
                          endDate: booking.endDate,
                          totalDays,
                          dailyRate: booking.car!.dailyRate,
                          totalPrice,
                          customer: booking.customer,
                          status: 'pending' as const,
                          createdAt: new Date().toISOString(),
                        };
                        saveBooking(bookingData);
                        fetch('/api/booking', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(bookingData),
                        }).catch(() => {});
                        setConfirmed(true);
                      }}
                      className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all animate-pulse-glow"
                      data-hover
                    >
                      Confirm & Pay — {formatPrice(totalPrice)}
                    </button>

                    <p className="text-zinc-600 text-xs text-center">
                      A hold will be placed on your card. Full payment due at pickup.
                    </p>
                  </div>
                </div>
              )}

              {/* Booking confirmed */}
              {confirmed && (
                <div className="max-w-lg mx-auto text-center">
                  <div className="border border-red-600/30 bg-red-600/5 p-8 sm:p-12">
                    <div className="w-20 h-20 border-2 border-red-600 flex items-center justify-center mx-auto mb-6">
                      <span className="text-red-600 text-3xl">&#10003;</span>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-3">Booking Confirmed</h2>
                    <p className="text-zinc-400 mb-8">
                      We&apos;ll contact you at <span className="text-white">{booking.customer.email}</span> to finalize payment and pickup details.
                    </p>
                    <div className="space-y-2 text-sm text-zinc-500 mb-8">
                      <p>{booking.car?.brand} {booking.car?.name}</p>
                      <p>{booking.startDate} — {booking.endDate}</p>
                      <p className="text-red-500 font-bold text-lg">{formatPrice(totalPrice)}</p>
                    </div>
                    <a
                      href="/fleet"
                      className="inline-block border border-white/20 text-white px-8 py-3 text-xs font-bold tracking-widest uppercase hover:border-white/40 transition-all"
                      data-hover
                    >
                      Browse More Cars
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense>
      <BookingContent />
    </Suspense>
  );
}
