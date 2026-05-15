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
      setMessageUnreadCount(snap.docs.filter((item) => item.data().type === 'message').length);
    });

    return unsub;
  }, [currentUser]);

  return { unreadCount, messageUnreadCount };
};
