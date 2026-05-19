import { arrayRemove, arrayUnion, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Listing } from '../types';

export const normalizeImages = (images?: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images
    .filter((image): image is string => typeof image === 'string')
    .map((image) => image.trim())
    .filter((image) => image.length > 0);
};

export const getListingById = async (listingId: string): Promise<Listing | null> => {
  const snap = await getDoc(doc(db, 'listings', listingId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Listing;
};

export const getListingSellerPhoto = async (sellerId: string, fallbackPhoto = ''): Promise<string> => {
  const userSnap = await getDoc(doc(db, 'users', sellerId)).catch(() => null);
  if (!userSnap?.exists()) return fallbackPhoto;
  const photoURL = userSnap.data().photoURL;
  return typeof photoURL === 'string' && photoURL.trim() ? photoURL : fallbackPhoto;
};

export const removeListingById = async (listingId: string): Promise<void> => {
  await deleteDoc(doc(db, 'listings', listingId));
};

export const toggleListingBookmark = async ({ userId, listingId, isBookmarked }: { userId: string; listingId: string; isBookmarked: boolean }): Promise<void> => {
  await setDoc(doc(db, 'users', userId), {
    bookmarks: isBookmarked ? arrayRemove(listingId) : arrayUnion(listingId),
    lastSeen: Date.now()
  }, { merge: true });
};
