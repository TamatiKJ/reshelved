import React from 'react';
import { Link } from 'react-router-dom';
import type { Listing } from '../types';

const typeColors: Record<Listing['type'], string> = {
  swap: 'bg-blue-50 text-blue-700 border-blue-100',
  donate: 'bg-green-50 text-green-700 border-green-100',
  sell: 'bg-primary-50 text-primary-700 border-primary-100'
};

const typeLabels: Record<Listing['type'], string> = {
  swap: 'Swap',
  donate: 'Donate',
  sell: 'Sell'
};

const typeIcons: Record<Listing['type'], string> = {
  swap: 'las la-sync',
  donate: 'las la-gift',
  sell: 'las la-tag'
};

const BookCard: React.FC<{ listing: Listing }> = ({ listing }) => {
  const isExpired = listing.expiresAt < Date.now();
  const daysLeft = Math.max(0, Math.ceil((listing.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <Link to={`/listing/${listing.id}`} className="group block h-full">
      <article className="h-full bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
          {listing.images && listing.images.length > 0 ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-stone-100">
              <i className="las la-book-open text-6xl text-stone-300" />
            </div>
          )}

          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${typeColors[listing.type]}`}>
              <i className={`${typeIcons[listing.type]} text-base leading-none`} />
              {typeLabels[listing.type]}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/90 text-stone-700 border border-white/70">
              {listing.condition}
            </span>
          </div>

          {listing.images && listing.images.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full">
              {listing.images.length} photos
            </div>
          )}

          {isExpired && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
              <span className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-full">Expired</span>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div>
            <h3 className="text-lg font-bold text-stone-900 leading-snug line-clamp-1 group-hover:text-primary-700 transition">
              {listing.title}
            </h3>
            <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">by {listing.author}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            {listing.type === 'sell' && listing.price ? (
              <span className="text-xl font-bold text-primary-700">KSh {listing.price.toLocaleString()}</span>
            ) : (
              <span className="text-sm font-semibold text-stone-700">{listing.type === 'donate' ? 'Free' : 'Open to swap'}</span>
            )}
            {!isExpired && <span className="text-xs text-stone-400">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1 min-w-0">
              <i className="las la-map-marker text-base text-stone-400" />
              <span className="truncate">{listing.location}</span>
            </span>
            <span className="inline-flex items-center gap-1 min-w-0">
              <i className="las la-layer-group text-base text-stone-400" />
              <span className="truncate">{listing.category}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
            {listing.userPhoto ? (
              <img src={listing.userPhoto} alt={listing.userName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold">
                {listing.userName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate">{listing.userName || 'Reshelved user'}</p>
              <p className="text-xs text-stone-400">Listed on Reshelved</p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default BookCard;
