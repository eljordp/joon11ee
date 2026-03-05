import { fleet, getCarBySlug, cities, formatPrice } from '@/data/fleet';
import { notFound } from 'next/navigation';
import CarDetailClient from './CarDetailClient';

export function generateStaticParams() {
  return fleet.map((car) => ({
    slug: car.slug,
  }));
}

export default async function CarDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const car = getCarBySlug(slug);

  if (!car) {
    notFound();
  }

  const city = cities[car.city];

  return <CarDetailClient car={car} city={city} />;
}
