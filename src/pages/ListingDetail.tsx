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
      navigate(`/messages/${conversationId}`);
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
                <span className="inline-flex items-center gap-2 rounded-md border border-[#1665CC] bg-white px-3 py-1.5 text-sm font-bold text-[#1665CC]"><i className="las la-exchange-alt text-lg" />{typeLabels[listing.type]}</span>
                <span className="inline-flex items-center gap-2 rounded-md bg-[#1665CC]/10 px-3 py-1.5 text-sm font-bold text-[#1665CC]"><i className="las la-book-open text-lg" />{listing.condition}</span>
                {ratings.length > 0 && <span className="inline-flex items-center gap-2 rounded-md bg-stone-100 px-3 py-1.5 text-sm font-bold text-stone-700"><i className="las la-star text-lg text-amber-400" />{averageRating.toFixed(1)} seller rating</span>}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 leading-tight">{listing.title}</h1>
              <p className="text-stone-500 mt-2">by {listing.author}</p>
            </div>

            {listing.type === 'sell' && listing.price && (
              <div className="text-2xl font-bold text-primary-700">KSh {listing.price.toLocaleString()}</div>
            )}

            <div className="inline-flex w-fit max-w-full flex-wrap items-center rounded-xl border border-stone-200 bg-white text-sm text-stone-700">
              <div className="flex items-center gap-2 px-4 py-3"><i className="las la-map-marker-alt text-lg text-stone-400" /><span>{listing.location}</span></div>
              <div className="h-6 w-px bg-stone-200" />
              <div className="flex items-center gap-2 px-4 py-3"><i className="las la-layer-group text-lg text-stone-400" /><span>{listing.category}</span></div>
              <div className="h-6 w-px bg-stone-200" />
              <div className="flex items-center gap-2 px-4 py-3"><i className="las la-clock text-lg text-stone-400" /><span>{isExpired ? 'Expired' : `${Math.ceil((listing.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))} Days Left`}</span></div>
            </div>

            {listing.description && (
              <div>
                <h3 className="font-semibold text-stone-700 mb-1">Description</h3>
                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
              </div>
            )}

            <SellerCard
              sellerId={listing.userId}
              sellerName={listing.userName}
              sellerPhoto={sellerPhoto}
              listingId={listing.id}
              listingTitle={listing.title}
              ratingsCount={ratings.length}
              averageRating={averageRating}
            />

            <div className="space-y-2">
              {!isOwner && currentUser && !isExpired && (
                <button onClick={handleContact} disabled={actionLoading} className="cursor-pointer w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50">
                  {actionLoading ? 'Please wait...' : `Contact ${listing.userName}`}
                </button>
              )}
              {!currentUser && (
                <Link to="/login" className="block w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition text-center">Log in to Contact</Link>
              )}
              {!isOwner && currentUser && (
                <div className="flex gap-2">
                  <button onClick={() => setShowRating(true)} className="cursor-pointer flex-1 py-2.5 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl transition text-sm font-medium">★ Leave Review</button>
                  <button onClick={() => setShowReport(true)} className="cursor-pointer flex-1 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition text-sm font-medium">⚑ Report</button>
                </div>
              )}
              {canEdit && <Link to={`/listing/${listing.id}/edit`} className="block w-full py-2.5 border border-primary-200 text-primary-700 hover:bg-primary-50 rounded-xl transition text-sm font-medium text-center">Edit Listing</Link>}
              {canEdit && <button onClick={handleDelete} className="cursor-pointer w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition text-sm font-medium">Delete Listing</button>}
            </div>

            <div className="pt-3">
              <h2 className="text-xl font-bold text-stone-900 mb-3">Share link</h2>
              <div className="flex flex-wrap gap-3">
                {shareItems.map((item) => (
                  <a key={item.label} href={item.href} target="_blank" rel="noreferrer" aria-label={`Share on ${item.label}`} className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl transition hover:-translate-y-0.5 ${item.className}`}><i className={item.icon} /></a>
                ))}
                <button type="button" onClick={copyLink} aria-label="Copy link" className="cursor-pointer w-12 h-12 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center text-2xl hover:bg-stone-200 transition"><i className="las la-link" /></button>
              </div>
            </div>
          </div>
        </div>

        {ratings.length > 0 && (
          <section className="mt-12 border-t border-stone-200 pt-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold text-stone-900">Seller ratings & reviews</h2>
              {canDeleteReviews && <span className="text-xs font-semibold uppercase tracking-wide text-red-500">Admin review controls active</span>}
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
              <div>
                <div className="text-5xl font-black tracking-tight text-stone-950">{averageRating.toFixed(1)} out of 5</div>
                <div className="mt-3 flex items-center gap-2"><RatingStars rating={averageRating} className="text-lg" /><span className="text-sm text-stone-600">{ratings.length} review{ratings.length !== 1 ? 's' : ''}</span></div>
                <p className="mt-5 text-sm font-semibold text-stone-600">Based on seller interactions</p>
              </div>
              <div className="space-y-3">
                {ratingBreakdown.map((item) => (
                  <button key={item.star} type="button" onClick={() => { setReviewFilter(item.star as 1 | 2 | 3 | 4 | 5); setVisibleReviews(REVIEWS_STEP); }} className="grid w-full cursor-pointer grid-cols-[64px_1fr_70px] items-center gap-3 text-sm text-left">
                    <span className="font-medium text-stone-600 underline underline-offset-2">{item.star} star{item.star !== 1 ? 's' : ''}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-stone-200"><span className="block h-full rounded-full bg-[#1665CC]" style={{ width: `${item.percent}%` }} /></span>
                    <span className="text-right text-stone-600">{item.percent}% ({item.count})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 border-t border-stone-200 pt-5">
              {reviewFilters.map((item) => (
                <button key={String(item.value)} type="button" onClick={() => { setReviewFilter(item.value); setVisibleReviews(REVIEWS_STEP); }} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition ${reviewFilter === item.value ? 'border-[#1665CC] bg-[#1665CC] text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-[#1665CC] hover:text-[#1665CC]'}`}>
                  {item.label} <span className={reviewFilter === item.value ? 'text-white/80' : 'text-stone-400'}>({item.count})</span>
                </button>
              ))}
            </div>

            <div className="mt-8 space-y-0">
              {shownRatings.length > 0 ? shownRatings.map((rating) => (
                <article key={rating.id} className="border-t border-stone-200 py-6">
                  <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                    <div>
                      <p className="text-sm text-stone-500">{new Date(rating.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="mt-6 font-semibold text-stone-700">{rating.fromUserName}</p>
                    </div>
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-amber-400">{'★'.repeat(rating.rating)}{'☆'.repeat(5 - rating.rating)}</div>
                        {canDeleteReviews && <button type="button" onClick={() => handleDeleteReview(rating.id)} disabled={actionLoading} className="shrink-0 cursor-pointer rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Delete</button>}
                      </div>
                      <h3 className="mt-4 text-xl font-extrabold text-stone-800">{rating.title || rating.listingTitle || 'Book exchange review'}</h3>
                      {rating.review && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-700">{rating.review}</p>}
                      <p className="mt-3 text-xs text-stone-500">Review for {rating.listingTitle}</p>
                    </div>
                  </div>
                </article>
              )) : <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-500">No reviews match this filter.</div>}
            </div>

            {visibleReviews < filteredRatings.length && (
              <button onClick={() => setVisibleReviews((current) => current + REVIEWS_STEP)} className="cursor-pointer mt-4 rounded-full border border-stone-800 px-5 py-2.5 text-sm font-bold text-stone-900 hover:bg-stone-50">View more reviews</button>
            )}
          </section>
        )}

        <RecentListings excludeId={listing.id} limit={3} />

        {showReport && (
          <ReportModal
            reason={reportReason}
            details={reportDetails}
            loading={actionLoading}
            onReasonChange={setReportReason}
            onDetailsChange={setReportDetails}
            onClose={() => setShowReport(false)}
            onSubmit={handleReport}
          />
        )}

        {showRating && (
          <RatingModal
            sellerName={listing.userName}
            rating={ratingValue}
            title={reviewTitle}
            review={reviewText}
            loading={actionLoading}
            onRatingChange={setRatingValue}
            onTitleChange={setReviewTitle}
            onReviewChange={setReviewText}
            onClose={() => setShowRating(false)}
            onSubmit={handleRating}
          />
        )}
      </div>
    </div>
  );
};

export default ListingDetail;
