import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Listing, Rating } from '../types';

const typeLabels: Record<Listing['type'], string> = {
  swap: 'Swap',
  donate: 'Free',
  sell: 'Sell'
};

const normalizeImages = (images?: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images.filter((image): image is string => typeof image === 'string').map((image) => image.trim()).filter((image) => image.length > 0);
};

const getStarLabel = (average: number) => {
  const rounded = Math.max(0, Math.min(5, Math.round(average)));
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
};

const formatListingValue = (listing: Listing) => {
  if (listing.type === 'sell') {
    const amount = Number(listing.price || 0);
    return amount > 0 ? `KSh ${amount.toLocaleString()}` : 'For Sale';
  }

  return typeLabels[listing.type];
};

const BookCard: React.FC<{ listing: Listing }> = ({ listing }) => {
  const navigate = useNavigate();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookmarking, setBookmarking] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [sellerPhoto, setSellerPhoto] = useState(listing.userPhoto || '');
  const [sellerRating, setSellerRating] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  const images = useMemo(() => normalizeImages(listing.images).filter((image) => !failedImages.includes(image)), [listing.images, failedImages]);
  const activeImage = images[currentImageIndex] || images[0];
  const hasImages = Boolean(activeImage);
  const isBookmarked = Boolean(userProfile?.bookmarks?.includes(listing.id));
  const isOwner = Boolean(currentUser && currentUser.uid === listing.userId);
  const listingValue = formatListingValue(listing);
  const hasReviews = sellerRating.count > 0;

  useEffect(() => {
    setCurrentImageIndex(0);
    setFailedImages([]);
    setSellerRating({ average: 0, count: 0 });
  }, [listing.id]);

  useEffect(() => {
    if (currentImageIndex >= images.length) setCurrentImageIndex(0);
  }, [images.length, currentImageIndex]);

  useEffect(() => { setSellerPhoto(listing.userPhoto || ''); }, [listing.userPhoto]);

  useEffect(() => {
    const fetchSellerMeta = async () => {
      if (!listing.userId) return;
      try {
        const publicSnap = await getDoc(doc(db, 'publicProfiles', listing.userId)).catch(() => null);
        if (publicSnap?.exists()) {
          const data = publicSnap.data();
          if (typeof data.photoURL === 'string' && data.photoURL.trim()) setSellerPhoto(data.photoURL);
        }

        const userSnap = await getDoc(doc(db, 'users', listing.userId)).catch(() => null);
        if (userSnap?.exists()) {
          const userData = userSnap.data();
          const photoURL = userData.photoURL;
          if (typeof photoURL === 'string' && photoURL.trim()) {
            setSellerPhoto(photoURL);
            if (currentUser?.uid === listing.userId && photoURL !== listing.userPhoto) {
              await setDoc(doc(db, 'listings', listing.id), { userPhoto: photoURL }, { merge: true }).catch(() => undefined);
              await setDoc(doc(db, 'publicProfiles', listing.userId), {
                uid: listing.userId,
                displayName: userData.displayName || listing.userName || 'Reshelved user',
                photoURL,
                location: userData.location || listing.location || '',
                updatedAt: Date.now()
              }, { merge: true }).catch(() => undefined);
            }
          }
        }

        const ratingsSnap = await getDocs(query(collection(db, 'ratings'), where('toUserId', '==', listing.userId))).catch(() => null);
        if (ratingsSnap) {
          const ratings: Rating[] = [];
          ratingsSnap.forEach((item) => ratings.push({ id: item.id, ...item.data() } as Rating));
          if (ratings.length > 0) {
            const average = ratings.reduce((sum, rating) => sum + (rating.rating || 0), 0) / ratings.length;
            setSellerRating({ average, count: ratings.length });
          } else {
            setSellerRating({ average: 0, count: 0 });
          }
        }
      } catch (err) {
        console.error('Error loading seller card data:', err);
        setSellerRating({ average: 0, count: 0 });
      }
    };

    fetchSellerMeta();
  }, [listing.userId, listing.id, listing.userPhoto, currentUser?.uid]);

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentImageIndex((current) => (current + 1) % images.length);
    }, 3500);

    return () => window.clearInterval(interval);
  }, [images.length]);

  const handleImageError = (image: string) => setFailedImages((current) => current.includes(image) ? current : [...current, image]);
  const handleCardClick = () => navigate(`/listing/${listing.id}`);

  const handleEdit = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    navigate(`/listing/${listing.id}/edit`);
  };

  const handleBookmark = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!currentUser || bookmarking) return;

    setBookmarking(true);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        bookmarks: isBookmarked ? arrayRemove(listing.id) : arrayUnion(listing.id),
        lastSeen: Date.now()
      }, { merge: true });
      await refreshProfile();
    } catch (err) {
      console.error('Error updating bookmark:', err);
    } finally {
      setBookmarking(false);
    }
  };

  return (
    <article
      onClick={handleCardClick}
      role="link"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleCardClick();
        }
      }}
      className="group block h-full cursor-pointer overflow-hidden rounded-[24px] border border-stone-200 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-xl"
    >
      <div className="relative aspect-[1.42/1] overflow-hidden rounded-[18px] bg-stone-100">
        {hasImages ? (
          <img
            key={activeImage}
            src={activeImage}
            alt={listing.title}
            className="absolute inset-0 h-full w-full bg-stone-100 object-cover transition-all duration-700 ease-in-out group-hover:scale-105"
            loading="eager"
            onError={() => handleImageError(activeImage)}
          />
        ) : (
          <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-stone-100">
            <i className="las la-book-open text-5xl text-stone-300" />
          </div>
        )}

        {currentUser && (
          <button
            type="button"
            onClick={handleBookmark}
            disabled={bookmarking}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark book'}
            aria-pressed={isBookmarked}
            className="absolute left-3 top-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBookmarked ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary-600" fill="currentColor" aria-hidden="true">
                <path d="M6 3.5C6 2.67 6.67 2 7.5 2h9c.83 0 1.5.67 1.5 1.5V22l-6-4-6 4V3.5z" />
              </svg>
            ) : (
              <i className="lar la-bookmark text-xl leading-none text-stone-500" />
            )}
          </button>
        )}

        <div className="absolute right-3 top-3 flex items-center gap-2">
          {hasReviews && (
            <div className="flex cursor-default items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-stone-700 shadow-sm ring-1 ring-stone-200">
              <i className="las la-star text-base text-[#F7AF31]" />
              <span className="text-sm font-bold">{sellerRating.average.toFixed(1)}</span>
            </div>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={handleEdit}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-primary-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-primary-50"
              aria-label="Edit listing"
            >
              <i className="las la-pen text-xl" />
            </button>
          )}
        </div>
      </div>

      <div className="px-1 pb-1 pt-4">
        <h3 className="reshelved-book-card-title line-clamp-1 font-['Work_Sans'] text-[20px] font-bold leading-tight text-stone-950 transition group-hover:text-primary-700">
          {listing.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-[15px] text-stone-500">by {listing.author}</p>

        <div className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-stone-950">
          <i className="las la-map-marker-alt shrink-0 text-[18px] leading-none text-stone-950" />
          <span className="line-clamp-1">{listing.location}, Nairobi</span>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-stone-200 text-stone-600">
          <div className="flex min-w-0 items-center justify-center gap-1 px-1.5 py-1.5">
            <i className="las la-book-open shrink-0 text-[16px] leading-none text-stone-500" />
            <span className="min-w-0 truncate text-[13px] font-semibold text-stone-700">{listing.condition}</span>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-1 px-1.5 py-1.5">
            <i className="las la-tag shrink-0 text-[16px] leading-none text-stone-500" />
            <span className="min-w-0 truncate text-[13px] font-semibold text-stone-700">{listingValue}</span>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-1 px-1.5 py-1.5">
            <i className="las la-layer-group shrink-0 text-[16px] leading-none text-stone-500" />
            <span className="min-w-0 truncate text-[13px] font-semibold text-stone-700">{listing.category}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-stone-200 pt-4">
          {sellerPhoto ? (
            <img src={sellerPhoto} alt={listing.userName} className="h-9 w-9 rounded-full bg-stone-100 object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
              {listing.userName?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm text-stone-500">Listed by <span className="font-bold text-stone-800">{listing.userName || 'Reshelved user'}</span></p>
            <p className={`mt-0.5 text-[13px] font-semibold leading-none ${hasReviews ? 'text-[#F59E0B]' : 'text-stone-400'}`}>
              {getStarLabel(hasReviews ? sellerRating.average : 0)} <span className="text-stone-500">{hasReviews ? `(${sellerRating.count})` : 'No reviews yet'}</span>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
};

export default BookCard;
