import Hero from '@/components/home/Hero';
import CitySelector from '@/components/home/CitySelector';
import FeaturedFleet from '@/components/home/FeaturedFleet';
import Stats from '@/components/home/Stats';
import CTA from '@/components/home/CTA';

export default function Home() {
  return (
    <>
      <Hero />
      <CitySelector />
      <FeaturedFleet />
      <Stats />
      <CTA />
    </>
  );
}
