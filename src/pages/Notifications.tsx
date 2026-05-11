import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  userId: string;
  fromAdmin?: boolean;
  type?: 'admin' | 'message' | 'system';
  subject: string;
  message: string;
  createdAt: number;
  read: boolean;
  conversationId?: string;
}

const Notifications: React.FC = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const ns: Notification[] = [];
      snap.forEach(d => ns.push({ id: d.id, ...d.data() } as Notification));
      ns.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNotifications(ns);
      setLoading(false);
    }, (err) => {
      console.error('Error loading notifications:', err);
      setLoading(false);
    });

    return unsub;
  }, [currentUser]);

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
                    <i className={`las ${n.type === 'message' ? 'la-comment' : 'la-bell'} text-2xl ${!n.read ? 'text-primary-600' : 'text-stone-400'}`} />
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
                    <p className="text-xs text-stone-500 mt-0.5">{n.type === 'message' ? 'Message notification' : 'From Reshelved Team'}</p>
                    {expanded !== n.id && (
                      <p className="text-sm text-stone-500 mt-1 line-clamp-1">{n.message}</p>
                    )}
                  </div>
                </div>

                {expanded === n.id && (
                  <div className="mt-3 pt-3 border-t border-stone-100 ml-12">
                    <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{n.message}</p>
                    {n.conversationId && (
                      <Link to={`/messages/${n.conversationId}`} className="mt-3 inline-flex text-sm font-semibold text-primary-600 hover:text-primary-700">
                        Open conversation
                      </Link>
                    )}
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
