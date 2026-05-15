import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, query, where, getDocs, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import RecentListings from '../components/RecentListings';
import type { Listing, Rating } from '../types';

const REVIEWS_STEP = 4;

const normalizeImages = (images?: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images
    .filter((image): image is string => typeof image === 'string')
    .map((image) => image.trim())
    .filter((image) => image.length > 0);
};

const ListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [visibleReviews, setVisibleReviews] = useState(REVIEWS_STEP);
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const listingImages = useMemo(() => normalizeImages(listing?.images).filter((image) => !failedImages.includes(image)), [listing?.images, failedImages]);
  const activeImage = listingImages[currentImage] || listingImages[0];

  useEffect(() => { if (id) fetchListing(); }, [id]);
  useEffect(() => { setCurrentImage(0); setFailedImages([]); setVisibleReviews(REVIEWS_STEP); }, [listing?.id]);
  useEffect(() => { if (currentImage >= listingImages.length) setCurrentImage(0); }, [currentImage, listingImages.length]);

  const handleImageError = (image: string) => setFailedImages((current) => current.includes(image) ? current : [...current, image]);

  const fetchListing = async () => {
    try {
      const snap = await getDoc(doc(db, 'listings', id!));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Listing;
        setListing(data);
        const rq = query(collection(db, 'ratings'), where('toUserId', '==', data.userId));
        const rSnap = await getDocs(rq);
        const r: Rating[] = [];
        rSnap.forEach(d => r.push({ id: d.id, ...d.data() } as Rating));
        r.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setRatings(r);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleContact = async () => {
    if (!currentUser || !listing) return;
    if (!listing.userId || listing.userId === currentUser.uid) return;

    setActionLoading(true);
    setMessage('');

    try {
      const cq = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid));
      const cSnap = await getDocs(cq);
      let existingConvId: string | null = null;
      cSnap.forEach(d => {
        const data = d.data();
        if (data.listingId === listing.id && Array.isArray(data.participants) && data.participants.includes(listing.userId)) existingConvId = d.id;
      });

      if (existingConvId) {
        navigate(`/messages/${existingConvId}`);
        return;
      }

      const now = Date.now();
      const initialMessage = `Hi! I'm interested in "${listing.title}"`;
      const buyerName = userProfile?.displayName || currentUser.displayName || 'User';
      const sellerName = listing.userName || 'Seller';
      const convRef = await addDoc(collection(db, 'conversations'), {
        participants: [currentUser.uid, listing.userId], buyerId: currentUser.uid, sellerId: listing.userId,
        participantNames: { [currentUser.uid]: buyerName, [listing.userId]: sellerName },
        participantPhotos: { [currentUser.uid]: userProfile?.photoURL || currentUser.photoURL || '', [listing.userId]: listing.userPhoto || '' },
        listingId: listing.id, listingTitle: listing.title, lastMessage: initialMessage, lastMessageAt: now, updatedAt: now, createdAt: now
      });
      await addDoc(collection(db, 'messages'), { conversationId: convRef.id, senderId: currentUser.uid, senderName: buyerName, recipientId: listing.userId, text: initialMessage, createdAt: now });
      await addDoc(collection(db, 'notifications'), { userId: listing.userId, fromUserId: currentUser.uid, fromUserName: buyerName, fromAdmin: false, type: 'message', subject: `New message from ${buyerName}`, message: initialMessage, conversationId: convRef.id, listingId: listing.id, createdAt: now, read: false });
      await addDoc(collection(db, 'contacts'), { userId: currentUser.uid, listingId: listing.id, listingTitle: listing.title, sellerId: listing.userId, sellerName, contactedAt: now, reviewPromptShown: false, reviewed: false });
      navigate(`/messages/${convRef.id}`);
    } catch (err) {
      console.error(err);
      setMessage('Failed to start conversation. Check your Firestore rules.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReport = async () => {
    if (!currentUser || !listing) return;
    setActionLoading(true);
    try {
      await addDoc(collection(db, 'reports'), { reporterId: currentUser.uid, reporterName: userProfile?.displayName || 'User', targetType: 'listing', targetId: listing.id, targetName: listing.title, reason: reportReason, details: reportDetails, createdAt: Date.now(), resolved: false });
      await updateDoc(doc(db, 'listings', listing.id), { flagCount: increment(1), flagged: true });
      setShowReport(false);
      setMessage('Report submitted. Thank you for helping keep Reshelved safe.');
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRating = async () => {
    if (!currentUser || !listing) return;
    setActionLoading(true);
    try {
      await addDoc(collection(db, 'ratings'), { fromUserId: currentUser.uid, fromUserName: userProfile?.displayName || 'User', toUserId: listing.userId, listingId: listing.id, listingTitle: listing.title, rating: ratingValue, review: reviewText, createdAt: Date.now() });
      setShowRating(false);
      setMessage('Review submitted!');
      fetchListing();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!listing) return;
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await deleteDoc(doc(db, 'listings', listing.id));
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 pb-10 sm:pb-[60px]"><div className="animate-pulse"><div className="aspect-[16/9] bg-stone-200 rounded-2xl" /><div className="mt-6 space-y-4"><div className="h-8 bg-stone-200 rounded w-1/2" /><div className="h-4 bg-stone-200 rounded w-1/3" /><div className="h-4 bg-stone-100 rounded w-full" /></div></div></div>;
  if (!listing) return <div className="max-w-4xl mx-auto px-4 py-16 text-center pb-10 sm:pb-[60px]"><h2 className="text-xl font-bold text-stone-700">Listing not found</h2><Link to="/" className="mt-4 inline-block text-primary-600 font-medium">Back to Home</Link></div>;

  const isOwner = currentUser?.uid === listing.userId;
  const canEdit = isOwner || Boolean(userProfile?.isAdmin);
  const isExpired = listing.expiresAt < Date.now();
  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
  const typeLabels: Record<string, string> = { swap: 'Swap', donate: 'Free / Donate', sell: 'For Sale' };
  const shownRatings = ratings.slice(0, visibleReviews);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-10 sm:pb-[60px]">
      <nav className="mb-6 text-sm text-stone-500" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-primary-700 font-medium">Home</Link>
        <span className="mx-2">&gt;</span>
        <Link to="/browse" className="hover:text-primary-700 font-medium">Browse</Link>
        <span className="mx-2">&gt;</span>
        <span className="text-stone-800 font-semibold">{listing.title}</span>
      </nav>

      {message && <div className="mb-4 p-3 bg-primary-50 border border-primary-200 text-primary-700 rounded-xl text-sm">{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <div className="aspect-[4/3] bg-stone-100 rounded-2xl overflow-hidden relative">
            {activeImage ? <img src={activeImage} alt={listing.title} className="w-full h-full object-cover" onError={() => handleImageError(activeImage)} /> : <div className="w-full h-full flex items-center justify-center bg-stone-100"><svg className="w-16 h-16 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>}
            {isExpired && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="px-4 py-2 bg-red-600 text-white font-semibold rounded-full">Listing Expired</span></div>}
          </div>
          {listingImages.length > 1 && <div className="flex gap-2 mt-3">{listingImages.map((img, i) => <button key={img} onClick={() => setCurrentImage(i)} className={`cursor-pointer w-16 h-16 rounded-lg overflow-hidden border-2 transition ${i === currentImage ? 'border-primary-500' : 'border-stone-200 hover:border-stone-300'}`}><img src={img} alt="" className="w-full h-full object-cover" onError={() => handleImageError(img)} /></button>)}</div>}
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${listing.type === 'swap' ? 'bg-blue-100 text-blue-700' : listing.type === 'donate' ? 'bg-green-100 text-green-700' : 'bg-accent-100 text-accent-700'}`}>{typeLabels[listing.type]}</span><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">{listing.condition}</span></div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-tight">{listing.title}</h1>
            <p className="text-stone-500 mt-2">by {listing.author}</p>
          </div>

          {listing.type === 'sell' && listing.price && <div className="text-2xl font-bold text-primary-700">KSh {listing.price.toLocaleString()}</div>}

          <div className="bg-stone-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="text-stone-600">{listing.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              <span className="text-stone-600">{listing.category}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-stone-600">{isExpired ? 'Expired' : `Expires in ${Math.ceil((listing.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))} days`}</span>
            </div>
          </div>

          {listing.description && <div><h3 className="font-semibold text-stone-700 mb-1">Description</h3><p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{listing.description}</p></div>}

          <div className="border border-stone-200 rounded-xl p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">{listing.userName?.[0]?.toUpperCase() || 'U'}</div><div><Link to={`/user/${listing.userId}`} className="font-semibold text-stone-800 hover:text-primary-700">{listing.userName}</Link>{ratings.length > 0 && <div className="flex items-center gap-1 text-sm"><span className="text-accent-500">{'★'.repeat(Math.round(avgRating))}</span><span className="text-stone-500">({ratings.length} review{ratings.length !== 1 ? 's' : ''})</span></div>}</div></div></div>

          <div className="space-y-2">
            {!isOwner && currentUser && !isExpired && <button onClick={handleContact} disabled={actionLoading} className="cursor-pointer w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50">{actionLoading ? 'Please wait...' : `Contact ${listing.userName}`}</button>}
            {!currentUser && <Link to="/login" className="block w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition text-center">Log in to Contact</Link>}
            {!isOwner && currentUser && <div className="flex gap-2"><button onClick={() => setShowRating(true)} className="cursor-pointer flex-1 py-2.5 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl transition text-sm font-medium">★ Leave Review</button><button onClick={() => setShowReport(true)} className="cursor-pointer flex-1 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition text-sm font-medium">⚑ Report</button></div>}
            {canEdit && <Link to={`/listing/${listing.id}/edit`} className="block w-full py-2.5 border border-primary-200 text-primary-700 hover:bg-primary-50 rounded-xl transition text-sm font-medium text-center">Edit Listing</Link>}
            {canEdit && <button onClick={handleDelete} className="cursor-pointer w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition text-sm font-medium">Delete Listing</button>}
          </div>
        </div>
      </div>

      {ratings.length > 0 && <div className="mt-10"><h2 className="text-lg font-bold text-stone-800 mb-4">Seller Reviews</h2><div className="space-y-3">{shownRatings.map((r) => <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-4"><div className="flex items-center justify-between"><span className="font-medium text-stone-700">{r.fromUserName}</span><span className="text-accent-500 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span></div>{r.review && <p className="text-sm text-stone-600 mt-1">{r.review}</p>}<p className="text-xs text-stone-400 mt-2">{new Date(r.createdAt).toLocaleDateString()}</p></div>)}</div>{visibleReviews < ratings.length && <button onClick={() => setVisibleReviews((current) => current + REVIEWS_STEP)} className="cursor-pointer mt-4 rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">Show more reviews</button>}</div>}

      <RecentListings excludeId={listing.id} limit={3} />

      {showReport && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl max-w-md w-full p-6"><h3 className="text-lg font-bold text-stone-800">Report Listing</h3><p className="text-sm text-stone-500 mt-1">Help us understand what's wrong</p><div className="mt-4 space-y-3"><select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm bg-white"><option value="">Select a reason...</option><option value="spam">Spam or misleading</option><option value="inappropriate">Inappropriate content</option><option value="fraud">Suspected fraud</option><option value="prohibited">Prohibited item</option><option value="other">Other</option></select><textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Additional details..." rows={3} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm resize-none" /><div className="flex gap-2"><button onClick={() => setShowReport(false)} className="cursor-pointer flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium">Cancel</button><button onClick={handleReport} disabled={!reportReason || actionLoading} className="cursor-pointer flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Submit Report</button></div></div></div></div>}
      {showRating && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl max-w-md w-full p-6"><h3 className="text-lg font-bold text-stone-800">Leave a Review</h3><p className="text-sm text-stone-500 mt-1">Rate your experience with {listing.userName}</p><div className="mt-4 space-y-3"><div className="flex items-center gap-1">{[1,2,3,4,5].map((star) => <button key={star} onClick={() => setRatingValue(star)} className={`cursor-pointer text-3xl transition ${star <= ratingValue ? 'text-accent-500' : 'text-stone-300'}`}>★</button>)}</div><textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Share your experience..." rows={3} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm resize-none" /><div className="flex gap-2"><button onClick={() => setShowRating(false)} className="cursor-pointer flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium">Cancel</button><button onClick={handleRating} disabled={actionLoading} className="cursor-pointer flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Submit Review</button></div></div></div></div>}
    </div>
  );
};

export default ListingDetail;
