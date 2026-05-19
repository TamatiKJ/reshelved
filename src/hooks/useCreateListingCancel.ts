import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../types';
import type { Listing } from '../types';

const CREATE_LISTING_CANCEL_REDIRECT = '/browse';

interface UseCreateListingCancelParams {
  title: string;
  author: string;
  description: string;
  price: string;
  previews: string[];
  imagesCount: number;
  condition: Listing['condition'];
  category: string;
  type: Listing['type'];
  location: string;
  defaultLocation: string;
  loading: boolean;
}

export const useCreateListingCancel = ({
  title,
  author,
  description,
  price,
  previews,
  imagesCount,
  condition,
  category,
  type,
  location,
  defaultLocation,
  loading
}: UseCreateListingCancelParams) => {
  const navigate = useNavigate();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const hasDraftChanges = useMemo(() => Boolean(
    title.trim() ||
    author.trim() ||
    description.trim() ||
    price.trim() ||
    previews.length > 0 ||
    imagesCount > 0 ||
    condition !== 'Good' ||
    category !== CATEGORIES[0] ||
    type !== 'swap' ||
    location !== defaultLocation
  ), [title, author, description, price, previews.length, imagesCount, condition, category, type, location, defaultLocation]);

  const requestCancel = useCallback(() => {
    if (loading) return;
    if (hasDraftChanges) {
      setShowCancelConfirm(true);
      return;
    }
    navigate(CREATE_LISTING_CANCEL_REDIRECT);
  }, [hasDraftChanges, loading, navigate]);

  const keepEditing = useCallback(() => setShowCancelConfirm(false), []);

  const discardDraft = useCallback(() => {
    previews.forEach((preview) => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    });
    setShowCancelConfirm(false);
    navigate(CREATE_LISTING_CANCEL_REDIRECT);
  }, [navigate, previews]);

  return {
    showCancelConfirm,
    requestCancel,
    keepEditing,
    discardDraft
  };
};
