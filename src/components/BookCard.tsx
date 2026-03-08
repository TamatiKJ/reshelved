import React from 'react';
import { Link } from 'react-router-dom';
import type { Listing } from '../types';

const typeColors = {
  swap: 'bg-blue-100 text-blue-700',
  donate: 'bg-green-100 text-green-700',
  sell: 'bg-accent-100 text-accent-700'
};

const typeLabels = {
  swap: 'Swap',
  donate: 'Free',
  sell: 'Sell'
};

const BookCard: React.FC<{ listing: Listing }> = ({ listing }) => {
  const isExpired = listing.expiresAt < Date.now();
  const daysLeft = Math.max(0, Math.ceil((listing.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <Link to={`/listing/${listing.id}`} className="group block">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-md hover:border-primary-200 transition-all duration-200">
        {/* Image */}
        <div className="aspect-[4/3] bg-stone-100 relative overflow-hidden">
          {listing.images && listing.images.length > 0 ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
          {/* Type Badge */}
          <div className="absolute top-2 left-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${typeColors[listing.type]}`}>
              {typeLabels[listing.type]}
            </span>
          </div>
          {/* Expired overlay */}
          {isExpired && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-full">Expired</span>
            </div>
          )}
          {/* Images count */}
          {listing.images && listing.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              {listing.images.length} photos
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-stone-800 truncate group-hover:text-primary-700 transition">
            {listing.title}
          </h3>
          <p className="text-sm text-stone-500 truncate mt-0.5">by {listing.author}</p>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1 text-sm text-stone-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {listing.location}
            </div>
            {listing.type === 'sell' && listing.price ? (
              <span className="font-bold text-primary-700">KSh {listing.price.toLocaleString()}</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-500 font-medium">{listing.condition}</span>
            )}
          </div>
          {!isExpired && (
            <p className="text-xs text-stone-400 mt-2">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default BookCard;
