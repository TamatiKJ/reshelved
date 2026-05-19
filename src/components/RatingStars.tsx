import React from 'react';

interface RatingStarsProps {
  rating: number;
  className?: string;
}

const RatingStars: React.FC<RatingStarsProps> = ({ rating, className = 'text-lg' }) => {
  const safeRating = Math.max(0, Math.min(5, rating || 0));

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${safeRating.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, safeRating - index)) * 100;
        return (
          <span key={index} className="relative inline-block h-[1em] w-[1em] leading-none">
            <span className="absolute inset-0 text-stone-300">★</span>
            <span className="absolute inset-0 overflow-hidden text-[#F59E0B]" style={{ width: `${fill}%` }}>★</span>
          </span>
        );
      })}
    </span>
  );
};

export default RatingStars;
