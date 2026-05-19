import React from 'react';

interface ListingGalleryProps {
  title: string;
  images: string[];
  currentImage: number;
  isExpired: boolean;
  isBookmarked: boolean;
  bookmarking: boolean;
  activeImage?: string;
  onSelectImage: (index: number) => void;
  onPreviousImage: () => void;
  onNextImage: () => void;
  onImageError: (image: string) => void;
  onCopyLink: () => void;
  onBookmark: () => void;
}

const EmptyBookImage = () => (
  <div className="w-full h-full flex items-center justify-center bg-stone-100">
    <svg className="w-16 h-16 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  </div>
);

const ListingGallery: React.FC<ListingGalleryProps> = ({
  title,
  images,
  currentImage,
  isExpired,
  isBookmarked,
  bookmarking,
  activeImage,
  onSelectImage,
  onPreviousImage,
  onNextImage,
  onImageError,
  onCopyLink,
  onBookmark
}) => {
  const canOpenImage = Boolean(activeImage || images[0]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {images.length > 1 && (
        <div className="order-2 flex gap-3 overflow-x-auto pb-1 lg:order-1 lg:w-[76px] lg:flex-col lg:overflow-visible lg:pb-0">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => onSelectImage(i)}
              className={`h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 bg-white transition lg:h-[72px] lg:w-[72px] ${i === currentImage ? 'border-[#1665CC] ring-2 ring-[#1665CC]/10' : 'border-stone-200 hover:border-[#1665CC]'}`}
              aria-label={`View image ${i + 1}`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" onError={() => onImageError(img)} />
            </button>
          ))}
        </div>
      )}

      <div className="order-1 flex-1 lg:order-2">
        <div className="aspect-square bg-stone-100 rounded-2xl overflow-hidden relative bg-no-repeat">
          {activeImage ? (
            <img src={activeImage} alt={title} className="w-full h-full object-cover" onError={() => onImageError(activeImage)} />
          ) : (
            <EmptyBookImage />
          )}

          {isExpired && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="px-4 py-2 bg-red-600 text-white font-semibold rounded-full">Listing Expired</span>
            </div>
          )}

          <div className="absolute right-4 top-4 flex flex-col gap-3">
            <button type="button" onClick={onCopyLink} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-stone-800 shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50" aria-label="Copy listing link">
              <i className="las la-share-alt text-2xl" />
            </button>
            <button type="button" onClick={onBookmark} disabled={bookmarking} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60" aria-label={isBookmarked ? 'Remove from favorites' : 'Save to favorites'} aria-pressed={isBookmarked}>
              <i className={`${isBookmarked ? 'las la-heart text-[#f15025]' : 'lar la-heart text-stone-800'} text-2xl`} />
            </button>
            <button type="button" onClick={() => window.open(activeImage || images[0], '_blank')} disabled={!canOpenImage} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white text-stone-800 shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Open larger image">
              <i className="las la-search-plus text-2xl" />
            </button>
          </div>

          {images.length > 1 && (
            <>
              <button type="button" onClick={onPreviousImage} className="absolute left-4 top-1/2 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-stone-800 shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50 sm:flex" aria-label="Previous image">
                <i className="las la-angle-left text-2xl" />
              </button>
              <button type="button" onClick={onNextImage} className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-stone-800 shadow-md ring-1 ring-stone-200 transition hover:bg-stone-50" aria-label="Next image">
                <i className="las la-angle-right text-2xl" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white">
                {currentImage + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingGallery;
