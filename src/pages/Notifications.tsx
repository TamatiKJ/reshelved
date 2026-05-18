import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  userId: string;
  fromAdmin?: boolean;
  type?: 'admin' | 'system' | 'listing' | 'swap' | 'availability' | 'message';
  subject: string;
  message: string;
  createdAt: number;
  read: boolean;
  conversationId?: string;
}

const getNotificationMeta = (type?: Notification['type']) => {
  switch (type) {
    case 'listing':
      return { label: 'Listing', icon: 'la-book', tone: 'bg-[#FFF4E2] text-[#D54215]' };
    case 'swap':
      return { label: 'Swap', icon: 'la-sync', tone: 'bg-[#FFF4E2] text-[#D54215]' };
    case 'availability':
      return { label: 'Availability', icon: 'la-bell', tone: 'bg-stone-100 text-stone-700' };
    case 'admin':
      return { label: 'Admin', icon: 'la-bullhorn', tone: 'bg-stone-100 text-stone-700' };
    case 'system':
      return { label: 'System', icon: 'la-info-circle', tone: 'bg-stone-100 text-stone-700' };
    default:
      return { label: 'Update', icon: 'la-bell', tone: 'bg-stone-100 text-stone-700' };
  }
};

const formatNotificationDate = (value: number) => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const Notifications: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'listing' | 'swap' | 'system'>('all');

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));

    const unsub = onSnapshot(q, (snap) => {
      const ns: Notification[] = [];
      snap.forEach(d => ns.push({ id: d.id, ...d.data() } as Notification));
      ns.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNotifications(ns.filter((item) => !item.read && item.type !== 'message'));
      setLoading(false);
    }, (err) => {
      console.error('Error loading notifications:', err);
      setLoading(false);
    });

    return unsub;
  }, [currentUser]);

  const markRead = async (notifId: string) => {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  };

  const handleOpenNotification = (notification: Notification) => {
    setSelectedNotification(notification);
    if (!notification.read) markRead(notification.id).catch(console.error);
  };

  const unreadCount = notifications.length;
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    if (activeFilter === 'system') return notifications.filter(n => n.type === 'system' || n.type === 'admin');
    return notifications.filter(n => n.type === activeFilter);
  }, [notifications, activeFilter]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-[996px] px-4 py-16 text-center pb-10 sm:pb-20">
        <div className="rounded-[28px] border border-stone-200 bg-white px-6 py-14">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-500"><i className="las la-bell text-3xl" /></div>
          <h2 className="mt-4 text-xl font-bold text-stone-950">Please log in to view notifications</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">Your listing updates, account notices, and Reshelved alerts will appear here.</p>
          <Link to="/login" className="mt-5 inline-flex items-center justify-center rounded-full bg-[#FF5F57] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#e84f48]">Log In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[996px] px-4 py-8 pb-10 sm:px-6 sm:pb-20">
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${getNotificationMeta(selectedNotification.type).tone}`}>
                  <i className={`las ${getNotificationMeta(selectedNotification.type).icon} text-2xl`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">{getNotificationMeta(selectedNotification.type).label}</p>
                  <h3 className="mt-1 text-xl font-bold leading-tight text-stone-950">{selectedNotification.subject}</h3>
                  <p className="mt-1 text-xs font-semibold text-stone-400">{new Date(selectedNotification.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedNotification(null)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200" aria-label="Close notification">
                <i className="las la-times text-xl" />
              </button>
            </div>
            <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{selectedNotification.message}</p>
            </div>
            <button type="button" onClick={() => setSelectedNotification(null)} className="mt-5 inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-[#FF5F57] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#e84f48]">Done</button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Updates about listings, swaps, account notices, and book activity.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700">
          <span className="flex h-2 w-2 rounded-full bg-[#FF5F57]" />
          {unreadCount} unread
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-stone-950">Inbox</h2>
              <p className="mt-1 text-sm text-stone-500">Open a notification to read the full message.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'listing', label: 'Listings' },
                { id: 'swap', label: 'Swaps' },
                { id: 'system', label: 'System' }
              ].map((filter) => {
                const selected = activeFilter === filter.id;
                return (
                  <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id as typeof activeFilter)} className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-bold transition ${selected ? 'border-stone-900 bg-stone-950 text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4 sm:p-6">
            {[1, 2, 3].map(i => <div key={i} className="h-[88px] animate-pulse rounded-[24px] border border-stone-200 bg-stone-50" />)}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-500"><i className="las la-bell-slash text-3xl" /></div>
            <h3 className="mt-4 text-base font-bold text-stone-950">No notifications yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-stone-500">System updates about listings, swaps, and book availability will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredNotifications.map((n) => {
              const meta = getNotificationMeta(n.type);
              return (
                <button key={n.id} type="button" onClick={() => handleOpenNotification(n)} className="group flex w-full cursor-pointer items-start gap-4 bg-white p-4 text-left transition hover:bg-stone-50 sm:p-5">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                    <i className={`las ${meta.icon} text-2xl`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-stone-950">{n.subject}</p>
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF5F57]" />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-stone-400">From Reshelved · {meta.label}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-stone-400">{formatNotificationDate(n.createdAt)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">{n.message}</p>
                  </div>
                  <i className="las la-angle-right mt-3 shrink-0 text-xl text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
