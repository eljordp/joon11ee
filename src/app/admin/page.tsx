'use client';

import { useState, useEffect } from 'react';
import { getBookings, updateBookingStatus, deleteBooking, type Booking } from '@/lib/bookings';
import { formatPrice } from '@/data/fleet';

const STATUS_COLORS: Record<Booking['status'], string> = {
  pending: 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10',
  confirmed: 'border-green-500/50 text-green-500 bg-green-500/10',
  completed: 'border-zinc-500/50 text-zinc-400 bg-zinc-500/10',
  cancelled: 'border-red-500/50 text-red-500 bg-red-500/10',
};

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Booking['status'] | 'all'>('all');
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('joon11ee_admin');
    if (saved === 'true') {
      setAuthenticated(true);
      setBookings(getBookings());
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'joon11ee2024') {
      setAuthenticated(true);
      sessionStorage.setItem('joon11ee_admin', 'true');
      setBookings(getBookings());
    }
  };

  const handleStatusChange = (id: string, status: Booking['status']) => {
    updateBookingStatus(id, status);
    setBookings(getBookings());
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this booking?')) {
      deleteBooking(id);
      setBookings(getBookings());
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    revenue: bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.totalPrice, 0),
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Admin Access</h1>
            <p className="text-zinc-500 text-sm">Enter password to continue</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-black border border-white/[0.1] px-4 py-3 text-white focus:border-red-600 focus:outline-none transition-colors text-sm"
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-3 text-sm font-bold tracking-widest uppercase hover:bg-red-500 transition-all"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">Bookings</h1>
            <p className="text-zinc-500 text-sm mt-1">{bookings.length} total booking{bookings.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('joon11ee_admin');
              setAuthenticated(false);
            }}
            className="text-zinc-500 text-xs tracking-wider uppercase hover:text-white transition-colors"
          >
            Log Out
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Bookings" value={stats.total.toString()} />
          <StatCard label="Pending" value={stats.pending.toString()} color="text-yellow-500" />
          <StatCard label="Confirmed" value={stats.confirmed.toString()} color="text-green-500" />
          <StatCard label="Revenue" value={formatPrice(stats.revenue)} color="text-red-500" />
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-8">
          {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-all ${
                filter === s
                  ? 'bg-red-600 text-white'
                  : 'border border-white/10 text-zinc-500 hover:text-white hover:border-white/20'
              }`}
            >
              {s === 'all' ? `All (${bookings.length})` : `${s} (${bookings.filter((b) => b.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Bookings list */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-lg">No bookings yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((b) => (
              <div key={b.id} className="border border-white/[0.06] hover:border-white/[0.12] transition-all">
                {/* Top row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-6">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Car thumbnail */}
                    {b.carImage && (
                      <div className="w-16 h-12 flex-shrink-0 overflow-hidden relative hidden sm:block">
                        <img src={b.carImage} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="text-white font-bold">{b.carBrand} {b.carName}</span>
                        <span className={`px-2 py-0.5 text-[10px] tracking-wider uppercase border ${STATUS_COLORS[b.status]}`}>
                          {b.status}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-sm">
                        {b.customer.firstName} {b.customer.lastName} &middot; {b.customer.email} &middot; {b.customer.phone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-red-500 font-bold text-lg">{formatPrice(b.totalPrice)}</p>
                      <p className="text-zinc-600 text-xs">{b.totalDays} day{b.totalDays !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>

                {/* Details row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-white/[0.04] bg-white/[0.01]">
                  <div className="flex gap-4 text-xs text-zinc-500 flex-wrap">
                    <span>ID: {b.id}</span>
                    <span>{b.cityFullName}</span>
                    <span>{b.startDate} — {b.endDate}</span>
                    <span>DL: {b.customer.driversLicense}</span>
                    <span>Age: {b.customer.age}</span>
                    <span>Booked: {new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex gap-2">
                    {b.status === 'pending' && (
                      <button
                        onClick={() => handleStatusChange(b.id, 'confirmed')}
                        className="px-3 py-1.5 bg-green-600/20 border border-green-600/30 text-green-500 text-xs tracking-wider uppercase hover:bg-green-600/30 transition-all"
                      >
                        Confirm
                      </button>
                    )}
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <button
                        onClick={() => handleStatusChange(b.id, 'completed')}
                        className="px-3 py-1.5 border border-white/10 text-zinc-400 text-xs tracking-wider uppercase hover:text-white hover:border-white/20 transition-all"
                      >
                        Complete
                      </button>
                    )}
                    {b.status !== 'cancelled' && (
                      <button
                        onClick={() => handleStatusChange(b.id, 'cancelled')}
                        className="px-3 py-1.5 border border-white/10 text-zinc-500 text-xs tracking-wider uppercase hover:text-red-500 hover:border-red-500/30 transition-all"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="px-3 py-1.5 border border-white/10 text-zinc-600 text-xs tracking-wider uppercase hover:text-red-500 hover:border-red-500/30 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-5 border border-white/[0.06]">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-zinc-500 text-xs tracking-wider uppercase mt-1">{label}</p>
    </div>
  );
}
