import Image from 'next/image';
import type { Car } from '@/data/fleet';

interface CarImageProps {
  car: Car;
  className?: string;
  sizes?: string;
}

export default function CarImage({ car, className = '', sizes = '(max-width: 768px) 100vw, 50vw' }: CarImageProps) {
  if (car.image) {
    return (
      <Image
        src={car.image}
        alt={`${car.brand} ${car.name}`}
        fill
        className={`object-cover ${className}`}
        sizes={sizes}
      />
    );
  }

  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={{ background: car.gradient }}
    />
  );
}
