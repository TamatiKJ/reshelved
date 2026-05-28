import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { uploadChatImage } from '../utils/chatMedia';
import {
  createMessageDocumentId,
  hideConversationForUser,
  markConversationMessagesRead,
  markConversationNotificationsRead,
  sendChatMessage
} from '../services/messagesService';
import RatingPrompt from './chat/RatingPrompt';
import type { Conversation, Message, Rating, UserProfile } from '../types';

type ParticipantMeta = {
  photoURL: string;
  location: string;
  avgRating: number;
  reviewCount: number;
  blockedUsers: string[];
  online?: boolean;
};

type ChatFilter = 'all' | 'swapping' | 'unread';

type SwapCompletion = {
  markedBy?: string[];
  firstMarkedAt?: number;
  autoConfirmAt?: number;
  completedAt?: number;
};

type ChatConversation = Conversation & {
  swapCompletion?: SwapCompletion;
};

const DELETE_EVERYONE_WINDOW_MS = 30 * 60 * 1000;
const AUTO_CONFIRM_SWAP_MS = 7 * 24 * 60 * 60 * 1000;
const RATING_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE_MESSAGE = "You can't message this user at this time.";

const panelClass = [
  'h-[calc(100dvh-64px-74px)] overflow-hidden border border-stone-200',
  'bg-white shadow-[0_18px_50px_rgba(28,25,23,0.06)]',
  'sm:h-[calc(100vh-120px)] sm:min-h-[540px] sm:rounded-[24px]'
].join(' ');

const messageMenuClass = [
  'absolute top-full z-40 mt-2 w-48 overflow-hidden rounded-xl',
  'border border-stone-200 bg-white py-1 text-stone-700 shadow-xl'
].join(' ');

const isSameDay = (first: number, second: number) => (
  new Date(first).toDateString() === new Date(second).toDateString()
);

const formatDayLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const formatThreadDate = (timestamp?: number) => (
  timestamp ? new Date(timestamp).toLocaleDateString('en-GB') : ''
);

const formatMessageTime = (timestamp?: number) => (
  timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    : ''
);

const formatLongDate = (timestamp?: number) => (
  timestamp
    ? new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : ''
);

const isErrorMessage = (message: string) => (
  message.startsWith('Could not')
  || message.includes('failed')
  || message.includes('rules')
  || message.includes('denied')
  || message.includes('not supported')
);

const getReminderKey = (uid: string, conversationId: string) => (
  `reshelved.ratingReminder.${uid}.${conversationId}`
);

const Avatar: React.FC<{
  photoURL: string;
  name: string;
  className?: string;
}> = ({ photoURL, name, className = 'h-11 w-11' }) => (
  photoURL ? (
    <img
      src={photoURL}
      alt={name}
      className={`${className} shrink-0 rounded-full object-cover`}
    />
  ) : (
    <span
      className={`${className} flex shrink-0 items-center justify-center
        rounded-full bg-[#FFF4E2] text-sm font-bold text-primary-700`}
    >
      {name[0]?.toUpperCase() || 'U'}
    </span>
  )
);

const MessagesPageEnhanced: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [completionUpdating, setCompletionUpdating] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingReview, setRatingReview] = useState('');
  const [hasRatedSwap, setHasRatedSwap] = useState(false);
  const [ratingSnoozedUntil, setRatingSnoozedUntil] = useState(0);
  const [error, setError] = useState('');
  const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);
  const [participantMeta, setParticipantMeta] = useState<Record<string, ParticipantMeta>>({});
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const messagesPaneRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const getOtherParticipantId = (conversation: Conversation) => (
    currentUser
      ? conversation.participants.find((id) => id !== currentUser.uid) || ''
      : ''
  );

  const getOtherParticipantName = (conversation: Conversation) => (
    conversation.participantNames?.[getOtherParticipantId(conversation)] || 'User'
  );

  const getOtherParticipantPhoto = (conversation: Conversation) => (
    participantMeta[getOtherParticipantId(conversation)]?.photoURL
    || conversation.participantPhotos?.[getOtherParticipantId(conversation)]
    || ''
  );

  const getOtherParticipantLocation = (conversation: Conversation) => (
    participantMeta[getOtherParticipantId(conversation)]?.location || ''
  );

  const getOtherParticipantRating = (conversation: Conversation): ParticipantMeta => (
    participantMeta[getOtherParticipantId(conversation)] || {
      avgRating: 0,
      reviewCount: 0,
      location: '',
      photoURL: '',
      blockedUsers: [],
      online: false
    }
  );

  const getUnreadCount = (conversation: Conversation) => (
    currentUser ? Number(conversation.unreadCount?.[currentUser.uid] || 0) : 0
  );

  const otherParticipantId = selectedConv
    ? getOtherParticipantId(selectedConv)
    : '';
  const otherMeta = otherParticipantId
    ? participantMeta[otherParticipantId]
    : undefined;
  const isBlockedByMe = Boolean(
    otherParticipantId && userProfile?.blockedUsers?.includes(otherParticipantId)
  );
  const hasBlockedMe = Boolean(
    currentUser && otherMeta?.blockedUsers?.includes(currentUser.uid)
  );
  const messagingBlocked = isBlockedByMe || hasBlockedMe;
  const visibleMessages = currentUser
    ? messages.filter((message) => !message.deletedFor?.includes(currentUser.uid))
    : [];
  const swapState = selectedConv?.swapCompletion || {};
  const markedCompleteBy = Array.isArray(swapState.markedBy)
    ? swapState.markedBy
    : [];
  const hasMarkedComplete = Boolean(
    currentUser && markedCompleteBy.includes(currentUser.uid)
  );
  const firstMarkedAt = Number(swapState.firstMarkedAt || 0);
  const autoConfirmAt = Number(
    swapState.autoConfirmAt
    || (firstMarkedAt ? firstMarkedAt + AUTO_CONFIRM_SWAP_MS : 0)
  );
  const isSwapCompleted = Boolean(
    swapState.completedAt || (firstMarkedAt && Date.now() >= autoConfirmAt)
  );
  const shouldShowSwapBox = Boolean(
    selectedConv?.listingId && currentUser && !messagingBlocked
  );
  const showRatingPrompt = Boolean(
    isSwapCompleted && !hasRatedSwap && Date.now() >= ratingSnoozedUntil
  );

  useEffect(() => {
    if (!error || isErrorMessage(error)) return undefined;
    const timer = window.setTimeout(() => setError(''), 3000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!currentUser) return undefined;
    setLoading(true);
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid)
    );
    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        const loaded: ChatConversation[] = [];
        snapshot.forEach((item) => {
          loaded.push({ id: item.id, ...item.data() } as ChatConversation);
        });
        const visible = loaded
          .filter((conversation) => !conversation.hiddenFor?.includes(currentUser.uid))
          .sort((first, second) => second.lastMessageAt - first.lastMessageAt);
        setConversations(visible);
        setSelectedConv(
          conversationId
            ? visible.find((conversation) => conversation.id === conversationId) || null
            : null
        );
        setLoading(false);
        void loadParticipantMeta(visible);
      },
      (snapshotError) => {
        console.error('Error loading conversations:', snapshotError);
        setError('Could not load conversations. Check your Firestore rules.');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [currentUser?.uid, conversationId]);

  useEffect(() => {
    if (!conversationId || !currentUser || loading) return;
    const exists = conversations.some((conversation) => (
      conversation.id === conversationId
    ));
    if (!exists) navigate('/messages', { replace: true });
  }, [conversationId, conversations, currentUser?.uid, loading, navigate]);

  useEffect(() => {
    if (!conversationId || !currentUser) {
      setMessages([]);
      return undefined;
    }
    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId)
    );
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const loaded: Message[] = [];
        snapshot.forEach((item) => {
          loaded.push({ id: item.id, ...item.data() } as Message);
        });
        loaded.sort((first, second) => first.createdAt - second.createdAt);
        setMessages(loaded);
        requestAnimationFrame(() => {
          const pane = messagesPaneRef.current;
          pane?.scrollTo({ top: pane.scrollHeight, behavior: 'auto' });
        });
        void markConversationNotificationsRead(conversationId, currentUser.uid);
        void markConversationMessagesRead({
          conversationId,
          userId: currentUser.uid,
          messages: loaded
        });
      },
      (snapshotError) => {
        console.error('Error loading messages:', snapshotError);
        setError('Could not load messages. Check your Firestore rules.');
      }
    );
    return unsubscribe;
  }, [conversationId, currentUser?.uid]);

  useEffect(() => {
    setSelectedConv(
      conversationId
        ? conversations.find((conversation) => conversation.id === conversationId) || null
        : null
    );
  }, [conversationId, conversations]);

  useEffect(() => {
    const closeMenus = () => {
      setThreadMenuOpen(false);
      setAttachMenuOpen(false);
      setMessageMenuId(null);
    };
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, []);

  useEffect(() => {
    if (
      !selectedConv
      || !conversationId
      || !firstMarkedAt
      || swapState.completedAt
      || Date.now() < autoConfirmAt
    ) return;
    void updateDoc(doc(db, 'conversations', conversationId), {
      'swapCompletion.completedAt': Date.now(),
      'swapCompletion.completedBy': 'auto-confirmed',
      'swapCompletion.ratingUnlocked': true,
      'swapCompletion.status': 'completed'
    }).catch((updateError) => {
      console.error('Auto confirm failed:', updateError);
    });
  }, [selectedConv?.id, conversationId, firstMarkedAt, autoConfirmAt, swapState.completedAt]);

  useEffect(() => {
    const loadExistingRating = async () => {
      if (!currentUser || !selectedConv || !otherParticipantId) {
        setHasRatedSwap(false);
        return;
      }
      try {
        const snapshot = await getDocs(
          query(collection(db, 'ratings'), where('fromUserId', '==', currentUser.uid))
        );
        const found = snapshot.docs.some((item) => {
          const data = item.data();
          return data.conversationId === selectedConv.id
            || (
              data.toUserId === otherParticipantId
              && data.listingId === selectedConv.listingId
            );
        });
        setHasRatedSwap(found);
      } catch {
        setHasRatedSwap(false);
      }
    };
    void loadExistingRating();
  }, [currentUser?.uid, selectedConv?.id, otherParticipantId]);

  useEffect(() => {
    if (!currentUser || !conversationId) {
      setRatingSnoozedUntil(0);
      return undefined;
    }
    const key = getReminderKey(currentUser.uid, conversationId);
    const storedTime = Number(window.localStorage.getItem(key) || 0);
    if (storedTime <= Date.now()) {
      window.localStorage.removeItem(key);
      setRatingSnoozedUntil(0);
      return undefined;
    }
    setRatingSnoozedUntil(storedTime);
    const delay = Math.min(storedTime - Date.now(), 2147483647);
    const timer = window.setTimeout(() => {
      window.localStorage.removeItem(key);
      setRatingSnoozedUntil(0);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [currentUser?.uid, conversationId]);

  const filteredConversations = useMemo(() => (
    conversations.filter((conversation) => {
      const term = searchTerm.trim().toLowerCase();
      const unread = getUnreadCount(conversation);
      if (activeFilter === 'swapping' && !conversation.listingId) return false;
      if (activeFilter === 'unread' && unread < 1) return false;
      if (!term) return true;
      const haystack = [
        getOtherParticipantName(conversation),
        conversation.lastMessage || '',
        conversation.listingTitle || '',
        getOtherParticipantLocation(conversation)
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    })
  ), [conversations, searchTerm, activeFilter, participantMeta, currentUser?.uid]);

  const loadParticipantMeta = async (loadedConversations: Conversation[]) => {
    const ids = Array.from(
      new Set(loadedConversations.flatMap((conversation) => conversation.participants))
    );
    const metadata: Record<string, ParticipantMeta> = {};
    await Promise.all(ids.map(async (uid) => {
      const fallbackPhoto = loadedConversations.find((conversation) => (
        conversation.participants.includes(uid)
      ))?.participantPhotos?.[uid] || '';
      metadata[uid] = {
        photoURL: fallbackPhoto,
        location: '',
        avgRating: 0,
        reviewCount: 0,
        blockedUsers: [],
        online: false
      };
      const publicProfile = await getDoc(doc(db, 'publicProfiles', uid)).catch(() => null);
      if (publicProfile?.exists()) {
        const data = publicProfile.data();
        metadata[uid] = {
          ...metadata[uid],
          photoURL: data.photoURL || fallbackPhoto,
          location: data.location || '',
          avgRating: Number(data.ratingAverage || 0),
          reviewCount: Number(data.ratingCount || 0)
        };
      }
      const profileSnapshot = await getDoc(doc(db, 'users', uid)).catch(() => null);
      if (profileSnapshot?.exists()) {
        const profile = { uid, ...profileSnapshot.data() } as UserProfile;
        metadata[uid] = {
          ...metadata[uid],
          photoURL: profile.photoURL || metadata[uid].photoURL,
          location: profile.location || metadata[uid].location,
          blockedUsers: profile.blockedUsers || [],
          online: Boolean(profile.online)
        };
      }
      const ratingsSnapshot = await getDocs(
        query(collection(db, 'ratings'), where('toUserId', '==', uid))
      ).catch(() => null);
      const ratings: Rating[] = [];
      ratingsSnapshot?.forEach((item) => {
        ratings.push({ id: item.id, ...item.data() } as Rating);
      });
      if (ratings.length > 0) {
        metadata[uid] = {
          ...metadata[uid],
          avgRating: ratings.reduce((sum, rating) => sum + rating.rating, 0)
            / ratings.length,
          reviewCount: ratings.length
        };
      }
    }));
    setParticipantMeta(metadata);
  };

  const ensureCanMessage = () => {
    if (!messagingBlocked) return true;
    setError(UNAVAILABLE_MESSAGE);
    return false;
  };

  const startLongPress = (
    message: Message,
    event: React.TouchEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>
  ) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a')) return;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setThreadMenuOpen(false);
      setAttachMenuOpen(false);
      setMessageMenuId(message.id);
      navigator.vibrate?.(25);
    }, 550);
  };

  const cancelLongPress = () => {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const sendTextOrMapMessage = async (
    payload: Record<string, unknown> & { text: string; type: 'text' | 'map' }
  ) => {
    if (!currentUser || !conversationId || !selectedConv || !ensureCanMessage()) return;
    setSending(true);
    setError('');
    try {
      await sendChatMessage({
        conversationId,
        conversation: selectedConv,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'User',
        payload,
        lastMessage: payload.type === 'map' ? 'Location pin' : payload.text
      });
    } catch (sendError) {
      console.error('Error sending message:', sendError);
      setError('Message failed to send. Check your Firestore rules.');
      throw sendError;
    } finally {
      setSending(false);
    }
  };

  const handleMarkSwapComplete = async () => {
    if (
      !currentUser
      || !selectedConv
      || !conversationId
      || completionUpdating
      || isSwapCompleted
    ) return;
    setCompletionUpdating(true);
    setError('');
    const now = Date.now();
    const nextMarkedBy = hasMarkedComplete
      ? markedCompleteBy.filter((id) => id !== currentUser.uid)
      : Array.from(new Set([...markedCompleteBy, currentUser.uid]));
    const firstAt = nextMarkedBy.length === 0 ? 0 : (firstMarkedAt || now);
    const updates: Record<string, unknown> = {
      'swapCompletion.markedBy': nextMarkedBy,
      'swapCompletion.firstMarkedAt': firstAt,
      'swapCompletion.autoConfirmAt': firstAt ? firstAt + AUTO_CONFIRM_SWAP_MS : 0,
      'swapCompletion.status': nextMarkedBy.length > 0 ? 'pending' : 'open'
    };
    if (nextMarkedBy.length >= selectedConv.participants.length) {
      updates['swapCompletion.completedAt'] = now;
      updates['swapCompletion.completedBy'] = 'both-users';
      updates['swapCompletion.ratingUnlocked'] = true;
      updates['swapCompletion.status'] = 'completed';
    } else {
      updates['swapCompletion.completedAt'] = 0;
      updates['swapCompletion.completedBy'] = '';
      updates['swapCompletion.ratingUnlocked'] = false;
    }
    try {
      await updateDoc(doc(db, 'conversations', conversationId), updates);
      if (nextMarkedBy.length >= selectedConv.participants.length) {
        setError('Swap completed. Rating is now unlocked.');
      } else if (hasMarkedComplete) {
        setError('Completion mark removed.');
      } else {
        setError('Marked complete. The other user can confirm the swap.');
      }
    } catch (completionError) {
      console.error('Could not update swap completion:', completionError);
      setError('Could not update swap completion. Check your Firestore rules.');
    } finally {
      setCompletionUpdating(false);
    }
  };

  const submitSwapRating = async () => {
    if (
      !currentUser
      || !selectedConv
      || !otherParticipantId
      || ratingSubmitting
      || hasRatedSwap
      || !isSwapCompleted
    ) return;
    setRatingSubmitting(true);
    setError('');
    try {
      await addDoc(collection(db, 'ratings'), {
        fromUserId: currentUser.uid,
        fromUserName: userProfile?.displayName || currentUser.displayName || 'User',
        toUserId: otherParticipantId,
        toUserName: getOtherParticipantName(selectedConv),
        conversationId: selectedConv.id,
        listingId: selectedConv.listingId || '',
        listingTitle: selectedConv.listingTitle || 'Swap',
        rating: ratingValue,
        review: ratingReview.trim(),
        createdAt: Date.now()
      });
      window.localStorage.removeItem(
        getReminderKey(currentUser.uid, selectedConv.id)
      );
      setHasRatedSwap(true);
      setRatingReview('');
      setError('Rating submitted.');
    } catch (ratingError) {
      console.error('Could not submit rating:', ratingError);
      setError('Could not submit rating. Check your Firestore rules.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const dismissRatingPrompt = () => {
    if (!currentUser || !conversationId) return;
    const remindAt = Date.now() + RATING_REMINDER_DELAY_MS;
    window.localStorage.setItem(
      getReminderKey(currentUser.uid, conversationId),
      String(remindAt)
    );
    setRatingSnoozedUntil(remindAt);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = newMessage.trim();
    if (!text || sending) return;
    try {
      await sendTextOrMapMessage({ text, type: 'text' });
      setNewMessage('');
    } catch {
      return;
    }
  };

  const handleImageSend = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (!currentUser || !conversationId || !selectedConv || !ensureCanMessage()) return;
    setSending(true);
    setAttachMenuOpen(false);
    setError('');
    try {
      const messageId = createMessageDocumentId();
      const uploaded = await uploadChatImage(conversationId, messageId, file);
      await sendChatMessage({
        conversationId,
        conversation: selectedConv,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'User',
        messageId,
        payload: { type: 'image', text: 'Image', ...uploaded },
        lastMessage: 'Image'
      });
    } catch (imageError) {
      console.error('Could not send image:', imageError);
      setError('Could not send image. Check your Firestore rules.');
    } finally {
      setSending(false);
    }
  };

  const handleMapPin = () => {
    if (!ensureCanMessage()) return;
    setAttachMenuOpen(false);
    if (!navigator.geolocation) {
      setError('Location sharing is not supported on this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const mapUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
        void sendTextOrMapMessage({
          text: 'Shared location',
          type: 'map',
          mapUrl,
          lat: coords.latitude,
          lng: coords.longitude
        });
      },
      () => setError('Location permission was denied.')
    );
  };

  const blockUser = async () => {
    if (!currentUser || !otherParticipantId || !selectedConv) return;
    if (!window.confirm(`Block ${getOtherParticipantName(selectedConv)}?`)) return;
    setBlocking(true);
    setThreadMenuOpen(false);
    setError('');
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        blockedUsers: arrayUnion(otherParticipantId),
        lastSeen: Date.now()
      }, { merge: true });
      await refreshProfile();
      setError(UNAVAILABLE_MESSAGE);
    } catch (blockError) {
      console.error('Could not block user:', blockError);
      setError('Could not block this user. Check your Firestore rules.');
    } finally {
      setBlocking(false);
    }
  };

  const deleteConversation = async () => {
    if (!conversationId || !selectedConv || !currentUser) return;
    if (!window.confirm('Delete this chat from your inbox only?')) return;
    setDeleting(true);
    setThreadMenuOpen(false);
    setError('');
    try {
      await hideConversationForUser({
        conversationId,
        conversation: selectedConv,
        userId: currentUser.uid
      });
      const snapshot = await getDocs(
        query(collection(db, 'messages'), where('conversationId', '==', conversationId))
      );
      await Promise.all(snapshot.docs.map((item) => (
        updateDoc(doc(db, 'messages', item.id), {
          deletedFor: Array.from(new Set([
            ...((item.data().deletedFor as string[]) || []),
            currentUser.uid
          ]))
        })
      )));
      await markConversationNotificationsRead(conversationId, currentUser.uid);
      navigate('/messages', { replace: true });
    } catch (deleteError) {
      console.error('Error deleting conversation:', deleteError);
      setError('Could not delete this chat. Check your Firestore rules.');
    } finally {
      setDeleting(false);
    }
  };

  const reportUser = async () => {
    if (!currentUser || !selectedConv || !otherParticipantId || !reportReason) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser.uid,
        reporterName: userProfile?.displayName || 'User',
        targetType: 'user',
        targetId: otherParticipantId,
        targetName: getOtherParticipantName(selectedConv),
        reason: reportReason,
        details: reportDetails,
        createdAt: Date.now(),
        resolved: false
      });
      setShowReport(false);
      setReportReason('');
      setReportDetails('');
      setError('Report submitted.');
    } catch (reportError) {
      console.error('Could not submit report:', reportError);
      setError('Could not submit report.');
    }
  };

  const copyMessage = async (message: Message) => {
    if (message.deleted || !message.text || message.text === 'Image') return;
    try {
      await navigator.clipboard.writeText(message.text);
      setError('Message copied.');
      setMessageMenuId(null);
    } catch {
      setError('Could not copy message.');
    }
  };

  const deleteMessageForMe = async (message: Message) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'messages', message.id), {
        deletedFor: Array.from(new Set([
          ...(message.deletedFor || []),
          currentUser.uid
        ]))
      });
      setMessageMenuId(null);
    } catch {
      setError('Could not delete message for you. Check your Firestore rules.');
    }
  };

  const deleteMessageForEveryone = async (message: Message) => {
    const canDelete = currentUser
      && message.senderId === currentUser.uid
      && !message.deleted
      && Date.now() - message.createdAt <= DELETE_EVERYONE_WINDOW_MS;
    if (!canDelete || !window.confirm('Delete this message for everyone?')) return;
    try {
      await updateDoc(doc(db, 'messages', message.id), {
        deleted: true,
        deletedAt: Date.now(),
        deletedBy: currentUser.uid,
        text: 'This message was deleted',
        type: 'text',
        imageUrl: '',
        imageData: '',
        imageName: '',
        imageSize: 0,
        storagePath: '',
        mapUrl: '',
        lat: null,
        lng: null
      });
      setMessageMenuId(null);
    } catch {
      setError('Could not delete message for everyone.');
    }
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-stone-700">
          Please log in to view chats
        </h2>
        <Link to="/login" className="mt-4 inline-block font-semibold text-primary-600">
          Log In
        </Link>
      </div>
    );
  }

  const selectedPhoto = selectedConv ? getOtherParticipantPhoto(selectedConv) : '';
  const selectedName = selectedConv ? getOtherParticipantName(selectedConv) : '';
  const selectedProfilePath = otherParticipantId
    ? `/user/${otherParticipantId}`
    : '/messages';

  return (
    <div className="mx-auto h-full max-w-[1240px] px-0 py-0 sm:px-5 sm:py-5">
      {error && (
        <div className={`mx-3 mb-3 rounded-xl p-3 text-sm font-medium sm:mx-0 ${isErrorMessage(error) ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-primary-200 bg-primary-50 text-primary-700'}`}>
          {error}
        </div>
      )}
      <div className={panelClass}>
        <div className="flex h-full min-h-0">
          <aside className={`w-full border-r border-stone-200 bg-[#FFFAF2] sm:w-[420px] sm:min-w-[420px] ${conversationId ? 'hidden sm:flex' : 'flex'} flex-col`}>
            <div className="border-b border-stone-200/70 px-4 py-4 sm:px-5">
              <h1 className="hidden font-['Work_Sans'] text-2xl font-bold text-stone-950 sm:block">
                Chats
              </h1>
              <div className="mt-0 flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm sm:mt-4">
                <i className="las la-search text-xl text-stone-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search conversations..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 border-b border-stone-200/70 px-4 py-3">
              {(['all', 'swapping', 'unread'] as ChatFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition ${activeFilter === filter ? 'border-primary-600 bg-white text-stone-950' : 'border-stone-300 text-stone-700 hover:bg-white'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {loading && <p className="p-4 text-sm text-stone-500">Loading chats...</p>}
              {!loading && filteredConversations.length === 0 && (
                <p className="p-4 text-sm text-stone-500">No chats found.</p>
              )}
              {filteredConversations.map((conversation) => {
                const photo = getOtherParticipantPhoto(conversation);
                const meta = getOtherParticipantRating(conversation);
                const unread = getUnreadCount(conversation);
                const selected = conversation.id === conversationId;
                return (
                  <Link
                    key={conversation.id}
                    to={`/messages/${conversation.id}`}
                    className={`mb-2 flex items-center gap-3 rounded-xl p-3 transition ${selected ? 'bg-white shadow-sm' : 'hover:bg-white/70'}`}
                  >
                    <Avatar photoURL={photo} name={getOtherParticipantName(conversation)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-stone-950">
                          {getOtherParticipantName(conversation)}
                        </span>
                        <span className="shrink-0 text-xs text-stone-400">
                          {formatThreadDate(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <p className="truncate text-sm text-stone-600">
                        {conversation.lastMessage || 'No messages yet'}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {getOtherParticipantLocation(conversation) || 'Location not set'}
                        {' · ★ '}
                        {meta.reviewCount > 0 ? meta.avgRating.toFixed(1) : '0.0'}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="rounded-full bg-primary-600 px-2 py-1 text-xs font-bold text-white">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </aside>
          <section className={`min-w-0 flex-1 flex-col bg-white ${conversationId ? 'flex' : 'hidden sm:flex'}`}>
            {selectedConv ? (
              <>
                <header className="flex items-center gap-3 border-b border-stone-200 px-4 py-3">
                  <Link to="/messages" className="sm:hidden">
                    <i className="las la-angle-left text-2xl" />
                  </Link>
                  <Link
                    to={selectedProfilePath}
                    className="rounded-full transition hover:opacity-80"
                    aria-label={`View ${selectedName}'s profile`}
                  >
                    <Avatar photoURL={selectedPhoto} name={selectedName} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={selectedProfilePath}
                      className="block truncate font-bold text-stone-950 hover:underline"
                    >
                      {selectedName}
                    </Link>
                    <p className="truncate text-xs text-stone-500">
                      {otherMeta?.location || 'Location not set'}
                      {otherMeta?.reviewCount ? ` · ★ ${otherMeta.avgRating.toFixed(1)}` : ''}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setThreadMenuOpen((open) => !open);
                        setAttachMenuOpen(false);
                      }}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-stone-200 bg-white"
                      aria-label="Conversation actions"
                    >
                      <i className="las la-ellipsis-v text-xl" />
                    </button>
                    {threadMenuOpen && (
                      <div className="absolute right-0 top-12 z-40 w-52 rounded-xl border border-stone-200 bg-white py-2 shadow-xl">
                        <button onClick={deleteConversation} disabled={deleting} className="block w-full px-4 py-2.5 text-left text-sm font-semibold">
                          {deleting ? 'Deleting...' : 'Delete chat'}
                        </button>
                        <button onClick={() => setShowReport(true)} className="block w-full px-4 py-2.5 text-left text-sm font-semibold">
                          Report
                        </button>
                        <button onClick={blockUser} disabled={blocking || isBlockedByMe} className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-red-600">
                          {isBlockedByMe ? 'Blocked' : blocking ? 'Blocking...' : 'Block'}
                        </button>
                      </div>
                    )}
                  </div>
                </header>
                {shouldShowSwapBox && (
                  <div className="border-b border-stone-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-stone-950">
                          {selectedConv.listingTitle || 'Book swap'}
                        </p>
                        <p className="text-xs text-stone-500">Swap conversation</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleMarkSwapComplete}
                        disabled={completionUpdating || isSwapCompleted}
                        className="cursor-pointer rounded-full border border-[#F7AF31] bg-[#FFF4E2] px-3 py-2 text-xs font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSwapCompleted
                          ? 'Swap completed'
                          : completionUpdating
                            ? 'Saving...'
                            : hasMarkedComplete
                              ? 'Unmark complete'
                              : 'Mark complete'}
                      </button>
                    </div>
                    {hasMarkedComplete && !isSwapCompleted && (
                      <p className="mt-2 text-xs text-stone-500">
                        Auto-confirms on {formatLongDate(autoConfirmAt)}.
                      </p>
                    )}
                    {showRatingPrompt && (
                      <RatingPrompt
                        name={selectedName}
                        rating={ratingValue}
                        review={ratingReview}
                        submitting={ratingSubmitting}
                        onRatingChange={setRatingValue}
                        onReviewChange={setRatingReview}
                        onSubmit={submitSwapRating}
                        onDismiss={dismissRatingPrompt}
                      />
                    )}
                  </div>
                )}
                {messagingBlocked && (
                  <div className="border-b border-primary-100 bg-primary-50 px-4 py-3 text-sm font-bold text-primary-700">
                    {UNAVAILABLE_MESSAGE}
                  </div>
                )}
                <div ref={messagesPaneRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {visibleMessages.map((message, index) => {
                    const isMe = message.senderId === currentUser.uid;
                    const previous = visibleMessages[index - 1];
                    const showDay = !previous
                      || !isSameDay(message.createdAt, previous.createdAt);
                    const recipientIds = selectedConv.participants.filter(
                      (id) => id !== currentUser.uid
                    );
                    const isDelivered = recipientIds.every((id) => (
                      message.deliveredTo?.includes(id)
                    ));
                    const isRead = recipientIds.every((id) => (
                      message.readBy?.includes(id)
                    ));
                    const canDeleteEveryone = isMe
                      && !message.deleted
                      && Date.now() - message.createdAt <= DELETE_EVERYONE_WINDOW_MS;
                    const imageSource = message.imageUrl || message.imageData || '';
                    return (
                      <React.Fragment key={message.id}>
                        {showDay && (
                          <div className="flex items-center gap-3 py-2 text-xs font-semibold text-stone-400">
                            <span className="h-px flex-1 bg-stone-200" />
                            {formatDayLabel(message.createdAt)}
                            <span className="h-px flex-1 bg-stone-200" />
                          </div>
                        )}
                        <div className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            onTouchStart={(event) => startLongPress(message, event)}
                            onTouchMove={cancelLongPress}
                            onTouchEnd={cancelLongPress}
                            onPointerDown={(event) => {
                              if (event.pointerType !== 'mouse') {
                                startLongPress(message, event);
                              }
                            }}
                            onPointerUp={cancelLongPress}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              setMessageMenuId(message.id);
                            }}
                            className={`relative max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${isMe ? 'bg-[#16A34A] text-white' : 'border border-green-200 bg-[#F0FDF4] text-stone-900'}`}
                          >
                            {message.deleted ? (
                              <p className="italic opacity-80">This message was deleted</p>
                            ) : (
                              <>
                                {message.type === 'image' && imageSource && (
                                  <img src={imageSource} alt={message.imageName || 'Sent image'} className="mb-2 max-h-52 rounded-xl object-contain" />
                                )}
                                {message.type === 'map' && message.mapUrl && (
                                  <a href={message.mapUrl} target="_blank" rel="noreferrer" className="mb-2 block rounded-xl bg-white p-2 font-bold text-[#1665CC]">
                                    Open location pin
                                  </a>
                                )}
                                {(message.type !== 'image' || message.text !== 'Image') && (
                                  <p className="whitespace-pre-wrap leading-6">{message.text}</p>
                                )}
                              </>
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setMessageMenuId(
                                  messageMenuId === message.id ? null : message.id
                                );
                              }}
                              className={`absolute top-1 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-stone-600 shadow-sm md:flex ${isMe ? '-left-10' : '-right-10'}`}
                              aria-label="Message actions"
                            >
                              <i className="las la-angle-down" />
                            </button>
                            {messageMenuId === message.id && (
                              <div className={`${messageMenuClass} ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}>
                                <button onClick={() => copyMessage(message)} className="block w-full px-3 py-2 text-left text-sm">
                                  Copy
                                </button>
                                <button onClick={() => deleteMessageForMe(message)} className="block w-full px-3 py-2 text-left text-sm text-red-600">
                                  Delete for me
                                </button>
                                {canDeleteEveryone && (
                                  <button onClick={() => deleteMessageForEveryone(message)} className="block w-full px-3 py-2 text-left text-sm text-red-600">
                                    Delete for everyone
                                  </button>
                                )}
                              </div>
                            )}
                            <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${isMe ? 'text-white/75' : 'text-stone-500'}`}>
                              <span>{formatMessageTime(message.createdAt)}</span>
                              {isMe && (
                                <i
                                  title={isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'}
                                  className={`las ${isRead || isDelivered ? 'la-check-double' : 'la-check'} ${isRead ? 'text-blue-200' : ''}`}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
                <form onSubmit={handleSend} className="border-t border-stone-200 p-3">
                  <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSend} className="hidden" />
                  <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-[#FFFAF2] p-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setAttachMenuOpen((open) => !open);
                          setThreadMenuOpen(false);
                        }}
                        disabled={sending || messagingBlocked}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white disabled:opacity-50"
                        aria-label="Attach"
                      >
                        <i className="las la-paperclip text-xl" />
                      </button>
                      {attachMenuOpen && (
                        <div className="absolute bottom-12 left-0 z-40 w-40 rounded-xl border border-stone-200 bg-white py-2 shadow-xl">
                          <button onClick={() => imageInputRef.current?.click()} type="button" className="block w-full px-3 py-2 text-left text-sm">
                            Add image
                          </button>
                          <button onClick={handleMapPin} type="button" className="block w-full px-3 py-2 text-left text-sm">
                            Location
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      disabled={messagingBlocked}
                      placeholder={messagingBlocked ? 'Messaging disabled' : 'Type a message...'}
                      className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending || messagingBlocked}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-white disabled:opacity-50"
                      aria-label="Send message"
                    >
                      <i className="las la-paper-plane text-lg" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-stone-500">
                Select a conversation to start messaging.
              </div>
            )}
          </section>
        </div>
      </div>
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">Report user</h3>
            <select
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className="mt-4 w-full rounded-xl border border-stone-200 p-3 text-sm"
            >
              <option value="">Select a reason...</option>
              <option value="spam">Spam</option>
              <option value="fraud">Suspected fraud</option>
              <option value="abuse">Abusive message</option>
              <option value="other">Other</option>
            </select>
            <textarea
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              rows={3}
              placeholder="Additional details..."
              className="mt-3 w-full rounded-xl border border-stone-200 p-3 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowReport(false)} className="flex-1 rounded-lg border border-stone-200 py-2 text-sm font-bold">
                Cancel
              </button>
              <button onClick={reportUser} disabled={!reportReason} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-bold text-white disabled:opacity-50">
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPageEnhanced;
