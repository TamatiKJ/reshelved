import { useCallback, useEffect, useState } from 'react';
import type { Listing } from '../types';
import { getListingById, getListingSellerPhoto } from '../services/listings';

export const useListing = (listingId?: string) => {
  const [listing, setListing] = useState<Listing | null>(null);
  const [sellerPhoto, setSellerPhoto] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refetch = useCallback(async () => {
    if (!listingId) {
      setListing(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextListing = await getListingById(listingId);
      setListing(nextListing);

      if (nextListing) {
        const photo = await getListingSellerPhoto(nextListing.userId, nextListing.userPhoto || '');
        setSellerPhoto(photo);
      } else {
        setSellerPhoto('');
      }
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { listing, sellerPhoto, loading, error, refetch };
};
