import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminUserDashboardStyled from './AdminUserDashboardStyled';
import type { UserProfile } from '../types';
import './AdminUserDashboardNotifyWrapper.css';

type Step = 'form' | 'confirm';
type Target = 'all' | 'specific';

type RestorePrompt = {
  listingId: string;
  title: string;
} | null;

const DAY_MS = 24 * 60 * 60 * 1000;
const DELETE_USER_BUTTON_CLASS = 'admin-inline-delete-user';
const RESTORE_LISTING_BUTTON_CLASS = 'admin-inline-restore-listing';

const AdminUserDashboardNotifyWrapper: React.FC = () => {
  const { userProfile } = useAuth() as any;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [target, setTarget] = useState<Target>('all');
  const [excludeAdmins, setExcludeAdmins] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [restorePrompt, setRestorePrompt] = useState<RestorePrompt>(null);
  const [restoring, setRestoring] = useState(false);
  const listingFiltersInitialized = useRef(false);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      snap.forEach((item) => list.push({ uid: item.id, ...item.data() } as UserProfile));
      list.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
      setUsers(list);
    } catch (error) {
      console.error(error);
      window.alert('Could not load registered users. Check Firestore rules.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const openModal = useCallback(() => {
    if (!userProfile?.isAdmin) return;
    setOpen(true);
    setStep('form');
    setTarget('all');
    setExcludeAdmins(true);
    setSelectedUserId('');
    setSearch('');
    loadUsers();
  }, [loadUsers, userProfile?.isAdmin]);

  const deleteDocsWhere = useCallback(async (collectionName: string, field: string, value: string, operator: '==' | 'array-contains' = '==') => {
    const snap = await getDocs(query(collection(db, collectionName), where(field, operator, value))).catch(() => null);
    if (!snap) return;
    await Promise.all(snap.docs.map((item) => deleteDoc(doc(db, collectionName, item.id)).catch(() => undefined)));
  }, []);

  const deleteUserConversations = useCallback(async (userId: string) => {
    const conversationSnap = await getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', userId))).catch(() => null);
    if (!conversationSnap) return;

    await Promise.all(conversationSnap.docs.map(async (conversation) => {
      const messageSnap = await getDocs(query(collection(db, 'messages'), where('conversationId', '==', conversation.id))).catch(() => null);
      if (messageSnap) await Promise.all(messageSnap.docs.map((messageDoc) => deleteDoc(doc(db, 'messages', messageDoc.id)).catch(() => undefined)));
      await deleteDoc(doc(db, 'conversations', conversation.id)).catch(() => undefined);
    }));
  }, []);

  const deleteUserData = useCallback(async (targetUser: UserProfile) => {
    if (!userProfile?.isAdmin || !targetUser?.uid) return;
    if (targetUser.uid === userProfile.uid) {
      window.alert('You cannot delete your own admin account from here.');
      return;
    }

    const confirmed = window.confirm(`Delete ${targetUser.displayName || targetUser.email || 'this user'} and their app data? This removes their Firestore data, listings, messages, reports, ratings, notifications, and public profile. Firebase Auth account deletion still needs a Cloud Function or Admin SDK.`);
    if (!confirmed) return;

    try {
      const userId = targetUser.uid;
      await Promise.all([
        deleteDocsWhere('listings', 'userId', userId),
        deleteDocsWhere('notifications', 'userId', userId),
        deleteDocsWhere('ratings', 'fromUserId', userId),
        deleteDocsWhere('ratings', 'toUserId', userId),
        deleteDocsWhere('reports', 'reporterId', userId),
        deleteDocsWhere('reports', 'targetId', userId),
        deleteDocsWhere('contacts', 'userId', userId),
        deleteDocsWhere('contacts', 'sellerId', userId),
        deleteDocsWhere('messages', 'senderId', userId),
        deleteDocsWhere('messages', 'recipientId', userId),
        deleteUserConversations(userId),
        deleteDoc(doc(db, 'publicProfiles', userId)).catch(() => undefined),
      ]);
      await deleteDoc(doc(db, 'users', userId));
      window.alert('User app data deleted. Firebase Auth account deletion still needs backend admin code.');
      window.location.reload();
    } catch (error) {
      console.error(error);
      window.alert('User could not be deleted. Check Firestore rules.');
    }
  }, [deleteDocsWhere, deleteUserConversations, userProfile?.isAdmin, userProfile?.uid]);

  const restoreListing = useCallback(async (listingId: string) => {
    if (!userProfile?.isAdmin || !listingId) return;

    setRestoring(true);
    try {
      const settingsSnap = await getDoc(doc(db, 'platform', 'settings')).catch(() => null);
      const listingDays = Math.max(1, Math.min(45, Number(settingsSnap?.exists() ? settingsSnap.data().listingDays : 10) || 10));
      const now = Date.now();
      await updateDoc(doc(db, 'listings', listingId), {
        active: true,
        listingDays,
        expiresAt: now + listingDays * DAY_MS,
        durationAdjustedAt: now,
      });
      setRestorePrompt(null);
      window.alert(`Listing restored for ${listingDays} days.`);
      window.location.reload();
    } catch (error) {
      console.error(error);
      window.alert('Listing could not be restored. Check Firestore rules.');
    } finally {
      setRestoring(false);
    }
  }, [userProfile?.isAdmin]);

  useEffect(() => {
    if (userProfile?.isAdmin) loadUsers();
  }, [loadUsers, userProfile?.isAdmin]);

  useEffect(() => {
    const handleClick = (event: Event) => {
      const button = (event.target as HTMLElement | null)?.closest?.('.admin-extra-action-primary') as HTMLButtonElement | null;
      if (!button || !button.textContent?.toLowerCase().includes('send update')) return;
      event.preventDefault();
      event.stopPropagation();
      openModal();
    };
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mousedown', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mousedown', handleClick, true);
    };
  }, [openModal]);

  useEffect(() => {
    const applyListingFilterOrder = () => {
      const listingPanel = Array.from(document.querySelectorAll<HTMLElement>('.admin-tiktok-shell section'))
        .find((section) => section.querySelector('h3')?.textContent?.trim() === 'Listings');
      const filterRow = listingPanel?.querySelector<HTMLElement>('.mb-4.flex.flex-wrap.items-center.gap-2');
      if (!filterRow) return;

      const buttons = Array.from(filterRow.querySelectorAll<HTMLButtonElement>('button'));
      const allButton = buttons.find((button) => button.textContent?.trim().toLowerCase().startsWith('all'));
      const activeButton = buttons.find((button) => button.textContent?.trim().toLowerCase().startsWith('active'));
      const inactiveButton = buttons.find((button) => button.textContent?.trim().toLowerCase().startsWith('inactive'));
      if (!allButton || !activeButton || !inactiveButton) return;

      const allCount = allButton.querySelector('span')?.outerHTML || '';
      allButton.innerHTML = `All listings ${allCount}`;

      if (filterRow.children[0] !== allButton || filterRow.children[1] !== activeButton || filterRow.children[2] !== inactiveButton) {
        filterRow.append(allButton, activeButton, inactiveButton);
      }

      if (!listingFiltersInitialized.current) {
        listingFiltersInitialized.current = true;
        allButton.click();
      }
    };

    const runSoon = () => window.setTimeout(applyListingFilterOrder, 60);
    const timers = [0, 250, 800, 1600].map((delay) => window.setTimeout(applyListingFilterOrder, delay));
    document.addEventListener('click', runSoon, true);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener('click', runSoon, true);
    };
  }, []);

  useEffect(() => {
    const hydrateAdminActions = () => {
      if (!userProfile?.isAdmin) return;

      const panels = Array.from(document.querySelectorAll<HTMLElement>('.admin-tiktok-shell section'));
      const usersPanel = panels.find((section) => section.querySelector('h3')?.textContent?.trim() === 'Users');
      usersPanel?.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
        const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td'));
        const email = cells[1]?.textContent?.trim();
        const actionsCell = cells[cells.length - 1];
        if (!email || !actionsCell || actionsCell.querySelector(`.${DELETE_USER_BUTTON_CLASS}`)) return;

        const targetUser = users.find((item) => item.email === email);
        if (!targetUser || targetUser.uid === userProfile.uid) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = `${DELETE_USER_BUTTON_CLASS} cursor-pointer rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50`;
        button.title = 'Delete user and app data';
        button.innerHTML = '<i class="las la-trash-alt text-base"></i>';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          deleteUserData(targetUser);
        });
        actionsCell.querySelector('div')?.appendChild(button);
      });

      const listingsPanel = panels.find((section) => section.querySelector('h3')?.textContent?.trim() === 'Listings');
      listingsPanel?.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
        const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td'));
        const listingLink = row.querySelector<HTMLAnchorElement>('a[href^="/listing/"]');
        const statusText = cells[7]?.textContent?.toLowerCase() || '';
        const actionsCell = cells[cells.length - 1];
        const listingId = listingLink?.getAttribute('href')?.split('/listing/')[1]?.split(/[/?#]/)[0];
        const listingTitle = listingLink?.textContent?.trim() || 'this listing';
        if (!listingId || !actionsCell || !statusText.includes('inactive') || actionsCell.querySelector(`.${RESTORE_LISTING_BUTTON_CLASS}`)) return;

        const switchButton = actionsCell.querySelector<HTMLButtonElement>('button.relative.h-6.w-11');
        if (switchButton && switchButton.dataset.restoreHandled !== 'true') {
          switchButton.dataset.restoreHandled = 'true';
          switchButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            (event as any).stopImmediatePropagation?.();
            setRestorePrompt({ listingId, title: listingTitle });
          }, true);
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = `${RESTORE_LISTING_BUTTON_CLASS} cursor-pointer rounded-lg border border-[#1665CC]/30 px-3 py-1.5 text-xs font-bold text-[#1665CC] hover:bg-[#1665CC]/5`;
        button.textContent = 'Restore';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          setRestorePrompt({ listingId, title: listingTitle });
        });
        actionsCell.querySelector('div')?.appendChild(button);
      });
    };

    const runSoon = () => window.setTimeout(hydrateAdminActions, 80);
    const observer = new MutationObserver(runSoon);
    observer.observe(document.body, { childList: true, subtree: true });
    const timers = [0, 300, 900, 1800].map((delay) => window.setTimeout(hydrateAdminActions, delay));
    document.addEventListener('click', runSoon, true);

    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener('click', runSoon, true);
    };
  }, [deleteUserData, userProfile?.isAdmin, userProfile?.uid, users]);

  const adminCount = users.filter((user) => user.isAdmin).length;
  const eligibleUsers = useMemo(() => excludeAdmins ? users.filter((user) => !user.isAdmin) : users, [excludeAdmins, users]);
  const selectedUser = users.find((user) => user.uid === selectedUserId);
  const selectedUserExcluded = Boolean(selectedUser?.isAdmin && excludeAdmins);
  const recipients = useMemo(() => {
    if (target === 'all') return eligibleUsers;
    if (!selectedUser || selectedUserExcluded) return [];
    return [selectedUser];
  }, [eligibleUsers, selectedUser, selectedUserExcluded, target]);
  const recipientCount = recipients.length;
  const canReview = subject.trim() && message.trim() && recipientCount > 0;
  const filteredUsers = eligibleUsers.filter((user) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [user.displayName, user.email, user.uid].join(' ').toLowerCase().includes(query);
  }).slice(0, 10);

  const sendNotification = async () => {
    if (!canReview || sending || !userProfile?.isAdmin) return;
    setSending(true);
    try {
      await Promise.all(recipients.map((recipient) => addDoc(collection(db, 'notifications'), {
        userId: recipient.uid,
        userName: recipient.displayName || recipient.email || 'User',
        fromAdmin: true,
        subject: subject.trim(),
        message: message.trim(),
        createdAt: Date.now(),
        read: false,
      })));
      window.alert(`Update sent to ${recipientCount} ${recipientCount === 1 ? 'user' : 'users'}.`);
      setOpen(false);
      setStep('form');
      setTarget('all');
      setExcludeAdmins(true);
      setSubject('');
      setMessage('');
      setSearch('');
      setSelectedUserId('');
    } catch (error) {
      console.error(error);
      window.alert('Update could not be sent. Check Firestore rules.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AdminUserDashboardStyled />
      {restorePrompt && (
        <div className="send-update-backdrop" onClick={() => !restoring && setRestorePrompt(null)}>
          <section className="send-update-card restore-listing-card" onClick={(event) => event.stopPropagation()}>
            <div className="send-update-body">
              <div className="restore-listing-icon"><i className="las la-redo-alt" /></div>
              <h5>Restore this listing?</h5>
              <p>{restorePrompt.title} is inactive. Restoring it will turn the switch back on and give it a fresh expiry date using the current listing duration setting.</p>
              <div className="send-update-actions">
                <button type="button" disabled={restoring} className="primary" onClick={() => restoreListing(restorePrompt.listingId)}>{restoring ? 'Restoring...' : 'Yes, restore it'}</button>
                <button type="button" disabled={restoring} className="secondary" onClick={() => setRestorePrompt(null)}>No, keep inactive</button>
              </div>
            </div>
          </section>
        </div>
      )}
      {open && (
        <div className="send-update-backdrop" onClick={() => !sending && setOpen(false)}>
          <section className="send-update-card" onClick={(event) => event.stopPropagation()}>
            {step === 'form' ? (
              <>
                <div className="send-update-head"><button type="button" onClick={() => setOpen(false)}>← Back to overview</button><span>/</span><strong>Send notification</strong></div>
                <div className="send-update-body">
                  <label className="send-update-label">Send to</label>
                  <div className="send-update-targets">
                    <button type="button" className={target === 'all' ? 'active' : ''} onClick={() => setTarget('all')}><strong>All users</strong><span>{loadingUsers ? 'Loading...' : `${eligibleUsers.length} recipients`}</span></button>
                    <button type="button" className={target === 'specific' ? 'active' : ''} onClick={() => setTarget('specific')}><strong>Specific user</strong><span>{selectedUser && !selectedUserExcluded ? selectedUser.displayName || selectedUser.email : 'Search by name or email'}</span></button>
                  </div>
                  <label className="send-update-check"><input type="checkbox" checked={excludeAdmins} onChange={(event) => setExcludeAdmins(event.target.checked)} /><span>Exclude admin accounts</span><small>{excludeAdmins ? `${adminCount} admin ${adminCount === 1 ? 'account is' : 'accounts are'} excluded by default.` : 'Admins will receive this update too.'}</small></label>
                  {target === 'specific' && <div className="send-update-picker"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search registered users..." /><div>{filteredUsers.map((user) => <button key={user.uid} type="button" className={selectedUserId === user.uid ? 'active' : ''} onClick={() => setSelectedUserId(user.uid)}><strong>{user.displayName || 'Unnamed user'}</strong><span>{user.email}</span></button>)}{filteredUsers.length === 0 && <p>No matching users found.</p>}</div></div>}
                  <div className="send-update-field"><label>Subject</label><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="System maintenance on Sunday" /></div>
                  <div className="send-update-field"><label>Message</label><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the notification message..." /></div>
                  <div className="send-update-actions"><button type="button" disabled={!canReview} onClick={() => setStep('confirm')} className="primary">Review before sending</button><button type="button" onClick={() => setOpen(false)} className="secondary">Cancel</button></div>
                </div>
              </>
            ) : (
              <>
                <div className="send-update-head"><button type="button" onClick={() => setStep('form')}>← Edit notification</button><span>/</span><strong>Confirm</strong></div>
                <div className="send-update-body">
                  <div className="send-update-summary"><div><span>Send to</span><strong>{target === 'all' ? `All non-admin users — ${recipientCount} recipients` : `${selectedUser?.displayName || selectedUser?.email || 'Specific user'} — 1 recipient`}</strong></div><div><span>Admins</span><strong>{excludeAdmins ? `${adminCount} excluded` : 'Included'}</strong></div><div><span>Subject</span><strong>{subject.trim()}</strong></div><div><span>Message</span><p>{message.trim()}</p></div></div>
                  <div className="send-update-warning"><i className="las la-exclamation-triangle" /> This will create {recipientCount} notification {recipientCount === 1 ? 'document' : 'documents'} in Firestore. This action cannot be undone.</div>
                  <div className="send-update-actions"><button type="button" disabled={sending} onClick={sendNotification} className="primary">{sending ? 'Sending...' : `Send to ${recipientCount} ${recipientCount === 1 ? 'user' : 'users'}`}</button><button type="button" disabled={sending} onClick={() => setStep('form')} className="secondary">← Edit</button></div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
};

export default AdminUserDashboardNotifyWrapper;
