import React, { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminUserDashboard from './AdminUserDashboard';
import type { UserProfile } from '../types';
import './AdminUserDashboardStyled.css';

const AdminUserDashboardStyled: React.FC = () => {
  const { userProfile, logout } = useAuth() as any;
  const [sending, setSending] = useState(false);

  const sendUpdate = useCallback(async () => {
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
  }, [sending, userProfile?.isAdmin]);

  useEffect(() => {
    if (!userProfile?.isAdmin) return undefined;

    const sidebarSelector = '.admin-tiktok-shell aside.hidden.border-r.border-stone-200.bg-white';
    const sidebars = Array.from(document.querySelectorAll<HTMLElement>(sidebarSelector));
    const cleanups: Array<() => void> = [];

    sidebars.forEach((sidebar) => {
      sidebar.querySelector('.admin-extra-actions')?.remove();

      const wrap = document.createElement('div');
      wrap.className = 'admin-extra-actions';

      const sendButton = document.createElement('button');
      sendButton.type = 'button';
      sendButton.className = 'admin-extra-action admin-extra-action-primary';
      sendButton.innerHTML = `<i class="las la-paper-plane"></i><span>${sending ? 'Sending...' : 'Send Update'}</span>`;
      sendButton.disabled = sending;

      const viewLink = document.createElement('a');
      viewLink.href = '/';
      viewLink.className = 'admin-extra-action';
      viewLink.innerHTML = '<i class="las la-globe"></i><span>View Site</span>';

      const logoutButton = document.createElement('button');
      logoutButton.type = 'button';
      logoutButton.className = 'admin-extra-action';
      logoutButton.innerHTML = '<i class="las la-sign-out-alt"></i><span>Logout</span>';

      const handleSend = () => sendUpdate();
      const handleLogout = () => logout?.();

      sendButton.addEventListener('click', handleSend);
      logoutButton.addEventListener('click', handleLogout);

      wrap.append(sendButton, viewLink, logoutButton);
      sidebar.appendChild(wrap);

      cleanups.push(() => {
        sendButton.removeEventListener('click', handleSend);
        logoutButton.removeEventListener('click', handleLogout);
        wrap.remove();
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [logout, sendUpdate, sending, userProfile?.isAdmin]);

  return (
    <div className="admin-tiktok-shell">
      <AdminUserDashboard />
    </div>
  );
};

export default AdminUserDashboardStyled;
