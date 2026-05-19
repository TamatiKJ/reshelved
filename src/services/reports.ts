import { addDoc, collection, doc, increment, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const reportListing = async ({
  reporterId,
  reporterName,
  listingId,
  listingTitle,
  reason,
  details
}: {
  reporterId: string;
  reporterName: string;
  listingId: string;
  listingTitle: string;
  reason: string;
  details: string;
}): Promise<void> => {
  await addDoc(collection(db, 'reports'), {
    reporterId,
    reporterName,
    targetType: 'listing',
    targetId: listingId,
    targetName: listingTitle,
    reason,
    details,
    createdAt: Date.now(),
    resolved: false
  });

  await updateDoc(doc(db, 'listings', listingId), {
    flagCount: increment(1),
    flagged: true
  });
};
