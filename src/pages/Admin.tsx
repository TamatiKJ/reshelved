import React, { useEffect, useState, useCallback } from 'react';
import {
  collection, query, where, getDocs, deleteDoc, doc, updateDoc,
  orderBy, addDoc, getDoc, setDoc, onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Report, Listing, UserProfile } from '../types';
import { Link } from 'react-router-dom';

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: PlatformSettings = {
  listingExpiryDays: 7,
  maxImagesPerListing: 4,
  maxListingsPerUser: 20,
  maintenanceMode: false,
  allowNewRegistrations: true,
};

type Tab = 'overview' | 'reports' | 'listings' | 'users' | 'settings' | 'notifications';

// ── Stat Card ──────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string; value: number | string; color: string; icon: React.ReactNode;
}> = ({ label, value, color, icon }) => (
  <div className="bg-white rounded-xl border border-stone-200 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <div className="text-2xl font-bold text-stone-800">{value}</div>
      <div className="text-sm text-stone-500">{label}</div>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────
const Admin: React.FC = () => {
  const { userProfile } = useAuth();

  // Tab
  const [tab, setTab] = useState<Tab>('overview');

  // Data
  const [reports, setReports] = useState<Report[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [flaggedListings, setFlaggedListings] = useState<Listing[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Listing edit modal
  const [editListing, setEditListing] = useState<Listing | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // User deactivate confirm
  const [confirmUser, setConfirmUser] = useState<UserProfile | null>(null);

  // Notification composer
  const [notifTarget, setNotifTarget] = useState<'all' | 'user'>('all');
  const [notifUserId, setNotifUserId] = useState('');
  const [notifSubject, setNotifSubject] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifSending, setNotifSending] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Listings filter
  const [listingSearch, setListingSearch] = useState('');
  const [listingFilter, setListingFilter] = useState<'all' | 'active' | 'expired' | 'flagged'>('all');

  // Users filter
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'deactivated' | 'flagged' | 'admin'>('all');

  // ── Show toast helper ──────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Fetch all data ─────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!userProfile?.isAdmin) return;
    setLoading(true);
    try {
      // Reports
      const rSnap = await getDocs(
        query(collection(db, 'reports'), where('resolved', '==', false), orderBy('createdAt', 'desc'))
      );
      const reps: Report[] = [];
      rSnap.forEach(d => reps.push({ id: d.id, ...d.data() } as Report));
      setReports(reps);

      // All listings
      const lSnap = await getDocs(
        query(collection(db, 'listings'), orderBy('createdAt', 'desc'))
      );
      const ls: Listing[] = [];
      lSnap.forEach(d => ls.push({ id: d.id, ...d.data() } as Listing));
      setAllListings(ls);
      setFlaggedListings(ls.filter(l => l.flagged));

      // All users
      const uSnap = await getDocs(collection(db, 'users'));
      const us: UserProfile[] = [];
      uSnap.forEach(d => us.push(d.data() as UserProfile));
      setAllUsers(us);
      setFlaggedUsers(us.filter(u => u.flagged));

      // Platform settings
      const settingsDoc = await getDoc(doc(db, 'platform', 'settings'));
      if (settingsDoc.exists()) {
        const s = settingsDoc.data() as PlatformSettings;
        setSettings(s);
        setSettingsDraft(s);
      } else {
        setSettings(DEFAULT_SETTINGS);
        setSettingsDraft(DEFAULT_SETTINGS);
      }

      // Notifications
      const nSnap = await getDocs(
        query(collection(db, 'notifications'), where('fromAdmin', '==', true), orderBy('createdAt', 'desc'))
      );
      const ns: Notification[] = [];
      nSnap.forEach(d => ns.push({ id: d.id, ...d.data() } as Notification));
      setNotifications(ns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Report actions ─────────────────────────────────────────────────────
  const resolveReport = async (reportId: string) => {
    await updateDoc(doc(db, 'reports', reportId), { resolved: true });
    setReports(prev => prev.filter(r => r.id !== reportId));
    showToast('Report resolved');
  };

  // ── Listing actions ────────────────────────────────────────────────────
  const deleteListing = async (listingId: string) => {
    if (!confirm('Delete this listing permanently?')) return;
    await deleteDoc(doc(db, 'listings', listingId));
    setAllListings(prev => prev.filter(l => l.id !== listingId));
    setFlaggedListings(prev => prev.filter(l => l.id !== listingId));
    showToast('Listing deleted');
  };

  const toggleListingActive = async (listing: Listing) => {
    const newActive = !listing.active;
    await updateDoc(doc(db, 'listings', listing.id), { active: newActive });
    const updated = (l: Listing) => l.id === listing.id ? { ...l, active: newActive } : l;
    setAllListings(prev => prev.map(updated));
    setFlaggedListings(prev => prev.map(updated));
    showToast(newActive ? 'Listing enabled' : 'Listing disabled');
  };

  const unflagListing = async (listingId: string) => {
    await updateDoc(doc(db, 'listings', listingId), { flagged: false, flagCount: 0 });
    const updated = (l: Listing) => l.id === listingId ? { ...l, flagged: false, flagCount: 0 } : l;
    setAllListings(prev => prev.map(updated));
    setFlaggedListings(prev => prev.filter(l => l.id !== listingId));
    showToast('Listing unflagged');
  };

  const openEditListing = (listing: Listing) => {
    setEditListing(listing);
    setEditTitle(listing.title);
    setEditPrice(listing.price?.toString() || '');
    setEditDescription(listing.description);
  };

  const saveEditListing = async () => {
    if (!editListing) return;
    const updates: Partial<Listing> = {
      title: editTitle,
      description: editDescription,
    };
    if (editListing.type === 'sell') updates.price = parseFloat(editPrice) || 0;
    await updateDoc(doc(db, 'listings', editListing.id), updates);
    const applyUpdates = (l: Listing) => l.id === editListing.id ? { ...l, ...updates } : l;
    setAllListings(prev => prev.map(applyUpdates));
    setFlaggedListings(prev => prev.map(applyUpdates));
    setEditListing(null);
    showToast('Listing updated');
  };

  // ── User actions ───────────────────────────────────────────────────────
  const toggleUserDeactivated = async (user: UserProfile) => {
    const nowDeactivated = !(user as any).deactivated;
    await updateDoc(doc(db, 'users', user.uid), { deactivated: nowDeactivated });
    setAllUsers(prev =>
      prev.map(u => u.uid === user.uid ? { ...u, deactivated: nowDeactivated } as any : u)
    );
    setConfirmUser(null);
    showToast(nowDeactivated ? 'Account deactivated' : 'Account reactivated');
  };

  const toggleAdmin = async (user: UserProfile) => {
    const newAdmin = !user.isAdmin;
    await updateDoc(doc(db, 'users', user.uid), { isAdmin: newAdmin });
    setAllUsers(prev =>
      prev.map(u => u.uid === user.uid ? { ...u, isAdmin: newAdmin } : u)
    );
    showToast(newAdmin ? `${user.displayName} is now admin` : `${user.displayName} removed from admin`);
  };

  const unflagUser = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), { flagged: false, flagCount: 0 });
    const updated = (u: UserProfile) => u.uid === userId ? { ...u, flagged: false, flagCount: 0 } : u;
    setAllUsers(prev => prev.map(updated));
    setFlaggedUsers(prev => prev.filter(u => u.uid !== userId));
    showToast('User unflagged');
  };

  // ── Settings ───────────────────────────────────────────────────────────
  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      await setDoc(doc(db, 'platform', 'settings'), settingsDraft);
      setSettings(settingsDraft);
      showToast('Platform settings saved');
    } catch (err) {
      console.error(err);
    } finally {
      setSettingsSaving(false);
    }
  };

  // ── Notifications ──────────────────────────────────────────────────────
  const sendNotification = async () => {
    if (!notifSubject.trim() || !notifMessage.trim()) return;
    setNotifSending(true);
    try {
      if (notifTarget === 'all') {
        // Broadcast to all users
        const batch = allUsers.map(u =>
          addDoc(collection(db, 'notifications'), {
            userId: u.uid,
            userName: u.displayName,
            fromAdmin: true,
            subject: notifSubject.trim(),
            message: notifMessage.trim(),
            createdAt: Date.now(),
            read: false,
          })
        );
        await Promise.all(batch);
        showToast(`Notification sent to ${allUsers.length} users`);
      } else {
        // Send to specific user
        const targetUser = allUsers.find(u => u.uid === notifUserId || u.email === notifUserId);
        if (!targetUser) { showToast('User not found'); setNotifSending(false); return; }
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
    } finally {
      setNotifSending(false);
    }
  };

  // ── Filtered data ──────────────────────────────────────────────────────
  const filteredListings = allListings.filter(l => {
    const matchSearch = !listingSearch ||
      l.title.toLowerCase().includes(listingSearch.toLowerCase()) ||
      l.author.toLowerCase().includes(listingSearch.toLowerCase()) ||
      l.userName.toLowerCase().includes(listingSearch.toLowerCase());
    const now = Date.now();
    if (listingFilter === 'active') return matchSearch && l.active && l.expiresAt > now;
    if (listingFilter === 'expired') return matchSearch && (!l.active || l.expiresAt <= now);
    if (listingFilter === 'flagged') return matchSearch && l.flagged;
    return matchSearch;
  });

  const filteredUsers = allUsers
    .filter(u => {
      const matchSearch = !userSearch ||
        u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase());
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
    });

  // ── Access guard ───────────────────────────────────────────────────────
  if (!userProfile?.isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-stone-700">Access Denied</h2>
        <p className="text-stone-500 mt-2">You don't have admin privileges.</p>
        <Link to="/" className="mt-4 inline-block text-primary-600 font-medium">Back to Home</Link>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'reports', label: 'Reports', count: reports.length },
    { key: 'listings', label: 'Listings', count: allListings.length },
    { key: 'users', label: 'Users', count: allUsers.length },
    { key: 'notifications', label: 'Notifications' },
    { key: 'settings', label: 'Settings' },
  ];

  const activeListings = allListings.filter(l => l.active && l.expiresAt > Date.now());
  const deactivatedUsers = allUsers.filter(u => (u as any).deactivated);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-stone-800 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Admin Dashboard</h1>
          <p className="text-stone-500 mt-0.5 text-sm">Reshelved platform management</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-600 rounded-xl hover:bg-stone-50 transition text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === t.key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                tab === t.key ? 'bg-primary-100 text-primary-700' : 'bg-stone-200 text-stone-600'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-stone-200 h-20" />
          ))}
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ─────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Total Users" value={allUsers.length} color="bg-blue-100"
                  icon={<svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                />
                <StatCard
                  label="Active Listings" value={activeListings.length} color="bg-green-100"
                  icon={<svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                />
                <StatCard
                  label="Open Reports" value={reports.length} color="bg-red-100"
                  icon={<svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                />
                <StatCard
                  label="Deactivated Users" value={deactivatedUsers.length} color="bg-orange-100"
                  icon={<svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
                />
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <h3 className="font-semibold text-stone-800 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Review Reports', count: reports.length, tab: 'reports' as Tab, color: 'text-red-600 bg-red-50 border-red-200' },
                    { label: 'Flagged Listings', count: flaggedListings.length, tab: 'listings' as Tab, color: 'text-orange-600 bg-orange-50 border-orange-200' },
                    { label: 'Flagged Users', count: flaggedUsers.length, tab: 'users' as Tab, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                  ].map(a => (
                    <button
                      key={a.tab}
                      onClick={() => setTab(a.tab)}
                      className={`p-4 rounded-xl border text-left transition hover:opacity-80 ${a.color}`}
                    >
                      <div className="text-2xl font-bold">{a.count}</div>
                      <div className="text-sm font-medium mt-1">{a.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Settings Summary */}
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-stone-800">Current Platform Settings</h3>
                  <button onClick={() => setTab('settings')} className="text-sm text-primary-600 font-medium hover:text-primary-700">Edit</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Listing Expiry', value: `${settings.listingExpiryDays} days` },
                    { label: 'Max Images', value: settings.maxImagesPerListing },
                    { label: 'Max Listings/User', value: settings.maxListingsPerUser },
                    { label: 'Maintenance Mode', value: settings.maintenanceMode ? 'ON' : 'Off' },
                    { label: 'New Registrations', value: settings.allowNewRegistrations ? 'Allowed' : 'Disabled' },
                  ].map(s => (
                    <div key={s.label} className="bg-stone-50 rounded-lg p-3">
                      <div className="text-xs text-stone-500">{s.label}</div>
                      <div className="text-sm font-semibold text-stone-800 mt-0.5">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── REPORTS ──────────────────────────────────────────────── */}
          {tab === 'reports' && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-stone-500">No open reports</p>
                </div>
              ) : reports.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-stone-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.targetType === 'listing' ? 'bg-accent-100 text-accent-700' : 'bg-red-100 text-red-700'}`}>
                          {r.targetType}
                        </span>
                        <span className="font-medium text-stone-800 truncate">{r.targetName}</span>
                      </div>
                      <p className="text-sm text-stone-600 mt-1"><span className="font-medium">Reason:</span> {r.reason}</p>
                      {r.details && <p className="text-sm text-stone-500 mt-0.5">{r.details}</p>}
                      <p className="text-xs text-stone-400 mt-2">
                        Reported by <strong>{r.reporterName}</strong> · {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.targetType === 'listing' && (
                        <Link to={`/listing/${r.targetId}`} className="px-3 py-1.5 text-sm text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition font-medium">
                          View
                        </Link>
                      )}
                      <button onClick={() => resolveReport(r.id)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition">
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── LISTINGS ─────────────────────────────────────────────── */}
          {tab === 'listings' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search listings..."
                  value={listingSearch}
                  onChange={e => setListingSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 outline-none"
                />
                <select
                  value={listingFilter}
                  onChange={e => setListingFilter(e.target.value as typeof listingFilter)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:border-primary-400 outline-none"
                >
                  <option value="all">All Listings</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired/Disabled</option>
                  <option value="flagged">Flagged</option>
                </select>
              </div>

              <div className="text-sm text-stone-500">{filteredListings.length} listings</div>

              {filteredListings.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
                  <p className="text-stone-500">No listings found</p>
                </div>
              ) : filteredListings.map(l => {
                const isExpired = l.expiresAt < Date.now();
                return (
                  <div key={l.id} className={`bg-white rounded-xl border p-4 ${l.flagged ? 'border-orange-200' : 'border-stone-200'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        {l.images?.[0] && (
                          <img src={l.images[0]} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link to={`/listing/${l.id}`} className="font-medium text-stone-800 hover:text-primary-700 truncate">
                              {l.title}
                            </Link>
                            {!l.active && <span className="px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded text-xs">Disabled</span>}
                            {isExpired && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">Expired</span>}
                            {l.flagged && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">⚑ {l.flagCount} flags</span>}
                          </div>
                          <p className="text-sm text-stone-500 mt-0.5">by {l.author} · {l.userName} · {l.location}</p>
                          <p className="text-xs text-stone-400 mt-0.5">
                            {new Date(l.createdAt).toLocaleDateString()} ·
                            {l.type === 'sell' ? ` KSh ${l.price?.toLocaleString()}` : ` ${l.type}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <button
                          onClick={() => openEditListing(l)}
                          className="px-2.5 py-1.5 text-xs border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 transition font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleListingActive(l)}
                          className={`px-2.5 py-1.5 text-xs rounded-lg transition font-medium ${
                            l.active ? 'border border-orange-200 text-orange-600 hover:bg-orange-50' : 'border border-green-200 text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {l.active ? 'Disable' : 'Enable'}
                        </button>
                        {l.flagged && (
                          <button
                            onClick={() => unflagListing(l.id)}
                            className="px-2.5 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
                          >
                            Unflag
                          </button>
                        )}
                        <button
                          onClick={() => deleteListing(l.id)}
                          className="px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── USERS ────────────────────────────────────────────────── */}
          {tab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 outline-none"
                />
                <select
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value as typeof userFilter)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:border-primary-400 outline-none"
                >
                  <option value="all">All Users</option>
                  <option value="active">Active</option>
                  <option value="deactivated">Deactivated</option>
                  <option value="flagged">Flagged</option>
                  <option value="admin">Admins</option>
                </select>
              </div>

              <div className="text-sm text-stone-500">{filteredUsers.length} users</div>

              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
                  <p className="text-stone-500">No users found</p>
                </div>
              ) : filteredUsers.map(u => {
                const isDeactivated = (u as any).deactivated;
                return (
                  <div key={u.uid} className={`bg-white rounded-xl border p-4 ${isDeactivated ? 'border-stone-300 opacity-70' : u.flagged ? 'border-orange-200' : 'border-stone-200'}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold shrink-0 ${isDeactivated ? 'bg-stone-200 text-stone-400' : 'bg-primary-100 text-primary-700'}`}>
                          {u.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-stone-800">{u.displayName}</span>
                            {u.isAdmin && <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">Admin</span>}
                            {isDeactivated && <span className="px-1.5 py-0.5 bg-stone-200 text-stone-500 rounded text-xs">Deactivated</span>}
                            {u.flagged && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">⚑ {u.flagCount} flags</span>}
                          </div>
                          <p className="text-sm text-stone-500 truncate">{u.email}</p>
                          <p className="text-xs text-stone-400">{u.location} · Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <button
                          onClick={() => {
                            setNotifTarget('user');
                            setNotifUserId(u.email);
                            setTab('notifications');
                          }}
                          className="px-2.5 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
                        >
                          Message
                        </button>
                        <button
                          onClick={() => toggleAdmin(u)}
                          className={`px-2.5 py-1.5 text-xs rounded-lg transition font-medium ${
                            u.isAdmin ? 'border border-stone-200 text-stone-600 hover:bg-stone-50' : 'border border-primary-200 text-primary-600 hover:bg-primary-50'
                          }`}
                        >
                          {u.isAdmin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                        {u.flagged && (
                          <button
                            onClick={() => unflagUser(u.uid)}
                            className="px-2.5 py-1.5 text-xs border border-green-200 text-green-600 rounded-lg hover:bg-green-50 transition font-medium"
                          >
                            Unflag
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmUser(u)}
                          className={`px-2.5 py-1.5 text-xs rounded-lg transition font-medium ${
                            isDeactivated
                              ? 'border border-green-200 text-green-600 hover:bg-green-50'
                              : 'border border-red-200 text-red-600 hover:bg-red-50'
                          }`}
                        >
                          {isDeactivated ? 'Reactivate' : 'Deactivate'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── NOTIFICATIONS ────────────────────────────────────────── */}
          {tab === 'notifications' && (
            <div className="space-y-6">
              {/* Composer */}
              <div className="bg-white rounded-xl border border-stone-200 p-6">
                <h3 className="font-semibold text-stone-800 mb-4">Send Notification</h3>
                <div className="space-y-4">
                  {/* Target */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Send To</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setNotifTarget('all')}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${notifTarget === 'all' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
                      >
                        📢 All Users ({allUsers.length})
                      </button>
                      <button
                        onClick={() => setNotifTarget('user')}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${notifTarget === 'user' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
                      >
                        👤 Specific User
                      </button>
                    </div>
                  </div>

                  {notifTarget === 'user' && (
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">User Email or ID</label>
                      <input
                        type="text"
                        value={notifUserId}
                        onChange={e => setNotifUserId(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={notifSubject}
                      onChange={e => setNotifSubject(e.target.value)}
                      placeholder="e.g. Important platform update"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Message</label>
                    <textarea
                      value={notifMessage}
                      onChange={e => setNotifMessage(e.target.value)}
                      placeholder="Write your message here..."
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 outline-none resize-none"
                    />
                  </div>

                  <button
                    onClick={sendNotification}
                    disabled={notifSending || !notifSubject.trim() || !notifMessage.trim()}
                    className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {notifSending ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        Send Notification
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Sent notifications history */}
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <h3 className="font-semibold text-stone-800 mb-4">Sent Notifications ({notifications.length})</h3>
                {notifications.length === 0 ? (
                  <p className="text-stone-500 text-sm">No notifications sent yet</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} className="p-3 bg-stone-50 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-stone-800 text-sm">{n.subject}</p>
                            <p className="text-xs text-stone-500 mt-0.5">To: {n.userName}</p>
                            <p className="text-sm text-stone-600 mt-1 line-clamp-2">{n.message}</p>
                          </div>
                          <p className="text-xs text-stone-400 shrink-0">{new Date(n.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SETTINGS ─────────────────────────────────────────────── */}
          {tab === 'settings' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-stone-200 p-6">
                <h3 className="font-semibold text-stone-800 mb-5">Platform Settings</h3>
                <div className="space-y-6">
                  {/* Listing Expiry Days */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Listing Expiry (days)
                    </label>
                    <p className="text-xs text-stone-500 mb-2">How many days before a listing automatically expires</p>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={1}
                        max={90}
                        value={settingsDraft.listingExpiryDays}
                        onChange={e => setSettingsDraft(d => ({ ...d, listingExpiryDays: parseInt(e.target.value) }))}
                        className="flex-1 accent-primary-600"
                      />
                      <div className="w-16 px-3 py-1.5 border border-stone-200 rounded-lg text-sm text-center font-semibold text-stone-800">
                        {settingsDraft.listingExpiryDays}d
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-stone-400 mt-1">
                      <span>1 day</span><span>90 days</span>
                    </div>
                  </div>

                  {/* Max Images */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Max Images per Listing
                    </label>
                    <p className="text-xs text-stone-500 mb-2">Maximum number of photos a seller can upload per listing</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5, 6, 8].map(n => (
                        <button
                          key={n}
                          onClick={() => setSettingsDraft(d => ({ ...d, maxImagesPerListing: n }))}
                          className={`w-10 h-10 rounded-lg border text-sm font-medium transition ${
                            settingsDraft.maxImagesPerListing === n
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-stone-200 text-stone-600 hover:border-stone-300'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Max Listings per User */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Max Active Listings per User
                    </label>
                    <p className="text-xs text-stone-500 mb-2">Maximum concurrent active listings allowed per user account</p>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={settingsDraft.maxListingsPerUser}
                        onChange={e => setSettingsDraft(d => ({ ...d, maxListingsPerUser: parseInt(e.target.value) }))}
                        className="flex-1 accent-primary-600"
                      />
                      <div className="w-16 px-3 py-1.5 border border-stone-200 rounded-lg text-sm text-center font-semibold text-stone-800">
                        {settingsDraft.maxListingsPerUser}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-stone-400 mt-1">
                      <span>1</span><span>100</span>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-4 pt-2 border-t border-stone-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-stone-700">Maintenance Mode</p>
                        <p className="text-xs text-stone-500">Show a maintenance message to all users</p>
                      </div>
                      <button
                        onClick={() => setSettingsDraft(d => ({ ...d, maintenanceMode: !d.maintenanceMode }))}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${settingsDraft.maintenanceMode ? 'bg-red-500' : 'bg-stone-300'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${settingsDraft.maintenanceMode ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-stone-700">Allow New Registrations</p>
                        <p className="text-xs text-stone-500">Disable to prevent new accounts from being created</p>
                      </div>
                      <button
                        onClick={() => setSettingsDraft(d => ({ ...d, allowNewRegistrations: !d.allowNewRegistrations }))}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${settingsDraft.allowNewRegistrations ? 'bg-primary-500' : 'bg-stone-300'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${settingsDraft.allowNewRegistrations ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Save */}
                  <div className="flex items-center gap-3 pt-4 border-t border-stone-100">
                    <button
                      onClick={saveSettings}
                      disabled={settingsSaving}
                      className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {settingsSaving ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          Saving...
                        </>
                      ) : 'Save Settings'}
                    </button>
                    <button
                      onClick={() => setSettingsDraft(settings)}
                      className="px-6 py-2.5 border border-stone-200 text-stone-600 rounded-xl hover:bg-stone-50 transition text-sm font-medium"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Edit Listing Modal ──────────────────────────────────────── */}
      {editListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Edit Listing</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 outline-none"
                />
              </div>
              {editListing.type === 'sell' && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Price (KSh)</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={e => setEditPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 outline-none resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditListing(null)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition">
                  Cancel
                </button>
                <button onClick={saveEditListing} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate User Confirm Modal ─────────────────────────── */}
      {confirmUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-stone-800">
              {(confirmUser as any).deactivated ? 'Reactivate Account' : 'Deactivate Account'}
            </h3>
            <p className="text-stone-500 text-sm mt-2">
              {(confirmUser as any).deactivated
                ? `Restore access for ${confirmUser.displayName}?`
                : `This will prevent ${confirmUser.displayName} from logging in. Their listings will remain but be inaccessible.`}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmUser(null)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-600">
                Cancel
              </button>
              <button
                onClick={() => toggleUserDeactivated(confirmUser)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition ${
                  (confirmUser as any).deactivated ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {(confirmUser as any).deactivated ? 'Reactivate' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
