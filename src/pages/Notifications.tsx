import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { mapSnapshot } from '../utils/firestoreMappers';

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
    case 'listing': return { label: 'Listing', icon: 'la-book', tone: 'bg-[#FFF4E2] text-primary-700' };
    case 'swap': return { label: 'Swap', icon: 'la-sync', tone: 'bg-[#EEF6FF] text-[#1665CC]' };
    case 'availability': return { label: 'Availability', icon: 'la-bell', tone: 'bg-[#FFF4E2] text-primary-700' };
    case 'admin': return { label: 'Admin', icon: 'la-bullhorn', tone: 'bg-stone-100 text-stone-800' };
    case 'system': return { label: 'System', icon: 'la-info-circle', tone: 'bg-stone-100 text-stone-800' };
    default: return { label: 'Update', icon: 'la-bell', tone: 'bg-stone-100 text-stone-800' };
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
      const ns = mapSnapshot<Notification>(snap).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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

  const getFilterCount = (filter: FilterKey) => {
    if (filter === 'all') return unreadCount;
    if (filter === 'listing') return listingCount;
    if (filter === 'swap') return swapCount;
    return systemCount;
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-[760px] rounded-[28px] border border-stone-200 bg-white p-6 text-center shadow-sm sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF4E2] text-primary-700">
            <i className="las la-bell text-3xl" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-stone-950">Please log in to view updates</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">Your listing updates, account notices, and Reshelved alerts will appear here.</p>
          <Link to="/login" className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700">Log In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] px-4 py-6 pb-10 sm:px-6 sm:py-8 sm:pb-20">
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl ring-1 ring-black/5 sm:p-7">
            <div className="flex items-start justify-between gap-5">
              <div className="flex min-w-0 items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${getNotificationMeta(selectedNotification.type).tone}`}>
                  <i className={`las ${getNotificationMeta(selectedNotification.type).icon} text-2xl`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">{getNotificationMeta(selectedNotification.type).label}</p>
                  <h3 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-stone-950">{selectedNotification.subject}</h3>
                  <p className="mt-2 text-sm font-semibold text-stone-400">{new Date(selectedNotification.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedNotification(null)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200" aria-label="Close notification">
                <i className="las la-times text-xl" />
              </button>
            </div>
            <div className="mt-7 rounded-2xl border border-stone-200 bg-[#FAFAF9] p-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{selectedNotification.message}</p>
            </div>
            <button type="button" onClick={() => setSelectedNotification(null)} className="mt-5 inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700">Done</button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl">Your updates</h1>
              <p className="mt-3 text-sm leading-6 text-stone-500">Keep track of listing activity, swap updates, and important account notices in one place.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-200 bg-[#FAFAF9] px-4 py-2 text-sm font-bold text-stone-700">
              <span className="flex h-2 w-2 rounded-full bg-primary-600" />
              {unreadCount} unread
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-stone-950">Inbox</h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">Unread updates only.</p>
            </div>
            <nav className="grid gap-2">
              {filters.map((filter) => {
                const selected = activeFilter === filter.id;
                const count = getFilterCount(filter.id);
                return (
                  <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={`flex h-12 cursor-pointer items-center justify-between rounded-xl border px-4 text-left text-sm transition ${selected ? 'border-primary-600 bg-[#FFF4E2] font-bold text-stone-950' : 'border-stone-200 bg-white font-semibold text-stone-700 hover:border-primary-200 hover:bg-[#FAFAF9]'}`}>
                    <span>{filter.label}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selected ? 'bg-white text-primary-700' : 'bg-stone-100 text-stone-500'}`}>{count}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0">
            <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-100 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-stone-950">Latest activity</h2>
                    <p className="mt-1 text-sm text-stone-500">Open an update to read the full message.</p>
                  </div>
                  <span className="w-fit rounded-full bg-[#FAFAF9] px-3 py-1.5 text-xs font-bold text-stone-500">{filteredNotifications.length} shown</span>
                </div>
              </div>

              {loading ? (
                <div className="space-y-3 p-5 sm:p-6">
                  {[1, 2, 3].map(i => <div key={i} className="h-[112px] animate-pulse rounded-2xl border border-stone-200 bg-[#FAFAF9]" />)}
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF4E2] text-primary-700"><i className="las la-bell-slash text-3xl" /></div>
                  <h3 className="mt-4 text-lg font-bold text-stone-950">No updates here</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-stone-500">New listing updates, swaps, and system notices will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3 p-4 sm:p-5">
                  {filteredNotifications.map((n) => {
                    const meta = getNotificationMeta(n.type);
                    return (
                      <button key={n.id} type="button" onClick={() => handleOpenNotification(n)} className="group grid w-full cursor-pointer grid-cols-[48px_minmax(0,1fr)] gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-primary-200 hover:bg-[#FAFAF9] sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:p-5">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${meta.tone}`}>
                          <i className={`las ${meta.icon} text-2xl`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="truncate text-base font-bold tracking-tight text-stone-950">{n.subject}</p>
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                          </div>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-400">{meta.label}</p>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">{n.message}</p>
                        </div>
                        <div className="col-span-2 flex items-center justify-between gap-3 pt-1 sm:col-span-1 sm:justify-end sm:pt-0">
                          <span className="text-xs font-semibold text-stone-400">{formatNotificationDate(n.createdAt)}</span>
                          <i className="las la-angle-right text-xl text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
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
    </div>
  );
};

export default Notifications;
