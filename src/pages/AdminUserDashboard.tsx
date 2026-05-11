import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { UserProfile } from '../types';

type UserFilter = 'all' | 'online' | 'offline' | 'banned' | 'admin';

const isUserOnline = (user: UserProfile) => {
  const lastSeen = user.lastSeen || 0;
  return Boolean(user.online) && Date.now() - lastSeen < 2 * 60 * 1000;
};

const formatDate = (timestamp?: number) => {
  if (!timestamp) return 'Not recorded';
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const AdminUserDashboard: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [toast, setToast] = useState('');
  const [messageUser, setMessageUser] = useState<UserProfile | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (!userProfile?.isAdmin) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((userDoc) => {
          const data = userDoc.data() as UserProfile;
          list.push({ ...data, uid: data.uid || userDoc.id });
        });
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setUsers(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading users:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userProfile?.isAdmin]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !term ||
        user.displayName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.location?.toLowerCase().includes(term) ||
        user.uid?.toLowerCase().includes(term);

      if (!matchesSearch) return false;
      if (filter === 'online') return isUserOnline(user);
      if (filter === 'offline') return !isUserOnline(user) && !(user as any).deactivated;
      if (filter === 'banned') return Boolean((user as any).deactivated);
      if (filter === 'admin') return Boolean(user.isAdmin);
      return true;
    });
  }, [users, search, filter]);

  const onlineUsers = users.filter(isUserOnline).length;
  const bannedUsers = users.filter((user) => Boolean((user as any).deactivated)).length;
  const normalUsers = users.filter((user) => !user.isAdmin).length;

  const toggleBanUser = async (user: UserProfile) => {
    if (user.uid === currentUser?.uid) {
      showToast('You cannot ban your own admin account');
      return;
    }

    const isBanned = Boolean((user as any).deactivated);
    const confirmText = isBanned
      ? `Reactivate ${user.displayName || user.email}?`
      : `Ban ${user.displayName || user.email}? They will not be allowed to continue using the platform.`;

    if (!confirm(confirmText)) return;

    await updateDoc(doc(db, 'users', user.uid), {
      deactivated: !isBanned,
      online: false,
      lastSeen: Date.now()
    });

    showToast(isBanned ? 'User reactivated' : 'User banned');
  };

  const openMessageModal = (user: UserProfile) => {
    setMessageUser(user);
    setSubject('Message from Reshelved Admin');
    setMessage('');
  };

  const sendAdminMessage = async () => {
    if (!messageUser || !subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: messageUser.uid,
        userName: messageUser.displayName || messageUser.email,
        fromAdmin: true,
        subject: subject.trim(),
        message: message.trim(),
        createdAt: Date.now(),
        read: false
      });
      showToast(`Message sent to ${messageUser.displayName || messageUser.email}`);
      setMessageUser(null);
      setSubject('');
      setMessage('');
    } catch (error) {
      console.error('Error sending admin message:', error);
      showToast('Message failed to send');
    } finally {
      setSending(false);
    }
  };

  if (!userProfile?.isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="las la-lock text-3xl text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-stone-800">Access Denied</h2>
        <p className="text-stone-500 mt-2">You do not have admin privileges.</p>
        <Link to="/" className="mt-4 inline-block text-primary-600 font-semibold">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-stone-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Admin Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-stone-900">Registered Users</h1>
          <p className="mt-1 text-sm text-stone-500">View all accounts, registration dates, online status, admin roles, messages, and bans.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition text-sm font-semibold"
        >
          <i className="las la-redo-alt text-lg" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-sm text-stone-500">Total accounts</p>
          <p className="mt-1 text-3xl font-bold text-stone-900">{users.length}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-sm text-stone-500">Online now</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{onlineUsers}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-sm text-stone-500">Regular users</p>
          <p className="mt-1 text-3xl font-bold text-stone-900">{normalUsers}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <p className="text-sm text-stone-500">Banned users</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{bannedUsers}</p>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, location, or UID..."
            className="w-full lg:max-w-md px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 focus:outline-none"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as UserFilter)}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:border-primary-400 focus:outline-none"
          >
            <option value="all">All users</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="banned">Banned</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-stone-500">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-stone-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last seen</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredUsers.map((user) => {
                  const online = isUserOnline(user);
                  const banned = Boolean((user as any).deactivated);
                  return (
                    <tr key={user.uid} className="align-top">
                      <td className="px-4 py-4 min-w-[260px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                            {(user.displayName || user.email || 'U')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-stone-900">{user.displayName || 'Unnamed user'}</div>
                            <div className="text-stone-500">{user.email}</div>
                            <div className="text-xs text-stone-400 mt-0.5">{user.location || 'No location'} · {user.uid}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-stone-700">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {banned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-red-500" /> Banned
                          </span>
                        ) : online ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-green-500" /> Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-stone-400" /> Offline
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-stone-700">{formatDate(user.lastSeen)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${user.isAdmin ? 'bg-primary-100 text-primary-700' : 'bg-stone-100 text-stone-600'}`}>
                          {user.isAdmin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openMessageModal(user)}
                            className="px-3 py-1.5 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 text-xs font-semibold"
                          >
                            Message
                          </button>
                          <button
                            onClick={() => toggleBanUser(user)}
                            disabled={user.uid === currentUser?.uid}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${banned ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-red-200 text-red-700 hover:bg-red-50'}`}
                          >
                            {banned ? 'Unban' : 'Ban'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {messageUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-stone-900">Send message</h2>
                <p className="text-sm text-stone-500">To {messageUser.displayName || messageUser.email}</p>
              </div>
              <button onClick={() => setMessageUser(null)} className="text-stone-400 hover:text-stone-700">
                <i className="las la-times text-2xl" />
              </button>
            </div>

            <label className="block text-sm font-semibold text-stone-700 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 focus:outline-none mb-4"
            />

            <label className="block text-sm font-semibold text-stone-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 focus:outline-none"
              placeholder="Write the admin message here..."
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setMessageUser(null)}
                className="px-4 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={sendAdminMessage}
                disabled={sending || !subject.trim() || !message.trim()}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserDashboard;
