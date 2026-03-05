export interface Booking {
  id: string;
  city: string;
  cityFullName: string;
  carBrand: string;
  carName: string;
  carSlug: string;
  carImage?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailyRate: number;
  totalPrice: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    age: string;
    driversLicense: string;
  };
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

const STORAGE_KEY = 'joon11ee_bookings';

export function getBookings(): Booking[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveBooking(booking: Booking): void {
  const bookings = getBookings();
  bookings.unshift(booking);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

export function updateBookingStatus(id: string, status: Booking['status']): void {
  const bookings = getBookings();
  const index = bookings.findIndex((b) => b.id === id);
  if (index !== -1) {
    bookings[index].status = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  }
}

export function deleteBooking(id: string): void {
  const bookings = getBookings().filter((b) => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

export function generateBookingId(): string {
  return `JN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}
