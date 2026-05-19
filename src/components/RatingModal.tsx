import React from 'react';

interface RatingModalProps {
  sellerName: string;
  rating: number;
  title: string;
  review: string;
  loading: boolean;
  onRatingChange: (value: number) => void;
  onTitleChange: (value: string) => void;
  onReviewChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const RatingModal: React.FC<RatingModalProps> = ({
  sellerName,
  rating,
  title,
  review,
  loading,
  onRatingChange,
  onTitleChange,
  onReviewChange,
  onClose,
  onSubmit
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl max-w-md w-full p-6">
      <h3 className="text-lg font-bold text-stone-800">Leave a Review</h3>
      <p className="text-sm text-stone-500 mt-1">Rate your experience with {sellerName}</p>
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => onRatingChange(star)} className={`cursor-pointer text-3xl transition ${star <= rating ? 'text-accent-500' : 'text-stone-300'}`}>
              ★
            </button>
          ))}
        </div>
        <input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Review title" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10" />
        <textarea value={review} onChange={(event) => onReviewChange(event.target.value)} placeholder="Share your experience..." rows={3} className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm resize-none focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 outline-none" />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium">Cancel</button>
          <button type="button" onClick={onSubmit} disabled={loading} className="cursor-pointer flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Submit Review</button>
        </div>
      </div>
    </div>
  </div>
);

export default RatingModal;
