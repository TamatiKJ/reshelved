import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AdminUserDashboardStyled from './AdminUserDashboardStyled';
import type { UserProfile } from '../types';
import './AdminUserDashboardNotifyWrapper.css';

type Step = 'form' | 'confirm';
type Target = 'all' | 'specific';

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
