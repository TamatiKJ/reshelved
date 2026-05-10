import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import type { UserProfile, Listing, Rating } from '../types';
import { KENYAN_CITIES } from '../types';

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const targetUserId = userId || currentUser?.uid;
  const isOwnProfile = !userId || userId === currentUser?.uid;

  useEffect(() => {
    if (targetUserId) fetchData();
  }, [targetUserId, currentUser?.uid]);

  const createFallbackProfile = async (): Promise<UserProfile | null> => {
    if (!currentUser || !isOwnProfile) return null;
    const fallback: UserProfile = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Reshelved User',
      email: currentUser.email || '',
      photoURL: currentUser.photoURL || '',
      bio: '',
      location: 'Lavington',
      phone: '',
      isAdmin: userProfile?.isAdmin || false,
      flagged: false,
      flagCount: 0,
      createdAt: Date.now()
    };
    await setDoc(doc(db, 'users', currentUser.uid), fallback, { merge: true });
    return fallback;
  };

  const fetchData = async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', targetUserId));
      let p: UserProfile | null = null;

      if (snap.exists()) {
        p = snap.data() as UserProfile;
      } else {
        p = await createFallbackProfile();
      }

      if (p) {
        setProfile(p);
        setEditName(p.displayName || '');
        setEditBio(p.bio || '');
        setEditLocation(p.location || 'Lavington');
        setEditPhone(p.phone || '');
      } else {
        setProfile(null);
      }

      const lq = query(collection(db, 'listings'), where('userId', '==', targetUserId));
      const lSnap = await getDocs(lq);
      const ls: Listing[] = [];
      lSnap.forEach(d => ls.push({ id: d.id, ...d.data() } as Listing));
      ls.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setListings(ls);

      const rq = query(collection(db, 'ratings'), where('toUserId', '==', targetUserId));
      const rSnap = await getDocs(rq).catch(() => null);
      const rs: Rating[] = [];
      rSnap?.forEach(d => rs.push({ id: d.id, ...d.data() } as Rating));
      rs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRatings(rs);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: editName,
        bio: editBio,
        location: editLocation,
        phone: editPhone
      });
      setEditing(false);
      await refreshProfile();
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
  const activeListings = listings.filter(l => l.active && l.expiresAt > Date.now());
  const expiredListings = listings.filter(l => !l.active || l.expiresAt <= Date.now());

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-stone-200 rounded-full" />
            <div className="space-y-2">
              <div className="h-6 bg-stone-200 rounded w-40" />
              <div className="h-4 bg-stone-100 rounded w-24" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-stone-700">User not found</h2>
        <p className="text-stone-500 mt-2">This profile does not exist or you do not have permission to view it.</p>
        <Link to="/browse" className="mt-4 inline-block text-primary-600 font-medium">Back to Browse</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt={profile.displayName} className="w-20 h-20 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-3xl font-bold shrink-0">
              {profile.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-stone-200 text-sm" placeholder="Display Name" />
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-stone-200 text-sm resize-none" rows={2} placeholder="About you..." />
                <select value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-stone-200 text-sm bg-white">
                  {KENYAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-stone-200 text-sm" placeholder="Phone number" />
                <div className="flex gap-2">
                  <button onClick={handleSaveProfile} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">Save</button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 border border-stone-200 rounded-lg text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-stone-800">{profile.displayName}</h1>
                  {isOwnProfile && <button onClick={() => setEditing(true)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</button>}
                </div>
                {profile.bio && <p className="text-stone-600 mt-1">{profile.bio}</p>}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-stone-500">
                  {profile.location && <span className="flex items-center gap-1"><i className="las la-map-marker text-base" />{profile.location}</span>}
                  <span className="flex items-center gap-1"><i className="las la-calendar text-base" />Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  {ratings.length > 0 && <span className="flex items-center gap-1"><span className="text-accent-500">★</span>{avgRating.toFixed(1)} ({ratings.length} review{ratings.length !== 1 ? 's' : ''})</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-stone-800 mb-4">{isOwnProfile ? 'My' : `${profile.displayName}'s`} Active Listings ({activeListings.length})</h2>
        {activeListings.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-stone-200">
            <p className="text-stone-500">No active listings</p>
            {isOwnProfile && <Link to="/create" className="mt-2 inline-block text-primary-600 font-medium text-sm">List a book</Link>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">{activeListings.map(l => <BookCard key={l.id} listing={l} />)}</div>
        )}
      </div>

      {isOwnProfile && expiredListings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-stone-800 mb-4">Expired Listings ({expiredListings.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">{expiredListings.map(l => <BookCard key={l.id} listing={l} />)}</div>
        </div>
      )}

      {ratings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-stone-800 mb-4">Reviews ({ratings.length})</h2>
          <div className="space-y-3">
            {ratings.map(r => (
              <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-4">
                <div className="flex items-center justify-between"><span className="font-medium text-stone-700">{r.fromUserName}</span><span className="text-accent-500 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span></div>
                {r.review && <p className="text-sm text-stone-600 mt-1">{r.review}</p>}
                <p className="text-xs text-stone-400 mt-2">{new Date(r.createdAt).toLocaleDateString()} — Re: {r.listingTitle}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
