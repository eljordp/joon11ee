'use client';

import { useState } from 'react';
import RevealOnScroll from '@/components/ui/RevealOnScroll';
import ParticleBackground from '@/components/ui/ParticleBackground';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen pt-32 pb-20">
      {/* Header */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/8 rounded-full blur-[150px]" />
        </div>
        <ParticleBackground count={15} />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <RevealOnScroll>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-[1px] bg-red-600" />
              <span className="text-red-600 text-xs tracking-[0.3em] uppercase font-semibold">
                Get in Touch
              </span>
            </div>
            <h1 className="text-section-title text-white mb-4">
              Contact Us
            </h1>
            <p className="text-zinc-400 text-lg max-w-lg">
              Questions about our fleet? Need a custom package? We&apos;re here to help.
            </p>
          </RevealOnScroll>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Form */}
          <RevealOnScroll>
            {submitted ? (
              <div className="p-12 border border-red-600/30 bg-red-600/5 text-center">
                <div className="w-16 h-16 border-2 border-red-600 flex items-center justify-center mx-auto mb-6">
                  <span className="text-red-600 text-2xl">✓</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Message Sent</h3>
                <p className="text-zinc-400">We&apos;ll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Preferred City</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
                  >
                    <option value="">Select a city</option>
                    <option value="sf">San Francisco</option>
                    <option value="la">Los Angeles</option>
                    <option value="mia">Miami</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs tracking-wider uppercase mb-2">Message</label>
                  <textarea
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm resize-none"
                    placeholder="Tell us about your rental needs..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-600 text-white py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all"
                  data-hover
                >
                  Send Message
                </button>
              </form>
            )}
          </RevealOnScroll>

          {/* Contact info */}
          <RevealOnScroll delay={0.2}>
            <div className="space-y-8">
              <div className="p-8 border border-white/[0.06]">
                <h3 className="text-white font-bold text-lg mb-6">Direct Contact</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-zinc-500 text-xs tracking-wider uppercase mb-1">Email</p>
                    <a href="mailto:info@joon11ee.com" className="text-white hover:text-red-500 transition-colors" data-hover>
                      info@joon11ee.com
                    </a>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs tracking-wider uppercase mb-1">Phone</p>
                    <a href="tel:+14155550111" className="text-white hover:text-red-500 transition-colors" data-hover>
                      (415) 555-0111
                    </a>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs tracking-wider uppercase mb-1">Hours</p>
                    <p className="text-zinc-300 text-sm">24/7 — We never sleep</p>
                  </div>
                </div>
              </div>

              {/* Locations */}
              {[
                { city: 'San Francisco', address: '123 Embarcadero, San Francisco, CA 94105' },
                { city: 'Los Angeles', address: '456 Rodeo Drive, Beverly Hills, CA 90210' },
                { city: 'Miami', address: '789 Ocean Drive, Miami Beach, FL 33139' },
              ].map((loc) => (
                <div key={loc.city} className="p-6 border border-white/[0.06] hover:border-red-600/20 transition-all duration-300">
                  <h4 className="text-white font-semibold mb-1">{loc.city}</h4>
                  <p className="text-zinc-500 text-sm">{loc.address}</p>
                </div>
              ))}

              {/* Social */}
              <div className="p-8 border border-white/[0.06]">
                <h3 className="text-white font-bold text-lg mb-4">Follow Us</h3>
                <div className="flex gap-4">
                  {['Instagram', 'Twitter', 'TikTok', 'YouTube'].map((social) => (
                    <a
                      key={social}
                      href="#"
                      className="px-4 py-2 border border-white/[0.08] text-zinc-400 text-sm hover:border-red-600/30 hover:text-white transition-all duration-300"
                      data-hover
                    >
                      {social}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </div>
  );
}
