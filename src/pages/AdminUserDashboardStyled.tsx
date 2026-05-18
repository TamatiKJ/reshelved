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
      sidebar.querySelector('.admin-sidebar-top-action')?.remove();
      sidebar.querySelector('.admin-extra-actions')?.remove();

      const topWrap = document.createElement('div');
      topWrap.className = 'admin-sidebar-top-action';

      const sendButton = document.createElement('button');
      sendButton.type = 'button';
      sendButton.className = 'admin-extra-action admin-extra-action-primary';
      sendButton.innerHTML = `<i class="las la-paper-plane"></i><span>${sending ? 'Sending...' : 'Send Update'}</span>`;
      sendButton.disabled = sending;

      const topDivider = document.createElement('div');
      topDivider.className = 'admin-extra-action-divider admin-extra-action-divider-top';

      const bottomWrap = document.createElement('div');
      bottomWrap.className = 'admin-extra-actions';

      const bottomDivider = document.createElement('div');
      bottomDivider.className = 'admin-extra-action-divider admin-extra-action-divider-bottom';

      const viewLink = document.createElement('a');
      viewLink.href = '/';
      viewLink.className = 'admin-extra-action';
      viewLink.innerHTML = '<i class="las la-globe"></i><span>View Site</span>';

      const logoutButton = document.createElement('button');
      logoutButton.type = 'button';
      logoutButton.className = 'admin-extra-action';
      logoutButton.innerHTML = '<i class="las la-sign-out-alt"></i><span>Sign Out</span>';

      const handleSend = () => sendUpdate();
      const handleLogout = () => logout?.();

      const placeExtraActions = () => {
        if (sidebar.firstElementChild !== topWrap) sidebar.insertBefore(topWrap, sidebar.firstChild);
        if (sidebar.lastElementChild !== bottomWrap) sidebar.appendChild(bottomWrap);
      };

      sendButton.addEventListener('click', handleSend);
      logoutButton.addEventListener('click', handleLogout);

      topWrap.append(sendButton, topDivider);
      bottomWrap.append(bottomDivider, viewLink, logoutButton);
      placeExtraActions();

      const sidebarObserver = new MutationObserver(() => placeExtraActions());
      sidebarObserver.observe(sidebar, { childList: true });

      cleanups.push(() => {
        sidebarObserver.disconnect();
        sendButton.removeEventListener('click', handleSend);
        logoutButton.removeEventListener('click', handleLogout);
        topWrap.remove();
        bottomWrap.remove();
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [logout, sendUpdate, sending, userProfile?.isAdmin]);

  useEffect(() => {
    const getEditor = () => document.querySelector<HTMLElement>('.admin-tiktok-shell [contenteditable="true"]');

    const getToolbarButtons = () => {
      const editor = getEditor();
      const toolbar = editor?.previousElementSibling?.querySelectorAll<HTMLButtonElement>('button');
      return Array.from(toolbar || []);
    };

    const buttonText = (button: HTMLButtonElement) => button.textContent?.trim().toLowerCase() || '';

    const getBlockFormat = () => {
      try {
        return String(document.queryCommandValue('formatBlock') || '').replace(/[<>]/g, '').toLowerCase();
      } catch {
        return '';
      }
    };

    const setActiveToolbarButton = () => {
      const editor = getEditor();
      const buttons = getToolbarButtons();
      if (!editor || buttons.length === 0) return;

      const selection = window.getSelection();
      const activeNode = selection?.anchorNode;
      const isInsideEditor = Boolean(activeNode && editor.contains(activeNode.nodeType === Node.TEXT_NODE ? activeNode.parentElement : activeNode as Node));
      const blockFormat = getBlockFormat();

      let isBold = false;
      let isItalic = false;
      let isUnderline = false;
      let isList = false;
      try {
        isBold = document.queryCommandState('bold');
        isItalic = document.queryCommandState('italic');
        isUnderline = document.queryCommandState('underline');
        isList = document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList');
      } catch {
        // Ignore unsupported browser command states.
      }

      buttons.forEach((button) => {
        const text = buttonText(button);
        let active = false;

        if (isInsideEditor) {
          if (text === 'h2') active = blockFormat === 'h2';
          else if (text === 'h3') active = blockFormat === 'h3';
          else if (text === 'h4') active = blockFormat === 'h4';
          else if (text === 'b') active = isBold;
          else if (text === 'i') active = isItalic;
          else if (text === 'u') active = isUnderline;
          else if (text === '•') active = isList;
          else if (text === 'paragraph') active = !['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(blockFormat);
          else if (text === 'quote') active = blockFormat === 'blockquote';
        }

        button.classList.toggle('admin-editor-button-active', active);
      });
    };

    const handleToolbarClick = () => window.setTimeout(setActiveToolbarButton, 0);
    const mutationObserver = new MutationObserver(() => setActiveToolbarButton());

    document.addEventListener('selectionchange', setActiveToolbarButton);
    document.addEventListener('keyup', setActiveToolbarButton, true);
    document.addEventListener('mouseup', setActiveToolbarButton, true);
    document.addEventListener('input', setActiveToolbarButton, true);
    document.addEventListener('click', handleToolbarClick, true);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    setActiveToolbarButton();

    return () => {
      document.removeEventListener('selectionchange', setActiveToolbarButton);
      document.removeEventListener('keyup', setActiveToolbarButton, true);
      document.removeEventListener('mouseup', setActiveToolbarButton, true);
      document.removeEventListener('input', setActiveToolbarButton, true);
      document.removeEventListener('click', handleToolbarClick, true);
      mutationObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const clickAddNewPost = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.admin-tiktok-shell button'));
      const addNewButton = buttons.find((button) => button.textContent?.trim().toLowerCase() === 'add new');
      addNewButton?.click();
    };

    const addPostsButton = () => {
      const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>('.admin-tiktok-shell section h3'));
      const postsHeading = headings.find((heading) => heading.textContent?.trim().toLowerCase().startsWith('all posts'));
      const panel = postsHeading?.closest('section') as HTMLElement | null;
      if (!postsHeading || !panel || panel.querySelector('.admin-add-post-button')) return;

      panel.classList.add('admin-posts-panel');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-add-post-button';
      button.innerHTML = '<span>+ Add Post</span>';
      button.addEventListener('click', clickAddNewPost);
      panel.appendChild(button);
    };

    const mutationObserver = new MutationObserver(addPostsButton);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    addPostsButton();

    return () => {
      mutationObserver.disconnect();
      document.querySelectorAll('.admin-add-post-button').forEach((button) => button.remove());
    };
  }, []);

  return (
    <div className="admin-tiktok-shell">
      <AdminUserDashboard />
    </div>
  );
};

export default AdminUserDashboardStyled;
