import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Rating } from '../types';
import { getAverageRating, getRatingsBySellerId } from '../services/ratings';

export const useSellerRatings = (sellerId?: string) => {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refetch = useCallback(async () => {
    if (!sellerId) {
      setRatings([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setRatings(await getRatingsBySellerId(sellerId));
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const averageRating = useMemo(() => getAverageRating(ratings), [ratings]);

  return { ratings, setRatings, averageRating, loading, error, refetch };
};
