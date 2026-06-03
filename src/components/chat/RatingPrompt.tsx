import React from 'react';

type RatingPromptProps = {
  name: string;
  rating: number;
  review: string;
  submitting: boolean;
  onRatingChange: (value: number) => void;
  onReviewChange: (value: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
};

const RatingPrompt: React.FC<RatingPromptProps> = ({
  name,
  rating,
  review,
  submitting,
  onRatingChange,
  onReviewChange,
  onSubmit,
  onDismiss
}) => (
  <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3">
    <p className="text-sm font-bold text-stone-950">Rate {name}</p>
    <div className="mt-2 flex gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onRatingChange(value)}
          className="cursor-pointer text-xl"
          aria-label={`${value} star rating`}
        >
          <i
            className={`las la-star ${
              value <= rating ? 'text-[#F7AF31]' : 'text-stone-300'
            }`}
          />
        </button>
      ))}
    </div>
    <textarea
      value={review}
      onChange={(event) => onReviewChange(event.target.value)}
      rows={2}
      placeholder="Add a short review..."
      className="mt-2 w-full resize-none rounded-xl border border-stone-200
        px-3 py-2 text-sm outline-none focus:border-primary-600"
    />
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="cursor-pointer rounded-lg bg-primary-600 px-4 py-2
          text-sm font-bold text-white transition hover:bg-primary-700
          disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Submit rating'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="cursor-pointer rounded-lg border border-stone-200
          bg-white px-4 py-2 text-sm font-bold text-stone-700
          transition hover:bg-stone-50"
      >
        Maybe later
      </button>
    </div>
  </div>
);

export default RatingPrompt;
