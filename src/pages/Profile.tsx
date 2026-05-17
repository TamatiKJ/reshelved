import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { addDoc, arrayRemove, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile, verifyBeforeUpdateEmail } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import type { UserProfile, Listing, Rating } from '../types';
import { KENYAN_CITIES } from '../types';

const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const DEFAULT_RENEW_DAYS = 10;
const getConversationKey = (a: string, b: string) => [a, b].sort().join('_');
type ProfileTab = 'profile' | 'settings' | 'active' | 'expired' | 'bookmarks';

const PasswordField: React.FC<{ value: string; onChange: (value: string) => void; placeholder?: string; autoComplete: string }> = ({ value, onChange, placeholder, autoComplete }) => {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><input type={visible ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} pr-10`} placeholder={placeholder} autoComplete={autoComplete} /><button type="button" onClick={() => setVisible(v => !v)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-stone-500 hover:bg-stone-100" aria-label={visible ? 'Hide password' : 'Show password'}><i className={`las ${visible ? 'la-eye-slash' : 'la-eye'} text-xl`} /></button></div>;
};

const resizeProfilePhoto = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(objectUrl);
    const canvas = document.createElement('canvas');
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Image processing is not supported in this browser.'));
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not compress image.')), 'image/webp', 0.82);
  };
  img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Invalid image file.')); };
  img.src = objectUrl;
});

const SectionTitle: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div><h2 className="text-xl font-bold text-stone-950">{title}</h2>{subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}</div>
    {action}
  </div>
);

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookmarkedListings, setBookmarkedListings] = useState<Listing[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('active');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [renewingId, setRenewingId] = useState('');

  const targetUserId = userId || currentUser?.uid;
  const isOwnProfile = !userId || userId === currentUser?.uid;
  const activeListings = useMemo(() => listings.filter(l => l.active && l.expiresAt > Date.now()), [listings]);
  const expiredListings = useMemo(() => listings.filter(l => !l.active || l.expiresAt <= Date.now()), [listings]);
  const avgRating = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;

  useEffect(() => { if (!isOwnProfile) setActiveTab('active'); }, [isOwnProfile]);
  useEffect(() => { if (targetUserId) fetchData(); }, [targetUserId, currentUser?.uid, userProfile?.bookmarks?.join('|')]);
  useEffect(() => { if (!saveMessage) return; const timer = window.setTimeout(() => setSaveMessage(''), 5000); return () => window.clearTimeout(timer); }, [saveMessage]);
  useEffect(() => { setNewEmail(currentUser?.email || profile?.email || ''); }, [currentUser?.email, profile?.email]);

  const createFallbackProfile = async (): Promise<UserProfile | null> => {
    if (!currentUser || !isOwnProfile) return null;
    const fallback: UserProfile = { uid: currentUser.uid, displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Reshelved User', email: currentUser.email || '', photoURL: currentUser.photoURL || '', bio: '', location: 'Lavington', phone: '', bookmarks: [], isAdmin: userProfile?.isAdmin || false, flagged: false, flagCount: 0, createdAt: Date.now(), online: true, lastSeen: Date.now(), deactivated: false };
    await setDoc(doc(db, 'users', currentUser.uid), fallback, { merge: true });
    await setDoc(doc(db, 'publicProfiles', currentUser.uid), { uid: currentUser.uid, displayName: fallback.displayName, photoURL: fallback.photoURL, location: fallback.location, ratingAverage: 0, ratingCount: 0, updatedAt: Date.now() }, { merge: true }).catch(() => undefined);
    return fallback;
  };

  const syncPublicProfile = async (profileData: Partial<UserProfile> = {}) => {
    if (!currentUser) return;
    await setDoc(doc(db, 'publicProfiles', currentUser.uid), { uid: currentUser.uid, displayName: profileData.displayName || profile?.displayName || userProfile?.displayName || currentUser.displayName || 'Reshelved User', photoURL: profileData.photoURL || profile?.photoURL || userProfile?.photoURL || currentUser.photoURL || '', location: profileData.location || profile?.location || userProfile?.location || '', ratingAverage: avgRating, ratingCount: ratings.length, updatedAt: Date.now() }, { merge: true }).catch(() => undefined);
  };

  const syncUserDisplayData = async (updates: { displayName?: string; photoURL?: string; location?: string }) => {
    if (!currentUser) return;
    const listingSnap = await getDocs(query(collection(db, 'listings'), where('userId', '==', currentUser.uid)));
    await Promise.all(listingSnap.docs.map(item => updateDoc(doc(db, 'listings', item.id), { ...(updates.displayName ? { userName: updates.displayName } : {}), ...(updates.photoURL !== undefined ? { userPhoto: updates.photoURL } : {}) })));
    const conversationSnap = await getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid))).catch(() => null);
    await Promise.all((conversationSnap?.docs || []).map(item => updateDoc(doc(db, 'conversations', item.id), { ...(updates.displayName ? { [`participantNames.${currentUser.uid}`]: updates.displayName } : {}), ...(updates.photoURL !== undefined ? { [`participantPhotos.${currentUser.uid}`]: updates.photoURL } : {}) })));
    await syncPublicProfile({ displayName: updates.displayName, photoURL: updates.photoURL, location: updates.location });
  };

  const fetchData = async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', targetUserId)).catch(() => null);
      let p: UserProfile | null = null;
      if (snap?.exists()) p = { uid: targetUserId, ...snap.data() } as UserProfile;
      else {
        const publicSnap = await getDoc(doc(db, 'publicProfiles', targetUserId)).catch(() => null);
        if (publicSnap?.exists()) p = { uid: targetUserId, email: '', bio: '', phone: '', bookmarks: [], isAdmin: false, flagged: false, flagCount: 0, createdAt: Date.now(), online: false, lastSeen: 0, deactivated: false, ...publicSnap.data() } as UserProfile;
        else p = await createFallbackProfile();
      }
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
        const ids = new Set(p.bookmarks);
        const allSnap = await getDocs(collection(db, 'listings'));
        const bookmarked: Listing[] = [];
        allSnap.forEach(d => { if (ids.has(d.id)) bookmarked.push({ id: d.id, ...d.data() } as Listing); });
        bookmarked.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setBookmarkedListings(bookmarked.filter(l => l.active && l.expiresAt > Date.now()));
      } else setBookmarkedListings([]);

      const rSnap = await getDocs(query(collection(db, 'ratings'), where('toUserId', '==', targetUserId))).catch(() => null);
      const rs: Rating[] = [];
      rSnap?.forEach(d => rs.push({ id: d.id, ...d.data() } as Rating));
      rs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRatings(rs);
    } catch (err) { console.error('Error loading profile:', err); }
    finally { setLoading(false); }
  };

  const reauthenticate = async (password: string) => {
    if (!currentUser?.email) throw new Error('Your account does not have an email address attached.');
    if (!password) throw new Error('Enter your current password first.');
    await reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email, password));
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    const cleanName = editName.trim();
    if (!cleanName) return setSaveError('Display name cannot be empty.');
    setSaving(true); setSaveError(''); setSaveMessage('');
    try {
      const updates: Partial<UserProfile> = { displayName: cleanName, email: currentUser.email || profile?.email || '', bio: editBio.trim(), location: editLocation || profile?.location || 'Lavington', phone: editPhone.trim(), lastSeen: Date.now() };
      await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
      await updateProfile(currentUser, { displayName: cleanName }).catch(() => undefined);
      await syncUserDisplayData({ displayName: cleanName, location: editLocation });
      setProfile(current => current ? { ...current, ...updates } as UserProfile : null);
      setListings(current => current.map(listing => ({ ...listing, userName: cleanName })));
      await refreshProfile();
      setSaveMessage('Profile saved.');
    } catch (err: any) { setSaveError(err?.message || 'Profile failed to save.'); }
    finally { setSaving(false); }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !currentUser || !isOwnProfile) return;
    if (!file.type.startsWith('image/')) return setSaveError('Please upload an image file.');
    setUploadingPhoto(true); setSaveError(''); setSaveMessage('');
    try {
      const compressed = await resizeProfilePhoto(file);
      const photoRef = ref(storage, `users/${currentUser.uid}/profile-photo.webp`);
      await uploadBytes(photoRef, compressed, { contentType: 'image/webp' });
      const photoURL = await getDownloadURL(photoRef);
      await setDoc(doc(db, 'users', currentUser.uid), { photoURL, lastSeen: Date.now() }, { merge: true });
      await updateProfile(currentUser, { photoURL }).catch(() => undefined);
      await syncUserDisplayData({ photoURL });
      setProfile(current => current ? { ...current, photoURL, lastSeen: Date.now() } : current);
      setListings(current => current.map(listing => ({ ...listing, userPhoto: photoURL })));
      setBookmarkedListings(current => current.map(listing => listing.userId === currentUser.uid ? { ...listing, userPhoto: photoURL } : listing));
      await refreshProfile();
      setSaveMessage('Profile photo uploaded and saved.');
    } catch (err: any) { setSaveError(err?.message || 'Profile photo failed to upload.'); }
    finally { setUploadingPhoto(false); }
  };

  const handleChangeEmail = async () => {
    if (!currentUser) return;
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || cleanEmail === currentUser.email) return setSaveError('Enter a new email address first.');
    setAccountLoading(true); setSaveError(''); setSaveMessage('');
    try { await reauthenticate(emailPassword); await verifyBeforeUpdateEmail(currentUser, cleanEmail); setEmailPassword(''); setSaveMessage(`Confirmation email sent to ${cleanEmail}.`); }
    catch (err: any) { setSaveError(err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential' ? 'Current password is incorrect.' : err?.message || 'Email change failed.'); }
    finally { setAccountLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!currentUser) return;
    if (newPassword.length < 6) return setSaveError('New password must be at least 6 characters.');
    if (newPassword !== confirmNewPassword) return setSaveError('New passwords do not match.');
    setAccountLoading(true); setSaveError(''); setSaveMessage('');
    try { await reauthenticate(currentPassword); await updatePassword(currentUser, newPassword); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setSaveMessage('Password updated successfully.'); }
    catch (err: any) { setSaveError(err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential' ? 'Current password is incorrect.' : err?.message || 'Password update failed.'); }
    finally { setAccountLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    if (!window.confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    setAccountLoading(true); setSaveError(''); setSaveMessage('');
    try {
      await reauthenticate(deletePassword);
      const [listingSnap, conversationSnap] = await Promise.all([getDocs(query(collection(db, 'listings'), where('userId', '==', currentUser.uid))), getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid))).catch(() => null)]);
      await Promise.all([...listingSnap.docs.map(item => updateDoc(doc(db, 'listings', item.id), { active: false, deactivatedOwner: true })), ...(conversationSnap?.docs || []).map(item => updateDoc(doc(db, 'conversations', item.id), { [`participantNames.${currentUser.uid}`]: 'Deleted account', [`participantPhotos.${currentUser.uid}`]: '' })), setDoc(doc(db, 'users', currentUser.uid), { deactivated: true, deletedAt: Date.now(), online: false, displayName: 'Deleted account', photoURL: '', bio: '', phone: '' }, { merge: true }), setDoc(doc(db, 'publicProfiles', currentUser.uid), { displayName: 'Deleted account', photoURL: '', location: '', deleted: true, updatedAt: Date.now() }, { merge: true })]);
      await deleteUser(currentUser); navigate('/');
    } catch (err: any) { setSaveError(err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential' ? 'Current password is incorrect.' : err?.message || 'Account deletion failed.'); }
    finally { setAccountLoading(false); }
  };

  const handleRenewListing = async (listing: Listing) => {
    setRenewingId(listing.id); setSaveError(''); setSaveMessage('');
    try {
      const settingsSnap = await getDoc(doc(db, 'platform', 'settings')).catch(() => null);
      const days = Number(settingsSnap?.exists() ? settingsSnap.data().listingDays : DEFAULT_RENEW_DAYS) || DEFAULT_RENEW_DAYS;
      const expiresAt = Date.now() + Math.min(Math.max(days, 1), 45) * 24 * 60 * 60 * 1000;
      await updateDoc(doc(db, 'listings', listing.id), { active: true, expiresAt, renewedAt: Date.now() });
      setListings(current => current.map(item => item.id === listing.id ? { ...item, active: true, expiresAt } : item));
      setSaveMessage('Listing renewed successfully.');
    } catch (err: any) { setSaveError(err?.message || 'Could not renew listing.'); }
    finally { setRenewingId(''); }
  };

  const handleMessageUser = async () => {
    if (!currentUser || !profile || !targetUserId || isOwnProfile || messageLoading) return;
    setMessageLoading(true); setSaveError('');
    try {
      const conversationKey = getConversationKey(currentUser.uid, targetUserId);
      const snap = await getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid)));
      let existingConvId: string | null = null;
      snap.forEach(item => { const data = item.data(); if (Array.isArray(data.participants) && data.participants.includes(targetUserId)) existingConvId = item.id; });
      if (existingConvId) return navigate(`/messages/${existingConvId}`);
      const now = Date.now();
      const senderName = userProfile?.displayName || currentUser.displayName || 'User';
      const recipientName = profile.displayName || 'User';
      const initialMessage = `Hi ${recipientName}, I saw your profile on Reshelved.`;
      const convRef = await addDoc(collection(db, 'conversations'), { participants: [currentUser.uid, targetUserId], conversationKey, buyerId: currentUser.uid, sellerId: targetUserId, participantNames: { [currentUser.uid]: senderName, [targetUserId]: recipientName }, participantPhotos: { [currentUser.uid]: userProfile?.photoURL || currentUser.photoURL || '', [targetUserId]: profile.photoURL || '' }, listingId: '', listingTitle: `Profile message to ${recipientName}`, lastMessage: initialMessage, lastMessageAt: now, updatedAt: now, createdAt: now });
      await addDoc(collection(db, 'messages'), { conversationId: convRef.id, senderId: currentUser.uid, senderName, recipientId: targetUserId, text: initialMessage, type: 'text', readBy: [currentUser.uid], createdAt: now });
      await addDoc(collection(db, 'notifications'), { userId: targetUserId, fromUserId: currentUser.uid, fromUserName: senderName, fromAdmin: false, type: 'message', subject: `New message from ${senderName}`, message: initialMessage, conversationId: convRef.id, createdAt: now, read: false });
      navigate(`/messages/${convRef.id}`);
    } catch { setSaveError('Could not start the message. Check your Firestore rules.'); }
    finally { setMessageLoading(false); }
  };

  const removeBookmark = async (listingId: string) => {
    if (!currentUser) return;
    await setDoc(doc(db, 'users', currentUser.uid), { bookmarks: arrayRemove(listingId), lastSeen: Date.now() }, { merge: true });
    window.dispatchEvent(new CustomEvent('reshelved:bookmark-updated', { detail: { listingId, bookmarked: false } }));
    setBookmarkedListings(current => current.filter(item => item.id !== listingId));
    await refreshProfile();
  };

  const tabs = isOwnProfile ? [
    { id: 'active' as ProfileTab, label: 'Active', icon: 'la-book-open', count: activeListings.length },
    { id: 'expired' as ProfileTab, label: 'Expired', icon: 'la-book-open', count: expiredListings.length },
    { id: 'bookmarks' as ProfileTab, label: 'Bookmarked', icon: 'la-heart', count: bookmarkedListings.length },
    { id: 'profile' as ProfileTab, label: 'Profile', icon: 'la-user', count: null },
    { id: 'settings' as ProfileTab, label: 'Settings', icon: 'la-cog', count: null }
  ] : [];

  if (loading) return <div className="max-w-[1120px] mx-auto px-4 py-8 pb-10 sm:pb-20"><div className="animate-pulse rounded-3xl border border-stone-200 bg-white p-6"><div className="flex items-center gap-4"><div className="h-20 w-20 rounded-full bg-stone-200" /><div className="space-y-2"><div className="h-6 w-44 rounded bg-stone-200" /><div className="h-4 w-28 rounded bg-stone-100" /></div></div></div></div>;
  if (!profile) return <div className="max-w-[996px] mx-auto px-4 py-16 text-center pb-10 sm:pb-20"><h2 className="text-xl font-bold text-stone-700">User not found</h2><p className="text-stone-500 mt-2">This profile does not exist or you do not have permission to view it.</p><Link to="/browse" className="mt-4 inline-block text-primary-600 font-medium">Back to Browse</Link></div>;

  const renderListings = (items: Listing[], emptyText: string, emptyLink?: React.ReactNode) => items.length === 0 ? <div className="rounded-3xl border border-stone-200 bg-white px-6 py-12 text-center"><p className="text-sm text-stone-500">{emptyText}</p>{emptyLink}</div> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(l => <BookCard key={l.id} listing={l} />)}</div>;

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8 pb-10 sm:pb-20">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        {saveMessage && <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{saveMessage}</div>}
        {saveError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="shrink-0">{profile.photoURL ? <img src={profile.photoURL} alt={profile.displayName} className="h-24 w-24 rounded-full object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-full bg-stone-100 text-3xl font-bold text-stone-500">{profile.displayName?.[0]?.toUpperCase() || 'U'}</div>}{isOwnProfile && <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-full border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:border-stone-300 hover:bg-stone-50">{uploadingPhoto ? 'Uploading...' : 'Upload photo'}<input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} className="hidden" /></label>}</div>
          <div className="min-w-0 flex-1"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight text-stone-950">{profile.displayName}</h1>{profile.bio ? <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{profile.bio}</p> : isOwnProfile ? <p className="mt-2 text-sm text-stone-500">Add a short bio in Settings so buyers know who they are dealing with.</p> : null}</div>{!isOwnProfile && currentUser && <button onClick={handleMessageUser} disabled={messageLoading} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"><i className="las la-comment text-lg" />{messageLoading ? 'Opening...' : 'Message'}</button>}</div><div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-500">{profile.location && <span className="flex items-center gap-1.5"><i className="las la-map-marker text-lg" />{profile.location}</span>}<span className="flex items-center gap-1.5"><i className="las la-calendar text-lg" />Joined {new Date(profile.createdAt).toLocaleDateString()}</span>{ratings.length > 0 && <span className="flex items-center gap-1.5"><i className="las la-star text-lg text-[#F7AF31]" />{avgRating.toFixed(1)} ({ratings.length} review{ratings.length !== 1 ? 's' : ''})</span>}</div></div>
        </div>
      </div>

      {isOwnProfile && <div className="mt-6 overflow-x-auto border-b border-stone-200"><div className="flex min-w-max gap-7">{tabs.map(tab => <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setSaveError(''); setSaveMessage(''); }} className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-1 py-4 text-sm font-semibold transition ${activeTab === tab.id ? 'border-stone-950 text-stone-950' : 'border-transparent text-stone-500 hover:text-stone-950'}`}><i className={`las ${tab.icon} text-lg`} />{tab.label}{tab.count !== null && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{tab.count}</span>}</button>)}</div></div>}

      {!isOwnProfile && <div className="mt-8"><SectionTitle title={`${profile.displayName}'s active listings`} subtitle={`${activeListings.length} book${activeListings.length === 1 ? '' : 's'} currently listed`} />{renderListings(activeListings, 'No active listings')}</div>}

      {isOwnProfile && activeTab === 'active' && <div className="mt-8"><SectionTitle title="Active listings" subtitle="Books currently visible to buyers." action={<Link to="/create" className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"><i className="las la-plus text-lg" />List a book</Link>} />{renderListings(activeListings, 'No active listings', <Link to="/create" className="mt-3 inline-block text-sm font-semibold text-primary-600">List your first book</Link>)}</div>}

      {isOwnProfile && activeTab === 'expired' && <div className="mt-8"><SectionTitle title="Expired listings" subtitle="Renew books you still want people to find." />{expiredListings.length === 0 ? <div className="rounded-3xl border border-stone-200 bg-white px-6 py-12 text-center"><p className="text-sm text-stone-500">No expired listings</p></div> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{expiredListings.map(l => <div key={l.id}><BookCard listing={l} /><button type="button" onClick={() => handleRenewListing(l)} disabled={renewingId === l.id} className="mt-3 w-full cursor-pointer rounded-full bg-[#1665CC] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1254a9] disabled:cursor-not-allowed disabled:opacity-60">{renewingId === l.id ? 'Renewing...' : 'Renew listing'}</button></div>)}</div>}</div>}

      {isOwnProfile && activeTab === 'bookmarks' && <div className="mt-8"><SectionTitle title="Bookmarked books" subtitle="Books you saved for later." action={<Link to="/browse" className="text-sm font-semibold text-primary-600 hover:text-primary-700">Browse books</Link>} />{bookmarkedListings.length === 0 ? <div className="rounded-3xl border border-stone-200 bg-white px-6 py-12 text-center"><p className="text-sm text-stone-500">No bookmarked books yet</p><Link to="/browse" className="mt-3 inline-block text-sm font-semibold text-primary-600">Find books to save</Link></div> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{bookmarkedListings.map(l => <div key={l.id}><BookCard listing={l} /><button type="button" onClick={() => removeBookmark(l.id)} className="mt-3 w-full cursor-pointer rounded-full border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">Remove bookmark</button></div>)}</div>}</div>}

      {isOwnProfile && activeTab === 'profile' && <section className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]"><div className="rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold text-stone-950">Profile details</h2><div className="mt-5 space-y-4 text-sm"><div><p className="font-semibold text-stone-950">Name</p><p className="mt-1 text-stone-600">{profile.displayName}</p></div><div><p className="font-semibold text-stone-950">Location</p><p className="mt-1 text-stone-600">{profile.location || 'Not set'}</p></div><div><p className="font-semibold text-stone-950">Phone</p><p className="mt-1 text-stone-600">{profile.phone || 'Not set'}</p></div><div><p className="font-semibold text-stone-950">Bio</p><p className="mt-1 leading-6 text-stone-600">{profile.bio || 'No bio added yet.'}</p></div></div></div><div className="rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold text-stone-950">Reviews</h2>{ratings.length === 0 ? <p className="mt-4 text-sm text-stone-500">No reviews yet.</p> : <div className="mt-5 space-y-3">{ratings.map(r => <div key={r.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-center justify-between gap-4"><span className="font-medium text-stone-800">{r.fromUserName}</span><span className="text-sm text-[#F59E0B]">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span></div>{r.review && <p className="mt-2 text-sm leading-6 text-stone-600">{r.review}</p>}<p className="mt-2 text-xs text-stone-400">{new Date(r.createdAt).toLocaleDateString()} · Re: {r.listingTitle}</p></div>)}</div>}</div></section>}

      {isOwnProfile && activeTab === 'settings' && <section className="mt-8 grid gap-6 lg:grid-cols-2"><div className="rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold text-stone-950">Profile settings</h2><div className="mt-5 space-y-3"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} placeholder="Display name" /><textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="About you..." /><select value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className={`${inputClass} bg-white`}>{KENYAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className={inputClass} placeholder="Phone number" /><button onClick={handleSaveProfile} disabled={saving} className="w-full cursor-pointer rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : 'Save profile'}</button></div></div><div className="rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold text-stone-950">Account security</h2><div className="mt-5 space-y-6"><div><h3 className="font-bold text-stone-900">Change email</h3><div className="mt-3 space-y-3"><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputClass} placeholder="New email address" autoComplete="email" /><PasswordField value={emailPassword} onChange={setEmailPassword} placeholder="Current password" autoComplete="current-password" /><button type="button" onClick={handleChangeEmail} disabled={accountLoading} className="w-full cursor-pointer rounded-full bg-[#1665CC] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1254a9] disabled:cursor-not-allowed disabled:opacity-60">Send confirmation email</button></div></div><div><h3 className="font-bold text-stone-900">Change password</h3><div className="mt-3 space-y-3"><PasswordField value={currentPassword} onChange={setCurrentPassword} placeholder="Current password" autoComplete="current-password" /><PasswordField value={newPassword} onChange={setNewPassword} placeholder="New password" autoComplete="new-password" /><PasswordField value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="Confirm new password" autoComplete="new-password" /><button type="button" onClick={handleChangePassword} disabled={accountLoading} className="w-full cursor-pointer rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60">Update password</button></div></div><div className="rounded-2xl border border-red-200 bg-red-50 p-4"><h3 className="font-bold text-red-700">Delete account</h3><p className="mt-1 text-sm text-red-700/80">This deactivates your listings and deletes your login account.</p><div className="mt-3 space-y-3"><PasswordField value={deletePassword} onChange={setDeletePassword} placeholder="Current password" autoComplete="current-password" /><button type="button" onClick={handleDeleteAccount} disabled={accountLoading} className="w-full cursor-pointer rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">Delete my account</button></div></div></div></div></section>}
    </div>
  );
};

export default Profile;
