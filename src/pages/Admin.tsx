import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  orderBy,
  addDoc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Listing, Report, UserProfile } from '../types';

interface PlatformSettings {
  listingExpiryDays: number;
  maxImagesPerListing: number;
  maxListingsPerUser: number;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
}

interface Notification {
  id: string;
  userId: string;
  userName: string;
  fromAdmin: boolean;
  subject: string;
  message: string;
  createdAt: number;
  read: boolean;
}

type Tab =
  | 'overview'
  | 'reports'
  | 'listings'
  | 'users'
  | 'reviews'
  | 'analytics'
  | 'activity'
  | 'notifications'
  | 'blog'
  | 'legal'
  | 'settings';

const DEFAULT_SETTINGS: PlatformSettings = {
  listingExpiryDays: 7,
  maxImagesPerListing: 4,
  maxListingsPerUser: 20,
  maintenanceMode: false,
  allowNewRegistrations: true,
};

const iconClass = 'h-5 w-5 shrink-0';

const Icon = ({ name }: { name: string }) => {
  const common = { className: iconClass, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2 };

  switch (name) {
    case 'dashboard':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m4-8v8m5-10l2 2m-2-2v10a1 1 0 01-1 1h-3m-8 0H6a1 1 0 01-1-1V10" /></svg>;
    case 'reports':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" /></svg>;
    case 'listings':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.25v13m0-13C10.83 5.48 9.25 5 7.5 5S4.17 5.48 3 6.25v13C4.17 18.48 5.75 18 7.5 18s3.33.48 4.5 1.25m0-13C13.17 5.48 14.75 5 16.5 5s3.33.48 4.5 1.25v13C19.83 18.48 18.25 18 16.5 18s-3.33.48-4.5 1.25" /></svg>;
    case 'users':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'reviews':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M11.05 2.93c.3-.92 1.6-.92 1.9 0l1.52 4.67a1 1 0 00.95.69h4.9c.97 0 1.37 1.24.59 1.8l-3.97 2.88a1 1 0 00-.36 1.12l1.51 4.67c.3.92-.75 1.69-1.54 1.12l-3.96-2.88a1 1 0 00-1.18 0l-3.96 2.88c-.79.57-1.84-.2-1.54-1.12l1.51-4.67a1 1 0 00-.36-1.12L3.1 10.1c-.78-.56-.38-1.8.59-1.8h4.9a1 1 0 00.95-.69l1.52-4.67z" /></svg>;
    case 'analytics':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6m6 13V9m6 10V3M3 19v-4" /></svg>;
    case 'activity':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    case 'notifications':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.17V11a6 6 0 10-12 0v3.17a2 2 0 01-.6 1.43L4 17h5m6 0a3 3 0 11-6 0m6 0H9" /></svg>;
    case 'blog':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 4v6h6M8 13h8M8 17h5" /></svg>;
    case 'legal':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.59a1 1 0 01.7.29l5.42 5.42a1 1 0 01.29.7V19a2 2 0 01-2 2z" /></svg>;
    case 'settings':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M10.33 4.32c.43-1.76 2.91-1.76 3.34 0a1.72 1.72 0 002.57 1.07c1.55-.94 3.3.82 2.36 2.36a1.72 1.72 0 001.07 2.57c1.76.43 1.76 2.91 0 3.34a1.72 1.72 0 00-1.07 2.57c.94 1.55-.82 3.3-2.36 2.36a1.72 1.72 0 00-2.57 1.07c-.43 1.76-2.91 1.76-3.34 0a1.72 1.72 0 00-2.57-1.07c-1.55.94-3.3-.82-2.36-2.36a1.72 1.72 0 00-1.07-2.57c-1.76-.43-1.76-2.91 0-3.34a1.72 1.72 0 001.07-2.57c-.94-1.55.82-3.3 2.36-2.36.99.6 2.27.06 2.57-1.07z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'site':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>;
    case 'signout':
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
    default:
      return null;
  }
};

const StatCard: React.FC<{ label: string; value: number | string; helper?: string }> = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-stone-200 bg-white p-5">
    <div className="text-sm font-semibold text-stone-800">{label}</div>
    <div className="mt-2 text-3xl font-semibold tracking-tight text-black">{value}</div>
    {helper && <div className="mt-1 text-sm text-stone-400">{helper}</div>}
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-8 mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.02em] text-stone-400">
    {children}
  </div>
);

const Admin: React.FC = () => {
  const { userProfile, logout } = useAuth() as any;
  const [tab, setTab] = useState<Tab>('overview');
  const [reports, setReports] = useState<Report[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [flaggedListings, setFlaggedListings] = useState<Listing[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [editListing, setEditListing] = useState<Listing | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmUser, setConfirmUser] = useState<UserProfile | null>(null);

  const [notifTarget, setNotifTarget] = useState<'all' | 'user'>('all');
  const [notifUserId, setNotifUserId] = useState('');
  const [notifSubject, setNotifSubject] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifSending, setNotifSending] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [listingSearch, setListingSearch] = useState('');
  const [listingFilter, setListingFilter] = useState<'all' | 'active' | 'expired' | 'flagged'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'deactivated' | 'flagged' | 'admin'>('all');

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!userProfile?.isAdmin) return;
    setLoading(true);

    try {
      const rSnap = await getDocs(query(collection(db, 'reports'), where('resolved', '==', false), orderBy('createdAt', 'desc')));
      const reps: Report[] = [];
      rSnap.forEach(d => reps.push({ id: d.id, ...d.data() } as Report));
      setReports(reps);

      const lSnap = await getDocs(query(collection(db, 'listings'), orderBy('createdAt', 'desc')));
      const listings: Listing[] = [];
      lSnap.forEach(d => listings.push({ id: d.id, ...d.data() } as Listing));
      setAllListings(listings);
      setFlaggedListings(listings.filter(l => l.flagged));

      const uSnap = await getDocs(collection(db, 'users'));
      const users: UserProfile[] = [];
      uSnap.forEach(d => users.push(d.data() as UserProfile));
      setAllUsers(users);
      setFlaggedUsers(users.filter(u => u.flagged));

      const settingsDoc = await getDoc(doc(db, 'platform', 'settings'));
      const platformSettings = settingsDoc.exists() ? settingsDoc.data() as PlatformSettings : DEFAULT_SETTINGS;
      setSettings(platformSettings);
      setSettingsDraft(platformSettings);

      const nSnap = await getDocs(query(collection(db, 'notifications'), where('fromAdmin', '==', true), orderBy('createdAt', 'desc')));
      const ns: Notification[] = [];
      nSnap.forEach(d => ns.push({ id: d.id, ...d.data() } as Notification));
      setNotifications(ns);
    } catch (err) {
      console.error(err);
      showToast('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resolveReport = async (reportId: string) => {
    await updateDoc(doc(db, 'reports', reportId), { resolved: true });
    setReports(prev => prev.filter(r => r.id !== reportId));
    showToast('Report resolved');
  };

  const deleteListing = async (listingId: string) => {
    if (!confirm('Delete this listing permanently?')) return;
    await deleteDoc(doc(db, 'listings', listingId));
    setAllListings(prev => prev.filter(l => l.id !== listingId));
    setFlaggedListings(prev => prev.filter(l => l.id !== listingId));
    showToast('Listing deleted');
  };

  const toggleListingActive = async (listing: Listing) => {
    const active = !listing.active;
    await updateDoc(doc(db, 'listings', listing.id), { active });
    const update = (l: Listing) => l.id === listing.id ? { ...l, active } : l;
    setAllListings(prev => prev.map(update));
    setFlaggedListings(prev => prev.map(update));
    showToast(active ? 'Listing enabled' : 'Listing disabled');
  };

  const unflagListing = async (listingId: string) => {
    await updateDoc(doc(db, 'listings', listingId), { flagged: false, flagCount: 0 });
    const update = (l: Listing) => l.id === listingId ? { ...l, flagged: false, flagCount: 0 } : l;
    setAllListings(prev => prev.map(update));
    setFlaggedListings(prev => prev.filter(l => l.id !== listingId));
    showToast('Listing unflagged');
  };

  const openEditListing = (listing: Listing) => {
    setEditListing(listing);
    setEditTitle(listing.title);
    setEditPrice(listing.price?.toString() || '');
    setEditDescription(listing.description || '');
  };

  const saveEditListing = async () => {
    if (!editListing) return;
    const updates: Partial<Listing> = { title: editTitle, description: editDescription };
    if (editListing.type === 'sell') updates.price = parseFloat(editPrice) || 0;
    await updateDoc(doc(db, 'listings', editListing.id), updates);
    const applyUpdates = (l: Listing) => l.id === editListing.id ? { ...l, ...updates } : l;
    setAllListings(prev => prev.map(applyUpdates));
    setFlaggedListings(prev => prev.map(applyUpdates));
    setEditListing(null);
    showToast('Listing updated');
  };

  const toggleUserDeactivated = async (user: UserProfile) => {
    const deactivated = !(user as any).deactivated;
    await updateDoc(doc(db, 'users', user.uid), { deactivated });
    setAllUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, deactivated } as any : u));
    setConfirmUser(null);
    showToast(deactivated ? 'Account deactivated' : 'Account reactivated');
  };

  const toggleAdmin = async (user: UserProfile) => {
    const isAdmin = !user.isAdmin;
    await updateDoc(doc(db, 'users', user.uid), { isAdmin });
    setAllUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, isAdmin } : u));
    showToast(isAdmin ? `${user.displayName} is now admin` : `${user.displayName} removed from admin`);
  };

  const unflagUser = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), { flagged: false, flagCount: 0 });
    const update = (u: UserProfile) => u.uid === userId ? { ...u, flagged: false, flagCount: 0 } : u;
    setAllUsers(prev => prev.map(update));
    setFlaggedUsers(prev => prev.filter(u => u.uid !== userId));
    showToast('User unflagged');
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      await setDoc(doc(db, 'platform', 'settings'), settingsDraft);
      setSettings(settingsDraft);
      showToast('Platform settings saved');
    } catch (err) {
      console.error(err);
      showToast('Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const sendNotification = async () => {
    if (!notifSubject.trim() || !notifMessage.trim()) return;
    setNotifSending(true);

    try {
      if (notifTarget === 'all') {
        await Promise.all(allUsers.map(u => addDoc(collection(db, 'notifications'), {
          userId: u.uid,
          userName: u.displayName,
          fromAdmin: true,
          subject: notifSubject.trim(),
          message: notifMessage.trim(),
          createdAt: Date.now(),
          read: false,
        })));
        showToast(`Notification sent to ${allUsers.length} users`);
      } else {
        const targetUser = allUsers.find(u => u.uid === notifUserId || u.email === notifUserId);
        if (!targetUser) {
          showToast('User not found');
          setNotifSending(false);
          return;
        }
        await addDoc(collection(db, 'notifications'), {
          userId: targetUser.uid,
          userName: targetUser.displayName,
          fromAdmin: true,
          subject: notifSubject.trim(),
          message: notifMessage.trim(),
          createdAt: Date.now(),
          read: false,
        });
        showToast(`Notification sent to ${targetUser.displayName}`);
      }

      setNotifSubject('');
      setNotifMessage('');
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Failed to send notification');
    } finally {
      setNotifSending(false);
    }
  };

  const filteredListings = useMemo(() => allListings.filter(l => {
    const search = listingSearch.toLowerCase();
    const matchSearch = !search ||
      l.title?.toLowerCase().includes(search) ||
      l.author?.toLowerCase().includes(search) ||
      l.userName?.toLowerCase().includes(search);
    const now = Date.now();

    if (listingFilter === 'active') return matchSearch && l.active && l.expiresAt > now;
    if (listingFilter === 'expired') return matchSearch && (!l.active || l.expiresAt <= now);
    if (listingFilter === 'flagged') return matchSearch && l.flagged;
    return matchSearch;
  }), [allListings, listingFilter, listingSearch]);

  const filteredUsers = useMemo(() => allUsers
    .filter(u => {
      const search = userSearch.toLowerCase();
      const matchSearch = !search ||
        u.displayName?.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search);

      if (userFilter === 'active') return matchSearch && !(u as any).deactivated;
      if (userFilter === 'deactivated') return matchSearch && (u as any).deactivated;
      if (userFilter === 'flagged') return matchSearch && u.flagged;
      if (userFilter === 'admin') return matchSearch && u.isAdmin;
      return matchSearch;
    })
    .sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return (a.displayName || '').localeCompare(b.displayName || '');
    }), [allUsers, userFilter, userSearch]);

  if (!userProfile?.isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500">
          <Icon name="reports" />
        </div>
        <h2 className="text-xl font-bold text-stone-700">Access Denied</h2>
        <p className="mt-2 text-stone-500">You do not have admin privileges.</p>
        <Link to="/" className="mt-4 inline-block font-medium text-primary-600">Back to Home</Link>
      </div>
    );
  }

  const activeListings = allListings.filter(l => l.active && l.expiresAt > Date.now());
  const deactivatedUsers = allUsers.filter(u => (u as any).deactivated);
  const pageTitles: Record<Tab, string> = {
    overview: 'Dashboard',
    reports: 'Reports',
    listings: 'Listings',
    users: 'Users',
    reviews: 'Reviews',
    analytics: 'Analytics',
    activity: 'Platform Activity',
    notifications: 'Notifications',
    blog: 'Blog',
    legal: 'Legal Pages',
    settings: 'Settings',
  };

  const NavButton = ({ item }: { item: { key: Tab; label: string; icon: string; count?: number } }) => {
    const active = tab === item.key;
    return (
      <button
        type="button"
        onClick={() => setTab(item.key)}
        className={`flex h-11 w-full items-center gap-3.5 rounded-lg px-3.5 text-left text-[16px] transition ${
          active
            ? 'border border-stone-300 bg-gradient-to-b from-stone-100 to-stone-200 font-semibold text-black'
            : 'font-medium text-stone-700 hover:bg-stone-100'
        }`}
      >
        <Icon name={item.icon} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.count !== undefined && item.count > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white text-stone-700' : 'bg-stone-100 text-stone-500'}`}>{item.count}</span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-stone-900">
      {toast && (
        <div className="fixed right-6 top-6 z-50 rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex min-h-screen">
        <aside className="hidden min-h-screen w-[296px] shrink-0 border-r border-[#e5e5e5] bg-white px-6 pt-6 lg:block">
          <Link to="/" className="flex h-12 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <Icon name="listings" />
            </div>
            <div className="text-xl font-bold text-stone-950">Reshelved Admin</div>
          </Link>

          <button
            type="button"
            onClick={() => setTab('notifications')}
            className="mt-9 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-600 text-[16px] font-semibold text-white transition hover:bg-primary-700"
          >
            <span className="text-xl leading-none">+</span>
            Send Update
          </button>

          <nav className="mt-9">
            <SectionLabel>Manage</SectionLabel>
            <div className="space-y-1.5">
              {[
                { key: 'overview' as Tab, label: 'Dashboard', icon: 'dashboard' },
                { key: 'reports' as Tab, label: 'Reports', icon: 'reports', count: reports.length },
                { key: 'listings' as Tab, label: 'Listings', icon: 'listings', count: allListings.length },
                { key: 'users' as Tab, label: 'Users', icon: 'users', count: allUsers.length },
                { key: 'reviews' as Tab, label: 'Reviews', icon: 'reviews' },
              ].map(item => <NavButton key={item.key} item={item} />)}
            </div>

            <SectionLabel>Growth</SectionLabel>
            <div className="space-y-1.5">
              <NavButton item={{ key: 'analytics', label: 'Analytics', icon: 'analytics' }} />
              <NavButton item={{ key: 'activity', label: 'Platform Activity', icon: 'activity' }} />
            </div>

            <SectionLabel>Tools</SectionLabel>
            <div className="space-y-1.5">
              <NavButton item={{ key: 'notifications', label: 'Notifications', icon: 'notifications' }} />
              <NavButton item={{ key: 'blog', label: 'Blog', icon: 'blog' }} />
              <NavButton item={{ key: 'legal', label: 'Legal Pages', icon: 'legal' }} />
              <NavButton item={{ key: 'settings', label: 'Settings', icon: 'settings' }} />
            </div>

            <SectionLabel>Others</SectionLabel>
            <div className="space-y-1.5">
              <Link to="/" className="flex h-11 items-center gap-3.5 rounded-lg px-3.5 text-[16px] font-medium text-stone-700 transition hover:bg-stone-100">
                <Icon name="site" />
                <span>View Site</span>
              </Link>
              <button
                type="button"
                onClick={() => logout?.()}
                className="flex h-11 w-full items-center gap-3.5 rounded-lg px-3.5 text-left text-[16px] font-medium text-stone-700 transition hover:bg-stone-100"
              >
                <Icon name="signout" />
                <span>Sign Out</span>
              </button>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex h-[84px] items-center justify-between border-b border-[#eeeeee] bg-white px-5 sm:px-10">
            <div>
              <h1 className="text-2xl font-bold text-black">{pageTitles[tab]}</h1>
              <p className="mt-0.5 text-sm text-stone-500">Reshelved platform management</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchData}
                className="hidden rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 sm:block"
              >
                Refresh
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-100 bg-white text-xs font-bold text-primary-700 shadow-sm">
                {userProfile?.displayName?.[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          </header>

          <div className="border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: 'overview' as Tab, label: 'Dashboard' },
                { key: 'reports' as Tab, label: 'Reports' },
                { key: 'listings' as Tab, label: 'Listings' },
                { key: 'users' as Tab, label: 'Users' },
                { key: 'notifications' as Tab, label: 'Notifications' },
                { key: 'settings' as Tab, label: 'Settings' },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`h-10 shrink-0 rounded-lg px-4 text-sm font-semibold ${tab === item.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <section className="p-5 sm:p-10">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl border border-stone-200 bg-white" />)}
              </div>
            ) : (
              <>
                {tab === 'overview' && (
                  <div className="space-y-7">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard label="Total Users" value={allUsers.length} helper={`${deactivatedUsers.length} deactivated`} />
                      <StatCard label="Active Listings" value={activeListings.length} helper={`${allListings.length} total listings`} />
                      <StatCard label="Open Reports" value={reports.length} helper={`${flaggedListings.length} flagged listings`} />
                      <StatCard label="Flagged Users" value={flaggedUsers.length} helper="Needs review" />
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-white p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-black">Quick Actions</h2>
                        <span className="text-sm text-stone-400">Last 7 days</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          { label: 'Review Reports', value: reports.length, next: 'reports' as Tab },
                          { label: 'Flagged Listings', value: flaggedListings.length, next: 'listings' as Tab },
                          { label: 'Flagged Users', value: flaggedUsers.length, next: 'users' as Tab },
                        ].map(item => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setTab(item.next)}
                            className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-left transition hover:bg-stone-100"
                          >
                            <div className="text-3xl font-semibold text-black">{item.value}</div>
                            <div className="mt-1 text-sm font-semibold text-stone-600">{item.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-white p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-black">Current Platform Settings</h2>
                        <button onClick={() => setTab('settings')} className="text-sm font-semibold text-primary-600">Edit</button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {[
                          ['Listing Expiry', `${settings.listingExpiryDays} days`],
                          ['Max Images', settings.maxImagesPerListing],
                          ['Max Listings/User', settings.maxListingsPerUser],
                          ['Maintenance', settings.maintenanceMode ? 'ON' : 'Off'],
                          ['Registrations', settings.allowNewRegistrations ? 'Allowed' : 'Disabled'],
                        ].map(([label, value]) => (
                          <div key={label.toString()} className="rounded-xl bg-stone-50 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</div>
                            <div className="mt-1 text-sm font-bold text-stone-900">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'reports' && (
                  <div className="space-y-3">
                    {reports.length === 0 ? <EmptyState message="No open reports" /> : reports.map(r => (
                      <div key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">{r.targetType}</span>
                              <span className="font-semibold text-stone-900">{r.targetName}</span>
                            </div>
                            <p className="mt-1 text-sm text-stone-600"><strong>Reason:</strong> {r.reason}</p>
                            {r.details && <p className="mt-1 text-sm text-stone-500">{r.details}</p>}
                            <p className="mt-2 text-xs text-stone-400">Reported by {r.reporterName} · {new Date(r.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            {r.targetType === 'listing' && <Link to={`/listing/${r.targetId}`} className="rounded-lg border border-primary-200 px-3 py-1.5 text-sm font-semibold text-primary-600 hover:bg-primary-50">View</Link>}
                            <button onClick={() => resolveReport(r.id)} className="rounded-lg bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-200">Resolve</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'listings' && (
                  <div className="space-y-4">
                    <FilterBar
                      searchValue={listingSearch}
                      onSearchChange={setListingSearch}
                      searchPlaceholder="Search listings..."
                      selectValue={listingFilter}
                      onSelectChange={value => setListingFilter(value as typeof listingFilter)}
                      options={[['all', 'All Listings'], ['active', 'Active'], ['expired', 'Expired/Disabled'], ['flagged', 'Flagged']]}
                    />
                    <p className="text-sm text-stone-500">{filteredListings.length} listings</p>
                    {filteredListings.length === 0 ? <EmptyState message="No listings found" /> : filteredListings.map(l => {
                      const isExpired = l.expiresAt < Date.now();
                      return (
                        <div key={l.id} className={`rounded-2xl border bg-white p-4 ${l.flagged ? 'border-orange-200' : 'border-stone-200'}`}>
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              {l.images?.[0] && <img src={l.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link to={`/listing/${l.id}`} className="font-semibold text-stone-900 hover:text-primary-700">{l.title}</Link>
                                  {!l.active && <Badge>Disabled</Badge>}
                                  {isExpired && <Badge tone="red">Expired</Badge>}
                                  {l.flagged && <Badge tone="orange">⚑ {l.flagCount} flags</Badge>}
                                </div>
                                <p className="mt-0.5 text-sm text-stone-500">by {l.author} · {l.userName} · {l.location}</p>
                                <p className="mt-0.5 text-xs text-stone-400">{new Date(l.createdAt).toLocaleDateString()} · {l.type === 'sell' ? `KSh ${l.price?.toLocaleString()}` : l.type}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 xl:justify-end">
                              <ActionButton onClick={() => openEditListing(l)}>Edit</ActionButton>
                              <ActionButton onClick={() => toggleListingActive(l)}>{l.active ? 'Disable' : 'Enable'}</ActionButton>
                              {l.flagged && <ActionButton onClick={() => unflagListing(l.id)}>Unflag</ActionButton>}
                              <ActionButton danger onClick={() => deleteListing(l.id)}>Delete</ActionButton>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {tab === 'users' && (
                  <div className="space-y-4">
                    <FilterBar
                      searchValue={userSearch}
                      onSearchChange={setUserSearch}
                      searchPlaceholder="Search users by name or email..."
                      selectValue={userFilter}
                      onSelectChange={value => setUserFilter(value as typeof userFilter)}
                      options={[['all', 'All Users'], ['active', 'Active'], ['deactivated', 'Deactivated'], ['flagged', 'Flagged'], ['admin', 'Admins']]}
                    />
                    <p className="text-sm text-stone-500">{filteredUsers.length} users</p>
                    {filteredUsers.length === 0 ? <EmptyState message="No users found" /> : filteredUsers.map(u => {
                      const isDeactivated = (u as any).deactivated;
                      return (
                        <div key={u.uid} className={`rounded-2xl border bg-white p-4 ${isDeactivated ? 'border-stone-300 opacity-70' : u.flagged ? 'border-orange-200' : 'border-stone-200'}`}>
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold ${isDeactivated ? 'bg-stone-200 text-stone-400' : 'bg-primary-100 text-primary-700'}`}>
                                {u.displayName?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-stone-900">{u.displayName}</span>
                                  {u.isAdmin && <Badge tone="blue">Admin</Badge>}
                                  {isDeactivated && <Badge>Deactivated</Badge>}
                                  {u.flagged && <Badge tone="orange">⚑ {u.flagCount} flags</Badge>}
                                </div>
                                <p className="truncate text-sm text-stone-500">{u.email}</p>
                                <p className="text-xs text-stone-400">{u.location} · Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 xl:justify-end">
                              <ActionButton onClick={() => { setNotifTarget('user'); setNotifUserId(u.email); setTab('notifications'); }}>Message</ActionButton>
                              <ActionButton onClick={() => toggleAdmin(u)}>{u.isAdmin ? 'Remove Admin' : 'Make Admin'}</ActionButton>
                              {u.flagged && <ActionButton onClick={() => unflagUser(u.uid)}>Unflag</ActionButton>}
                              <ActionButton danger={!isDeactivated} onClick={() => setConfirmUser(u)}>{isDeactivated ? 'Reactivate' : 'Deactivate'}</ActionButton>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {tab === 'notifications' && (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="rounded-2xl border border-stone-200 bg-white p-6">
                      <h2 className="mb-4 text-lg font-bold text-black">Send Notification</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-stone-700">Send To</label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <button onClick={() => setNotifTarget('all')} className={`rounded-xl border py-2.5 text-sm font-semibold ${notifTarget === 'all' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>All Users ({allUsers.length})</button>
                            <button onClick={() => setNotifTarget('user')} className={`rounded-xl border py-2.5 text-sm font-semibold ${notifTarget === 'user' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>Specific User</button>
                          </div>
                        </div>
                        {notifTarget === 'user' && <TextInput label="User Email or ID" value={notifUserId} onChange={setNotifUserId} placeholder="user@example.com" />}
                        <TextInput label="Subject" value={notifSubject} onChange={setNotifSubject} placeholder="Important platform update" />
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-stone-700">Message</label>
                          <textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)} rows={5} className="w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-primary-400" placeholder="Write your message here..." />
                        </div>
                        <button onClick={sendNotification} disabled={notifSending || !notifSubject.trim() || !notifMessage.trim()} className="flex w-full items-center justify-center rounded-xl bg-primary-600 py-3 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
                          {notifSending ? 'Sending...' : 'Send Notification'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-white p-6">
                      <h2 className="mb-4 text-lg font-bold text-black">Sent Notifications ({notifications.length})</h2>
                      {notifications.length === 0 ? <p className="text-sm text-stone-500">No notifications sent yet</p> : (
                        <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                          {notifications.map(n => (
                            <div key={n.id} className="rounded-xl bg-stone-50 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-stone-900">{n.subject}</p>
                                  <p className="mt-0.5 text-xs text-stone-500">To: {n.userName}</p>
                                  <p className="mt-1 line-clamp-2 text-sm text-stone-600">{n.message}</p>
                                </div>
                                <p className="shrink-0 text-xs text-stone-400">{new Date(n.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'settings' && (
                  <div className="max-w-3xl rounded-2xl border border-stone-200 bg-white p-6">
                    <h2 className="mb-5 text-lg font-bold text-black">Platform Settings</h2>
                    <div className="space-y-6">
                      <RangeSetting label="Listing Expiry (days)" helper="How many days before a listing automatically expires" min={1} max={90} value={settingsDraft.listingExpiryDays} suffix="d" onChange={value => setSettingsDraft(d => ({ ...d, listingExpiryDays: value }))} />
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-stone-700">Max Images per Listing</label>
                        <p className="mb-2 text-xs text-stone-500">Maximum number of photos a seller can upload per listing</p>
                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3, 4, 5, 6, 8].map(n => (
                            <button key={n} onClick={() => setSettingsDraft(d => ({ ...d, maxImagesPerListing: n }))} className={`h-10 w-10 rounded-lg border text-sm font-semibold ${settingsDraft.maxImagesPerListing === n ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>{n}</button>
                          ))}
                        </div>
                      </div>
                      <RangeSetting label="Max Active Listings per User" helper="Maximum concurrent active listings allowed per user account" min={1} max={100} value={settingsDraft.maxListingsPerUser} onChange={value => setSettingsDraft(d => ({ ...d, maxListingsPerUser: value }))} />
                      <ToggleSetting label="Maintenance Mode" helper="Show a maintenance message to all users" enabled={settingsDraft.maintenanceMode} onClick={() => setSettingsDraft(d => ({ ...d, maintenanceMode: !d.maintenanceMode }))} danger />
                      <ToggleSetting label="Allow New Registrations" helper="Disable to prevent new accounts from being created" enabled={settingsDraft.allowNewRegistrations} onClick={() => setSettingsDraft(d => ({ ...d, allowNewRegistrations: !d.allowNewRegistrations }))} />
                      <div className="flex gap-3 border-t border-stone-100 pt-4">
                        <button onClick={saveSettings} disabled={settingsSaving} className="rounded-xl bg-primary-600 px-6 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">{settingsSaving ? 'Saving...' : 'Save Settings'}</button>
                        <button onClick={() => setSettingsDraft(settings)} className="rounded-xl border border-stone-200 px-6 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50">Reset</button>
                      </div>
                    </div>
                  </div>
                )}

                {['reviews', 'analytics', 'activity', 'blog', 'legal'].includes(tab) && (
                  <ComingSoon
                    title={pageTitles[tab]}
                    message={tab === 'activity' ? 'Use this area for platform activity logs, moderation events, and admin history.' : 'This admin section has been added to the new dashboard structure and can be connected to live data next.'}
                  />
                )}
              </>
            )}
          </section>
        </main>
      </div>

      {editListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h3 className="mb-4 text-lg font-bold text-stone-900">Edit Listing</h3>
            <div className="space-y-4">
              <TextInput label="Title" value={editTitle} onChange={setEditTitle} />
              {editListing.type === 'sell' && <TextInput label="Price (KSh)" value={editPrice} onChange={setEditPrice} type="number" />}
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-700">Description</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={4} className="w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-primary-400" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditListing(null)} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50">Cancel</button>
                <button onClick={saveEditListing} className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center">
            <h3 className="text-lg font-bold text-stone-900">{(confirmUser as any).deactivated ? 'Reactivate Account' : 'Deactivate Account'}</h3>
            <p className="mt-2 text-sm text-stone-500">
              {(confirmUser as any).deactivated ? `Restore access for ${confirmUser.displayName}?` : `This will prevent ${confirmUser.displayName} from logging in.`}
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirmUser(null)} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-600">Cancel</button>
              <button onClick={() => toggleUserDeactivated(confirmUser)} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white ${(confirmUser as any).deactivated ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {(confirmUser as any).deactivated ? 'Reactivate' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Badge = ({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'red' | 'orange' | 'blue' }) => {
  const tones = {
    neutral: 'bg-stone-100 text-stone-600',
    red: 'bg-red-100 text-red-600',
    orange: 'bg-orange-100 text-orange-600',
    blue: 'bg-primary-100 text-primary-700',
  };
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
};

const ActionButton = ({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
  >
    {children}
  </button>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-stone-200 bg-white py-12 text-center text-stone-500">
    {message}
  </div>
);

const ComingSoon = ({ title, message }: { title: string; message: string }) => (
  <div className="rounded-2xl border border-stone-200 bg-white p-8">
    <h2 className="text-xl font-bold text-black">{title}</h2>
    <p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">{message}</p>
  </div>
);

const FilterBar = ({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  selectValue,
  onSelectChange,
  options,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  selectValue: string;
  onSelectChange: (value: string) => void;
  options: [string, string][];
}) => (
  <div className="flex flex-col gap-3 sm:flex-row">
    <input
      type="text"
      placeholder={searchPlaceholder}
      value={searchValue}
      onChange={e => onSearchChange(e.target.value)}
      className="flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400"
    />
    <select
      value={selectValue}
      onChange={e => onSelectChange(e.target.value)}
      className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary-400"
    >
      {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </div>
);

const TextInput = ({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) => (
  <div>
    <label className="mb-1 block text-sm font-semibold text-stone-700">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400"
    />
  </div>
);

const RangeSetting = ({ label, helper, min, max, value, onChange, suffix = '' }: { label: string; helper: string; min: number; max: number; value: number; onChange: (value: number) => void; suffix?: string }) => (
  <div>
    <label className="mb-1 block text-sm font-semibold text-stone-700">{label}</label>
    <p className="mb-2 text-xs text-stone-500">{helper}</p>
    <div className="flex items-center gap-4">
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value, 10))} className="flex-1 accent-primary-600" />
      <div className="w-16 rounded-lg border border-stone-200 px-3 py-1.5 text-center text-sm font-bold text-stone-900">{value}{suffix}</div>
    </div>
    <div className="mt-1 flex justify-between text-xs text-stone-400"><span>{min}</span><span>{max}</span></div>
  </div>
);

const ToggleSetting = ({ label, helper, enabled, onClick, danger = false }: { label: string; helper: string; enabled: boolean; onClick: () => void; danger?: boolean }) => (
  <div className="flex items-center justify-between border-t border-stone-100 pt-4">
    <div>
      <p className="text-sm font-semibold text-stone-700">{label}</p>
      <p className="text-xs text-stone-500">{helper}</p>
    </div>
    <button type="button" onClick={onClick} className={`relative h-6 w-12 rounded-full transition-colors ${enabled ? (danger ? 'bg-red-500' : 'bg-primary-500') : 'bg-stone-300'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
    </button>
  </div>
);

export default Admin;
