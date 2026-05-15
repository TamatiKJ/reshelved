import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Listing, Report, UserProfile } from '../types';

type Tab = 'overview' | 'listings' | 'reports' | 'registeredUsers';
type UserRoleFilter = 'all' | 'admin';

const isUserOnline = (user: UserProfile) => Boolean(user.online) && Date.now() - (user.lastSeen || 0) < 2 * 60 * 1000;

const formatDateTime = (timestamp?: number) => {
  if (!timestamp) return 'Not recorded';
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const normalizeImages = (images?: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images.filter((image): image is string => typeof image === 'string' && image.trim().length > 0);
};

const getPriceLabel = (listing: Listing) => {
  if (listing.type === 'swap') return 'Swap';
  if (listing.type === 'donate') return 'Free';
  if (listing.price && listing.price > 0) return `KSh ${listing.price.toLocaleString()}`;
  return 'Ask';
};

const sortAdminsFirst = (a: UserProfile, b: UserProfile) => {
  if (a.isAdmin && !b.isAdmin) return -1;
  if (!a.isAdmin && b.isAdmin) return 1;
  return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
};

const StatCard: React.FC<{ label: string; value: number | string; icon: string; tone: string }> = ({ label, value, icon, tone }) => (
  <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tone}`}>
      <i className={`las ${icon} text-2xl`} />
    </div>
    <div>
      <p className="text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-sm text-stone-500">{label}</p>
    </div>
  </div>
);

const AdminUserDashboard: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [listingSearch, setListingSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>('all');

  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 3000);
  };

  const fetchAdminData = async () => {
    if (!userProfile?.isAdmin) return;
    setLoading(true);
    try {
      const [listingSnap, reportSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'listings')),
        getDocs(collection(db, 'reports')),
        getDocs(collection(db, 'users'))
      ]);

      const listingItems: Listing[] = [];
      listingSnap.forEach((item) => listingItems.push({ id: item.id, ...item.data() } as Listing));
      listingItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setListings(listingItems);

      const reportItems: Report[] = [];
      reportSnap.forEach((item) => reportItems.push({ id: item.id, ...item.data() } as Report));
      reportItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setReports(reportItems);

      const userItems: UserProfile[] = [];
      userSnap.forEach((item) => userItems.push({ uid: item.id, ...item.data() } as UserProfile));
      userItems.sort(sortAdminsFirst);
      setUsers(userItems);
    } catch (error) {
      console.error('Admin dashboard failed to load:', error);
      showToast('Dashboard data failed to load. Check Firestore rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [userProfile?.isAdmin]);

  const activeListings = useMemo(() => listings.filter((listing) => listing.active && listing.expiresAt > Date.now()), [listings]);
  const expiredListings = useMemo(() => listings.filter((listing) => !listing.active || listing.expiresAt <= Date.now()), [listings]);
  const openReports = useMemo(() => reports.filter((report) => !report.resolved), [reports]);
  const flaggedListings = useMemo(() => listings.filter((listing) => listing.flagged), [listings]);
  const flaggedUsers = useMemo(() => users.filter((user) => user.flagged), [users]);
  const onlineUsers = useMemo(() => users.filter(isUserOnline), [users]);
  const adminUsers = useMemo(() => users.filter((user) => user.isAdmin), [users]);

  const filteredActiveListings = activeListings.filter((listing) => {
    const term = listingSearch.trim().toLowerCase();
    if (!term) return true;
    return [listing.title, listing.author, listing.userName, listing.location, listing.condition, listing.type]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
  });

  const filteredReports = reports.filter((report) => {
    const term = reportSearch.trim().toLowerCase();
    if (!term) return true;
    return [report.targetName, report.reporterName, report.reason, report.details, report.targetType]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
  });

  const filteredUsers = users
    .filter((user) => {
      if (userRoleFilter === 'admin' && !user.isAdmin) return false;
      const term = userSearch.trim().toLowerCase();
      if (!term) return true;
      return [user.displayName, user.email, user.location, user.uid, user.isAdmin ? 'administrator admin' : 'user']
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    })
    .sort(sortAdminsFirst);

  const resolveReport = async (report: Report) => {
    await updateDoc(doc(db, 'reports', report.id), { resolved: true });
    setReports((current) => current.map((item) => item.id === report.id ? { ...item, resolved: true } : item));
    showToast('Report resolved');
  };

  const reopenReport = async (report: Report) => {
    await updateDoc(doc(db, 'reports', report.id), { resolved: false });
    setReports((current) => current.map((item) => item.id === report.id ? { ...item, resolved: false } : item));
    showToast('Report reopened');
  };

  const toggleListing = async (listing: Listing) => {
    const active = !listing.active;
    await updateDoc(doc(db, 'listings', listing.id), { active });
    setListings((current) => current.map((item) => item.id === listing.id ? { ...item, active } : item));
    showToast(active ? 'Listing enabled' : 'Listing disabled');
  };

  const deleteListing = async (listing: Listing) => {
    if (!confirm(`Delete “${listing.title}” permanently?`)) return;
    await deleteDoc(doc(db, 'listings', listing.id));
    setListings((current) => current.filter((item) => item.id !== listing.id));
    showToast('Listing deleted');
  };

  const unflagListing = async (listing: Listing) => {
    await updateDoc(doc(db, 'listings', listing.id), { flagged: false, flagCount: 0 });
    setListings((current) => current.map((item) => item.id === listing.id ? { ...item, flagged: false, flagCount: 0 } : item));
    showToast('Listing unflagged');
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
    { key: 'listings', label: 'Active Listings', count: activeListings.length },
    { key: 'reports', label: 'Reports', count: openReports.length },
    { key: 'registeredUsers', label: 'Registered Users', count: users.length }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {toast && <div className="fixed top-6 right-6 z-50 bg-stone-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">{toast}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Admin Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-stone-900">Reshelved Platform Management</h1>
          <p className="mt-1 text-sm text-stone-500">Manage active listings, reports, and registered users.</p>
        </div>
        <button onClick={fetchAdminData} className="inline-flex cursor-pointer items-center justify-center gap-2 px-4 py-2 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition text-sm font-semibold">
          <i className="las la-redo-alt text-lg" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Listings" value={listings.length} icon="la-book" tone="bg-primary-100 text-primary-700" />
        <StatCard label="Active Listings" value={activeListings.length} icon="la-check-circle" tone="bg-green-100 text-green-700" />
        <StatCard label="Open Reports" value={openReports.length} icon="la-exclamation-triangle" tone="bg-red-100 text-red-700" />
        <StatCard label="Registered Users" value={users.length} icon="la-users" tone="bg-blue-100 text-blue-700" />
        <StatCard label="Online Users" value={onlineUsers.length} icon="la-wifi" tone="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`cursor-pointer flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition ${tab === item.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            {item.label}
            {item.count !== undefined && <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === item.key ? 'bg-primary-100 text-primary-700' : 'bg-stone-200 text-stone-600'}`}>{item.count}</span>}
          </button>
        ))}
      </div>

      {loading ? <LoadingState /> : (
        <>
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel title="Latest Active Listings" action={<button onClick={() => setTab('listings')} className="cursor-pointer text-sm font-semibold text-primary-600">View all</button>}>
                <div className="space-y-3">
                  {activeListings.slice(0, 6).map((listing) => <ListingPreview key={listing.id} listing={listing} />)}
                  {activeListings.length === 0 && <EmptyState text="No active listings yet" />}
                </div>
              </Panel>
              <Panel title="Latest Reports" action={<button onClick={() => setTab('reports')} className="cursor-pointer text-sm font-semibold text-primary-600">View all</button>}>
                <div className="space-y-3">
                  {openReports.slice(0, 6).map((report) => <ReportPreview key={report.id} report={report} />)}
                  {openReports.length === 0 && <EmptyState text="No open reports" />}
                </div>
              </Panel>
              <Panel title="Dashboard Summary">
                <SummaryGrid items={[
                  ['Flagged Listings', flaggedListings.length, 'text-orange-600'],
                  ['Expired or Disabled', expiredListings.length, 'text-stone-900'],
                  ['Flagged Users', flaggedUsers.length, 'text-yellow-600'],
                  ['Online Users', onlineUsers.length, 'text-green-600']
                ]} />
              </Panel>
            </div>
          )}

          {tab === 'listings' && (
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <FilterBar search={listingSearch} setSearch={setListingSearch} placeholder="Search active listings by title, seller, location, type..." />
              {filteredActiveListings.length === 0 ? <EmptyState text="No active listings found" /> : (
                <div className="divide-y divide-stone-100">
                  {filteredActiveListings.map((listing) => (
                    <ListingRow key={listing.id} listing={listing} onToggle={toggleListing} onDelete={deleteListing} onUnflag={unflagListing} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'reports' && (
            <div className="space-y-4">
              <div className="bg-white border border-stone-200 rounded-2xl p-4">
                <FilterBar search={reportSearch} setSearch={setReportSearch} placeholder="Search reports by target, reporter, reason..." noBorder />
              </div>
              {filteredReports.length === 0 ? <EmptyState text="No reports found" /> : filteredReports.map((report) => (
                <ReportRow key={report.id} report={report} onResolve={resolveReport} onReopen={reopenReport} />
              ))}
            </div>
          )}

          {tab === 'registeredUsers' && (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('all')}
                    className={`cursor-pointer font-semibold ${userRoleFilter === 'all' ? 'text-stone-900' : 'text-primary-700 hover:text-primary-800'}`}
                  >
                    All <span className="text-stone-400">({users.length})</span>
                  </button>
                  <span className="text-stone-300">|</span>
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('admin')}
                    className={`cursor-pointer font-semibold ${userRoleFilter === 'admin' ? 'text-stone-900' : 'text-primary-700 hover:text-primary-800'}`}
                  >
                    Administrators <span className="text-stone-400">({adminUsers.length})</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search users..."
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-primary-400 sm:w-72"
                  />
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg border border-primary-200 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
                  >
                    Search Users
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-stone-50 text-stone-700">
                    <tr className="border-b border-stone-200">
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Join Date</th>
                      <th className="px-4 py-3 font-semibold">Last Seen</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredUsers.map((user) => <UserRow key={user.uid} user={user} currentUserId={currentUser?.uid} />)}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && <EmptyState text="No registered users found" />}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const LoadingState = () => <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="animate-pulse bg-white rounded-xl border border-stone-200 h-20" />)}</div>;
const EmptyState: React.FC<{ text: string }> = ({ text }) => <div className="p-8 text-center text-sm text-stone-500">{text}</div>;
const Panel: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => <div className="bg-white rounded-2xl border border-stone-200 p-5"><div className="flex items-center justify-between mb-4"><h2 className="font-bold text-stone-900">{title}</h2>{action}</div>{children}</div>;
const SummaryGrid: React.FC<{ items: [string, number | string, string][] }> = ({ items }) => <div className="grid grid-cols-2 gap-3">{items.map(([label, value, color]) => <div key={label} className="bg-stone-50 rounded-xl p-4"><p className="text-xs text-stone-500">{label}</p><p className={`text-xl font-bold ${color}`}>{value}</p></div>)}</div>;
const FilterBar: React.FC<{ search: string; setSearch: (value: string) => void; placeholder: string; noBorder?: boolean }> = ({ search, setSearch, placeholder, noBorder }) => <div className={`${noBorder ? '' : 'p-4 border-b border-stone-200'}`}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:border-primary-400 focus:outline-none" /></div>;

const ListingPreview: React.FC<{ listing: Listing }> = ({ listing }) => {
  const image = normalizeImages(listing.images)[0];
  return <div className="flex items-center gap-3"><ImageBox image={image} /><div className="min-w-0"><Link to={`/listing/${listing.id}`} className="font-semibold text-stone-900 hover:text-primary-700 truncate block">{listing.title}</Link><p className="text-xs text-stone-500 truncate">{listing.userName} · {listing.location} · {getPriceLabel(listing)}</p></div></div>;
};

const ReportPreview: React.FC<{ report: Report }> = ({ report }) => <div><div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">{report.targetType}</span><p className="font-semibold text-stone-800 truncate">{report.targetName}</p></div><p className="text-xs text-stone-500 mt-1 truncate">{report.reason} · by {report.reporterName}</p></div>;
const ImageBox: React.FC<{ image?: string }> = ({ image }) => image ? <img src={image} alt="" className="w-14 h-14 rounded-lg object-cover bg-stone-100 shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-stone-100 flex items-center justify-center shrink-0"><i className="las la-book text-2xl text-stone-300" /></div>;

const ListingRow: React.FC<{ listing: Listing; onToggle: (listing: Listing) => void; onDelete: (listing: Listing) => void; onUnflag: (listing: Listing) => void }> = ({ listing, onToggle, onDelete, onUnflag }) => {
  const image = normalizeImages(listing.images)[0];
  return <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4"><ImageBox image={image} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><Link to={`/listing/${listing.id}`} className="font-bold text-stone-900 hover:text-primary-700 truncate">{listing.title}</Link>{listing.flagged && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">Flagged</span>}</div><p className="text-sm text-stone-500 mt-1 truncate">by {listing.author} · Listed by {listing.userName}</p><p className="text-xs text-stone-400 mt-1">{listing.location} · {listing.condition} · {getPriceLabel(listing)} · Expires {formatDateTime(listing.expiresAt)}</p></div><div className="flex items-center gap-2 shrink-0"><Link to={`/listing/${listing.id}`} className="px-3 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm font-semibold hover:bg-stone-50">View</Link>{listing.flagged && <button onClick={() => onUnflag(listing)} className="cursor-pointer px-3 py-2 rounded-lg border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50">Unflag</button>}<button onClick={() => onToggle(listing)} className="cursor-pointer px-3 py-2 rounded-lg border border-orange-200 text-orange-700 text-sm font-semibold hover:bg-orange-50">Disable</button><button onClick={() => onDelete(listing)} className="cursor-pointer px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50">Delete</button></div></div>;
};

const ReportRow: React.FC<{ report: Report; onResolve: (report: Report) => void; onReopen: (report: Report) => void }> = ({ report, onResolve, onReopen }) => <div className={`bg-white rounded-2xl p-4 border ${report.resolved ? 'border-stone-200 opacity-70' : 'border-red-200'}`}><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${report.resolved ? 'bg-stone-100 text-stone-500' : 'bg-red-50 text-red-600'}`}>{report.resolved ? 'Resolved' : 'Open'}</span><span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">{report.targetType}</span><h3 className="font-bold text-stone-900 truncate">{report.targetName}</h3></div><p className="text-sm text-stone-600 mt-2"><strong>Reason:</strong> {report.reason}</p>{report.details && <p className="text-sm text-stone-500 mt-1">{report.details}</p>}<p className="text-xs text-stone-400 mt-2">Reported by {report.reporterName} · {formatDateTime(report.createdAt)}</p></div><div className="flex items-center gap-2 shrink-0">{report.targetType === 'listing' && <Link to={`/listing/${report.targetId}`} className="px-3 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm font-semibold hover:bg-stone-50">View</Link>}{report.resolved ? <button onClick={() => onReopen(report)} className="cursor-pointer px-3 py-2 rounded-lg border border-orange-200 text-orange-700 text-sm font-semibold hover:bg-orange-50">Reopen</button> : <button onClick={() => onResolve(report)} className="cursor-pointer px-3 py-2 rounded-lg border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50">Resolve</button>}</div></div></div>;

const UserRow: React.FC<{ user: UserProfile; currentUserId?: string }> = ({ user, currentUserId }) => (
  <tr className={`${user.isAdmin ? 'bg-primary-50/35' : 'bg-white'} hover:bg-stone-50`}>
    <td className="whitespace-nowrap px-4 py-3 font-semibold text-stone-900">
      {user.displayName || 'Unnamed user'} {user.uid === currentUserId ? <span className="text-stone-500">(You)</span> : null}
    </td>
    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{user.email || 'No email'}</td>
    <td className="whitespace-nowrap px-4 py-3 text-stone-500">{formatDateTime(user.createdAt)}</td>
    <td className="whitespace-nowrap px-4 py-3 text-stone-500">{formatDateTime(user.lastSeen)}</td>
    <td className="whitespace-nowrap px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.isAdmin ? 'bg-primary-50 text-primary-700' : 'bg-stone-100 text-stone-600'}`}>
          {user.isAdmin ? 'Administrator' : 'User'}
        </span>
        {isUserOnline(user) && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">Online</span>}
        {user.deactivated && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">Banned</span>}
      </div>
    </td>
  </tr>
);

export default AdminUserDashboard;
