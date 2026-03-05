import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/[0.06]">
      {/* CTA Banner */}
      <div className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 py-20 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
              Ready to drive?
            </h3>
            <p className="text-zinc-500 mt-2 text-lg">
              Book your exotic experience today.
            </p>
          </div>
          <Link
            href="/book"
            className="bg-red-600 text-white px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all duration-300 animate-pulse-glow"
            data-hover
          >
            Reserve Now
          </Link>
        </div>
      </div>

      {/* Footer Grid */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 border-2 border-red-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">J</span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">JOON11EE</span>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Premium exotic car rentals in San Francisco, Los Angeles, and Miami.
            </p>
          </div>

          {/* Locations */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-widest uppercase mb-4">
              Locations
            </h4>
            <ul className="space-y-3">
              <li><Link href="/locations" className="text-zinc-500 hover:text-white text-sm transition-colors" data-hover>San Francisco</Link></li>
              <li><Link href="/locations" className="text-zinc-500 hover:text-white text-sm transition-colors" data-hover>Los Angeles</Link></li>
              <li><Link href="/locations" className="text-zinc-500 hover:text-white text-sm transition-colors" data-hover>Miami</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-widest uppercase mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="text-zinc-500 hover:text-white text-sm transition-colors" data-hover>About</Link></li>
              <li><Link href="/fleet" className="text-zinc-500 hover:text-white text-sm transition-colors" data-hover>Our Fleet</Link></li>
              <li><Link href="/contact" className="text-zinc-500 hover:text-white text-sm transition-colors" data-hover>Contact</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-widest uppercase mb-4">
              Get in Touch
            </h4>
            <ul className="space-y-3">
              <li className="text-zinc-500 text-sm">info@joon11ee.com</li>
              <li className="text-zinc-500 text-sm">(415) 555-0111</li>
              <li className="flex gap-4 mt-4">
                <a href="#" className="text-zinc-500 hover:text-red-500 transition-colors" data-hover>IG</a>
                <a href="#" className="text-zinc-500 hover:text-red-500 transition-colors" data-hover>TW</a>
                <a href="#" className="text-zinc-500 hover:text-red-500 transition-colors" data-hover>TT</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-xs">
            &copy; {new Date().getFullYear()} Joon11ee. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors" data-hover>Privacy</Link>
            <Link href="#" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors" data-hover>Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
