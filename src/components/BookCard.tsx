import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Listing } from '../types';

const typeLabels: Record<Listing['type'], string> = {
  swap: 'Swap',
  donate: 'Free',
  sell: 'For sale'
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
  return 'Price on request';
};

const BookCard: React.FC<{ listing: Listing }> = ({ listing }) => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookmarking, setBookmarking] = useState(false);
  const images = useMemo(() => (listing.images || []).filter(Boolean), [listing.images]);
  const hasImages = images.length > 0;
  const isBookmarked = Boolean(userProfile?.bookmarks?.includes(listing.id));

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = window.setInterval(() => {
      setCurrentImageIndex((current) => (current + 1) % images.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, [images.length]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [listing.id]);

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
      <article className="h-full bg-white rounded-[28px] border border-stone-200 p-3 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="relative aspect-[1.45/1] rounded-[22px] bg-stone-100 overflow-hidden">
          {hasImages ? (
            images.map((image, index) => (
              <img
                key={`${image}-${index}`}
                src={image}
                alt={listing.title}
                className={`absolute inset-0 w-full h-full object-cover bg-stone-100 transition-opacity duration-700 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
              />
            ))
          ) : (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-stone-100">
              <i className="las la-book-open text-6xl text-stone-300" />
            </div>
          )}

          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/95 text-[#4A2A10] shadow-sm text-sm font-bold backdrop-blur-sm">
              <i className={`${typeIcons[listing.type]} text-xl leading-none`} />
              {typeLabels[listing.type]}
            </span>
          </div>

          {currentUser && (
            <button
              type="button"
              onClick={handleBookmark}
              disabled={bookmarking}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark book'}
              className={`absolute bottom-4 left-4 w-12 h-12 rounded-2xl flex items-center justify-center shadow-md backdrop-blur-sm transition ${isBookmarked ? 'bg-primary-600 text-white' : 'bg-stone-900/85 text-green-400 hover:bg-stone-950'}`}
            >
              <i className={`${isBookmarked ? 'las la-bookmark' : 'lar la-bookmark'} text-2xl`} />
            </button>
          )}
        </div>

        <div className="px-2 pt-5 pb-2">
          <h3 className="text-2xl font-bold text-stone-900 leading-tight line-clamp-1 group-hover:text-primary-700 transition">
            {listing.title}
          </h3>
          <p className="text-lg text-slate-500 mt-1 line-clamp-1">by {listing.author}</p>

          <div className="flex items-center gap-3 mt-5">
            {listing.userPhoto ? (
              <img src={listing.userPhoto} alt={listing.userName} className="w-10 h-10 rounded-full object-cover bg-stone-200" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-sm font-bold">
                {listing.userName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-700 truncate">Listed by {listing.userName || 'Reshelved user'}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-stone-50/90 border border-stone-100 p-4 grid grid-cols-3 divide-x divide-stone-200">
            <div className="px-2">
              <p className="text-sm font-semibold text-slate-500">Condition</p>
              <p className="mt-1 text-lg font-bold text-slate-800 truncate">{listing.condition}</p>
            </div>
            <div className="px-4">
              <p className="text-sm font-semibold text-slate-500">Location</p>
              <p className="mt-1 text-lg font-bold text-slate-800 truncate">{listing.location}</p>
            </div>
            <div className="px-4">
              <p className="text-sm font-semibold text-slate-500">Price</p>
              <p className="mt-1 text-lg font-bold text-slate-800 truncate">{getDisplayPrice(listing)}</p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default BookCard;
