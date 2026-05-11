import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
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

type Tab = 'overview' | 'reports' | 'listings' | 'registeredUsers' | 'settings';
type UserFilter = 'all' | 'online' | 'offline' | 'banned' | 'admin' | 'user';
type ListingFilter = 'all' | 'active' | 'expired' | 'flagged';

const DEFAULT_SETTINGS: PlatformSettings = {
  listingExpiryDays: 7,
  maxImagesPerListing: 4,
  maxListingsPerUser: 20,
  maintenanceMode: false,
  allowNewRegistrations: true
};

const isUserOnline = (user: UserProfile) => Boolean(user.online) && Date.now() - (user.lastSeen || 0) < 2 * 60 * 1000;

const formatDateTime = (timestamp?: number) => {
  if (!timestamp) return 'Not recorded';
  return new Date(timestamp).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const AdminUserDashboard: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [reports, setReports] = useState<Report[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [listingSearch, setListingSearch] = useState('');
  const [listingFilter, setListingFilter] = useState<ListingFilter>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [messageUser, setMessageUser] = useState<UserProfile | null>(null);
  const [subject, setSubject] = useState('Message from Reshelved Admin');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 3000);
  };

  const fetchAdminData = async () => {
    if (!userProfile?.isAdmin) return;
    setLoading(true);
    try {
      const reportsSnap = await getDocs(query(collection(db, 'reports'), where('resolved', '==', false), orderBy('createdAt', 'desc')));
      const reportItems: Report[] = [];
      reportsSnap.forEach((item) => reportItems.push({ id: item.id, ...item.data() } as Report));
      setReports(reportItems);

      const listingsSnap = await getDocs(query(collection(db, 'listings'), orderBy('createdAt', 'desc')));
      const listingItems: Listing[] = [];
      listingsSnap.forEach((item) => listingItems.push({ id: item.id, ...item.data() } as Listing));
      setListings(listingItems);

      const settingsSnap = await getDoc(doc(db, 'platform', 'settings'));
      const savedSettings = settingsSnap.exists() ? settingsSnap.data() as PlatformSettings : DEFAULT_SETTINGS;
      setSettings(savedSettings);
      setSettingsDraft(savedSettings);
    } catch (error) {
      console.error(error);
      showToast('Dashboard data failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdminData(); }, [userProfile?.isAdmin]);

  useEffect(() => {
    if (!userProfile?.isAdmin) return;
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((userDoc) => {
        const data = userDoc.data() as UserProfile;
        list.push({ ...data, uid: data.uid || userDoc.id });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsers(list);
    });
  }, [userProfile?.isAdmin]);

  const activeListings = listings.filter((listing) => listing.active && listing.expiresAt > Date.now());
  const flaggedListings = listings.filter((listing) => listing.flagged);
  const expiredListings = listings.filter((listing) => !listing.active || listing.expiresAt <= Date.now());
  const flaggedUsers = users.filter((user) => user.flagged);
  const onlineUsers = users.filter(isUserOnline);
  const bannedUsers = users.filter((user) => user.deactivated);

  const filteredListings = useMemo(() => {
    const term = listingSearch.trim().toLowerCase();
    return listings.filter((listing) => {
      const matches = !term || listing.title?.toLowerCase().includes(term) || listing.author?.toLowerCase().includes(term) || listing.userName?.toLowerCase().includes(term) || listing.location?.toLowerCase().includes(term);
      if (!matches) return false;
      if (listingFilter === 'active') return listing.active && listing.expiresAt > Date.now();
      if (listingFilter === 'expired') return !listing.active || listing.expiresAt <= Date.now();
      if (listingFilter === 'flagged') return listing.flagged;
      return true;
    });
  }, [listings, listingSearch, listingFilter]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    return users.filter((user) => {
      const role = user.isAdmin ? 'admin' : 'user';
      const matches = !term || user.displayName?.toLowerCase().includes(term) || user.email?.toLowerCase().includes(term) || user.location?.toLowerCase().includes(term) || user.uid?.toLowerCase().includes(term) || role.includes(term);
      if (!matches) return false;
      if (userFilter === 'online') return isUserOnline(user);
      if (userFilter === 'offline') return !isUserOnline(user) && !user.deactivated;
      if (userFilter === 'banned') return Boolean(user.deactivated);
      if (userFilter === 'admin') return Boolean(user.isAdmin);
      if (userFilter === 'user') return !user.isAdmin;
      return true;
    });
  }, [users, userSearch, userFilter]);

  const resolveReport = async (reportId: string) => {
    await updateDoc(doc(db, 'reports', reportId), { resolved: true });
    setReports((previous) => previous.filter((report) => report.id !== reportId));
    showToast('Report resolved');
  };

  const deleteListing = async (listingId: string) => {
    if (!confirm('Delete this listing permanently?')) return;
    await deleteDoc(doc(db, 'listings', listingId));
    setListings((previous) => previous.filter((listing) => listing.id !== listingId));
    showToast('Listing deleted');
  };

  const toggleListingActive = async (listing: Listing) => {
    const active = !listing.active;
    await updateDoc(doc(db, 'listings', listing.id), { active });
    setListings((previous) => previous.map((item) => item.id === listing.id ? { ...item, active } : item));
    showToast(active ? 'Listing enabled' : 'Listing disabled');
  };

  const unflagListing = async (listingId: string) => {
    await updateDoc(doc(db, 'listings', listingId), { flagged: false, flagCount: 0 });
    setListings((previous) => previous.map((listing) => listing.id === listingId ? { ...listing, flagged: false, flagCount: 0 } : listing));
    showToast('Listing unflagged');
  };

  const unflagUser = async (userId: string) => {
    await updateDoc(doc(db, 'users', userId), { flagged: false, flagCount: 0 });
    showToast('User unflagged');
  };

  const toggleBanUser = async (user: UserProfile) => {
    if (user.uid === currentUser?.uid) {
      showToast('You cannot ban your own admin account');
      return;
    }
    const banned = Boolean(user.deactivated);
    if (!confirm(banned ? `Reactivate ${user.displayName || user.email}?` : `Ban ${user.displayName || user.email}?`)) return;
    await updateDoc(doc(db, 'users', user.uid), { deactivated: !banned, online: false, lastSeen: Date.now() });
    showToast(banned ? 'User reactivated' : 'User banned');
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'platform', 'settings'), settingsDraft, { merge: true });
      setSettings(settingsDraft);
      showToast('Platform settings saved');
    } catch (error) {
      console.error(error);
      showToast('Settings failed to save');
    } finally {
      setSaving(false);
    }
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
      setMessage('');
    } catch (error) {
      console.error(error);
      showToast('Message failed to send');
    } finally {
      setSending(false);
    }
  };

  if (!userProfile?.isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-stone-800">Access Denied</h2>
        <p className="text-stone-500 mt-2">You do not have admin privileges.</p>
        <Link to="/" className="mt-4 inline-block text-primary-600 font-semibold">Back to Home</Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'reports', label: 'Reports', count: reports.length },
    { key: 'listings', label: 'Listings', count: listings.length },
    { key: 'registeredUsers', label: 'Registered Users', count: users.length },
    { key: 'settings', label: 'Platform Settings' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {toast && <div className="fixed top-6 right-6 z-50 bg-stone-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">{toast}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Admin Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-stone-900">Reshelved Platform Management</h1>
          <p className="mt-1 text-sm text-stone-500">Manage listings, reports, users, roles, online activity, bans, and platform settings.</p>
        </div>
        <button onClick={fetchAdminData} className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition text-sm font-semibold">
          <i className="las la-redo-alt text-lg" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Listings" value={listings.length} icon="la-book" tone="bg-primary-100 text-primary-700" />
        <StatCard label="Active Listings" value={activeListings.length} icon="la-check-circle" tone="bg-green-100 text-green-700" />
        <StatCard label="Open Reports" value={reports.length} icon="la-exclamation-triangle" tone="bg-red-100 text-red-700" />
        <StatCard label="Registered Users" value={users.length} icon="la-users" tone="bg-blue-100 text-blue-700" />
        <StatCard label="Online Users" value={onlineUsers.length} icon="la-wifi" tone="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition ${tab === item.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            {item.label}
            {item.count !== undefined && <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === item.key ? 'bg-primary-100 text-primary-700' : 'bg-stone-200 text-stone-600'}`}>{item.count}</span>}
          </button>
        ))}
      </div>

      {loading ? <LoadingState /> : (
        <>
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel title="Dashboard Summary">
                <SummaryGrid items={[
                  ['Flagged Listings', flaggedListings.length, 'text-orange-600'],
                  ['Expired or Disabled', expiredListings.length, 'text-stone-900'],
                  ['Flagged Users', flaggedUsers.length, 'text-yellow-600'],
                  ['Banned Users', bannedUsers.length, 'text-red-600']
                ]} />
              </Panel>
              <Panel title="Current Platform Settings" action={<button onClick={() => setTab('settings')} className="text-sm font-semibold text-primary-600 hover:text-primary-700">Edit</button>}>
                <SummaryGrid items={[
                  ['Listing Expiry', `${settings.listingExpiryDays} days`, 'text-stone-900'],
                  ['Max Images', settings.maxImagesPerListing, 'text-stone-900'],
                  ['Max Listings/User', settings.maxListingsPerUser, 'text-stone-900'],
                  ['Registrations', settings.allowNewRegistrations ? 'Allowed' : 'Disabled', 'text-stone-900']
                ]} />
              </Panel>
            </div>
          )}

          {tab === 'reports' && (
            <div className="space-y-3">
              {reports.length === 0 ? <EmptyState text="No open reports" /> : reports.map((report) => (
                <div key={report.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${report.targetType === 'listing' ? 'bg-accent-100 text-accent-700' : 'bg-red-100 text-red-700'}`}>{report.targetType}</span>
                      <span className="font-semibold text-stone-900">{report.targetName}</span>
                    </div>
                    <p className="text-sm text-stone-600 mt-1"><span className="font-semibold">Reason:</span> {report.reason}</p>
                    {report.details && <p className="text-sm text-stone-500 mt-1">{report.details}</p>}
                    <p className="text-xs text-stone-400 mt-2">Reported by {report.reporterName} on {formatDateTime(report.createdAt)}</p>
                  </div>
                  <button onClick={() => resolveReport(report.id)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-200 transition">Resolve</button>
                </div>
              ))}
            </div>
          )}

          {tab === 'listings' && (
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <FilterBar search={listingSearch} setSearch={setListingSearch} placeholder="Search listings...">
                <select value={listingFilter} onChange={(event) => setListingFilter(event.target.value as ListingFilter)} className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:border-primary-400 focus:outline-none">
                  <option value="all">All Listings</option><option value="active">Active</option><option value="expired">Expired or Disabled</option><option value="flagged">Flagged</option>
                </select>
              </FilterBar>
              {filteredListings.length === 0 ? <EmptyState text="No listings found" /> : <ListingsList listings={filteredListings} onToggle={toggleListingActive} onDelete={deleteListing} onUnflag={unflagListing} />}
            </div>
          )}

          {tab === 'registeredUsers' && (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <FilterBar search={userSearch} setSearch={setUserSearch} placeholder="Search by name, email, location, role, or UID...">
                <select value={userFilter} onChange={(event) => setUserFilter(event.target.value as UserFilter)} className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:border-primary-400 focus:outline-none">
                  <option value="all">All registered users</option><option value="online">Online</option><option value="offline">Offline</option><option value="banned">Banned</option><option value="admin">Admin</option><option value="user">User</option>
                </select>
              </FilterBar>
              <RegisteredUsersTable users={filteredUsers} currentUserId={currentUser?.uid} onMessage={openMessageModal} onToggleBan={toggleBanUser} onUnflag={unflagUser} />
            </div>
          )}

          {tab === 'settings' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-5 max-w-3xl">
              <h2 className="text-xl font-bold text-stone-900">Platform Settings</h2>
              <p className="text-sm text-stone-500 mt-1 mb-5">These are saved in Firestore at platform/settings.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumberInput label="Listing expiry days" value={settingsDraft.listingExpiryDays} onChange={(value) => setSettingsDraft((current) => ({ ...current, listingExpiryDays: value }))} />
                <NumberInput label="Max images per listing" value={settingsDraft.maxImagesPerListing} onChange={(value) => setSettingsDraft((current) => ({ ...current, maxImagesPerListing: value }))} />
                <NumberInput label="Max listings per user" value={settingsDraft.maxListingsPerUser} onChange={(value) => setSettingsDraft((current) => ({ ...current, maxListingsPerUser: value }))} />
                <SwitchInput label="Allow new registrations" checked={settingsDraft.allowNewRegistrations} onChange={(checked) => setSettingsDraft((current) => ({ ...current, allowNewRegistrations: checked }))} />
                <SwitchInput label="Maintenance mode" checked={settingsDraft.maintenanceMode} onChange={(checked) => setSettingsDraft((current) => ({ ...current, maintenanceMode: checked }))} />
              </div>
              <button onClick={saveSettings} disabled={saving} className="mt-6 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl disabled:opacity-60">{saving ? 'Saving...' : 'Save Settings'}</button>
            </div>
          )}
        </>
      )}

      {messageUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4"><div><h2 className="text-xl font-bold text-stone-900">Send message</h2><p className="text-sm text-stone-500">To {messageUser.displayName || messageUser.email}</p></div><button onClick={() => setMessageUser(null)} className="text-stone-400 hover:text-stone-700"><i className="las la-times text-2xl" /></button></div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">Subject</label>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 focus:outline-none mb-4" />
            <label className="block text-sm font-semibold text-stone-700 mb-1">Message</label>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 focus:outline-none" placeholder="Write the admin message here..." />
            <div className="mt-5 flex justify-end gap-2"><button onClick={() => setMessageUser(null)} className="px-4 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm font-semibold hover:bg-stone-50">Cancel</button><button onClick={sendAdminMessage} disabled={sending || !subject.trim() || !message.trim()} className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50">{sending ? 'Sending...' : 'Send message'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number | string; icon: string; tone: string }> = ({ label, value, icon, tone }) => <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-4"><div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tone}`}><i className={`las ${icon} text-2xl`} /></div><div><p className="text-2xl font-bold text-stone-900">{value}</p><p className="text-sm text-stone-500">{label}</p></div></div>;
const LoadingState = () => <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="animate-pulse bg-white rounded-xl border border-stone-200 h-20" />)}</div>;
const EmptyState: React.FC<{ text: string }> = ({ text }) => <div className="p-10 text-center text-stone-500">{text}</div>;
const Panel: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => <div className="bg-white rounded-2xl border border-stone-200 p-5"><div className="flex items-center justify-between mb-4"><h2 className="font-bold text-stone-900">{title}</h2>{action}</div>{children}</div>;
const SummaryGrid: React.FC<{ items: [string, number | string, string][] }> = ({ items }) => <div className="grid grid-cols-2 gap-3">{items.map(([label, value, color]) => <div key={label} className="bg-stone-50 rounded-xl p-4"><p className="text-xs text-stone-500">{label}</p><p className={`text-xl font-bold ${color}`}>{value}</p></div>)}</div>;
const FilterBar: React.FC<{ search: string; setSearch: (value: string) => void; placeholder: string; children: React.ReactNode }> = ({ search, setSearch, placeholder, children }) => <div className="p-4 border-b border-stone-200 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} className="w-full lg:max-w-md px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 focus:outline-none" />{children}</div>;
const NumberInput: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => <label className="block"><span className="block text-sm font-semibold text-stone-700 mb-1">{label}</span><input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 focus:outline-none" /></label>;
const SwitchInput: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => <label className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3"><span className="text-sm font-semibold text-stone-700">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;

const ListingsList: React.FC<{ listings: Listing[]; onToggle: (listing: Listing) => void; onDelete: (id: string) => void; onUnflag: (id: string) => void }> = ({ listings, onToggle, onDelete, onUnflag }) => <div className="divide-y divide-stone-100">{listings.map((listing) => <div key={listing.id} className="p-4 flex items-start justify-between gap-4"><div className="flex items-start gap-3 min-w-0">{listing.images?.[0] && <img src={listing.images[0]} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />}<div className="min-w-0"><Link to={`/listing/${listing.id}`} className="font-semibold text-stone-900 hover:text-primary-700">{listing.title}</Link><p className="text-sm text-stone-500">by {listing.author} · {listing.userName} · {listing.location}</p><p className="text-xs text-stone-400 mt-1">{formatDateTime(listing.createdAt)} · {listing.type === 'sell' ? `KSh ${listing.price?.toLocaleString()}` : listing.type}</p></div></div><div className="flex flex-wrap justify-end gap-2 shrink-0">{listing.flagged && <button onClick={() => onUnflag(listing.id)} className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold">Unflag</button>}<button onClick={() => onToggle(listing)} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${listing.active ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>{listing.active ? 'Disable' : 'Enable'}</button><button onClick={() => onDelete(listing.id)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold">Delete</button></div></div>)}</div>;

const RegisteredUsersTable: React.FC<{ users: UserProfile[]; currentUserId?: string; onMessage: (user: UserProfile) => void; onToggleBan: (user: UserProfile) => void; onUnflag: (userId: string) => void }> = ({ users, currentUserId, onMessage, onToggleBan, onUnflag }) => {
  if (users.length === 0) return <EmptyState text="No registered users found" />;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3 font-semibold">User</th><th className="px-4 py-3 font-semibold">Registration Date & Time</th><th className="px-4 py-3 font-semibold">Online Status</th><th className="px-4 py-3 font-semibold">Last Seen</th><th className="px-4 py-3 font-semibold">User Role</th><th className="px-4 py-3 font-semibold text-right">Actions</th></tr></thead><tbody className="divide-y divide-stone-100">{users.map((user) => { const online = isUserOnline(user); const banned = Boolean(user.deactivated); return <tr key={user.uid} className="align-top"><td className="px-4 py-4 min-w-[260px]"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">{(user.displayName || user.email || 'U')[0]?.toUpperCase()}</div><div><div className="font-semibold text-stone-900">{user.displayName || 'Unnamed user'}</div><div className="text-stone-500">{user.email}</div><div className="text-xs text-stone-400 mt-0.5">{user.location || 'No location'} · {user.uid}</div></div></div></td><td className="px-4 py-4 whitespace-nowrap text-stone-700">{formatDateTime(user.createdAt)}</td><td className="px-4 py-4 whitespace-nowrap">{banned ? <StatusBadge label="Banned" color="red" /> : online ? <StatusBadge label="Online" color="green" /> : <StatusBadge label="Offline" color="stone" />}</td><td className="px-4 py-4 whitespace-nowrap text-stone-700">{formatDateTime(user.lastSeen)}</td><td className="px-4 py-4 whitespace-nowrap"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${user.isAdmin ? 'bg-primary-100 text-primary-700' : 'bg-stone-100 text-stone-600'}`}>{user.isAdmin ? 'Admin' : 'User'}</span></td><td className="px-4 py-4"><div className="flex items-center justify-end gap-2">{user.flagged && <button onClick={() => onUnflag(user.uid)} className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold">Unflag</button>}<button onClick={() => onMessage(user)} className="px-3 py-1.5 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 text-xs font-semibold">Message</button><button onClick={() => onToggleBan(user)} disabled={user.uid === currentUserId} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${banned ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-red-200 text-red-700 hover:bg-red-50'}`}>{banned ? 'Unban' : 'Ban'}</button></div></td></tr>; })}</tbody></table></div>;
};

const StatusBadge: React.FC<{ label: string; color: 'green' | 'red' | 'stone' }> = ({ label, color }) => {
  const styles = { green: 'bg-green-100 text-green-700 before:bg-green-500', red: 'bg-red-100 text-red-700 before:bg-red-500', stone: 'bg-stone-100 text-stone-600 before:bg-stone-400' }[color];
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold before:content-[''] before:w-2 before:h-2 before:rounded-full ${styles}`}>{label}</span>;
};

export default AdminUserDashboard;
