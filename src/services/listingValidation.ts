import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import type { Listing } from '../types';
import { listingSchema, listingWriteSchema, type ListingWriteInput } from '../schemas/listingSchema';

type ListingDocument = DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>;

export const parseListingDoc = (item: ListingDocument): Listing | null => {
  const result = listingSchema.safeParse({ id: item.id, ...item.data() });
  return result.success ? (result.data as Listing) : null;
};

export const parseListingSnapshot = (snapshot: QuerySnapshot<DocumentData>): Listing[] => {
  const listings: Listing[] = [];
  snapshot.docs.forEach((item) => {
    const listing = parseListingDoc(item);
    if (listing) listings.push(listing);
  });
  return listings;
};

export const validateListingWrite = (value: unknown): ListingWriteInput => {
  return listingWriteSchema.parse(value);
};
