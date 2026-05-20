import { useEffect, useState } from 'react';
import { getActiveListingCategoriesWithFallback, type ListingCategory, fallbackListingCategories } from '../services/listingCategories';

export const useListingCategories = () => {
  const [categories, setCategories] = useState<ListingCategory[]>(fallbackListingCategories);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      setLoading(true);
      const items = await getActiveListingCategoriesWithFallback();
      if (!mounted) return;
      setCategories(items);
      setLoading(false);
    };

    loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  return { categories, loading };
};
