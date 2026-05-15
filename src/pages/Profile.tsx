import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import type { UserProfile, Listing, Rating } from '../types';
import { KENYAN_CITIES } from '../types';

const resizeProfilePhoto = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      const size = 400;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Image processing is not supported in this browser.'));
        return;
      }
      const shortestSide = Math.min(img.width, img.height);
      const sourceX = (img.width - shortestSide) / 2;
      const sourceY = (img.height - shortestSide) / 2;
      ctx.drawImage(img, sourceX, sourceY, shortestSide, shortestSide, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Could not compress image.'));
          return;
        }
        resolve(blob);
      }, 'image/webp', 0.82);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image file.'));
    };
    img.src = objectUrl;
  });
};

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookmarkedListings, setBookmarkedListings] = useState<Listing[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const targetUserId = userId || currentUser?.uid;
  const isOwnProfile = !userId || userId === currentUser?.uid;

  useEffect(() => { if (targetUserId) fetchData(); }, [targetUserId, currentUser?.uid, userProfile?.bookmarks?.join('|')]);
  useEffect(() => { if (!saveMessage) return; const timer = window.setTimeout(() => setSaveMessage(''), 3000); return () => window.clearTimeout(timer); }, [saveMessage]);

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
      bookmarks: [],
      isAdmin: userProfile?.isAdmin || false,
      flagged: false,
      flagCount: 0,
      createdAt: Date.now(),
      online: true,
      lastSeen: Date.now(),
      deactivated: false
    };
    await setDoc(doc(db, 'users', currentUser.uid), fallback, { merge: true });
    return fallback;
  };

  const syncUserDisplayData = async (updates: { displayName?: string; photoURL?: string }) => {
    if (!currentUser) return;
    const listingSnap = await getDocs(query(collection(db, 'listings'), where('userId', '==', currentUser.uid)));
    await Promise.all(listingSnap.docs.map((item) => updateDoc(doc(db, 'listings', item.id), {
      ...(updates.displayName ? { userName: updates.displayName } : {}),
      ...(updates.photoURL !== undefined ? { userPhoto: updates.photoURL } : {})
    })));
    const conversationSnap = await getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid)));
    await Promise.all(conversationSnap.docs.map((item) => updateDoc(doc(db, 'conversations', item.id), {
      ...(updates.displayName ? { [`participantNames.${currentUser.uid}`]: updates.displayName } : {}),
      ...(updates.photoURL !== undefined ? { [`participantPhotos.${currentUser.uid}`]: updates.photoURL } : {})
    })));
  };

  const fetchData = async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', targetUserId));
      let p: UserProfile | null = null;
      if (snap.exists()) p = { uid: targetUserId, ...snap.data() } as UserProfile;
      else p = await createFallbackProfile();
      if (p) {
        setProfile(p);
        setEditName(p.displayName || '');
        setEditBio(p.bio || '');
        setEditLocation(p.location || 'Lavington');
        setEditPhone(p.phone || '');
      } else setProfile(null);

      const lSnap = await getDocs(query(collection(db, 'listings'), where('userId', '==', targetUserId)));
      const ls: Listing[] = [];
      lSnap.forEach(d => ls.push({ id: d.id, ...d.data() } as Listing));
      ls.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setListings(ls);

      if (isOwnProfile && p?.bookmarks?.length) {
        const bookmarkedIds = new Set(p.bookmarks);
        const allSnap = await getDocs(collection(db, 'listings'));
        const bookmarked: Listing[] = [];
        allSnap.forEach(d => { if (bookmarkedIds.has(d.id)) bookmarked.push({ id: d.id, ...d.data() } as Listing); });
        bookmarked.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setBookmarkedListings(bookmarked.filter(l => l.active && l.expiresAt > Date.now()));
      } else setBookmarkedListings([]);

      const rSnap = await getDocs(query(collection(db, 'ratings'), where('toUserId', '==', targetUserId))).catch(() => null);
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

  const handleMessageUser = async () => {
    if (!currentUser || !profile || !targetUserId || isOwnProfile || messageLoading) return;
    setMessageLoading(true);
    setSaveError('');
    try {
      const q = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid));
      const snap = await getDocs(q);
      let existingConvId: string | null = null;
      snap.forEach((item) => {
        const data = item.data();
        if (!data.listingId && Array.isArray(data.participants) && data.participants.includes(targetUserId)) existingConvId = item.id;
      });
      if (existingConvId) {
        navigate(`/messages/${existingConvId}`);
        return;
      }
      const now = Date.now();
      const senderName = userProfile?.displayName || currentUser.displayName || 'User';
      const recipientName = profile.displayName || 'User';
      const initialMessage = `Hi ${recipientName}, I saw your profile on Reshelved.`;
      const convRef = await addDoc(collection(db, 'conversations'), {
        participants: [currentUser.uid, targetUserId],
        buyerId: currentUser.uid,
        sellerId: targetUserId,
        participantNames: { [currentUser.uid]: senderName, [targetUserId]: recipientName },
        participantPhotos: { [currentUser.uid]: userProfile?.photoURL || currentUser.photoURL || '', [targetUserId]: profile.photoURL || '' },
        listingId: '',
        listingTitle: `Profile message to ${recipientName}`,
        lastMessage: initialMessage,
        lastMessageAt: now,
        updatedAt: now,
        createdAt: now
      });
      await addDoc(collection(db, 'messages'), { conversationId: convRef.id, senderId: currentUser.uid, senderName, recipientId: targetUserId, text: initialMessage, createdAt: now });
      await addDoc(collection(db, 'notifications'), { userId: targetUserId, fromUserId: currentUser.uid, fromUserName: senderName, fromAdmin: false, type: 'message', subject: `New message from ${senderName}`, message: initialMessage, conversationId: convRef.id, createdAt: now, read: false });
      navigate(`/messages/${convRef.id}`);
    } catch (err) {
      console.error('Error starting profile message:', err);
      setSaveError('Could not start the message. Check your Firestore rules.');
    } finally {
      setMessageLoading(false);
    }
  };

  const saveProfileUpdates = async () => {
    if (!currentUser) return null;
    const cleanName = editName.trim();
    if (!cleanName) throw new Error('Display name cannot be empty.');
    const profileUpdates: Partial<UserProfile> = { displayName: cleanName, email: currentUser.email || profile?.email || '', bio: editBio.trim(), location: editLocation || profile?.location || 'Lavington', phone: editPhone.trim(), lastSeen: Date.now() };
    await setDoc(doc(db, 'users', currentUser.uid), profileUpdates, { merge: true });
    await updateProfile(currentUser, { displayName: cleanName }).catch((err) => console.error('Auth profile update failed:', err));
    await syncUserDisplayData({ displayName: cleanName });
    setProfile((current) => current ? { ...current, ...profileUpdates } as UserProfile : null);
    setListings((current) => current.map((listing) => ({ ...listing, userName: cleanName })));
    await refreshProfile();
    return profileUpdates;
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      await saveProfileUpdates();
      setEditing(false);
      setSaveMessage('Profile saved.');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setSaveError(err?.message || 'Profile failed to save. Check your Firestore rules and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !currentUser || !isOwnProfile) return;
    if (!file.type.startsWith('image/')) {
      setSaveError('Please upload an image file.');
      return;
    }
    setUploadingPhoto(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const compressed = await resizeProfilePhoto(file);
      const photoRef = ref(storage, `users/${currentUser.uid}/profile-photo.webp`);
      await uploadBytes(photoRef, compressed, { contentType: 'image/webp' });
      const photoURL = await getDownloadURL(photoRef);
      await setDoc(doc(db, 'users', currentUser.uid), { photoURL, lastSeen: Date.now() }, { merge: true });
      await updateProfile(currentUser, { photoURL }).catch((err) => console.error('Auth profile photo update failed:', err));
      await syncUserDisplayData({ photoURL });
      setProfile((current) => current ? { ...current, photoURL, lastSeen: Date.now() } : current);
      setListings((current) => current.map((listing) => ({ ...listing, userPhoto: photoURL })));
      setBookmarkedListings((current) => current.map((listing) => listing.userId === currentUser.uid ? { ...listing, userPhoto: photoURL } : listing));
      await refreshProfile();
      setSaveMessage('Profile photo uploaded and saved.');
    } catch (err: any) {
      console.error('Error uploading profile photo:', err);
      setSaveError(err?.message || 'Profile photo failed to upload. Check your Storage rules and try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
  const activeListings = listings.filter(l => l.active && l.expiresAt > Date.now());
  const expiredListings = listings.filter(l => !l.active || l.expiresAt <= Date.now());

  if (loading) return <div className="max-w-[996px] mx-auto px-4 py-8 pb-10 sm:pb-20"><div className="animate-pulse space-y-4"><div className="flex items-center gap-4"><div className="w-20 h-20 bg-stone-200 rounded-full" /><div className="space-y-2"><div className="h-6 bg-stone-200 rounded w-40" /><div className="h-4 bg-stone-100 rounded w-24" /></div></div></div></div>;
  if (!profile) return <div className="max-w-[996px] mx-auto px-4 py-16 text-center pb-10 sm:pb-20"><h2 className="text-xl font-bold text-stone-700">User not found</h2><p className="text-stone-500 mt-2">This profile does not exist or you do not have permission to view it.</p><Link to="/browse" className="mt-4 inline-block text-primary-600 font-medium">Back to Browse</Link></div>;

  return (
    <div className="max-w-[996px] mx-auto px-4 sm:px-6 py-8 pb-10 sm:pb-20">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8">
        {saveMessage && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{saveMessage}</div>}
        {saveError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{saveError}</div>}
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="shrink-0">{profile.photoURL ? <img src={profile.photoURL} alt={profile.displayName} className="w-20 h-20 rounded-full object-cover shrink-0" /> : <div className="w-20 h-20 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-3xl font-bold shrink-0">{profile.displayName?.[0]?.toUpperCase() || 'U'}</div>}{isOwnProfile && <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}<input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} className="hidden" /></label>}</div>
          <div className="flex-1 min-w-0">
            {editing ? <div className="space-y-3"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-stone-200 text-sm" placeholder="Display Name" /><textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-stone-200 text-sm resize-none" rows={2} placeholder="About you..." /><select value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-stone-200 text-sm bg-white">{KENYAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-stone-200 text-sm" placeholder="Phone number" /><div className="flex gap-2"><button onClick={handleSaveProfile} disabled={saving} className="cursor-pointer px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button><button onClick={() => setEditing(false)} disabled={saving} className="cursor-pointer px-4 py-2 border border-stone-200 rounded-lg text-sm disabled:cursor-not-allowed disabled:opacity-60">Cancel</button></div></div> : <><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-stone-800">{profile.displayName}</h1>{isOwnProfile && <button onClick={() => { setSaveMessage(''); setSaveError(''); setEditing(true); }} className="cursor-pointer text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</button>}</div>{profile.bio && <p className="text-stone-600 mt-1">{profile.bio}</p>}</div>{!isOwnProfile && currentUser && <button onClick={handleMessageUser} disabled={messageLoading} className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"><i className="las la-comment text-lg" />{messageLoading ? 'Opening...' : 'Message'}</button>}</div><div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-stone-500">{profile.location && <span className="flex items-center gap-1"><i className="las la-map-marker text-base" />{profile.location}</span>}<span className="flex items-center gap-1"><i className="las la-calendar text-base" />Joined {new Date(profile.createdAt).toLocaleDateString()}</span>{ratings.length > 0 && <span className="flex items-center gap-1"><span className="text-accent-500">★</span>{avgRating.toFixed(1)} ({ratings.length} review{ratings.length !== 1 ? 's' : ''})</span>}</div></>}
          </div>
        </div>
      </div>
      {isOwnProfile && <div className="mt-8"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-stone-800">Bookmarked Books ({bookmarkedListings.length})</h2><Link to="/browse" className="text-sm font-semibold text-primary-600 hover:text-primary-700">Browse books</Link></div>{bookmarkedListings.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border border-stone-200"><p className="text-stone-500">No bookmarked books yet</p><Link to="/browse" className="mt-2 inline-block text-primary-600 font-medium text-sm">Find books to save</Link></div> : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">{bookmarkedListings.map(l => <BookCard key={l.id} listing={l} />)}</div>}</div>}
      <div className="mt-8"><h2 className="text-lg font-bold text-stone-800 mb-4">{isOwnProfile ? 'My' : `${profile.displayName}'s`} Active Listings ({activeListings.length})</h2>{activeListings.length === 0 ? <div className="text-center py-8 bg-white rounded-xl border border-stone-200"><p className="text-stone-500">No active listings</p>{isOwnProfile && <Link to="/create" className="mt-2 inline-block cursor-pointer text-primary-600 font-medium text-sm">List a book</Link>}</div> : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">{activeListings.map(l => <BookCard key={l.id} listing={l} />)}</div>}</div>
      {isOwnProfile && expiredListings.length > 0 && <div className="mt-8"><h2 className="text-lg font-bold text-stone-800 mb-4">Expired Listings ({expiredListings.length})</h2><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">{expiredListings.map(l => <BookCard key={l.id} listing={l} />)}</div></div>}
      {ratings.length > 0 && <div className="mt-8"><h2 className="text-lg font-bold text-stone-800 mb-4">Reviews ({ratings.length})</h2><div className="space-y-3">{ratings.map(r => <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-4"><div className="flex items-center justify-between"><span className="font-medium text-stone-700">{r.fromUserName}</span><span className="text-accent-500 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span></div>{r.review && <p className="text-sm text-stone-600 mt-1">{r.review}</p>}<p className="text-xs text-stone-400 mt-2">{new Date(r.createdAt).toLocaleDateString()} — Re: {r.listingTitle}</p></div>)}</div></div>}
    </div>
  );
};

export default Profile;
