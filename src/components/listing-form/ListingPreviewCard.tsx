import React from 'react';
import type { Listing } from '../../types';

const listingTypeMeta: Record<Listing['type'], { label: string; icon: string }> = {
  swap: { label: 'Swap', icon: 'las la-sync' },
  donate: { label: 'Donate', icon: 'las la-gift' },
  sell: { label: 'Sell', icon: 'las la-tag' }
};

const ListingPreviewCard: React.FC<{
  title: string;
  author: string;
  imageUrl?: string;
  condition: string;
  location: string;
  category: string;
  type: Listing['type'];
  priceLabel: string;
  listingDays?: number;
  emptyImageLabel?: string;
}> = ({ title, author, imageUrl, condition, location, category, type, priceLabel, listingDays, emptyImageLabel = 'Cover image will appear here' }) => {
  const meta = listingTypeMeta[type] || listingTypeMeta.swap;

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-xl font-bold text-stone-950 sm:text-2xl">Live Preview</h2>
        <p className="mt-1 text-sm text-stone-500">See how it looks before you save.</p>
        <div className="mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100">
          {imageUrl ? (
            <img src={imageUrl} alt="Book cover preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-stone-100 text-center text-sm font-semibold text-stone-400">{emptyImageLabel}</div>
          )}
        </div>
        <h3 className="mt-4 text-xl font-bold leading-tight text-stone-950">{title}</h3>
        <p className="mt-1 text-sm text-stone-500">by {author}</p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-xs font-normal text-stone-600">
          <span className="min-w-0 truncate"><i className="las la-check-circle mr-1 text-primary-600" />{condition}</span>
          <span className="min-w-0 truncate"><i className="las la-map-marker mr-1 text-primary-600" />{location}</span>
          <span className="min-w-0 truncate"><i className="las la-book mr-1 text-primary-600" />{category}</span>
        </div>
        <div className="mt-5">
          <p className="text-sm font-bold text-stone-950">Listing Type</p>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-950"><i className={`${meta.icon} text-primary-600`} />{meta.label}</span>
          <p className="mt-3 text-sm font-bold text-stone-950">{priceLabel}</p>
        </div>
        {listingDays !== undefined && (
          <div className="mt-5 rounded-2xl bg-green-50 p-4 text-sm leading-6 text-green-800"><i className="las la-info-circle mr-1 text-lg text-green-700" />Your listing will be active for {listingDays} {listingDays === 1 ? 'day' : 'days'} after publishing.</div>
        )}
      </div>
    </aside>
  );
};

export default ListingPreviewCard;
