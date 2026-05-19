import React from 'react';
import { Link } from 'react-router-dom';
import RatingStars from './RatingStars';

interface SellerCardProps {
  sellerId: string;
  sellerName: string;
  sellerPhoto?: string;
  listingId: string;
  listingTitle: string;
  ratingsCount: number;
  averageRating: number;
}

const SellerCard: React.FC<SellerCardProps> = ({
  sellerId,
  sellerName,
  sellerPhoto,
  listingId,
  listingTitle,
  ratingsCount,
  averageRating
}) => {
  const profileState = { from: 'listing', listingId, listingTitle };

  return (
    <div className="border border-stone-200 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <Link to={`/user/${sellerId}`} state={profileState} className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1665CC]/30" aria-label={`View ${sellerName}'s profile`}>
          {sellerPhoto ? (
            <img src={sellerPhoto} alt={sellerName} className="w-12 h-12 rounded-full object-cover bg-stone-100" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
              {sellerName?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
        </Link>
        <div>
          <Link to={`/user/${sellerId}`} state={profileState} className="font-semibold text-stone-800 hover:text-primary-700">
            {sellerName}
          </Link>
          {ratingsCount > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <RatingStars rating={averageRating} className="text-sm" />
              <span className="text-stone-500">({ratingsCount} review{ratingsCount !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerCard;
