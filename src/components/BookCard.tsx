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
    <article onClick={handleCardClick} role="link" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleCardClick(); } }} className="group block h-full cursor-pointer bg-white rounded-2xl border border-stone-200 p-2 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
      <div className="relative aspect-[1.45/1] rounded-xl bg-stone-100 overflow-hidden">
        {hasImages ? <>{<img src={coverImage} alt={listing.title} className="absolute inset-0 w-full h-full object-cover bg-stone-100" loading="eager" onError={() => handleImageError(coverImage)} />}{images.length > 1 && images.map((image, index) => <img key={`${image}-${index}`} src={image} alt={listing.title} className={`absolute inset-0 w-full h-full object-cover bg-stone-100 transition-opacity duration-700 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`} loading={index === 0 ? 'eager' : 'lazy'} onError={() => handleImageError(image)} />)}</> : <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-stone-100"><i className="las la-book-open text-5xl text-stone-300" /></div>}
        <div className="absolute top-3 left-3"><span className="inline-flex cursor-default items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 text-primary-700 shadow-sm text-xs font-bold backdrop-blur-sm"><i className={`${typeIcons[listing.type]} cursor-default text-base leading-none`} />{typeLabels[listing.type]}</span></div>
        <div className="absolute top-3 right-3 flex items-center gap-2">{isOwner && <button type="button" onClick={handleEdit} className="cursor-pointer w-9 h-9 rounded-lg bg-white/95 text-primary-600 flex items-center justify-center shadow-sm backdrop-blur-sm transition hover:bg-primary-50" aria-label="Edit listing"><i className="las la-pen text-lg" /></button>}{currentUser && <button type="button" onClick={handleBookmark} disabled={bookmarking} aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark book'} className={`cursor-pointer w-9 h-9 rounded-lg flex items-center justify-center shadow-sm backdrop-blur-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${isBookmarked ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-white/95 text-primary-600 hover:bg-primary-50'}`}><i className={`${isBookmarked ? 'las la-bookmark' : 'lar la-bookmark'} text-lg`} /></button>}</div>
      </div>
      <div className="px-1.5 pt-3.5 pb-1">
        <h3 className="text-[16px] font-bold text-stone-950 leading-tight line-clamp-1 group-hover:text-primary-700 transition">{listing.title}</h3>
        <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">by {listing.author}</p>
        <div className="flex items-start gap-2 mt-3">
          {sellerPhoto ? <img src={sellerPhoto} alt={listing.userName} className="w-7 h-7 rounded-full object-cover bg-stone-100" /> : <div className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center text-[10px] font-bold">{listing.userName?.[0]?.toUpperCase() || 'U'}</div>}
          <div className="min-w-0"><p className="text-xs font-semibold text-stone-700 truncate">Listed by {listing.userName || 'Reshelved user'}</p>{sellerRating.count > 0 && <p className="mt-0.5 text-xs font-semibold text-accent-500 leading-none">{getStarLabel(sellerRating.average)} <span className="text-stone-500">({sellerRating.count})</span></p>}</div>
        </div>
        <div className="mt-4 rounded-xl bg-[#FFF4E2]/50 border border-stone-200/60 p-2.5 grid grid-cols-3 divide-x divide-stone-300/50">
          <div className="px-1.5 min-w-0"><p className="text-[10px] font-semibold text-stone-500">Condition</p><p className="mt-0.5 text-[14px] sm:text-[12px] font-bold text-stone-800 truncate">{listing.condition}</p></div>
          <div className="px-2.5 min-w-0"><p className="text-[10px] font-semibold text-stone-500">Location</p><p className="mt-0.5 text-[14px] sm:text-[12px] font-bold text-stone-800 truncate">{listing.location}</p></div>
          <div className="px-2.5 min-w-0"><p className="text-[10px] font-semibold text-stone-500">Price</p><p className="mt-0.5 text-[14px] sm:text-[12px] font-bold text-stone-800 truncate">{getDisplayPrice(listing)}</p></div>
        </div>
      </div>
    </article>
  );
};

export default BookCard;
