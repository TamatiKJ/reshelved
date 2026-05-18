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

type FilterKey = 'all' | 'listing' | 'swap' | 'system';

const filters: Array<{ id: FilterKey; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'listing', label: 'Listings' },
  { id: 'swap', label: 'Swaps' },
  { id: 'system', label: 'System' }
];

const getNotificationMeta = (type?: Notification['type']) => {
  switch (type) {
    case 'listing': return { label: 'Listing', icon: 'la-book' };
    case 'swap': return { label: 'Swap', icon: 'la-sync' };
    case 'availability': return { label: 'Availability', icon: 'la-bell' };
    case 'admin': return { label: 'Admin', icon: 'la-bullhorn' };
    case 'system': return { label: 'System', icon: 'la-info-circle' };
    default: return { label: 'Update', icon: 'la-bell' };
  }
};

const formatNotificationDate = (value: number) => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const Notifications: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

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
  const systemCount = notifications.filter(n => n.type === 'system' || n.type === 'admin').length;
  const listingCount = notifications.filter(n => n.type === 'listing').length;
  const swapCount = notifications.filter(n => n.type === 'swap').length;

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
    <div className="mx-auto max-w-[1180px] px-4 py-8 pb-10 sm:px-6 sm:pb-20">
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-xl rounded-[32px] bg-white p-6 shadow-2xl ring-1 ring-black/5 sm:p-7">
            <div className="flex items-start justify-between gap-5">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                  <i className={`las ${getNotificationMeta(selectedNotification.type).icon} text-2xl`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">{getNotificationMeta(selectedNotification.type).label}</p>
                  <h3 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-stone-950">{selectedNotification.subject}</h3>
                  <p className="mt-2 text-sm font-semibold text-stone-400">{new Date(selectedNotification.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedNotification(null)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200" aria-label="Close notification">
                <i className="las la-times text-xl" />
              </button>
            </div>
            <div className="mt-7 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
              <p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{selectedNotification.message}</p>
            </div>
            <button type="button" onClick={() => setSelectedNotification(null)} className="mt-5 inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-[#FF5F57] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#e84f48]">Done</button>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Notifications</p>
          <h1 className="text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl">Your updates</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">Keep track of account notices, listing updates, and swap activity.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700 shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-[#FF5F57]" />
          {unreadCount} unread
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-[28px] border border-stone-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
          <div className="p-3">
            <h2 className="text-lg font-bold text-stone-950">Inbox</h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">Unread notifications only.</p>
          </div>
          <nav className="mt-2 grid gap-1.5">
            {filters.map((filter) => {
              const selected = activeFilter === filter.id;
              const count = filter.id === 'all' ? unreadCount : filter.id === 'listing' ? listingCount : filter.id === 'swap' ? swapCount : systemCount;
              return (
                <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={`flex h-11 cursor-pointer items-center justify-between rounded-full px-4 text-left text-[15px] transition ${selected ? 'border border-stone-300 bg-gradient-to-b from-stone-100 to-stone-200 font-semibold text-black' : 'font-medium text-stone-700 hover:bg-stone-100'}`}>
                  <span>{filter.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-white text-stone-700' : 'bg-stone-100 text-stone-500'}`}>{count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-stone-950">Latest activity</h2>
                  <p className="mt-1 text-sm text-stone-500">Open a notification to read the full message.</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 p-5 sm:p-6">
                {[1, 2, 3].map(i => <div key={i} className="h-[104px] animate-pulse rounded-[24px] border border-stone-200 bg-stone-50" />)}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-500"><i className="las la-bell-slash text-3xl" /></div>
                <h3 className="mt-4 text-base font-bold text-stone-950">No notifications here</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-stone-500">New listing updates, swaps, and system notices will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filteredNotifications.map((n) => {
                  const meta = getNotificationMeta(n.type);
                  return (
                    <button key={n.id} type="button" onClick={() => handleOpenNotification(n)} className="group grid w-full cursor-pointer grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-4 bg-white px-5 py-5 text-left transition hover:bg-stone-50 sm:px-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                        <i className={`las ${meta.icon} text-2xl`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-base font-bold tracking-tight text-stone-950">{n.subject}</p>
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF5F57]" />
                        </div>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-400">{meta.label}</p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">{n.message}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 pt-1">
                        <span className="text-xs font-semibold text-stone-400">{formatNotificationDate(n.createdAt)}</span>
                        <i className="las la-angle-right text-xl text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Notifications;
