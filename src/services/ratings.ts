import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Rating } from '../types';
import { mapSnapshot } from '../utils/firestoreMappers';

export const getRatingsBySellerId = async (sellerId: string): Promise<Rating[]> => {
  const snap = await getDocs(query(collection(db, 'ratings'), where('toUserId', '==', sellerId)));
  return mapSnapshot<Rating>(snap).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const createSellerRating = async ({
  fromUserId,
  fromUserName,
  toUserId,
  listingId,
  listingTitle,
  rating,
  title,
  review
}: {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  listingId: string;
  listingTitle: string;
  rating: number;
  title: string;
  review: string;
}): Promise<void> => {
  await addDoc(collection(db, 'ratings'), {
    fromUserId,
    fromUserName,
    toUserId,
    listingId,
    listingTitle,
    rating,
    title: title.trim(),
    review: review.trim(),
    createdAt: Date.now()
  });
};

export const deleteRatingById = async (ratingId: string): Promise<void> => {
  await deleteDoc(doc(db, 'ratings', ratingId));
};

export const getAverageRating = (ratings: Rating[]): number => {
  if (ratings.length === 0) return 0;
  return ratings.reduce((total, rating) => total + rating.rating, 0) / ratings.length;
};

export const getRatingCount = (ratings: Rating[], star: number): number => {
  return ratings.filter((rating) => rating.rating === star).length;
};
