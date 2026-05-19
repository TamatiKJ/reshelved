import { deleteObject, ref } from 'firebase/storage';
import { storage } from '../firebase';

const isFirebaseStorageUrl = (url?: string | null) => {
  if (!url) return false;
  return url.startsWith('gs://') || url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com');
};

export const shouldDeleteOldProfilePhoto = (oldPhotoUrl?: string | null, newPhotoUrl?: string | null) => {
  return Boolean(oldPhotoUrl && oldPhotoUrl !== newPhotoUrl && isFirebaseStorageUrl(oldPhotoUrl));
};

export const deleteOldProfilePhoto = async (oldPhotoUrl?: string | null, newPhotoUrl?: string | null): Promise<void> => {
  if (!shouldDeleteOldProfilePhoto(oldPhotoUrl, newPhotoUrl)) return;
  await deleteObject(ref(storage, oldPhotoUrl!)).catch((error) => {
    console.warn('Old profile photo cleanup failed:', error);
  });
};
