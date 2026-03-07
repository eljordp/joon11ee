'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Notification {
  id: string;
  type: 'achievement' | 'friend_online' | 'jackpot' | 'challenge';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const NOTIF_KEY = 'joon11ee_notifications';

function loadNotifications(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(NOTIF_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveNotifications(notifs: Notification[]) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs.slice(0, 50))); } catch {}
}

export function pushNotification(notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
  const all = loadNotifications();
  const entry: Notification = {
    ...notif,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    read: false,
  };
  all.unshift(entry);
  saveNotifications(all);
  // Dispatch custom event so the bell picks it up
  window.dispatchEvent(new CustomEvent('joon11ee_notification', { detail: entry }));
}

interface Props {
  className?: string;
}

export default function NotificationBell({ className }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifications(loadNotifications());

    const handler = (e: Event) => {
      const notif = (e as CustomEvent<Notification>).detail;
      setNotifications(prev => [notif, ...prev].slice(0, 50));
    };
    window.addEventListener('joon11ee_notification', handler);
    return () => window.removeEventListener('joon11ee_notification', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const clearAll = () => {
    setNotifications([]);
    saveNotifications([]);
    setOpen(false);
  };

  const typeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'achievement': return '🏆';
      case 'friend_online': return '🟢';
      case 'jackpot': return '💰';
      case 'challenge': return '⚔️';
    }
  };

  const timeAgo = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  return (
    <div className={`relative ${className || ''}`} ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        className="px-2 py-1.5 sm:py-2 border border-white/10 text-zinc-400 text-sm hover:text-white transition-all relative"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            className="absolute right-0 top-12 w-72 max-h-80 overflow-y-auto bg-black/95 border border-white/10 backdrop-blur-md z-50"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
              <span className="text-zinc-400 text-[10px] tracking-wider uppercase font-bold">Notifications</span>
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-zinc-700 text-[9px] hover:text-red-400 transition-colors tracking-wider uppercase">
                  Clear
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-zinc-700 text-xs">No notifications</div>
            ) : (
              notifications.slice(0, 20).map(n => (
                <div key={n.id} className={`px-3 py-2 border-b border-white/[0.03] ${!n.read ? 'bg-white/[0.02]' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{typeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-300 text-[11px] font-bold truncate">{n.title}</span>
                        <span className="text-zinc-700 text-[9px] flex-shrink-0 ml-2">{timeAgo(n.timestamp)}</span>
                      </div>
                      <p className="text-zinc-500 text-[10px] truncate">{n.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
