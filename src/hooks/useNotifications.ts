import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const useNotifications = () => {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      setMessageUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('read', '==', false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
      const threads = new Set<string>();
      snap.docs.forEach((item) => {
        const data = item.data();
        if (data.type === 'message') threads.add(data.conversationId || item.id);
      });
      setMessageUnreadCount(threads.size);
    });

    return unsub;
  }, [currentUser]);

  return { unreadCount, messageUnreadCount };
};
