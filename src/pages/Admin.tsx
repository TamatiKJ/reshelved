import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Report, Listing, UserProfile } from '../types';
import { Link } from 'react-router-dom';

const Admin: React.FC = () => {
  const { userProfile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [flaggedListings, setFlaggedListings] = useState<Listing[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'reports' | 'listings' | 'users'>('reports');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (userProfile?.isAdmin) fetchData();
  }, [userProfile]);

  const fetchData = async () => {
    try {
      // Fetch reports
      const rq = query(collection(db, 'reports'), where('resolved', '==', false), orderBy('createdAt', 'desc'));
      const rSnap = await getDocs(rq);
      const reps: Report[] = [];
      rSnap.forEach(d => reps.push({ id: d.id, ...d.data() } as Report));
      setReports(reps);

      // Fetch flagged listings
      const lq = query(collection(db, 'listings'), where('flagged', '==', true));
      const lSnap = await getDocs(lq);
      const ls: Listing[] = [];
      lSnap.forEach(d => ls.push({ id: d.id, ...d.data() } as Listing));
      setFlaggedListings(ls);

      // Fetch flagged users
      const uq = query(collection(db, 'users'), where('flagged', '==', true));
      const uSnap = await getDocs(uq);
      const us: UserProfile[] = [];
      uSnap.forEach(d => us.push(d.data() as UserProfile));
      setFlaggedUsers(us);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { resolved: true });
      setReports(prev => prev.filter(r => r.id !== reportId));
      setMessage('Report resolved');
    } catch (err) {
      console.error(err);
    }
  };

  const deleteListing = async (listingId: string) => {
    if (!confirm('Delete this listing permanently?')) return;
    try {
      await deleteDoc(doc(db, 'listings', listingId));
      setFlaggedListings(prev => prev.filter(l => l.id !== listingId));
      setMessage('Listing deleted');
    } catch (err) {
      console.error(err);
    }
  };

  const unflagListing = async (listingId: string) => {
    try {
      await updateDoc(doc(db, 'listings', listingId), { flagged: false, flagCount: 0 });
      setFlaggedListings(prev => prev.filter(l => l.id !== listingId));
      setMessage('Listing unflagged');
    } catch (err) {
      console.error(err);
    }
  };

  const unflagUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { flagged: false, flagCount: 0 });
      setFlaggedUsers(prev => prev.filter(u => u.uid !== userId));
      setMessage('User unflagged');
    } catch (err) {
      console.error(err);
    }
  };

  if (!userProfile?.isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-stone-700">Access Denied</h2>
        <p className="text-stone-500 mt-2">You don't have admin privileges.</p>
        <Link to="/" className="mt-4 inline-block text-primary-600 font-medium">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Admin Dashboard</h1>
          <p className="text-stone-500 mt-1">Manage reports, flagged listings, and users</p>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-primary-50 border border-primary-200 text-primary-700 rounded-xl text-sm flex items-center justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-primary-500 hover:text-primary-700">✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{reports.length}</div>
          <div className="text-sm text-stone-500">Open Reports</div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
          <div className="text-2xl font-bold text-accent-600">{flaggedListings.length}</div>
          <div className="text-sm text-stone-500">Flagged Listings</div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{flaggedUsers.length}</div>
          <div className="text-sm text-stone-500">Flagged Users</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6">
        {[
          { key: 'reports', label: `Reports (${reports.length})` },
          { key: 'listings', label: `Listings (${flaggedListings.length})` },
          { key: 'users', label: `Users (${flaggedUsers.length})` }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-stone-200 p-4">
              <div className="h-4 bg-stone-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-stone-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Reports Tab */}
          {tab === 'reports' && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-stone-200">
                  <p className="text-stone-500">No open reports 🎉</p>
                </div>
              ) : (
                reports.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-stone-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.targetType === 'listing' ? 'bg-accent-100 text-accent-700' : 'bg-red-100 text-red-700'}`}>
                            {r.targetType}
                          </span>
                          <span className="font-medium text-stone-800">{r.targetName}</span>
                        </div>
                        <p className="text-sm text-stone-600 mt-1">Reason: {r.reason}</p>
                        {r.details && <p className="text-sm text-stone-500 mt-1">{r.details}</p>}
                        <p className="text-xs text-stone-400 mt-2">Reported by {r.reporterName} on {new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        {r.targetType === 'listing' && (
                          <Link to={`/listing/${r.targetId}`} className="text-sm text-primary-600 hover:text-primary-700 font-medium">View</Link>
                        )}
                        <button onClick={() => resolveReport(r.id)} className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-200 transition">
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Flagged Listings Tab */}
          {tab === 'listings' && (
            <div className="space-y-3">
              {flaggedListings.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-stone-200">
                  <p className="text-stone-500">No flagged listings</p>
                </div>
              ) : (
                flaggedListings.map(l => (
                  <div key={l.id} className="bg-white rounded-xl border border-stone-200 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {l.images?.[0] && (
                          <img src={l.images[0]} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                        )}
                        <div>
                          <Link to={`/listing/${l.id}`} className="font-medium text-stone-800 hover:text-primary-700">{l.title}</Link>
                          <p className="text-sm text-stone-500">by {l.author} — Listed by {l.userName}</p>
                          <p className="text-xs text-red-500 mt-1">⚑ {l.flagCount} flag{l.flagCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <button onClick={() => unflagListing(l.id)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition">
                          Unflag
                        </button>
                        <button onClick={() => deleteListing(l.id)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Flagged Users Tab */}
          {tab === 'users' && (
            <div className="space-y-3">
              {flaggedUsers.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-stone-200">
                  <p className="text-stone-500">No flagged users</p>
                </div>
              ) : (
                flaggedUsers.map(u => (
                  <div key={u.uid} className="bg-white rounded-xl border border-stone-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-semibold">
                          {u.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <span className="font-medium text-stone-800">{u.displayName}</span>
                          <p className="text-sm text-stone-500">{u.email}</p>
                          <p className="text-xs text-red-500 mt-0.5">⚑ {u.flagCount} flag{u.flagCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => unflagUser(u.uid)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition">
                          Unflag
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Admin;
