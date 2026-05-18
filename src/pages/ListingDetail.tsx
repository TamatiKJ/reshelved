import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, increment, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import RecentListings from '../components/RecentListings';
import type { Listing, Rating } from '../types';

const REVIEWS_STEP = 4;
const getConversationKey = (a: string, b: string) => [a, b].sort().join('_');

const normalizeImages = (images?: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images
    .filter((image): image is string => typeof image === 'string')
    .map((image) => image.trim())
    .filter((image) => image.length > 0);
};

const getShareUrl = () => encodeURIComponent(window.location.href);
const getShareText = (listing: Listing) => encodeURIComponent(`Check out ${listing.title} on Reshelved`);
const getRatingCount = (ratings: Rating[], star: number) => ratings.filter((rating) => rating.rating === star).length;

const RatingStars: React.FC<{ rating: number; className?: string }> = ({ rating, className = 'text-lg' }) => {
  const safeRating = Math.max(0, Math.min(5, rating || 0));
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${safeRating.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, safeRating - index)) * 100;
        return (
          <span key={index} className="relative inline-block h-[1em] w-[1em] leading-none">
            <span className="absolute inset-0 text-stone-300">★</span>
            <span className="absolute inset-0 overflow-hidden text-[#F59E0B]" style={{ width: `${fill}%` }}>★</span>
          </span>
        );
      })}
    </span>
  );
};

const ListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [sellerPhoto, setSellerPhoto] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [visibleReviews, setVisibleReviews] = useState(REVIEWS_STEP);
  const [reviewFilter, setReviewFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [message, setMessage] = useState('');

  const listingImages = useMemo(() => normalizeImages(listing?.images).filter((image) => !failedImages.includes(image)), [listing?.images, failedImages]);
  const activeImage = listingImages[currentImage] || listingImages[0];
  const filteredRatings = useMemo(() => reviewFilter === 'all' ? ratings : ratings.filter((rating) => rating.rating === reviewFilter), [ratings, reviewFilter]);
  const isBookmarked = Boolean(listing && userProfile?.bookmarks?.includes(listing.id));

  useEffect(() => { if (id) fetchListing(); }, [id]);
  useEffect(() => { setCurrentImage(0); setFailedImages([]); setVisibleReviews(REVIEWS_STEP); setReviewFilter('all'); }, [listing?.id]);
  useEffect(() => { if (currentImage >= listingImages.length) setCurrentImage(0); }, [currentImage, listingImages.length]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const flashMessage = (text: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(text), 0);
  };

  const handleImageError = (image: string) => setFailedImages((current) => current.includes(image) ? current : [...current, image]);
  const goToNextImage = () => setCurrentImage((current) => listingImages.length ? (current + 1) % listingImages.length : 0);
  const goToPreviousImage = () => setCurrentImage((current) => listingImages.length ? (current - 1 + listingImages.length) % listingImages.length : 0);

  const fetchListing = async () => {
    try {
      const snap = await getDoc(doc(db, 'listings', id!));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Listing;
        setListing(data);
        setSellerPhoto(data.userPhoto || '');

        const [ratingsSnap, userSnap] = await Promise.all([
          getDocs(query(collection(db, 'ratings'), where('toUserId', '==', data.userId))),
          getDoc(doc(db, 'users', data.userId)).catch(() => null)
        ]);

        if (userSnap?.exists()) {
          const photoURL = userSnap.data().photoURL;
          if (typeof photoURL === 'string' && photoURL.trim()) setSellerPhoto(photoURL);
        }

        const r: Rating[] = [];
        ratingsSnap.forEach(d => r.push({ id: d.id, ...d.data() } as Rating));
        r.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setRatings(r);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (!listing) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (bookmarking) return;
    setBookmarking(true);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        bookmarks: isBookmarked ? arrayRemove(listing.id) : arrayUnion(listing.id),
        lastSeen: Date.now()
      }, { merge: true });
      await refreshProfile();
      flashMessage(isBookmarked ? 'Removed from favorites.' : 'Saved to favorites.');
    } catch (err) {
      console.error(err);
      flashMessage('Could not update favorites.');
    } finally {
      setBookmarking(false);
    }
  };

  const handleContact = async () => {
    if (!currentUser || !listing) return;
    if (!listing.userId || listing.userId === currentUser.uid) return;
    setActionLoading(true);
    setMessage('');
    try {
      const conversationKey = `${getConversationKey(currentUser.uid, listing.userId)}_${listing.id}`;
      const listingImage = listingImages[0] || normalizeImages(listing.images)[0] || '';
      const listingPrice = typeof listing.price === 'number' ? listing.price : null;
      const cq = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid));
      const cSnap = await getDocs(cq);
      let existingConvId: string | null = null;
      cSnap.forEach(d => {
        const data = d.data();
        if (Array.isArray(data.participants) && data.participants.includes(listing.userId) && data.listingId === listing.id) existingConvId = d.id;
      });
      if (existingConvId) {
        await updateDoc(doc(db, 'conversations', existingConvId), {
          conversationKey,
          listingId: listing.id,
          listingTitle: listing.title,
          listingImage,
          listingPrice,
          listingType: listing.type,
          hiddenFor: arrayRemove(currentUser.uid),
          updatedAt: Date.now()
        });
        navigate(`/messages/${existingConvId}`);
        return;
      }
      const now = Date.now();
      const initialMessage = `Hi! I'm interested in "${listing.title}"`;
      const buyerName = userProfile?.displayName || currentUser.displayName || 'User';
      const sellerName = listing.userName || 'Seller';
      const convRef = await addDoc(collection(db, 'conversations'), {
        participants: [currentUser.uid, listing.userId],
        conversationKey,
        buyerId: currentUser.uid,
        sellerId: listing.userId,
        participantNames: { [currentUser.uid]: buyerName, [listing.userId]: sellerName },
        participantPhotos: { [currentUser.uid]: userProfile?.photoURL || currentUser.photoURL || '', [listing.userId]: sellerPhoto || listing.userPhoto || '' },
        listingId: listing.id,
        listingTitle: listing.title,
        listingImage,
        listingPrice,
        listingType: listing.type,
        lastMessage: initialMessage,
        lastMessageAt: now,
        updatedAt: now,
        createdAt: now
      });
      await addDoc(collection(db, 'messages'), { conversationId: convRef.id, senderId: currentUser.uid, senderName: buyerName, recipientId: listing.userId, text: initialMessage, type: 'text', readBy: [currentUser.uid], createdAt: now });
      await addDoc(collection(db, 'notifications'), { userId: listing.userId, fromUserId: currentUser.uid, fromUserName: buyerName, fromAdmin: false, type: 'message', subject: `New message from ${buyerName}`, message: initialMessage, conversationId: convRef.id, listingId: listing.id, createdAt: now, read: false });
      await addDoc(collection(db, 'contacts'), { userId: currentUser.uid, listingId: listing.id, listingTitle: listing.title, sellerId: listing.userId, sellerName, contactedAt: now, reviewPromptShown: false, reviewed: false });
      navigate(`/messages/${convRef.id}`);
    } catch (err) {
      console.error(err);
      flashMessage('Failed to start conversation. Check your Firestore rules.');
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
      flashMessage('Report submitted. Thank you for helping keep Reshelved safe.');
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
      await addDoc(collection(db, 'ratings'), {
        fromUserId: currentUser.uid,
        fromUserName: userProfile?.displayName || 'User',
        toUserId: listing.userId,
        listingId: listing.id,
        listingTitle: listing.title,
        rating: ratingValue,
        title: reviewTitle.trim(),
        review: reviewText.trim(),
        createdAt: Date.now()
      });
      setShowRating(false);
      setReviewTitle('');
      setReviewText('');
      flashMessage('Review submitted!');
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

  const handleDeleteReview = async (reviewId?: string) => {
    if (!reviewId || !userProfile?.isAdmin) return;
    if (!confirm('Delete this review permanently?')) return;

    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'ratings', reviewId));
      setRatings((current) => current.filter((rating) => rating.id !== reviewId));
      setVisibleReviews(REVIEWS_STEP);
      flashMessage('Review deleted.');
    } catch (err) {
      console.error(err);
      flashMessage('Could not delete review. Check your Firestore rules.');
    } finally {
      setActionLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flashMessage('Listing link copied.');
    } catch (err) {
      console.error(err);
      flashMessage('Could not copy the link.');
    }
  };

  if (loading) return <div className="bg-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10 sm:pb-20"><div className="animate-pulse"><div className="aspect-square bg-stone-200 rounded-2xl max-w-4xl" /><div className="mt-6 space-y-4"><div className="h-8 bg-stone-200 rounded w-1/2" /><div className="h-4 bg-stone-200 rounded w-1/3" /><div className="h-4 bg-stone-100 rounded w-full" /></div></div></div></div>;
  if (!listing) return <div className="bg-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center pb-10 sm:pb-20"><h2 className="text-xl font-bold text-stone-700">Listing not found</h2><Link to="/" className="mt-4 inline-block text-primary-600 font-medium">Back to Home</Link></div></div>;

  const isOwner = currentUser?.uid === listing.userId;
  const canEdit = isOwner || Boolean(userProfile?.isAdmin);
  const canDeleteReviews = Boolean(userProfile?.isAdmin);
  const isExpired = listing.expiresAt < Date.now();
  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
  const typeLabels: Record<string, string> = { swap: 'Swap', donate: 'Free / Donate', sell: 'For Sale' };
  const shownRatings = filteredRatings.slice(0, visibleReviews);
  const shareUrl = getShareUrl();
  const shareText = getShareText(listing);
  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => {
    const count = getRatingCount(ratings, star);
    return { star, count, percent: ratings.length ? Math.round((count / ratings.length) * 100) : 0 };
  });
  const reviewFilters: Array<{ label: string; value: 'all' | 1 | 2 | 3 | 4 | 5; count: number }> = [
    { label: 'All reviews', value: 'all', count: ratings.length },
    ...([5, 4, 3, 2, 1] as const).map((star) => ({ label: `${star} star${star === 1 ? '' : 's'}`, value: star, count: getRatingCount(ratings, star) }))
  ];
  const shareItems = [
    { label: 'WhatsApp', icon: 'lab la-whatsapp', className: 'bg-green-500 text-white', href: `https://wa.me/?text=${shareText}%20${shareUrl}` },
    { label: 'LinkedIn', icon: 'lab la-linkedin-in', className: 'bg-[#0A66C2] text-white', href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}` },
    { label: 'Facebook', icon: 'lab la-facebook-f', className: 'bg-[#4267B2] text-white', href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}` },
    { label: 'Reddit', icon: 'lab la-reddit-alien', className: 'bg-[#FF4500] text-white', href: `https://www.reddit.com/submit?url=${shareUrl}&title=${shareText}` },
    { label: 'X', icon: 'lab la-x-twitter', className: 'bg-black text-white', href: `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}` }
  ];

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10 sm:pb-20">
        <nav className="mb-6 text-sm text-stone-500" aria-label="Breadcrumb"><Link to="/" className="hover:text-primary-700 font-medium">Home</Link><span className="mx-2">&gt;</span><Link to="/browse" className="hover:text-primary-700 font-medium">Browse</Link><span className="mx-2">&gt;</span><span className="text-stone-800 font-semibold">{listing.title}</span></nav>
        {message && <div className="mb-4 p-3 bg-primary-50 border border-primary-200 text-primary-700 rounded-xl text-sm transition-opacity duration-300">{message}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-10">
          <div className="lg:col-span-2"><div className="flex flex-col gap-4 lg:flex-row">{listingImages.length > 1 && <div className="order-2 flex gap-3 overflow-x-auto pb-1 lg:order-1 lg:w-[76px] lg:flex-col lg:overflow-visible lg:pb-0">{listingImages.map((img, i) => <button key={img} onClick={() => setCurrentImage(i)} className={`h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 bg-white transition lg:h-[72px] lg:w-[72px] ${i === currentImage ? 'border-[#1665CC] ring-2 ring-[#1665CC]/10' : 'border-stone-200 hover:border-[#1665CC]'}`} aria-label={`View image ${i + 1}`}><img src={img} alt="" className="h-full w-full object-cover" onError={() => handleImageError(img)} /></button>)}</div>}<div className="order-1 flex-1 lg:order-2"><div className="aspect-square bg-stone-100 rounded-2xl overflow-hidden relative bg-no-repeat">{activeImage ? <img src={activeImage} alt={listing.title} className="w-full h-full object-cover" onError={() => handleImageError(activeImage)} /> : <div className="w-full h-full flex items-center justify-center bg-stone-100"><svg className="w-16 h-16 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>}{isExpired && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="px-4 py-2 bg-red-600 text-white font-semibold rounded-full">Listing Expired</span></div>}<div className="absolute right-4 top-4 flex flex-col gap-3"><button type="button" onClick={copyLink} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-stone-800 shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50" aria-label="Copy listing link"><i className="las la-share-alt text-2xl" /></button><button type="button" onClick={handleBookmark} disabled={bookmarking} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60" aria-label={isBookmarked ? 'Remove from favorites' : 'Save to favorites'} aria-pressed={isBookmarked}><i className={`${isBookmarked ? 'las la-heart text-[#f15025]' : 'lar la-heart text-stone-800'} text-2xl`} /></button><button type="button" onClick={() => window.open(activeImage || listingImages[0], '_blank')} disabled={!activeImage} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-stone-800 shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Open larger image"><i className="las la-search-plus text-2xl" /></button></div>{listingImages.length > 1 && <><button type="button" onClick={goToPreviousImage} className="absolute left-4 top-1/2 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-stone-800 shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50 sm:flex" aria-label="Previous image"><i className="las la-angle-left text-2xl" /></button><button type="button" onClick={goToNextImage} className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-stone-800 shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50" aria-label="Next image"><i className="las la-angle-right text-2xl" /></button><div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white">{currentImage + 1} / {listingImages.length}</div></>}</div></div></div></div>

          <div className="lg:col-span-1 space-y-5"><div><div className="mb-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-md border border-[#1665CC] bg-white px-3 py-1.5 text-sm font-bold text-[#1665CC]"><i className="las la-exchange-alt text-lg" />{typeLabels[listing.type]}</span><span className="inline-flex items-center gap-2 rounded-md bg-[#1665CC]/10 px-3 py-1.5 text-sm font-bold text-[#1665CC]"><i className="las la-book-open text-lg" />{listing.condition}</span>{ratings.length > 0 && <span className="inline-flex items-center gap-2 rounded-md bg-stone-100 px-3 py-1.5 text-sm font-bold text-stone-700"><i className="las la-star text-lg text-amber-400" />{avgRating.toFixed(1)} seller rating</span>}</div><h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-tight">{listing.title}</h1><p className="text-stone-500 mt-2">by {listing.author}</p></div>{listing.type === 'sell' && listing.price && <div className="text-2xl font-bold text-primary-700">KSh {listing.price.toLocaleString()}</div>}<div className="inline-flex w-fit max-w-full flex-wrap items-center rounded-xl border border-stone-200 bg-white text-sm text-stone-700"><div className="flex items-center gap-2 px-4 py-3"><i className="las la-map-marker-alt text-lg text-stone-400" /><span>{listing.location}</span></div><div className="h-6 w-px bg-stone-200" /><div className="flex items-center gap-2 px-4 py-3"><i className="las la-layer-group text-lg text-stone-400" /><span>{listing.category}</span></div><div className="h-6 w-px bg-stone-200" /><div className="flex items-center gap-2 px-4 py-3"><i className="las la-clock text-lg text-stone-400" /><span>{isExpired ? 'Expired' : `${Math.ceil((listing.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))} Days Left`}</span></div></div>{listing.description && <div><h3 className="font-semibold text-stone-700 mb-1">Description</h3><p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{listing.description}</p></div>}<div className="border border-stone-200 rounded-xl p-4"><div className="flex items-center gap-3">{sellerPhoto ? <img src={sellerPhoto} alt={listing.userName} className="w-12 h-12 rounded-full object-cover bg-stone-100" /> : <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">{listing.userName?.[0]?.toUpperCase() || 'U'}</div>}<div><Link to={`/user/${listing.userId}`} className="font-semibold text-stone-800 hover:text-primary-700">{listing.userName}</Link>{ratings.length > 0 && <div className="flex items-center gap-1 text-sm"><RatingStars rating={avgRating} className="text-sm" /><span className="text-stone-500">({ratings.length} review{ratings.length !== 1 ? 's' : ''})</span></div>}</div></div></div><div className="space-y-2">{!isOwner && currentUser && !isExpired && <button onClick={handleContact} disabled={actionLoading} className="cursor-pointer w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50">{actionLoading ? 'Please wait...' : `Contact ${listing.userName}`}</button>}{!currentUser && <Link to="/login" className="block w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition text-center">Log in to Contact</Link>}{!isOwner && currentUser && <div className="flex gap-2"><button onClick={() => setShowRating(true)} className="cursor-pointer flex-1 py-2.5 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl transition text-sm font-medium">★ Leave Review</button><button onClick={() => setShowReport(true)} className="cursor-pointer flex-1 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition text-sm font-medium">⚑ Report</button></div>}{canEdit && <Link to={`/listing/${listing.id}/edit`} className="block w-full py-2.5 border border-primary-200 text-primary-700 hover:bg-primary-50 rounded-xl transition text-sm font-medium text-center">Edit Listing</Link>}{canEdit && <button onClick={handleDelete} className="cursor-pointer w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition text-sm font-medium">Delete Listing</button>}</div><div className="pt-3"><h2 className="text-xl font-bold text-stone-900 mb-3">Share link</h2><div className="flex flex-wrap gap-3">{shareItems.map((item) => <a key={item.label} href={item.href} target="_blank" rel="noreferrer" aria-label={`Share on ${item.label}`} className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl transition hover:-translate-y-0.5 ${item.className}`}><i className={item.icon} /></a>)}<button type="button" onClick={copyLink} aria-label="Copy link" className="cursor-pointer w-12 h-12 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center text-2xl hover:bg-stone-200 transition"><i className="las la-link" /></button></div></div></div>
        </div>

        {ratings.length > 0 && <section className="mt-12 border-t border-stone-200 pt-8"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-2xl font-bold text-stone-900">Seller ratings & reviews</h2>{canDeleteReviews && <span className="text-xs font-semibold uppercase tracking-wide text-red-500">Admin review controls active</span>}</div><div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]"><div><div className="text-5xl font-black tracking-tight text-stone-950">{avgRating.toFixed(1)} out of 5</div><div className="mt-3 flex items-center gap-2"><RatingStars rating={avgRating} className="text-lg" /><span className="text-sm text-stone-600">{ratings.length} review{ratings.length !== 1 ? 's' : ''}</span></div><p className="mt-5 text-sm font-semibold text-stone-600">Based on seller interactions</p></div><div className="space-y-3">{ratingBreakdown.map((item) => <button key={item.star} type="button" onClick={() => { setReviewFilter(item.star as 1 | 2 | 3 | 4 | 5); setVisibleReviews(REVIEWS_STEP); }} className="grid w-full cursor-pointer grid-cols-[64px_1fr_70px] items-center gap-3 text-sm text-left"><span className="font-medium text-stone-600 underline underline-offset-2">{item.star} star{item.star !== 1 ? 's' : ''}</span><span className="h-2.5 overflow-hidden rounded-full bg-stone-200"><span className="block h-full rounded-full bg-[#1665CC]" style={{ width: `${item.percent}%` }} /></span><span className="text-right text-stone-600">{item.percent}% ({item.count})</span></button>)}</div></div><div className="mt-8 flex flex-wrap gap-2 border-t border-stone-200 pt-5">{reviewFilters.map((item) => <button key={String(item.value)} type="button" onClick={() => { setReviewFilter(item.value); setVisibleReviews(REVIEWS_STEP); }} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition ${reviewFilter === item.value ? 'border-[#1665CC] bg-[#1665CC] text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-[#1665CC] hover:text-[#1665CC]'}`}>{item.label} <span className={reviewFilter === item.value ? 'text-white/80' : 'text-stone-400'}>({item.count})</span></button>)}</div><div className="mt-8 space-y-0">{shownRatings.length > 0 ? shownRatings.map((r) => <article key={r.id} className="border-t border-stone-200 py-6"><div className="grid gap-4 sm:grid-cols-[160px_1fr]"><div><p className="text-sm text-stone-500">{new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p><p className="mt-6 font-semibold text-stone-700">{r.fromUserName}</p></div><div><div className="flex items-start justify-between gap-3"><div className="text-amber-400">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>{canDeleteReviews && <button type="button" onClick={() => handleDeleteReview(r.id)} disabled={actionLoading} className="shrink-0 cursor-pointer rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Delete</button>}</div><h3 className="mt-4 text-xl font-extrabold text-stone-800">{r.title || r.listingTitle || 'Book exchange review'}</h3>{r.review && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-700">{r.review}</p>}<p className="mt-3 text-xs text-stone-500">Review for {r.listingTitle}</p></div></div></article>) : <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-500">No reviews match this filter.</div>}</div>{visibleReviews < filteredRatings.length && <button onClick={() => setVisibleReviews((current) => current + REVIEWS_STEP)} className="cursor-pointer mt-4 rounded-full border border-stone-800 px-5 py-2.5 text-sm font-bold text-stone-900 hover:bg-stone-50">View more reviews</button>}</section>}
        <RecentListings excludeId={listing.id} limit={3} />
        {showReport && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl max-w-md w-full p-6"><h3 className="text-lg font-bold text-stone-800">Report Listing</h3><p className="text-sm text-stone-500 mt-1">Help us understand what's wrong</p><div className="mt-4 space-y-3"><select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm bg-white"><option value="">Select a reason...</option><option value="spam">Spam or misleading</option><option value="inappropriate">Inappropriate content</option><option value="fraud">Suspected fraud</option><option value="prohibited">Prohibited item</option><option value="other">Other</option></select><textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Additional details..." rows={3} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm resize-none" /><div className="flex gap-2"><button onClick={() => setShowReport(false)} className="cursor-pointer flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium">Cancel</button><button onClick={handleReport} disabled={!reportReason || actionLoading} className="cursor-pointer flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Submit Report</button></div></div></div></div>}
        {showRating && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl max-w-md w-full p-6"><h3 className="text-lg font-bold text-stone-800">Leave a Review</h3><p className="text-sm text-stone-500 mt-1">Rate your experience with {listing.userName}</p><div className="mt-4 space-y-3"><div className="flex items-center gap-1">{[1,2,3,4,5].map((star) => <button key={star} onClick={() => setRatingValue(star)} className={`cursor-pointer text-3xl transition ${star <= ratingValue ? 'text-accent-500' : 'text-stone-300'}`}>★</button>)}</div><input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Review title" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10" /><textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Share your experience..." rows={3} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm resize-none focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 outline-none" /><div className="flex gap-2"><button onClick={() => setShowRating(false)} className="cursor-pointer flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium">Cancel</button><button onClick={handleRating} disabled={actionLoading} className="cursor-pointer flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Submit Review</button></div></div></div></div>}
      </div>
    </div>
  );
};

export default ListingDetail;