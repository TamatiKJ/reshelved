import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Listing } from '../types';
import BookCard from './BookCard';

const RecentListings: React.FC<{ excludeId?: string; limit?: number }> = ({ excludeId, limit = 3 }) => {
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const snap = await getDocs(collection(db, 'listings'));
        const items: Listing[] = [];
        snap.forEach((item) => items.push({ id: item.id, ...item.data() } as Listing));
        setListings(
          items
            .filter((item) => item.id !== excludeId && item.active && item.expiresAt > Date.now())
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, limit)
        );
      } catch (error) {
        console.error('Could not load recent listings:', error);
      }
    };

    fetchRecent();
  }, [excludeId, limit]);

  if (listings.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold text-stone-900 mb-5">You may also like</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {listings.map((listing) => <BookCard key={listing.id} listing={listing} />)}
      </div>
    </section>
  );
};

export default RecentListings;
