import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Listing } from '../types';

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

const BookCard: React.FC<{ listing: Listing }> = ({ listing }) => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookmarking, setBookmarking] = useState(false);
  const images = useMemo(() => {
    return (listing.images || [])
      .filter((image): image is string => typeof image === 'string')
      .map((image) => image.trim())
      .filter((image) => image.length > 0);
  }, [listing.images]);
  const coverImage = images[0];
  const hasImages = Boolean(coverImage);
  const isBookmarked = Boolean(userProfile?.bookmarks?.includes(listing.id));

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [listing.id, coverImage]);

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
    <Link to={`/listing/${listing.id}`} className="group block h-full">
      <article className="h-full bg-white rounded-[22px] border border-stone-200 p-2.5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
        <div className="relative aspect-[1.45/1] rounded-[18px] bg-[#f5eee3] overflow-hidden">
          {hasImages ? (
            <>
              <img
                src={coverImage}
                alt={listing.title}
                className="absolute inset-0 w-full h-full object-cover bg-[#f5eee3]"
                loading="eager"
              />
              {images.length > 1 && images.map((image, index) => (
                <img
                  key={`${image}-${index}`}
                  src={image}
                  alt={listing.title}
                  className={`absolute inset-0 w-full h-full object-cover bg-[#f5eee3] transition-opacity duration-700 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              ))}
            </>
          ) : (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#f5eee3]">
              <i className="las la-book-open text-5xl text-stone-300" />
            </div>
          )}

          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 text-primary-700 shadow-sm text-xs font-bold backdrop-blur-sm">
              <i className={`${typeIcons[listing.type]} text-base leading-none`} />
              {typeLabels[listing.type]}
            </span>
          </div>

          {currentUser && (
            <button
              type="button"
              onClick={handleBookmark}
              disabled={bookmarking}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark book'}
              className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-white/95 text-primary-600 flex items-center justify-center shadow-sm backdrop-blur-sm transition hover:bg-primary-50 disabled:opacity-60"
            >
              <i className={`${isBookmarked ? 'las la-bookmark' : 'lar la-bookmark'} text-lg`} />
            </button>
          )}
        </div>

        <div className="px-1.5 pt-3.5 pb-1">
          <h3 className="text-[16px] font-bold text-stone-950 leading-tight line-clamp-1 group-hover:text-primary-700 transition">
            {listing.title}
          </h3>
          <p className="text-[14px] text-stone-500 mt-0.5 line-clamp-1">by {listing.author}</p>

          <div className="flex items-center gap-2 mt-3">
            {listing.userPhoto ? (
              <img src={listing.userPhoto} alt={listing.userName} className="w-7 h-7 rounded-full object-cover bg-[#f5eee3]" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#f5eee3] text-stone-500 flex items-center justify-center text-[10px] font-bold">
                {listing.userName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-stone-700 truncate">Listed by {listing.userName || 'Reshelved user'}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#f5eee3] border border-stone-200/70 p-3 grid grid-cols-3 divide-x divide-stone-300/70">
            <div className="px-1.5 min-w-0">
              <p className="text-[11px] font-semibold text-stone-500">Condition</p>
              <p className="mt-0.5 text-sm font-bold text-stone-800 truncate">{listing.condition}</p>
            </div>
            <div className="px-2.5 min-w-0">
              <p className="text-[11px] font-semibold text-stone-500">Location</p>
              <p className="mt-0.5 text-sm font-bold text-stone-800 truncate">{listing.location}</p>
            </div>
            <div className="px-2.5 min-w-0">
              <p className="text-[11px] font-semibold text-stone-500">Price</p>
              <p className="mt-0.5 text-sm font-bold text-stone-800 truncate">{getDisplayPrice(listing)}</p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default BookCard;
