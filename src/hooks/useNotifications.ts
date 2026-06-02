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

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('read', '==', false)
    );

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubNotifications = onSnapshot(notificationsQuery, (snap) => {
      const systemNotifications = snap.docs.filter((item) => item.data().type !== 'message');
      setUnreadCount(systemNotifications.length);
    });

    const unsubConversations = onSnapshot(conversationsQuery, (snap) => {
      let unreadThreads = 0;
      snap.docs.forEach((item) => {
        const data = item.data();
        const hiddenFor = Array.isArray(data.hiddenFor) ? data.hiddenFor : [];
        if (hiddenFor.includes(currentUser.uid)) return;

        const storedUnreadCount = Number(data.unreadCount?.[currentUser.uid] || 0);
        const lastMessageAt = Number(data.lastMessageAt || 0);
        const lastReadAt = Number(data.lastReadAt?.[currentUser.uid] || 0);
        const lastMessageBy = data.lastMessageBy || '';
        const hasUnreadByTimestamp = Boolean(lastMessageAt && lastMessageAt > lastReadAt && lastMessageBy !== currentUser.uid);

        if (storedUnreadCount > 0 || hasUnreadByTimestamp) unreadThreads += 1;
      });
      setMessageUnreadCount(unreadThreads);
    });

    return () => {
      unsubNotifications();
      unsubConversations();
    };
  }, [currentUser]);

  return { unreadCount, messageUnreadCount };
};