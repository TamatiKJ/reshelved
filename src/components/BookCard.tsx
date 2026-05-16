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

const typeIcons: Record<Listing['type'], string> = {
  swap: 'las la-sync',
  donate: 'las la-gift',
  sell: 'las la-tag'
};

const getDisplayPrice = (listing: Listing) => {
  if (listing.type === 'swap') return 'Swap';
  if (listing.type === 'donate') return 'Free';
  if (listing.price && listing.price > 0) return `KSh ${listing.price.toLocaleString()}`;
  return 'Ask';
};

const normalizeImages = (images?: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images.filter((image): image is string => typeof image === 'string').map((image) => image.trim()).filter((image) => image.length > 0);
};

const getStarLabel = (average: number) => {
  const rounded = Math.max(0, Math.min(5, Math.round(average)));
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
};

const BookCard: React.FC<{ listing: Listing }> = ({ listing }) => {
  const navigate = useNavigate();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookmarking, setBookmarking] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [sellerPhoto, setSellerPhoto] = useState(listing.userPhoto || '');
  const [sellerRating, setSellerRating] = useState<{ average: number; count: number }>({ average: Number((listing as any).sellerRatingAverage || 0), count: Number((listing as any).sellerRatingCount || 0) });
  const images = useMemo(() => normalizeImages(listing.images).filter((image) => !failedImages.includes(image)), [listing.images, failedImages]);
  const coverImage = images[0];
  const hasImages = Boolean(coverImage);
  const isBookmarked = Boolean(userProfile?.bookmarks?.includes(listing.id));
  const isOwner = Boolean(currentUser && currentUser.uid === listing.userId);
  const displayPrice = getDisplayPrice(listing);

  useEffect(() => {
    setCurrentImageIndex(0);
    setFailedImages([]);
  }, [listing.id]);

  useEffect(() => { setCurrentImageIndex(0); }, [coverImage]);
  useEffect(() => { setSellerPhoto(listing.userPhoto || ''); }, [listing.userPhoto]);

  useEffect(() => {
    const fetchSellerMeta = async () => {
      if (!listing.userId) return;
      try {
        const publicSnap = await getDoc(doc(db, 'publicProfiles', listing.userId)).catch(() => null);
        if (publicSnap?.exists()) {
          const data = publicSnap.data();
          if (typeof data.photoURL === 'string' && data.photoURL.trim()) setSellerPhoto(data.photoURL);
          if (typeof data.ratingCount === 'number') {
            setSellerRating({ average: Number(data.ratingAverage || 0), count: Number(data.ratingCount || 0) });
          }
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
                ratingAverage: sellerRating.average,
                ratingCount: sellerRating.count,
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
          } else if (!publicSnap?.exists()) {
            setSellerRating({ average: 0, count: 0 });
          }
        }
      } catch (err) {
        console.error('Error loading seller card data:', err);
      }
    };

    fetchSellerMeta();
  }, [listing.userId, listing.id, listing.userPhoto, currentUser?.uid]);

  useEffect(() => {
    if (images.length <= 1) return;
    const startDelay = window.setTimeout(() => {
      const interval = window.setInterval(() => {
        setCurrentImageIndex((current) => (current + 1) % images.length);
      }, 3200);
      return () => window.clearInterval(interval);
    }, 1800);
    return () => window.clearTimeout(startDelay);
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
      className="group block h-full cursor-pointer overflow-hidden rounded-[30px] border border-white/20 bg-[#1427A8] shadow-[0_16px_45px_rgba(15,23,42,0.16)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
    >
      <div className="relative aspect-[1.45/1] overflow-hidden bg-stone-100">
        {hasImages ? (
          <>
            <img
              src={coverImage}
              alt={listing.title}
              className="absolute inset-0 h-full w-full bg-stone-100 object-cover transition duration-700 group-hover:scale-105"
              loading="eager"
              onError={() => handleImageError(coverImage)}
            />
            {images.length > 1 && images.map((image, index) => (
              <img
                key={`${image}-${index}`}
                src={image}
                alt={listing.title}
                className={`absolute inset-0 h-full w-full bg-stone-100 object-cover transition-all duration-700 ease-in-out group-hover:scale-105 ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                loading={index === 0 ? 'eager' : 'lazy'}
                onError={() => handleImageError(image)}
              />
            ))}
          </>
        ) : (
          <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-stone-100">
            <i className="las la-book-open text-5xl text-stone-300" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />

        <div className="absolute left-4 top-4">
          <span className="inline-flex cursor-default items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-700 shadow-sm backdrop-blur-sm">
            <i className={`${typeIcons[listing.type]} cursor-default text-base leading-none`} />
            {typeLabels[listing.type]}
          </span>
        </div>

        <div className="absolute right-4 top-4 flex items-center gap-2">
          {sellerRating.count > 0 && (
            <div className="flex cursor-default items-center gap-1.5 rounded-full bg-[#4da9e8]/85 px-3.5 py-1.5 text-white shadow-sm backdrop-blur-md">
              <i className="las la-star text-base text-[#F7AF31]" />
              <span className="text-sm font-extrabold">{sellerRating.average.toFixed(1)}</span>
            </div>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={handleEdit}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/95 text-primary-600 shadow-sm backdrop-blur-sm transition hover:bg-primary-50"
              aria-label="Edit listing"
            >
              <i className="las la-pen text-lg" />
            </button>
          )}
          {currentUser && (
            <button
              type="button"
              onClick={handleBookmark}
              disabled={bookmarking}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark book'}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${isBookmarked ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-white/95 text-primary-600 hover:bg-primary-50'}`}
            >
              <i className={`${isBookmarked ? 'las la-bookmark' : 'lar la-bookmark'} text-lg`} />
            </button>
          )}
        </div>

        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {images.slice(0, 4).map((image, index) => (
              <span
                key={`${image}-dot-${index}`}
                className={`h-1.5 rounded-full transition-all ${index === currentImageIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-[#1427A8] via-[#1457B8] to-[#22A6CF] px-6 pb-6 pt-7 text-white sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="line-clamp-1 font-['Work_Sans'] text-[22px] font-bold leading-tight text-white transition group-hover:text-white">
              {listing.title}
            </h3>
            <p className="mt-1 line-clamp-1 text-[14px] text-white/70">by {listing.author}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[22px] font-extrabold leading-none text-[#8AF0B0]">{displayPrice}</p>
            {listing.type === 'sell' && <p className="mt-1 text-xs font-medium text-white/65">price</p>}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 text-white/70">
          <i className="las la-map-marker-alt text-[23px] leading-none" />
          <span className="line-clamp-1 text-[15px] font-medium">{listing.location}, Nairobi</span>
        </div>

        <div className="mt-7 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3 text-white">
          <div className="flex min-w-0 items-center gap-2.5">
            <i className="las la-book-open shrink-0 text-[27px] leading-none text-white/90" />
            <span className="line-clamp-1 text-[14px] font-semibold">{listing.condition}</span>
          </div>

          <div className="h-8 w-px bg-white/25" />

          <div className="flex min-w-0 items-center gap-2.5">
            <i className={`${typeIcons[listing.type]} shrink-0 text-[27px] leading-none text-white/90`} />
            <span className="line-clamp-1 text-[14px] font-semibold">{typeLabels[listing.type]}</span>
          </div>

          <div className="h-8 w-px bg-white/25" />

          <div className="flex min-w-0 items-center gap-2.5">
            <i className="las la-layer-group shrink-0 text-[27px] leading-none text-white/90" />
            <span className="line-clamp-1 text-[14px] font-semibold">{listing.category}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 border-t border-white/15 pt-4">
          {sellerPhoto ? (
            <img src={sellerPhoto} alt={listing.userName} className="h-7 w-7 rounded-full bg-white/10 object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">
              {listing.userName?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white/80">Listed by {listing.userName || 'Reshelved user'}</p>
            {sellerRating.count > 0 && <p className="mt-0.5 text-[11px] font-semibold leading-none text-[#F7AF31]">{getStarLabel(sellerRating.average)} <span className="text-white/60">({sellerRating.count})</span></p>}
          </div>
        </div>
      </div>
    </article>
  );
};

export default BookCard;
