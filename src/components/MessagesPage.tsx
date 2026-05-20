import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { uploadChatImage } from '../utils/chatMedia';
import { createMessageDocumentId, hideConversationForUser, markConversationMessagesRead, markConversationNotificationsRead, sendChatMessage } from '../services/messagesService';
import type { Conversation, Message, Rating, UserProfile } from '../types';

type ParticipantMeta = { photoURL: string; location: string; avgRating: number; reviewCount: number; blockedUsers: string[]; online?: boolean };
type ChatFilter = 'all' | 'swapping' | 'unread';

const DELETE_EVERYONE_WINDOW_MS = 30 * 60 * 1000;
const AUTO_CONFIRM_SWAP_MS = 7 * 24 * 60 * 60 * 1000;
const UNAVAILABLE_MESSAGE = "You can't message this user at this time.";
const isSameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const formatDayLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
const formatThreadDate = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString('en-GB') : '';
const formatMessageTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const formatLongDate = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const isErrorMessage = (message: string) => message.startsWith('Could not') || message.includes('failed') || message.includes('rules') || message.includes('denied') || message.includes('not supported');

const MessagesPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
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
  const [error, setError] = useState('');
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
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

  const getOtherParticipantId = (conv: Conversation) => currentUser ? conv.participants.find((id) => id !== currentUser.uid) || '' : '';
  const getOtherParticipantName = (conv: Conversation) => conv.participantNames?.[getOtherParticipantId(conv)] || 'User';
  const getOtherParticipantPhoto = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)]?.photoURL || conv.participantPhotos?.[getOtherParticipantId(conv)] || '';
  const getOtherParticipantInitial = (conv: Conversation) => getOtherParticipantName(conv)[0]?.toUpperCase() || 'U';
  const getOtherParticipantLocation = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)]?.location || '';
  const getOtherParticipantRating = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)] || { avgRating: 0, reviewCount: 0, location: '', photoURL: '', blockedUsers: [], online: false };
  const getUnreadCount = (conv: Conversation) => currentUser ? Number((conv as any).unreadCount?.[currentUser.uid] || 0) : 0;

  const otherParticipantId = selectedConv ? getOtherParticipantId(selectedConv) : '';
  const otherMeta = otherParticipantId ? participantMeta[otherParticipantId] : undefined;
  const isBlockedByMe = Boolean(otherParticipantId && userProfile?.blockedUsers?.includes(otherParticipantId));
  const hasBlockedMe = Boolean(currentUser && otherMeta?.blockedUsers?.includes(currentUser.uid));
  const messagingBlocked = isBlockedByMe || hasBlockedMe;
  const visibleMessages = currentUser ? messages.filter((msg) => !((msg as any).deletedFor || []).includes(currentUser.uid)) : [];
  const swapState = selectedConv ? (selectedConv as any).swapCompletion || {} : {};
  const markedCompleteBy: string[] = Array.isArray(swapState.markedBy) ? swapState.markedBy : [];
  const hasMarkedComplete = Boolean(currentUser && markedCompleteBy.includes(currentUser.uid));
  const firstMarkedAt = Number(swapState.firstMarkedAt || 0);
  const autoConfirmAt = Number(swapState.autoConfirmAt || (firstMarkedAt ? firstMarkedAt + AUTO_CONFIRM_SWAP_MS : 0));
  const isSwapCompleted = Boolean(swapState.completedAt || (firstMarkedAt && Date.now() >= autoConfirmAt));
  const shouldShowSwapBox = Boolean(selectedConv && selectedConv.listingId && currentUser && !messagingBlocked);

  useEffect(() => {
    if (!error || isErrorMessage(error)) return;
    const timer = window.setTimeout(() => setError(''), 3000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const convs: Conversation[] = [];
      snap.forEach((item) => convs.push({ id: item.id, ...item.data() } as Conversation));
      const visible = convs.filter((conv) => !((conv as any).hiddenFor || []).includes(currentUser.uid));
      visible.sort((a, b) => ((b as any).lastMessageAt || 0) - ((a as any).lastMessageAt || 0));
      setConversations(visible);
      setSelectedConv(conversationId ? visible.find((conv) => conv.id === conversationId) || null : null);
      await loadParticipantMeta(visible);
      setLoading(false);
    }, (err) => {
      console.error('Error loading conversations:', err);
      setError('Could not load conversations. Check your Firestore rules.');
      setLoading(false);
    });
    return unsub;
  }, [currentUser, conversationId]);

  useEffect(() => {
    if (!conversationId || !currentUser || loading) return;
    const exists = conversations.some((conversation) => conversation.id === conversationId);
    if (!exists) navigate('/messages', { replace: true });
  }, [conversationId, conversations, currentUser?.uid, loading, navigate]);

  useEffect(() => {
    if (!conversationId || !currentUser) {
      setMessages([]);
      return;
    }

    const q = query(collection(db, 'messages'), where('conversationId', '==', conversationId));
    const unsub = onSnapshot(q, (snap) => {
      const items: Message[] = [];
      snap.forEach((item) => items.push({ id: item.id, ...item.data() } as Message));
      items.sort((a, b) => ((a as any).createdAt || 0) - ((b as any).createdAt || 0));
      setMessages(items);
      requestAnimationFrame(() => messagesPaneRef.current?.scrollTo({ top: messagesPaneRef.current.scrollHeight, behavior: 'auto' }));
      markConversationNotificationsRead(conversationId, currentUser.uid).catch((err) => console.error('Could not mark message notifications as read:', err));
      markConversationMessagesRead({ conversationId, userId: currentUser.uid, messages: items }).catch((err) => console.error('Could not mark messages as read:', err));
    }, (err) => {
      console.error('Error loading messages:', err);
      setError('Could not load messages. Check your Firestore rules.');
    });
    return unsub;
  }, [conversationId, currentUser?.uid]);

  useEffect(() => {
    setSelectedConv(conversationId ? conversations.find((conv) => conv.id === conversationId) || null : null);
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
    if (!selectedConv || !conversationId || !firstMarkedAt || swapState.completedAt || Date.now() < autoConfirmAt) return;
    updateDoc(doc(db, 'conversations', conversationId), {
      'swapCompletion.completedAt': Date.now(),
      'swapCompletion.completedBy': 'auto-confirmed',
      'swapCompletion.ratingUnlocked': true,
      'swapCompletion.status': 'completed'
    }).catch((err) => console.error('Auto confirm failed:', err));
  }, [selectedConv?.id, conversationId, firstMarkedAt, autoConfirmAt, swapState.completedAt]);

  useEffect(() => {
    const loadExistingRating = async () => {
      if (!currentUser || !selectedConv || !otherParticipantId) {
        setHasRatedSwap(false);
        return;
      }
      try {
        const snap = await getDocs(query(collection(db, 'ratings'), where('fromUserId', '==', currentUser.uid)));
        const found = snap.docs.some((item) => {
          const data = item.data() as any;
          return data.conversationId === selectedConv.id || (data.toUserId === otherParticipantId && data.listingId === selectedConv.listingId);
        });
        setHasRatedSwap(found);
      } catch {
        setHasRatedSwap(false);
      }
    };
    loadExistingRating();
  }, [currentUser?.uid, selectedConv?.id, otherParticipantId]);

  const filteredConversations = useMemo(() => conversations.filter((conv) => {
    const term = searchTerm.trim().toLowerCase();
    const unread = getUnreadCount(conv);
    const isSwapping = Boolean(conv.listingId);
    if (activeFilter === 'swapping' && !isSwapping) return false;
    if (activeFilter === 'unread' && unread < 1) return false;
    if (!term) return true;
    const haystack = [getOtherParticipantName(conv), (conv as any).lastMessage || '', conv.listingTitle || '', getOtherParticipantLocation(conv)].join(' ').toLowerCase();
    return haystack.includes(term);
  }), [conversations, searchTerm, activeFilter, participantMeta, currentUser?.uid]);

  const loadParticipantMeta = async (convs: Conversation[]) => {
    const userIds = Array.from(new Set(convs.flatMap((conv) => conv.participants)));
    const meta: Record<string, ParticipantMeta> = {};
    await Promise.all(userIds.map(async (uid) => {
      const fallback = convs.find((conv) => conv.participants.includes(uid))?.participantPhotos?.[uid] || '';
      meta[uid] = { photoURL: fallback, location: '', avgRating: 0, reviewCount: 0, blockedUsers: [], online: false };
      try {
        const publicSnap = await getDoc(doc(db, 'publicProfiles', uid)).catch(() => null);
        if (publicSnap?.exists()) {
          const data = publicSnap.data();
          meta[uid] = { ...meta[uid], photoURL: data.photoURL || fallback, location: data.location || '', avgRating: Number(data.ratingAverage || 0), reviewCount: Number(data.ratingCount || 0) };
        }
        const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
        if (userSnap?.exists()) {
          const user = { uid, ...userSnap.data() } as UserProfile;
          meta[uid] = { ...meta[uid], photoURL: user.photoURL || meta[uid].photoURL, location: user.location || meta[uid].location, blockedUsers: user.blockedUsers || [], online: Boolean((user as any).online) };
        }
        const ratingsSnap = await getDocs(query(collection(db, 'ratings'), where('toUserId', '==', uid))).catch(() => null);
        const ratings: Rating[] = [];
        ratingsSnap?.forEach((item) => ratings.push({ id: item.id, ...item.data() } as Rating));
        if (ratings.length > 0) meta[uid] = { ...meta[uid], avgRating: ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length, reviewCount: ratings.length };
      } catch {
        // Keep fallback metadata.
      }
    }));
    setParticipantMeta(meta);
  };

  const ensureCanMessage = () => {
    if (messagingBlocked) {
      setError(UNAVAILABLE_MESSAGE);
      return false;
    }
    return true;
  };

  const startLongPress = (message: Message, event: React.TouchEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a')) return;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setThreadMenuOpen(false);
      setAttachMenuOpen(false);
      setMessageMenuId(message.id);
      if ('vibrate' in navigator) navigator.vibrate?.(25);
    }, 550);
  };

  const cancelLongPress = () => {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const sendTextOrMapMessage = async (payload: Record<string, unknown> & { text: string; type: 'text' | 'map' }) => {
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
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Message failed to send. Check your Firestore rules.');
      throw err;
    } finally {
      setSending(false);
    }
  };

  const handleMarkSwapComplete = async () => {
    if (!currentUser || !selectedConv || !conversationId || completionUpdating || isSwapCompleted) return;
    setCompletionUpdating(true);
    setError('');
    const now = Date.now();
    const nextMarkedBy = hasMarkedComplete ? markedCompleteBy.filter((id) => id !== currentUser.uid) : Array.from(new Set([...markedCompleteBy, currentUser.uid]));
    const firstAt = nextMarkedBy.length === 0 ? 0 : (firstMarkedAt || now);
    const updates: Record<string, unknown> = { 'swapCompletion.markedBy': nextMarkedBy, 'swapCompletion.firstMarkedAt': firstAt, 'swapCompletion.autoConfirmAt': firstAt ? firstAt + AUTO_CONFIRM_SWAP_MS : 0, 'swapCompletion.status': nextMarkedBy.length > 0 ? 'pending' : 'open' };
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
      if (hasMarkedComplete) setError('Completion mark removed.');
      else if (nextMarkedBy.length === 1) setError('Marked complete. If the other user does not respond within 7 days, the swap will auto-confirm.');
      else if (nextMarkedBy.length >= selectedConv.participants.length) setError('Swap completed. Rating is now unlocked.');
    } catch (err) {
      console.error('Could not update swap completion:', err);
      setError('Could not update swap completion. Check your Firestore rules.');
    } finally {
      setCompletionUpdating(false);
    }
  };

  const submitSwapRating = async () => {
    if (!currentUser || !selectedConv || !otherParticipantId || ratingSubmitting || hasRatedSwap || !isSwapCompleted) return;
    setRatingSubmitting(true);
    setError('');
    try {
      await addDoc(collection(db, 'ratings'), { fromUserId: currentUser.uid, fromUserName: userProfile?.displayName || currentUser.displayName || 'User', toUserId: otherParticipantId, toUserName: getOtherParticipantName(selectedConv), conversationId: selectedConv.id, listingId: selectedConv.listingId || '', listingTitle: selectedConv.listingTitle || 'Swap', rating: ratingValue, review: ratingReview.trim(), createdAt: Date.now() });
      setHasRatedSwap(true);
      setRatingReview('');
      setError('Rating submitted.');
    } catch (err) {
      console.error('Could not submit rating:', err);
      setError('Could not submit rating. Check your Firestore rules.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = newMessage.trim();
    if (!text || sending) return;
    try {
      await sendTextOrMapMessage({ text, type: 'text' });
      setNewMessage('');
    } catch {
      // Keep text in the composer if sending fails.
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
    } catch (err: any) {
      console.error('Could not send image:', err);
      setError(err?.message || 'Could not send image. Check your Firestore rules.');
    } finally {
      setSending(false);
    }
  };

  const handleMapPin = async () => {
    if (!ensureCanMessage()) return;
    setAttachMenuOpen(false);
    if (!navigator.geolocation) return setError('Location sharing is not supported on this browser.');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const mapUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
      await sendTextOrMapMessage({ text: 'Shared location', type: 'map', mapUrl, lat: coords.latitude, lng: coords.longitude });
    }, () => setError('Location permission was denied.'));
  };

  const blockUser = async () => {
    if (!currentUser || !otherParticipantId || !selectedConv) return;
    if (!confirm(`Block ${getOtherParticipantName(selectedConv)}? They will not be able to start new chats or message you.`)) return;
    setBlocking(true);
    setThreadMenuOpen(false);
    setError('');
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { blockedUsers: arrayUnion(otherParticipantId), lastSeen: Date.now() }, { merge: true });
      await refreshProfile();
      setError(UNAVAILABLE_MESSAGE);
    } catch (err) {
      console.error('Could not block user:', err);
      setError('Could not block this user. Check your Firestore rules.');
    } finally {
      setBlocking(false);
    }
  };

  const deleteConversation = async () => {
    if (!conversationId || !selectedConv || !currentUser) return;
    if (!confirm('Delete this chat from your inbox only?')) return;
    setDeleting(true);
    setThreadMenuOpen(false);
    setError('');
    try {
      await hideConversationForUser({ conversationId, conversation: selectedConv, userId: currentUser.uid });
      const messageSnap = await getDocs(query(collection(db, 'messages'), where('conversationId', '==', conversationId)));
      await Promise.all(messageSnap.docs.map((item) => updateDoc(doc(db, 'messages', item.id), { deletedFor: Array.from(new Set([...(item.data() as any).deletedFor || [], currentUser.uid])) })));
      await markConversationNotificationsRead(conversationId, currentUser.uid);
      navigate('/messages', { replace: true });
    } catch (err) {
      console.error('Error deleting conversation:', err);
      setError('Could not delete this chat. Check your Firestore rules.');
    } finally {
      setDeleting(false);
    }
  };

  const reportUser = async () => {
    if (!currentUser || !selectedConv || !otherParticipantId || !reportReason) return;
    try {
      await addDoc(collection(db, 'reports'), { reporterId: currentUser.uid, reporterName: userProfile?.displayName || 'User', targetType: 'user', targetId: otherParticipantId, targetName: getOtherParticipantName(selectedConv), reason: reportReason, details: reportDetails, createdAt: Date.now(), resolved: false });
      setShowReport(false);
      setReportReason('');
      setReportDetails('');
      setError('Report submitted.');
    } catch (err) {
      console.error('Could not submit report:', err);
      setError('Could not submit report.');
    }
  };

  const copyMessage = async (message: Message) => {
    if ((message as any).deleted || !message.text || message.text === 'Image') return;
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
      await updateDoc(doc(db, 'messages', message.id), { deletedFor: Array.from(new Set([...(message as any).deletedFor || [], currentUser.uid])) });
      setMessageMenuId(null);
    } catch {
      setError('Could not delete message for you. Check your Firestore rules.');
    }
  };

  const deleteMessageForEveryone = async (message: Message) => {
    if (!currentUser || message.senderId !== currentUser.uid || (message as any).deleted || Date.now() - ((message as any).createdAt || 0) > DELETE_EVERYONE_WINDOW_MS) return;
    if (!confirm('Delete this message for everyone? This cannot be undone.')) return;
    try {
      await updateDoc(doc(db, 'messages', message.id), { deleted: true, deletedAt: Date.now(), deletedBy: currentUser.uid, text: 'This message was deleted', type: 'text', imageUrl: '', imageData: '', imageName: '', imageSize: 0, storagePath: '', mapUrl: '', lat: null, lng: null });
      setMessageMenuId(null);
    } catch {
      setError('Could not delete message for everyone. Check your Firestore rules and the 30-minute window.');
    }
  };

  if (!currentUser) return <div className="mx-auto max-w-4xl px-4 py-16 text-center pb-10 sm:pb-[60px]"><h2 className="text-xl font-bold text-stone-700">Please log in to view chats</h2><Link to="/login" className="mt-4 inline-block font-semibold text-primary-600">Log In</Link></div>;

  const selectedPhoto = selectedConv ? getOtherParticipantPhoto(selectedConv) : '';
  const selectedName = selectedConv ? getOtherParticipantName(selectedConv) : '';
  const selectedInitial = selectedConv ? getOtherParticipantInitial(selectedConv) : 'U';

  return (
    <div className="mx-auto h-full max-w-[1240px] px-0 py-0 sm:px-5 sm:py-5 sm:pb-[60px]">
      {error && <div className={`mx-3 mb-3 rounded-2xl p-3 text-sm font-medium sm:mx-0 ${isErrorMessage(error) ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-primary-200 bg-primary-50 text-primary-700'}`}>{error}</div>}
      <div className="h-[calc(100dvh-64px-74px)] overflow-hidden border border-stone-200 bg-white shadow-[0_18px_50px_rgba(28,25,23,0.06)] sm:h-[calc(100vh-120px)] sm:min-h-[650px] sm:rounded-[24px]">
        <div className="flex h-full min-h-0">
          <aside className={`w-full border-r border-stone-200 bg-[#FFFAF2] sm:w-[420px] sm:min-w-[420px] ${conversationId ? 'hidden sm:flex' : 'flex'} flex-col`}>
            <div className="border-b border-stone-200/70 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-7"><h1 className="hidden font-['Work_Sans'] text-[28px] font-bold tracking-tight text-stone-950 sm:block">Chats</h1><div className="mt-0 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm sm:mt-6"><i className="las la-search text-xl text-stone-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search conversations..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400" /></div></div>
            <div className="border-b border-stone-200/70 px-5 py-3 sm:px-6 sm:py-4"><div className="flex gap-2 overflow-x-auto">{([['all', 'All'], ['swapping', 'Swapping'], ['unread', 'Unread']] as [ChatFilter, string][]).map(([key, label]) => <button key={key} type="button" onClick={() => setActiveFilter(key)} className={`shrink-0 cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${activeFilter === key ? 'border-primary-600 bg-white text-stone-950 shadow-sm' : 'border-stone-300 bg-transparent text-stone-700 hover:bg-white'}`}>{label}</button>)}</div></div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loading ? <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl bg-white/60 p-4"><div className="h-12 w-12 rounded-full bg-stone-200" /><div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-stone-200" /><div className="h-2 w-full rounded bg-stone-100" /></div></div>)}</div> : filteredConversations.length === 0 ? <div className="flex h-full flex-col items-center justify-center px-6 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-stone-400 ring-1 ring-stone-200"><i className="las la-comment-slash text-3xl" /></div><h3 className="mt-4 font-bold text-stone-900">No chats found</h3><p className="mt-1 text-sm leading-6 text-stone-500">Try a different filter or search term.</p></div> : filteredConversations.map((conv) => {
                const photo = getOtherParticipantPhoto(conv);
                const rating = getOtherParticipantRating(conv);
                const location = getOtherParticipantLocation(conv);
                const unread = getUnreadCount(conv);
                const isSelected = conv.id === conversationId;
                const hasUnread = unread > 0;
                const online = Boolean(rating.online);
                return <Link key={conv.id} to={`/messages/${conv.id}`} className={`group relative mb-2 block rounded-2xl transition ${isSelected ? 'bg-white shadow-sm' : 'hover:bg-white/70'}`}><div className="flex items-center gap-3 px-4 py-4"><div className="relative shrink-0">{photo ? <img src={photo} alt={getOtherParticipantName(conv)} className="h-[52px] w-[52px] rounded-full bg-stone-100 object-cover ring-1 ring-stone-100" /> : <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-sm font-bold text-stone-700 ring-1 ring-stone-200">{getOtherParticipantInitial(conv)}</div>}{online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#FFFAF2] bg-emerald-500" />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate text-[15px] font-extrabold leading-tight text-stone-950">{getOtherParticipantName(conv)}</span><span className={`shrink-0 text-xs ${hasUnread ? 'font-extrabold text-primary-600' : 'font-semibold text-stone-400'}`}>{formatThreadDate((conv as any).lastMessageAt)}</span></div><p className={`mt-0.5 truncate text-sm ${hasUnread ? 'font-bold text-stone-800' : 'text-stone-600'}`}>{(conv as any).lastMessage || 'No messages yet'}</p><div className="mt-1 flex items-center gap-2 text-xs text-stone-500"><span className="truncate"><i className="las la-map-marker mr-0.5" />{location || 'Location not set'}</span><span className="text-[#F7AF31]">★</span><span className="font-semibold text-stone-700">{rating.reviewCount > 0 ? rating.avgRating.toFixed(1) : '0.0'}</span></div></div>{hasUnread && <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 px-2 text-[11px] font-extrabold text-white shadow-sm">{unread > 99 ? '99+' : unread}</span>}</div></Link>;
              })}
            </div>
          </aside>

          <section className={`min-w-0 flex-1 flex-col bg-white ${!conversationId ? 'hidden sm:flex' : 'flex'}`}>
            {conversationId && selectedConv ? <>
              <header className="relative shrink-0 border-b border-stone-200 bg-white px-4 py-3 sm:px-6 sm:py-4"><div className="flex min-w-0 items-center gap-3"><Link to="/messages" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-700 hover:bg-stone-100 sm:hidden"><i className="las la-angle-left text-2xl" /></Link><div className="relative shrink-0">{selectedPhoto ? <img src={selectedPhoto} alt={selectedName} className="h-12 w-12 rounded-full bg-stone-100 object-cover ring-1 ring-stone-100 sm:h-14 sm:w-14" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4E2] text-sm font-bold text-primary-700 sm:h-14 sm:w-14">{selectedInitial}</div>}{otherMeta?.online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />}</div><div className="min-w-0 flex-1"><h3 className="truncate text-base font-extrabold text-stone-950 sm:text-xl">{selectedName}</h3><p className="truncate text-xs text-stone-500 sm:text-sm"><i className="las la-map-marker mr-1" />{otherMeta?.location || 'Location not set'} <span className="mx-1">·</span> <span className="text-[#F7AF31]">★</span> {otherMeta?.reviewCount ? `${otherMeta.avgRating.toFixed(1)} (${otherMeta.reviewCount})` : 'No reviews'} {otherMeta?.online && <><span className="mx-1">·</span><span className="font-semibold text-emerald-600">Online</span></>}</p></div><div className="relative shrink-0"><button type="button" onClick={(event) => { event.stopPropagation(); setThreadMenuOpen((current) => !current); setAttachMenuOpen(false); }} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50 sm:h-11 sm:w-11" aria-label="Conversation actions"><i className="las la-ellipsis-v text-xl" /></button>{threadMenuOpen && <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm shadow-2xl"><button onClick={deleteConversation} disabled={deleting} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"><i className="las la-trash text-xl" />{deleting ? 'Deleting...' : 'Delete chat'}</button><button onClick={() => { setThreadMenuOpen(false); setShowReport(true); }} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50"><i className="las la-flag text-xl" />Report</button><button onClick={blockUser} disabled={blocking || isBlockedByMe} className="flex w-full cursor-pointer items-center gap-3 border-t border-stone-100 px-4 py-3 text-left font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><i className="las la-ban text-xl" />{isBlockedByMe ? 'Blocked' : blocking ? 'Blocking...' : 'Block'}</button></div>}</div></div></header>
              {(selectedConv.listingTitle || shouldShowSwapBox) && <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-2 sm:px-6 sm:py-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="inline-flex min-w-0 items-center gap-3 rounded-full border border-stone-200 bg-[#FFFAF2] px-3 py-2 sm:px-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white sm:h-9 sm:w-9"><i className="las la-book text-lg" /></span><div className="min-w-0"><p className="truncate text-sm font-extrabold text-stone-950">{selectedConv.listingTitle || 'Book swap'}</p><p className="truncate text-xs text-stone-500">Swap conversation</p></div><span className="ml-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-700">Active</span></div>{shouldShowSwapBox && <button type="button" onClick={handleMarkSwapComplete} disabled={completionUpdating || isSwapCompleted} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#F7AF31] bg-[#FFF4E2] px-4 py-2.5 text-sm font-bold text-stone-800 hover:bg-[#ffeac0] disabled:cursor-not-allowed disabled:opacity-60"><i className="las la-exchange-alt text-lg" />{isSwapCompleted ? 'Swap completed' : hasMarkedComplete ? 'Unmark complete' : completionUpdating ? 'Saving...' : 'Swap completion'}</button>}</div>{shouldShowSwapBox && (hasMarkedComplete || isSwapCompleted) && <p className="mt-2 text-xs text-stone-500">{isSwapCompleted ? 'Rating is now unlocked for this swap.' : `Waiting for the other user. Auto-confirms on ${formatLongDate(autoConfirmAt)}.`}</p>}{isSwapCompleted && <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-4"><p className="text-sm font-bold text-stone-950">Rate {selectedName}</p>{hasRatedSwap ? <p className="mt-1 text-sm text-stone-500">You have already rated this swap.</p> : <div className="mt-3 space-y-3"><div className="flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRatingValue(value)} className="cursor-pointer text-2xl" aria-label={`${value} star rating`}><i className={`las la-star ${value <= ratingValue ? 'text-[#F7AF31]' : 'text-stone-300'}`} /></button>)}</div><textarea value={ratingReview} onChange={(e) => setRatingReview(e.target.value)} rows={2} placeholder="Add a short review..." className="w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-primary-600" /><button type="button" onClick={submitSwapRating} disabled={ratingSubmitting} className="cursor-pointer rounded-full bg-stone-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">{ratingSubmitting ? 'Submitting...' : 'Submit rating'}</button></div>}</div>}</div>}
              {messagingBlocked && <div className="shrink-0 border-b border-primary-100 bg-primary-50 px-5 py-3 text-sm font-bold text-primary-700">{UNAVAILABLE_MESSAGE}</div>}
              <div ref={messagesPaneRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
                {visibleMessages.map((msg, index) => {
                  const isMe = msg.senderId === currentUser.uid;
                  const showDay = index === 0 || !isSameDay((msg as any).createdAt || 0, (visibleMessages[index - 1] as any)?.createdAt || 0);
                  const recipientIds = selectedConv.participants.filter((id) => id !== currentUser.uid);
                  const isDelivered = recipientIds.every((id) => ((msg as any).deliveredTo || []).includes(id));
                  const isRead = recipientIds.every((id) => ((msg as any).readBy || []).includes(id));
                  const imageSource = (msg as any).imageUrl || (msg as any).imageData || '';
                  const canDeleteEveryone = isMe && !(msg as any).deleted && Date.now() - ((msg as any).createdAt || 0) <= DELETE_EVERYONE_WINDOW_MS;
                  return <React.Fragment key={msg.id}>{showDay && <div className="flex items-center gap-4 py-2"><span className="h-px flex-1 bg-stone-200" /><span className="text-xs font-semibold text-stone-400">{formatDayLabel((msg as any).createdAt)}</span><span className="h-px flex-1 bg-stone-200" /></div>}<div className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}><div onTouchStart={(event) => startLongPress(msg, event)} onTouchMove={cancelLongPress} onTouchEnd={cancelLongPress} onTouchCancel={cancelLongPress} onPointerDown={(event) => { if (event.pointerType !== 'mouse') startLongPress(msg, event); }} onPointerMove={cancelLongPress} onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onContextMenu={(event) => { event.preventDefault(); setMessageMenuId(msg.id); }} className={`relative max-w-[86%] select-none px-4 py-3 text-[15px] shadow-sm sm:max-w-[68%] ${isMe ? 'rounded-[22px] rounded-br-md bg-[#16A34A] text-white' : 'rounded-[22px] rounded-bl-md border border-green-200 bg-[#F0FDF4] text-stone-900'} ${(msg as any).deleted ? 'opacity-80' : ''}`}>{(msg as any).deleted ? <p className="whitespace-pre-wrap italic opacity-80">This message was deleted</p> : <>{(msg as any).type === 'image' && imageSource ? <img src={imageSource} alt={(msg as any).imageName || 'Sent image'} className="mb-2 max-h-72 rounded-2xl object-contain" /> : null}{(msg as any).type === 'map' && (msg as any).mapUrl ? <a href={(msg as any).mapUrl} target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 font-bold text-[#1665CC]"><i className="las la-map-marker text-2xl" /> Open location pin</a> : null}{(msg as any).type !== 'image' || msg.text !== 'Image' ? <p className="whitespace-pre-wrap leading-7">{msg.text}</p> : null}</>}<button type="button" onClick={(event) => { event.stopPropagation(); setMessageMenuId(messageMenuId === msg.id ? null : msg.id); }} className={`absolute top-1 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50 md:flex ${isMe ? '-left-10' : '-right-10'} opacity-0 group-hover:opacity-100`} aria-label="Message actions"><i className="las la-angle-down text-lg" /></button>{messageMenuId === msg.id && <div onClick={(event) => event.stopPropagation()} className={`absolute top-9 z-40 w-52 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm text-stone-700 shadow-2xl ${isMe ? 'right-full mr-2' : 'left-full ml-2'} max-md:left-auto max-md:right-0 max-md:top-full max-md:mt-2`}><button type="button" onClick={() => copyMessage(msg)} disabled={(msg as any).deleted || !msg.text || msg.text === 'Image'} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"><i className="las la-copy text-xl" />Copy</button><button type="button" onClick={() => deleteMessageForMe(msg)} className="flex w-full cursor-pointer items-center gap-3 border-t border-stone-100 px-4 py-3 text-left text-red-600 hover:bg-red-50"><i className="las la-trash text-xl" />Delete for me</button>{canDeleteEveryone && <button type="button" onClick={() => deleteMessageForEveryone(msg)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-red-700 hover:bg-red-50"><i className="las la-trash-alt text-xl" />Delete for everyone</button>}</div>}<div className={`mt-1 flex flex-wrap items-center justify-end gap-1 text-xs ${isMe ? 'text-white/75' : 'text-stone-500'}`}><span>{formatMessageTime((msg as any).createdAt)}</span>{isMe && <span title={isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'} className={isRead ? 'text-[#1665CC]' : 'text-white/80'}>{isRead ? <i className="las la-check-double" /> : isDelivered ? <i className="las la-check-double" /> : <i className="las la-check" />}</span>}</div></div></div></React.Fragment>;
                })}
              </div>
              <form onSubmit={handleSend} className="shrink-0 border-t border-stone-200 bg-white px-3 py-3 sm:px-7 sm:py-4"><input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSend} className="hidden" /><div className="flex items-center gap-2 rounded-full border border-stone-200 bg-[#FFFAF2] p-2 shadow-sm sm:gap-3"><div className="relative"><button type="button" onClick={(event) => { event.stopPropagation(); setAttachMenuOpen((current) => !current); setThreadMenuOpen(false); }} disabled={sending || messagingBlocked} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-11" aria-label="Attach"><i className="las la-paperclip text-2xl" /></button>{attachMenuOpen && <div onClick={(event) => event.stopPropagation()} className="absolute bottom-14 left-0 z-40 w-48 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm shadow-2xl"><button type="button" onClick={() => { setAttachMenuOpen(false); imageInputRef.current?.click(); }} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50"><i className="las la-image text-xl" />Add image</button><button type="button" onClick={handleMapPin} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50"><i className="las la-map-marker text-xl" />Location</button></div>}</div><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={messagingBlocked} placeholder={messagingBlocked ? 'Messaging disabled' : 'Type a message...'} className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary-600 disabled:text-stone-400 sm:py-3" /><button type="submit" disabled={!newMessage.trim() || sending || messagingBlocked} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-11" aria-label="Send message"><i className="las la-paper-plane text-xl" /></button></div></form>
            </> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white text-stone-400 shadow-sm ring-1 ring-stone-200"><i className="las la-comments text-4xl" /></div><h3 className="font-['Work_Sans'] text-xl font-bold text-stone-900">Select a conversation</h3><p className="mt-2 max-w-xs text-sm leading-6 text-stone-500">Choose a chat from the left to view messages and respond.</p></div>}
          </section>
        </div>
      </div>
      {showReport && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-bold text-stone-800">Report user</h3><p className="mt-1 text-sm text-stone-500">Tell us what is wrong with this user.</p><div className="mt-4 space-y-3"><select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none"><option value="">Select a reason...</option><option value="spam">Spam</option><option value="fraud">Suspected fraud</option><option value="abuse">Abusive message</option><option value="other">Other</option></select><textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Additional details..." rows={3} className="w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none" /><div className="grid grid-cols-2 gap-2"><button onClick={() => setShowReport(false)} className="cursor-pointer rounded-full border border-stone-200 py-2.5 text-sm font-bold">Cancel</button><button onClick={reportUser} disabled={!reportReason} className="cursor-pointer rounded-full bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">Submit report</button></div></div></div></div>}
    </div>
  );
};

export default MessagesPage;
