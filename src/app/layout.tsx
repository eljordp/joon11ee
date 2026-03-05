import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CustomCursor from '@/components/layout/CustomCursor';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'JOON11EE | Exotic Car Rentals - SF, LA, Miami',
  description:
    'Premium exotic car rentals in San Francisco, Los Angeles, and Miami. Drive Lamborghini, Ferrari, McLaren, Rolls-Royce, and more.',
  keywords: ['exotic car rental', 'luxury car rental', 'supercar rental', 'San Francisco', 'Los Angeles', 'Miami'],
  openGraph: {
    title: 'JOON11EE | Exotic Car Rentals',
    description: 'Drive the world\'s most exclusive vehicles. Three cities. One unforgettable experience.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased bg-black text-white grain`}>
        <CustomCursor />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
