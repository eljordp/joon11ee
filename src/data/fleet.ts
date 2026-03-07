export type City = 'mia';

export interface Car {
  id: string;
  slug: string;
  name: string;
  brand: string;
  year: number;
  city: City;
  dailyRate: number;
  category: 'supercar' | 'luxury' | 'exotic' | 'suv';
  specs: {
    hp: number;
    topSpeed: string;
    zeroToSixty: string;
    engine: string;
    transmission: string;
    seats: number;
  };
  features: string[];
  color: string;
  gradient: string;
  image?: string;
  featured?: boolean;
}

export const cities: Record<City, { name: string; fullName: string; tagline: string; pickupAddress: string }> = {
  mia: {
    name: 'MIA',
    fullName: 'Miami',
    tagline: 'Exotic Heat, Exotic Cars',
    pickupAddress: '789 Ocean Drive, Miami Beach, FL 33139',
  },
};

export const fleet: Car[] = [
  {
    id: 'mia-1',
    slug: 'maybach-gls-600',
    name: 'GLS 600',
    brand: 'Mercedes-Maybach',
    year: 2024,
    city: 'mia',
    dailyRate: 1500,
    category: 'luxury',
    specs: {
      hp: 550,
      topSpeed: '130 mph',
      zeroToSixty: '4.8s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '9-Speed Auto',
      seats: 4,
    },
    features: ['AWD', 'Rear Seat Entertainment', 'Burmester 3D Audio', 'Massage Seats'],
    color: 'Obsidian Black',
    gradient: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #2a2a2a 100%)',
    image: '/cars/maybach-gls600.jpg',
    featured: true,
  },
  {
    id: 'mia-2',
    slug: 'ferrari-488-gtb',
    name: '488 GTB',
    brand: 'Ferrari',
    year: 2024,
    city: 'mia',
    dailyRate: 1800,
    category: 'supercar',
    specs: {
      hp: 661,
      topSpeed: '205 mph',
      zeroToSixty: '3.0s',
      engine: '3.9L Twin-Turbo V8',
      transmission: '7-Speed DCT',
      seats: 2,
    },
    features: ['RWD', 'Carbon Fiber Package', 'Racing Seats', 'Launch Control'],
    color: 'Rosso Corsa',
    gradient: 'linear-gradient(135deg, #2d1b1b 0%, #4a1010 50%, #6b1515 100%)',
    image: '/cars/ferrari-488.jpg',
    featured: true,
  },
  {
    id: 'mia-3',
    slug: 'lamborghini-urus-black',
    name: 'Urus',
    brand: 'Lamborghini',
    year: 2024,
    city: 'mia',
    dailyRate: 1200,
    category: 'suv',
    specs: {
      hp: 641,
      topSpeed: '190 mph',
      zeroToSixty: '3.6s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '8-Speed Auto',
      seats: 5,
    },
    features: ['AWD', 'Carbon Package', 'Akrapovic Exhaust', 'Air Suspension'],
    color: 'Nero Noctis',
    gradient: 'linear-gradient(135deg, #1a0a0a 0%, #2d1111 50%, #401a1a 100%)',
    image: '/cars/urus-black.jpg',
    featured: true,
  },
  {
    id: 'mia-4',
    slug: 'lamborghini-urus-white',
    name: 'Urus',
    brand: 'Lamborghini',
    year: 2024,
    city: 'mia',
    dailyRate: 1200,
    category: 'suv',
    specs: {
      hp: 641,
      topSpeed: '190 mph',
      zeroToSixty: '3.6s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '8-Speed Auto',
      seats: 5,
    },
    features: ['AWD', 'Carbon Package', 'Bang & Olufsen', 'Panoramic Roof'],
    color: 'Bianco Monocerus',
    gradient: 'linear-gradient(135deg, #2a2a2a 0%, #3d3d3d 50%, #505050 100%)',
    image: '/cars/urus-white.jpg',
  },
  {
    id: 'mia-5',
    slug: 'mansory-cullinan',
    name: 'Cullinan Mansory',
    brand: 'Rolls-Royce',
    year: 2024,
    city: 'mia',
    dailyRate: 2500,
    category: 'luxury',
    specs: {
      hp: 632,
      topSpeed: '155 mph',
      zeroToSixty: '4.5s',
      engine: '6.75L Twin-Turbo V12',
      transmission: '8-Speed Auto',
      seats: 5,
    },
    features: ['AWD', 'Mansory Wide Body', 'Starlight Headliner', 'Forged Wheels'],
    color: 'Black',
    gradient: 'linear-gradient(135deg, #050505 0%, #111111 50%, #1a1a1a 100%)',
    image: '/cars/mansory-cullinan.jpg',
    featured: true,
  },
  {
    id: 'mia-6',
    slug: 'chevrolet-corvette-c8',
    name: 'Corvette C8',
    brand: 'Chevrolet',
    year: 2024,
    city: 'mia',
    dailyRate: 500,
    category: 'supercar',
    specs: {
      hp: 490,
      topSpeed: '194 mph',
      zeroToSixty: '2.9s',
      engine: '6.2L V8',
      transmission: '8-Speed DCT',
      seats: 2,
    },
    features: ['RWD', 'Magnetic Ride', 'Performance Exhaust', 'Head-Up Display'],
    color: 'Torch Red',
    gradient: 'linear-gradient(135deg, #3d0c0c 0%, #5c1010 50%, #7a1515 100%)',
    image: '/cars/corvette-c8.jpg',
  },
  {
    id: 'mia-7',
    slug: 'porsche-macan',
    name: 'Macan',
    brand: 'Porsche',
    year: 2024,
    city: 'mia',
    dailyRate: 350,
    category: 'suv',
    specs: {
      hp: 375,
      topSpeed: '159 mph',
      zeroToSixty: '4.4s',
      engine: '2.9L Twin-Turbo V6',
      transmission: '7-Speed PDK',
      seats: 5,
    },
    features: ['AWD', 'Sport Chrono', 'BOSE Audio', 'Panoramic Roof'],
    color: 'Carrara White',
    gradient: 'linear-gradient(135deg, #1c1c1c 0%, #333333 50%, #4a4a4a 100%)',
    image: '/cars/porsche-macan.jpg',
  },
  {
    id: 'mia-8',
    slug: 'mercedes-s580',
    name: 'S580',
    brand: 'Mercedes-Benz',
    year: 2024,
    city: 'mia',
    dailyRate: 700,
    category: 'luxury',
    specs: {
      hp: 496,
      topSpeed: '130 mph',
      zeroToSixty: '4.4s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '9-Speed Auto',
      seats: 5,
    },
    features: ['AWD', 'Burmester 4D Audio', 'Rear Seat Package', 'E-Active Body Control'],
    color: 'Obsidian Black',
    gradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #252525 100%)',
    image: '/cars/mercedes-s580.jpg',
  },
];

export function getCarsByCity(city: City): Car[] {
  return fleet.filter((car) => car.city === city);
}

export function getFeaturedCars(): Car[] {
  return fleet.filter((car) => car.featured);
}

export function getCarBySlug(slug: string): Car | undefined {
  return fleet.find((car) => car.slug === slug);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(price);
}
