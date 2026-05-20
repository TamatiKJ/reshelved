import { useEffect, useState } from 'react';
import { getListingCategories, type ListingCategory } from '../services/listingCategories';

export const useListingCategories = () => {
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      setLoading(true);
      try {
        const items = await getListingCategories({ includeInactive: false });
        if (!mounted) return;
        setCategories(items);
      } catch (error) {
        console.error('Could not load listing categories:', error);
        if (!mounted) return;
        setCategories([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  return { categories, loading };
};
