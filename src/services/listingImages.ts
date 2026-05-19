import { deleteObject, ref } from 'firebase/storage';
import { storage } from '../firebase';

export const normalizeListingImageUrls = (images?: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images.filter((image): image is string => typeof image === 'string' && image.trim().length > 0);
};

const isFirebaseStorageUrl = (url: string) => {
  return url.startsWith('gs://') || url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com');
};

export const getRemovedListingImageUrls = (oldImages: string[], nextImages: string[]): string[] => {
  const nextImageSet = new Set(nextImages);
  return oldImages.filter((url) => url && !nextImageSet.has(url) && isFirebaseStorageUrl(url));
};

export const deleteRemovedListingImages = async (oldImages: string[], nextImages: string[]): Promise<void> => {
  const removedImages = getRemovedListingImageUrls(oldImages, nextImages);
  await Promise.allSettled(removedImages.map((url) => deleteObject(ref(storage, url))));
};
