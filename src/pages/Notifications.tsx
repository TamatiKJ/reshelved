import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
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

const primaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#FF5F57] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#e84f48] disabled:cursor-not-allowed disabled:opacity-60';

const filters: Array<{ id: FilterKey; label: string; icon: string }> = [
  { id: 'all', label: 'All updates', icon: 'la-bell' },
  { id: 'listing', label: 'Listings', icon: 'la-book-open' },
  { id: 'swap', label: 'Swaps', icon: 'la-sync' },
  { id: 'system', label: 'System', icon: 'la-info-circle' }
];

const getNotificationMeta = (type?: Notification['type']) => {
  switch (type) {
    case 'listing': return { label: 'Listing', icon: 'la-book', tone: 'bg-[#FFF4E2] text-[#FF5F57]' };
    case 'swap': return { label: 'Swap', icon: 'la-sync', tone: 'bg-[#FFF4E2] text-[#FF5F57]' };
    case 'availability': return { label: 'Availability', icon: 'la-bell', tone: 'bg-[#FFF4E2] text-[#FF5F57]' };
    case 'admin': return { label: 'Admin', icon: 'la-bullhorn', tone: 'bg-stone-100 text-stone-700' };
    case 'system': return { label: 'System', icon: 'la-info-circle', tone: 'bg-stone-100 text-stone-700' };
    default: return { label: 'Update', icon: 'la-bell', tone: 'bg-stone-100 text-stone-700' };
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

const EmptyState: React.FC<{ icon: string; title: string; body: string; action?: React.ReactNode }> = ({ icon, title, body, action }) => (
  <div className="rounded-[28px] border border-stone-200 bg-white px-6 py-14 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-500"><i className={`las ${icon} text-3xl`} /></div>
    <h3 className="mt-4 text-base font-bold text-stone-950">{title}</h3>
    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-stone-500">{body}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const Notifications: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
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
      <div className="mx-auto max-w-[996px] px-4 py-16 text-center pb-10 sm:pb-20">
        <EmptyState
          icon="la-bell"
          title="Please log in to view updates"
          body="Your listing updates, account notices, and Reshelved alerts will appear here."
          action={<Link to="/login" className={primaryButtonClass}>Log In</Link>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 pb-10 sm:px-6 sm:pb-20">
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${getNotificationMeta(selectedNotification.type).tone}`}>
                  <i className={`las ${getNotificationMeta(selectedNotification.type).icon} text-2xl`} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-950">{selectedNotification.subject}</h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">{getNotificationMeta(selectedNotification.type).label} · {new Date(selectedNotification.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedNotification(null)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200" aria-label="Close notification"><i className="las la-times text-xl" /></button>
            </div>
            <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
              <p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{selectedNotification.message}</p>
            </div>
            <button type="button" onClick={() => setSelectedNotification(null)} className={`mt-5 w-full cursor-pointer ${primaryButtonClass}`}>Done</button>
          </div>
        </div>
      )}

      <div className="mb-5">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex cursor-pointer items-center text-sm font-bold text-[#1665CC] hover:text-[#1254a9]">← Back</button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-[32px] border border-stone-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-stone-100 text-stone-500 ring-1 ring-stone-200">
              <i className="las la-bell text-4xl" />
            </div>
            <h1 className="mt-7 text-2xl font-bold tracking-tight text-stone-950">Your updates</h1>
            <p className="mt-3 text-sm leading-6 text-stone-500">Listing activity, swap updates, and account notices appear here.</p>
            <div className="mt-5 flex justify-center">
              <span className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600">
                <i className="las la-bell mr-1" />{unreadCount} unread
              </span>
            </div>
          </div>

          <nav className="mt-5 overflow-hidden rounded-[28px] border border-stone-200 bg-white p-2 shadow-sm">
            <div className="grid gap-1.5">
              {filters.map((filter) => {
                const selected = activeFilter === filter.id;
                const count = getFilterCount(filter.id);
                return (
                  <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={`flex h-11 cursor-pointer items-center justify-between rounded-full px-4 text-left text-[16px] transition ${selected ? 'border border-stone-300 bg-gradient-to-b from-stone-100 to-stone-200 font-semibold text-black' : 'font-medium text-stone-700 hover:bg-stone-100'}`}>
                    <span className="flex min-w-0 items-center gap-3.5"><i className={`las ${filter.icon} text-xl`} />{filter.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-white text-stone-700' : 'bg-stone-100 text-stone-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-stone-950">Latest activity</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Open an update to read the full message. Read updates are removed from this inbox.</p>
            </div>
            <span className="w-fit rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600">{filteredNotifications.length} shown</span>
          </div>

          {loading ? (
            <div className="animate-pulse rounded-[32px] border border-stone-200 bg-white p-6">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[24px] bg-stone-100" />)}
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <EmptyState icon="la-bell-slash" title="No updates here" body="New listing updates, swaps, and system notices will appear here." />
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((n) => {
                const meta = getNotificationMeta(n.type);
                return (
                  <button key={n.id} type="button" onClick={() => handleOpenNotification(n)} className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-[24px] border border-stone-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-stone-300 hover:bg-stone-50 hover:shadow-sm">
                    <span className="flex min-w-0 items-start gap-3">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.tone}`}><i className={`las ${meta.icon} text-2xl`} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-stone-950">{n.subject}</span>
                        <span className="mt-0.5 block text-xs font-bold uppercase tracking-[0.14em] text-stone-400">{meta.label} · {formatNotificationDate(n.createdAt)}</span>
                        <span className="mt-2 block line-clamp-2 text-sm leading-6 text-stone-500">{n.message}</span>
                      </span>
                    </span>
                    <i className="las la-angle-right shrink-0 text-xl text-stone-400 transition group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Notifications;
