import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  userId: string;
  fromAdmin: boolean;
  subject: string;
  message: string;
  createdAt: number;
  read: boolean;
}

const Notifications: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) fetchNotifications();
  }, [currentUser]);

  const fetchNotifications = async () => {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser!.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const ns: Notification[] = [];
      snap.forEach(d => ns.push({ id: d.id, ...d.data() } as Notification));
      setNotifications(ns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (notifId: string) => {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  };

  const handleExpand = (notifId: string) => {
    setExpanded(expanded === notifId ? null : notifId);
    const notif = notifications.find(n => n.id === notifId);
    if (notif && !notif.read) markRead(notifId);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-stone-700">Please log in to view notifications</h2>
        <Link to="/login" className="mt-4 inline-block text-primary-600 font-medium">Log In</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-primary-600 mt-0.5 font-medium">{unreadCount} unread</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-stone-200 h-20" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <div className="text-5xl mb-4">🔔</div>
          <h3 className="text-lg font-semibold text-stone-700">No notifications yet</h3>
          <p className="text-stone-500 text-sm mt-1">Platform updates and messages will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`bg-white rounded-xl border transition cursor-pointer ${
                !n.read ? 'border-primary-200 shadow-sm' : 'border-stone-200'
              }`}
              onClick={() => handleExpand(n.id)}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    !n.read ? 'bg-primary-100' : 'bg-stone-100'
                  }`}>
                    <svg className={`w-5 h-5 ${!n.read ? 'text-primary-600' : 'text-stone-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold truncate ${!n.read ? 'text-stone-800' : 'text-stone-600'}`}>
                        {n.subject}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                        <span className="text-xs text-stone-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">From Reshelved Team</p>
                    {expanded !== n.id && (
                      <p className="text-sm text-stone-500 mt-1 line-clamp-1">{n.message}</p>
                    )}
                  </div>
                </div>

                {expanded === n.id && (
                  <div className="mt-3 pt-3 border-t border-stone-100 ml-12">
                    <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{n.message}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
