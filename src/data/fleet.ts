export type City = 'sf' | 'la' | 'mia';

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
  gradient: string; // placeholder gradient until real images
  image?: string;
  featured?: boolean;
}

export const cities: Record<City, { name: string; fullName: string; tagline: string; pickupAddress: string }> = {
  sf: {
    name: 'SF',
    fullName: 'San Francisco',
    tagline: 'Bay Area\'s Finest Exotics',
    pickupAddress: '123 Embarcadero, San Francisco, CA 94105',
  },
  la: {
    name: 'LA',
    fullName: 'Los Angeles',
    tagline: 'Drive the Dream in LA',
    pickupAddress: '456 Rodeo Drive, Beverly Hills, CA 90210',
  },
  mia: {
    name: 'MIA',
    fullName: 'Miami',
    tagline: 'Exotic Heat, Exotic Cars',
    pickupAddress: '789 Ocean Drive, Miami Beach, FL 33139',
  },
};

export const fleet: Car[] = [
  // San Francisco Fleet
  {
    id: 'sf-1',
    slug: 'lamborghini-huracan-evo-sf',
    name: 'Huracán EVO',
    brand: 'Lamborghini',
    year: 2024,
    city: 'sf',
    dailyRate: 1500,
    category: 'supercar',
    specs: {
      hp: 631,
      topSpeed: '202 mph',
      zeroToSixty: '2.9s',
      engine: '5.2L V10',
      transmission: '7-Speed DCT',
      seats: 2,
    },
    features: ['AWD', 'Carbon Ceramic Brakes', 'Lift System', 'Navigation'],
    color: 'Verde Mantis',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    image: '/cars/huracan-evo.jpg',
    featured: true,
  },
  {
    id: 'sf-2',
    slug: 'ferrari-488-gtb-sf',
    name: '488 GTB',
    brand: 'Ferrari',
    year: 2024,
    city: 'sf',
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
    features: ['RWD', 'Carbon Fiber Package', 'Racing Seats', 'Telemetry'],
    color: 'Rosso Corsa',
    gradient: 'linear-gradient(135deg, #2d1b1b 0%, #4a1010 50%, #6b1515 100%)',
    image: '/cars/ferrari-488.jpg',
    featured: true,
  },
  {
    id: 'sf-3',
    slug: 'mclaren-720s-sf',
    name: '720S',
    brand: 'McLaren',
    year: 2024,
    city: 'sf',
    dailyRate: 1600,
    category: 'supercar',
    specs: {
      hp: 710,
      topSpeed: '212 mph',
      zeroToSixty: '2.8s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '7-Speed SSG',
      seats: 2,
    },
    features: ['RWD', 'Active Aero', 'Proactive Chassis', 'Folding Display'],
    color: 'Papaya Spark',
    gradient: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #404040 100%)',
    image: '/cars/mclaren-720s.jpg',
  },
  {
    id: 'sf-4',
    slug: 'porsche-911-turbo-s-sf',
    name: '911 Turbo S',
    brand: 'Porsche',
    year: 2024,
    city: 'sf',
    dailyRate: 1200,
    category: 'supercar',
    specs: {
      hp: 640,
      topSpeed: '205 mph',
      zeroToSixty: '2.6s',
      engine: '3.7L Twin-Turbo Flat-6',
      transmission: '8-Speed PDK',
      seats: 4,
    },
    features: ['AWD', 'Sport Chrono', 'PCCB Brakes', 'Burmester Audio'],
    color: 'GT Silver',
    gradient: 'linear-gradient(135deg, #1c1c1c 0%, #333333 50%, #4a4a4a 100%)',
    image: '/cars/porsche-911.jpg',
  },
  {
    id: 'sf-5',
    slug: 'rolls-royce-cullinan-sf',
    name: 'Cullinan',
    brand: 'Rolls-Royce',
    year: 2024,
    city: 'sf',
    dailyRate: 2000,
    category: 'suv',
    specs: {
      hp: 563,
      topSpeed: '155 mph',
      zeroToSixty: '4.8s',
      engine: '6.75L Twin-Turbo V12',
      transmission: '8-Speed Auto',
      seats: 5,
    },
    features: ['AWD', 'Starlight Headliner', 'Bespoke Audio', 'Night Vision'],
    color: 'Black Diamond',
    gradient: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #2a2a2a 100%)',
    image: '/cars/cullinan.jpg',
  },

  // Los Angeles Fleet
  {
    id: 'la-1',
    slug: 'lamborghini-urus-performante-la',
    name: 'Urus Performante',
    brand: 'Lamborghini',
    year: 2024,
    city: 'la',
    dailyRate: 1400,
    category: 'suv',
    specs: {
      hp: 666,
      topSpeed: '190 mph',
      zeroToSixty: '3.3s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '8-Speed Auto',
      seats: 5,
    },
    features: ['AWD', 'Carbon Package', 'Akrapovič Exhaust', 'Rally Mode'],
    color: 'Nero Noctis',
    gradient: 'linear-gradient(135deg, #1a0a0a 0%, #2d1111 50%, #401a1a 100%)',
    image: '/cars/urus.jpg',
    featured: true,
  },
  {
    id: 'la-2',
    slug: 'ferrari-sf90-stradale-la',
    name: 'SF90 Stradale',
    brand: 'Ferrari',
    year: 2024,
    city: 'la',
    dailyRate: 2500,
    category: 'supercar',
    specs: {
      hp: 986,
      topSpeed: '211 mph',
      zeroToSixty: '2.5s',
      engine: '4.0L Twin-Turbo V8 + 3 Electric Motors',
      transmission: '8-Speed DCT',
      seats: 2,
    },
    features: ['AWD', 'Hybrid', 'Assetto Fiorano', 'eManettino'],
    color: 'Rosso Scuderia',
    gradient: 'linear-gradient(135deg, #3d0c0c 0%, #5c1010 50%, #7a1515 100%)',
    image: '/cars/sf90.jpg',
    featured: true,
  },
  {
    id: 'la-3',
    slug: 'bentley-continental-gt-la',
    name: 'Continental GT',
    brand: 'Bentley',
    year: 2024,
    city: 'la',
    dailyRate: 1100,
    category: 'luxury',
    specs: {
      hp: 542,
      topSpeed: '198 mph',
      zeroToSixty: '3.5s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '8-Speed DCT',
      seats: 4,
    },
    features: ['AWD', 'Naim Audio', 'Rotating Display', 'Diamond Knurling'],
    color: 'Glacier White',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #22223b 50%, #2a2a4a 100%)',
    image: '/cars/bentley-gt.jpg',
  },
  {
    id: 'la-4',
    slug: 'mercedes-amg-gt-black-la',
    name: 'AMG GT Black Series',
    brand: 'Mercedes-Benz',
    year: 2024,
    city: 'la',
    dailyRate: 1700,
    category: 'supercar',
    specs: {
      hp: 720,
      topSpeed: '202 mph',
      zeroToSixty: '3.1s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '7-Speed DCT',
      seats: 2,
    },
    features: ['RWD', 'Active Aero', 'Carbon Roof', 'Track Package'],
    color: 'Magno Black',
    gradient: 'linear-gradient(135deg, #111111 0%, #1f1f1f 50%, #333333 100%)',
    image: '/cars/amg-gt.jpg',
  },
  {
    id: 'la-5',
    slug: 'aston-martin-db12-la',
    name: 'DB12',
    brand: 'Aston Martin',
    year: 2024,
    city: 'la',
    dailyRate: 1300,
    category: 'luxury',
    specs: {
      hp: 671,
      topSpeed: '202 mph',
      zeroToSixty: '3.5s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '8-Speed Auto',
      seats: 4,
    },
    features: ['RWD', 'Bowers & Wilkins', 'Carbon Ceramic', 'Adaptive Dampers'],
    color: 'Lunar White',
    gradient: 'linear-gradient(135deg, #0f1923 0%, #1a2a3a 50%, #243b4f 100%)',
    image: '/cars/aston-db12.jpg',
  },

  // Miami Fleet
  {
    id: 'mia-1',
    slug: 'lamborghini-aventador-svj-mia',
    name: 'Aventador SVJ',
    brand: 'Lamborghini',
    year: 2024,
    city: 'mia',
    dailyRate: 2200,
    category: 'supercar',
    specs: {
      hp: 770,
      topSpeed: '217 mph',
      zeroToSixty: '2.8s',
      engine: '6.5L V12',
      transmission: '7-Speed ISR',
      seats: 2,
    },
    features: ['AWD', 'ALA 2.0 Aero', 'Carbon Fiber Monocoque', 'Haldex Gen IV'],
    color: 'Arancio Atlas',
    gradient: 'linear-gradient(135deg, #2d1a00 0%, #4a2800 50%, #663800 100%)',
    image: '/cars/aventador.jpg',
    featured: true,
  },
  {
    id: 'mia-2',
    slug: 'ferrari-812-superfast-mia',
    name: '812 Superfast',
    brand: 'Ferrari',
    year: 2024,
    city: 'mia',
    dailyRate: 2000,
    category: 'supercar',
    specs: {
      hp: 789,
      topSpeed: '211 mph',
      zeroToSixty: '2.9s',
      engine: '6.5L V12',
      transmission: '7-Speed DCT',
      seats: 2,
    },
    features: ['RWD', 'Virtual Short Wheelbase', 'Carbon Brakes', 'JBL Pro Audio'],
    color: 'Giallo Modena',
    gradient: 'linear-gradient(135deg, #2d2d00 0%, #4a4a00 50%, #666600 100%)',
    image: '/cars/ferrari-812.jpg',
  },
  {
    id: 'mia-3',
    slug: 'mclaren-765lt-mia',
    name: '765LT',
    brand: 'McLaren',
    year: 2024,
    city: 'mia',
    dailyRate: 1900,
    category: 'supercar',
    specs: {
      hp: 755,
      topSpeed: '205 mph',
      zeroToSixty: '2.7s',
      engine: '4.0L Twin-Turbo V8',
      transmission: '7-Speed SSG',
      seats: 2,
    },
    features: ['RWD', 'Longtail Design', 'Titanium Exhaust', 'Senna DNA'],
    color: 'Curacao Blue',
    gradient: 'linear-gradient(135deg, #0a1628 0%, #132b4a 50%, #1c3f6e 100%)',
    image: '/cars/mclaren-765lt.jpg',
  },
  {
    id: 'mia-4',
    slug: 'rolls-royce-dawn-mia',
    name: 'Dawn Black Badge',
    brand: 'Rolls-Royce',
    year: 2024,
    city: 'mia',
    dailyRate: 2500,
    category: 'luxury',
    specs: {
      hp: 593,
      topSpeed: '155 mph',
      zeroToSixty: '4.3s',
      engine: '6.6L Twin-Turbo V12',
      transmission: '8-Speed Auto',
      seats: 4,
    },
    features: ['RWD', 'Convertible', 'Starlight Headliner', 'Bespoke Audio'],
    color: 'Black Diamond',
    gradient: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #252525 100%)',
    image: '/cars/rr-dawn.jpg',
    featured: true,
  },
  {
    id: 'mia-5',
    slug: 'bugatti-chiron-mia',
    name: 'Chiron Sport',
    brand: 'Bugatti',
    year: 2024,
    city: 'mia',
    dailyRate: 5000,
    category: 'exotic',
    specs: {
      hp: 1500,
      topSpeed: '261 mph',
      zeroToSixty: '2.3s',
      engine: '8.0L Quad-Turbo W16',
      transmission: '7-Speed DCT',
      seats: 2,
    },
    features: ['AWD', 'Carbon Fiber Body', 'Titanium Exhaust', 'Top Speed Mode'],
    color: 'Atlantic Blue/Black',
    gradient: 'linear-gradient(135deg, #050520 0%, #0a0a40 50%, #101060 100%)',
    image: '/cars/chiron.jpg',
    featured: true,
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
