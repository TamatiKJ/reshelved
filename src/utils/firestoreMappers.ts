import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';

export const mapDoc = <T>(doc: QueryDocumentSnapshot<DocumentData>): T => {
  return { id: doc.id, ...doc.data() } as T;
};

export const mapSnapshot = <T>(snapshot: QuerySnapshot<DocumentData>): T[] => {
  return snapshot.docs.map((doc) => mapDoc<T>(doc));
};
