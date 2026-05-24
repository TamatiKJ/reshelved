import { onAuthStateChanged, type Unsubscribe } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

let initialized = false;
let stopConversationWarmup: Unsubscribe | null = null;
let warmedUserId: string | null = null;

/**
 * Primes Firestore's in-memory conversation cache once per signed-in user.
 * The Messages page keeps ownership of its real-time subscription; this warm-up
 * ends after the first server-confirmed snapshot to avoid a duplicate live listener.
 */
export const enableConversationWarmup = () => {
  if (initialized) return;
  initialized = true;

  onAuthStateChanged(auth, (user) => {
    stopConversationWarmup?.();
    stopConversationWarmup = null;

    if (!user) {
      warmedUserId = null;
      return;
    }

    if (warmedUserId === user.uid) return;
    warmedUserId = user.uid;

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    stopConversationWarmup = onSnapshot(
      conversationsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) {
          stopConversationWarmup?.();
          stopConversationWarmup = null;
        }
      },
      (error) => {
        console.warn('Conversation warm-up skipped:', error);
        stopConversationWarmup?.();
        stopConversationWarmup = null;
      }
    );
  });
};
