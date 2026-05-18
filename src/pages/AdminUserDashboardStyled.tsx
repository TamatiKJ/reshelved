import React, { useState } from 'react';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminUserDashboard from './AdminUserDashboard';
import type { UserProfile } from '../types';

const AdminUserDashboardStyled: React.FC = () => {
  const { userProfile, logout } = useAuth() as any;
  const [sending, setSending] = useState(false);

  const sendUpdate = async () => {
    if (!userProfile?.isAdmin || sending) return;

    const subject = window.prompt('Notification subject');
    if (!subject?.trim()) return;

    const message = window.prompt('Notification message');
    if (!message?.trim()) return;

    setSending(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const users: UserProfile[] = [];
      usersSnap.forEach((item) => users.push({ uid: item.id, ...item.data() } as UserProfile));

      await Promise.all(users.map((user) => addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        userName: user.displayName || 'User',
        fromAdmin: true,
        subject: subject.trim(),
        message: message.trim(),
        createdAt: Date.now(),
        read: false,
      })));

      window.alert(`Update sent to ${users.length} platform users.`);
    } catch (error) {
      console.error(error);
      window.alert('Update could not be sent. Check Firestore rules.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="admin-tiktok-shell">
      <AdminUserDashboard />

      {userProfile?.isAdmin && (
        <>
          <div className="admin-left-primary-action hidden lg:block">
            <button
              type="button"
              onClick={sendUpdate}
              disabled={sending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#D54215] text-[16px] font-semibold text-white transition hover:bg-[#B53811] disabled:opacity-60"
            >
              <i className="las la-paper-plane text-xl" />
              {sending ? 'Sending...' : 'Send Update'}
            </button>
          </div>

          <div className="admin-left-bottom-actions hidden lg:block">
            <Link to="/" className="admin-tiktok-side-link">
              <i className="las la-globe" />
              <span>View Site</span>
            </Link>
            <button type="button" onClick={() => logout?.()} className="admin-tiktok-side-link w-full">
              <i className="las la-sign-out-alt" />
              <span>Logout</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminUserDashboardStyled;
