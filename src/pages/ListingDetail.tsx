import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ListingGallery from '../components/ListingGallery';
import RatingModal from '../components/RatingModal';
import RatingStars from '../components/RatingStars';
import RecentListings from '../components/RecentListings';
import ReportModal from '../components/ReportModal';
import SellerCard from '../components/SellerCard';
import { useListing } from '../hooks/useListing';
import { useSellerRatings } from '../hooks/useSellerRatings';
import { normalizeImages, removeListingById, toggleListingBookmark } from '../services/listings';
import { findOrCreateListingConversation } from '../services/messages';
import { createSellerRating, deleteRatingById, getRatingCount } from '../services/ratings';
import { reportListing } from '../services/reports';

const REVIEWS_STEP = 4;

const getShareUrl = () => encodeURIComponent(window.location.href);
const getShareText = (title: string) => encodeURIComponent(`Check out ${title} on Reshelved`);
const isDesktopViewport = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

const ListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { listing, sellerPhoto, loading, refetch: refetchListing } = useListing(id);
  const { ratings, setRatings, averageRating, refetch: refetchRatings } = useSellerRatings(listing?.userId);

  const [currentImage, setCurrentImage] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [visibleReviews, setVisibleReviews] = useState(REVIEWS_STEP);
  const [reviewFilter, setReviewFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [message, setMessage] = useState('');

  const listingImages = useMemo(
    () => normalizeImages(listing?.images).filter((image) => !failedImages.includes(image)),
    [listing?.images, failedImages]
  );
  const activeImage = listingImages[currentImage] || listingImages[0];
  const isBookmarked = Boolean(listing && userProfile?.bookmarks?.includes(listing.id));
  const filteredRatings = useMemo(
    () => reviewFilter === 'all' ? ratings : ratings.filter((rating) => rating.rating === reviewFilter),
    [ratings, reviewFilter]
  );

  useEffect(() => {
    setCurrentImage(0);
    setFailedImages([]);
    setVisibleReviews(REVIEWS_STEP);
    setReviewFilter('all');
  }, [listing?.id]);

  useEffect(() => {
    if (currentImage >= listingImages.length) setCurrentImage(0);
  }, [currentImage, listingImages.length]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const flashMessage = (text: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(text), 0);
  };

  const handleImageError = (image: string) => {
    setFailedImages((current) => current.includes(image) ? current : [...current, image]);
  };

  const goToNextImage = () => {
    setCurrentImage((current) => listingImages.length ? (current + 1) % listingImages.length : 0);
  };

  const goToPreviousImage = () => {
    setCurrentImage((current) => listingImages.length ? (current - 1 + listingImages.length) % listingImages.length : 0);
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

  const handleBookmark = async () => {
    if (!listing) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (bookmarking) return;

    setBookmarking(true);
    try {
      await toggleListingBookmark({ userId: currentUser.uid, listingId: listing.id, isBookmarked });
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
      const conversationId = await findOrCreateListingConversation({
        buyerId: currentUser.uid,
        buyerName: userProfile?.displayName || currentUser.displayName || 'User',
        buyerPhoto: userProfile?.photoURL || currentUser.photoURL || '',
        listing,
        sellerPhoto,
        listingImage: listingImages[0] || normalizeImages(listing.images)[0] || ''
      });
      if (isDesktopViewport()) {
        window.dispatchEvent(new CustomEvent('reshelved:open-chat', { detail: { conversationId } }));
        flashMessage('Chat opened.');
      } else {
        navigate(`/messages/${conversationId}`);
      }
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
      await reportListing({
        reporterId: currentUser.uid,
        reporterName: userProfile?.displayName || 'User',
        listingId: listing.id,
        listingTitle: listing.title,
        reason: reportReason,
        details: reportDetails
      });
      setShowReport(false);
      setReportReason('');
      setReportDetails('');
      flashMessage('Report submitted. Thank you for helping keep Reshelved safe.');
      await refetchListing();
    } catch (err) {
      console.error(err);
      flashMessage('Could not submit report. Check your Firestore rules.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRating = async () => {
    if (!currentUser || !listing) return;

    setActionLoading(true);
    try {
      await createSellerRating({
        fromUserId: currentUser.uid,
        fromUserName: userProfile?.displayName || 'User',
        toUserId: listing.userId,
        listingId: listing.id,
        listingTitle: listing.title,
        rating: ratingValue,
        title: reviewTitle,
        review: reviewText
      });
      setShowRating(false);
      setReviewTitle('');
      setReviewText('');
      flashMessage('Review submitted!');
      await refetchRatings();
    } catch (err) {
      console.error(err);
      flashMessage('Could not submit review. Check your Firestore rules.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!listing) return;
    if (!confirm('Are you sure you want to delete this listing?')) return;

    try {
      await removeListingById(listing.id);
      navigate('/');
    } catch (err) {
      console.error(err);
      flashMessage('Could not delete listing. Check your Firestore rules.');
    }
  };

  const handleDeleteReview = async (reviewId?: string) => {
    if (!reviewId || !userProfile?.isAdmin) return;
    if (!confirm('Delete this review permanently?')) return;

    setActionLoading(true);
    try {
      await deleteRatingById(reviewId);
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

  if (loading) {
    return (
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10 sm:pb-20">
          <div className="animate-pulse">
            <div className="aspect-square bg-stone-200 rounded-2xl max-w-4xl" />
            <div className="mt-6 space-y-4">
              <div className="h-8 bg-stone-200 rounded w-1/2" />
              <div className="h-4 bg-stone-200 rounded w-1/3" />
              <div className="h-4 bg-stone-100 rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center pb-10 sm:pb-20">
          <h2 className="text-xl font-bold text-stone-700">Listing not found</h2>
          <Link to="/" className="mt-4 inline-block text-primary-600 font-medium">Back to Home</Link>
        </div>
      </div>
    );
  }

  const isOwner = currentUser?.uid === listing.userId;
  const canEdit = isOwner || Boolean(userProfile?.isAdmin);
  const canDeleteReviews = Boolean(userProfile?.isAdmin);
  const isExpired = listing.expiresAt < Date.now();
  const typeLabels: Record<string, string> = { swap: 'Swap', donate: 'Free / Donate', sell: 'For Sale' };
  const shownRatings = filteredRatings.slice(0, visibleReviews);
  const shareUrl = getShareUrl();
  const shareText = getShareText(listing.title);
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
        <nav className="mb-6 text-sm text-stone-500" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-primary-700 font-medium">Home</Link>
          <span className="mx-2">&gt;</span>
          <Link to="/browse" className="hover:text-primary-700 font-medium">Browse</Link>
          <span className="mx-2">&gt;</span>
          <span className="text-stone-800 font-semibold">{listing.title}</span>
        </nav>

        {message && (
          <div className="mb-4 p-3 bg-primary-50 border border-primary-200 text-primary-700 rounded-xl text-sm transition-opacity duration-300">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-10">
          <div className="lg:col-span-2">
            <ListingGallery
              title={listing.title}
              images={listingImages}
              currentImage={currentImage}
              isExpired={isExpired}
              isBookmarked={isBookmarked}
              bookmarking={bookmarking}
              activeImage={activeImage}
              onSelectImage={setCurrentImage}
              onPreviousImage={goToPreviousImage}
              onNextImage={goToNextImage}
              onImageError={handleImageError}
              onCopyLink={copyLink}
              onBookmark={handleBookmark}
            />
          </div>

          <div className="lg:col-span-1 space-y-5">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-[#1665CC]/10 px-3 py-1 text-xs font-bold uppercase tracking-[1.5px] text-[#1665CC]">{typeLabels[listing.type] || listing.type}</span>
                {isExpired && <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[1.5px] text-red-700">Expired</span>}
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl">{listing.title}</h1>
              <p className="mt-3 text-xl font-medium text-stone-500">by {listing.author}</p>
            </div>

            <div className="inline-flex w-fit max-w-full flex-wrap items-center rounded-xl border border-stone-200 bg-white text-sm text-stone-700">
              <div className="flex items-center gap-2 px-3 py-2"><i className="las la-check-circle text-stone-500" /><span>{listing.condition}</span></div>
              <div className="h-6 w-px bg-stone-200" />
              <div className="flex items-center gap-2 px-3 py-2"><i className="las la-map-marker text-stone-500" /><span>{listing.location}</span></div>
              <div className="h-6 w-px bg-stone-200" />
              <div className="flex items-center gap-2 px-3 py-2"><i className="las la-folder text-stone-500" /><span>{listing.category}</span></div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              {listing.type === 'sell' && listing.price > 0 && <p className="text-3xl font-bold text-stone-950">KSh {listing.price.toLocaleString()}</p>}
              {listing.type === 'donate' && <p className="text-3xl font-bold text-green-700">Free</p>}
              {listing.type === 'swap' && <p className="text-3xl font-bold text-[#1665CC]">Swap</p>}
              <p className="mt-2 text-sm text-stone-500">Listed {new Date(listing.createdAt).toLocaleDateString()}</p>
              {!isOwner && currentUser && !isExpired && <button onClick={handleContact} disabled={actionLoading} className="mt-5 w-full cursor-pointer rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50">{actionLoading ? 'Opening chat...' : 'Contact Owner'}</button>}
              {!currentUser && <Link to="/login" className="mt-5 flex w-full items-center justify-center rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-700">Log in to Contact</Link>}
              {canEdit && <Link to={`/listing/${listing.id}/edit`} className="mt-3 flex w-full items-center justify-center rounded-xl border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50"><i className="las la-pen mr-2" /> Edit Listing</Link>}
              {canEdit && <button onClick={handleDelete} className="mt-3 w-full cursor-pointer rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50">Delete Listing</button>}
            </div>

            <SellerCard listing={listing} sellerPhoto={sellerPhoto} averageRating={averageRating} ratingsCount={ratings.length} />

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-stone-950">Share this book</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {shareItems.map((item) => <a key={item.label} href={item.href} target="_blank" rel="noreferrer" aria-label={`Share on ${item.label}`} className={`flex h-10 w-10 items-center justify-center rounded-full ${item.className}`}><i className={`${item.icon} text-lg`} /></a>)}
                <button onClick={copyLink} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-stone-100 text-stone-700"><i className="las la-link text-lg" /></button>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-12 border-t border-stone-200 pt-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <h2 className="text-2xl font-bold text-stone-950">About this book</h2>
              <p className="mt-4 whitespace-pre-line text-base leading-8 text-stone-700">{listing.description}</p>
            </div>
            <aside className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <h3 className="text-base font-bold text-stone-950">Safety tips</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
                <li>Meet in a public place.</li>
                <li>Check the book before payment or exchange.</li>
                <li>Use Reshelved messages before sharing private details.</li>
              </ul>
              {!isOwner && currentUser && <button onClick={() => setShowReport(true)} className="mt-5 cursor-pointer text-sm font-bold text-red-600">Report this listing</button>}
            </aside>
          </div>
        </section>

        <section className="mt-12 border-t border-stone-200 pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-stone-950">Seller reviews</h2>
              <p className="mt-2 text-sm text-stone-500">See what other readers say about this seller.</p>
            </div>
            {!isOwner && currentUser && <button onClick={() => setShowRating(true)} className="w-fit cursor-pointer rounded-xl bg-[#1665CC] px-5 py-3 text-sm font-bold text-white">Leave a review</button>}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-4xl font-bold text-stone-950">{averageRating.toFixed(1)}</p>
              <RatingStars rating={averageRating} size="md" />
              <p className="mt-2 text-sm text-stone-500">Based on {ratings.length} reviews</p>
              <div className="mt-5 space-y-2">
                {ratingBreakdown.map((item) => <button key={item.star} onClick={() => setReviewFilter(item.star as 1 | 2 | 3 | 4 | 5)} className="flex w-full cursor-pointer items-center gap-2 text-sm"><span className="w-10 text-left font-semibold">{item.star} ★</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100"><span className="block h-full bg-amber-400" style={{ width: `${item.percent}%` }} /></span><span className="w-8 text-right text-stone-500">{item.count}</span></button>)}
              </div>
            </div>

            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                {reviewFilters.map((filter) => <button key={filter.label} onClick={() => setReviewFilter(filter.value)} className={`cursor-pointer rounded-full px-3 py-1 text-sm font-semibold ${reviewFilter === filter.value ? 'bg-[#1665CC] text-white' : 'bg-stone-100 text-stone-600'}`}>{filter.label} ({filter.count})</button>)}
              </div>
              <div className="space-y-4">
                {shownRatings.length === 0 && <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-500">No reviews yet.</div>}
                {shownRatings.map((rating) => <article key={rating.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><RatingStars rating={rating.rating} size="sm" /><h3 className="mt-2 text-base font-bold text-stone-950">{rating.title || 'Review'}</h3><p className="mt-1 text-sm text-stone-500">{rating.fromUserName} · {new Date(rating.createdAt).toLocaleDateString()}</p></div>{canDeleteReviews && <button onClick={() => handleDeleteReview(rating.id)} className="cursor-pointer text-sm font-bold text-red-600">Delete</button>}</div>{rating.review && <p className="mt-3 text-sm leading-6 text-stone-700">{rating.review}</p>}</article>)}
              </div>
              {filteredRatings.length > visibleReviews && <button onClick={() => setVisibleReviews((current) => current + REVIEWS_STEP)} className="mt-5 cursor-pointer rounded-xl border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700">Load more reviews</button>}
            </div>
          </div>
        </section>

        <RecentListings excludeId={listing.id} />
      </div>

      {showReport && <ReportModal reason={reportReason} details={reportDetails} loading={actionLoading} onReasonChange={setReportReason} onDetailsChange={setReportDetails} onClose={() => setShowReport(false)} onSubmit={handleReport} />}
      {showRating && <RatingModal rating={ratingValue} title={reviewTitle} review={reviewText} loading={actionLoading} onRatingChange={setRatingValue} onTitleChange={setReviewTitle} onReviewChange={setReviewText} onClose={() => setShowRating(false)} onSubmit={handleRating} />}
    </div>
  );
};

export default ListingDetail;
