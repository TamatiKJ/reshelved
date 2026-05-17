import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { uploadChatImage } from '../utils/chatMedia';
import ConversationListingCard from './ConversationListingCard';
import type { Conversation, Message, Rating, UserProfile } from '../types';

type ParticipantMeta = {
  photoURL: string;
  location: string;
  avgRating: number;
  reviewCount: number;
  blockedUsers: string[];
};

const DELETE_EVERYONE_WINDOW_MS = 10 * 60 * 1000;
const UNAVAILABLE_MESSAGE = "You can't message this user at this time.";

const getConversationKey = (a: string, b: string) => [a, b].sort().join('_');
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

const formatThreadDate = (timestamp?: number) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('en-GB');
};

const MessagesPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile, refreshProfile } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blocking, setBlocking] = useState(false);
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
    if (!conversationId || !currentUser) {
      setMessages([]);
      return;
    }

    const markLegacyMessageNotificationsRead = async () => {
      try {
        const nq = query(
          collection(db, 'notifications'),
          where('userId', '==', currentUser.uid),
          where('conversationId', '==', conversationId),
          where('read', '==', false)
        );
        const snap = await getDocs(nq);
        await Promise.all(snap.docs.map((item) => updateDoc(doc(db, 'notifications', item.id), { read: true })));
      } catch (err) {
        console.error('Could not mark legacy message notifications as read:', err);
      }
    };

    const markMessagesDeliveredAndRead = async (items: Message[]) => {
      const now = Date.now();
      const incoming = items.filter((msg) => msg.senderId !== currentUser.uid && !(msg as any).deleted);
      await Promise.all(incoming.map((msg) => updateDoc(doc(db, 'messages', msg.id), {
        deliveredTo: Array.from(new Set([...(msg as any).deliveredTo || [], currentUser.uid])),
        readBy: Array.from(new Set([...(msg as any).readBy || [], currentUser.uid])),
        [`deliveredAt.${currentUser.uid}`]: now
      }).catch(() => null)));
      if (incoming.length > 0) await updateDoc(doc(db, 'conversations', conversationId), { [`unreadCount.${currentUser.uid}`]: 0 }).catch(() => null);
    };

    markLegacyMessageNotificationsRead();

    const q = query(collection(db, 'messages'), where('conversationId', '==', conversationId));
    const unsub = onSnapshot(q, (snap) => {
      const items: Message[] = [];
      snap.forEach((item) => items.push({ id: item.id, ...item.data() } as Message));
      items.sort((a, b) => ((a as any).createdAt || 0) - ((b as any).createdAt || 0));
      setMessages(items);
      requestAnimationFrame(() => messagesPaneRef.current?.scrollTo({ top: messagesPaneRef.current.scrollHeight, behavior: 'auto' }));
      markLegacyMessageNotificationsRead();
      markMessagesDeliveredAndRead(items);
    }, (err) => {
      console.error('Error loading messages:', err);
      setError('Could not load messages. Check your Firestore rules.');
    });

    return unsub;
  }, [conversationId, currentUser]);

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

  const loadParticipantMeta = async (convs: Conversation[]) => {
    const userIds = Array.from(new Set(convs.flatMap((conv) => conv.participants)));
    const meta: Record<string, ParticipantMeta> = {};

    await Promise.all(userIds.map(async (uid) => {
      const fallback = convs.find((conv) => conv.participants.includes(uid))?.participantPhotos?.[uid] || '';
      meta[uid] = { photoURL: fallback, location: '', avgRating: 0, reviewCount: 0, blockedUsers: [] };

      try {
        const publicSnap = await getDoc(doc(db, 'publicProfiles', uid)).catch(() => null);
        if (publicSnap?.exists()) {
          const data = publicSnap.data();
          meta[uid] = {
            ...meta[uid],
            photoURL: data.photoURL || fallback,
            location: data.location || '',
            avgRating: Number(data.ratingAverage || 0),
            reviewCount: Number(data.ratingCount || 0)
          };
        }

        const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
        if (userSnap?.exists()) {
          const user = { uid, ...userSnap.data() } as UserProfile;
          meta[uid] = {
            ...meta[uid],
            photoURL: user.photoURL || meta[uid].photoURL,
            location: user.location || meta[uid].location,
            blockedUsers: user.blockedUsers || []
          };
        }

        const ratingsSnap = await getDocs(query(collection(db, 'ratings'), where('toUserId', '==', uid))).catch(() => null);
        const ratings: Rating[] = [];
        ratingsSnap?.forEach((item) => ratings.push({ id: item.id, ...item.data() } as Rating));
        if (ratings.length > 0) {
          meta[uid] = {
            ...meta[uid],
            avgRating: ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length,
            reviewCount: ratings.length
          };
        }
      } catch {
        // Keep fallback metadata.
      }
    }));

    setParticipantMeta(meta);
  };

  const getOtherParticipantId = (conv: Conversation) => currentUser ? conv.participants.find((id) => id !== currentUser.uid) || '' : '';
  const getOtherParticipantName = (conv: Conversation) => conv.participantNames?.[getOtherParticipantId(conv)] || 'User';
  const getOtherParticipantPhoto = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)]?.photoURL || conv.participantPhotos?.[getOtherParticipantId(conv)] || '';
  const getOtherParticipantInitial = (conv: Conversation) => getOtherParticipantName(conv)[0]?.toUpperCase() || 'U';
  const getOtherParticipantLocation = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)]?.location || '';
  const getOtherParticipantRating = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)] || { avgRating: 0, reviewCount: 0, location: '', photoURL: '', blockedUsers: [] };
  const getUnreadCount = (conv: Conversation) => currentUser ? Number((conv as any).unreadCount?.[currentUser.uid] || 0) : 0;

  const otherParticipantId = selectedConv ? getOtherParticipantId(selectedConv) : '';
  const otherMeta = otherParticipantId ? participantMeta[otherParticipantId] : undefined;
  const isBlockedByMe = Boolean(otherParticipantId && userProfile?.blockedUsers?.includes(otherParticipantId));
  const hasBlockedMe = Boolean(currentUser && otherMeta?.blockedUsers?.includes(currentUser.uid));
  const messagingBlocked = isBlockedByMe || hasBlockedMe;
  const visibleMessages = currentUser ? messages.filter((msg) => !((msg as any).deletedFor || []).includes(currentUser.uid)) : [];

  const ensureCanMessage = () => {
    if (messagingBlocked) {
      setError(UNAVAILABLE_MESSAGE);
      return false;
    }
    return true;
  };

  const buildConversationDeliveryUpdate = (recipientIds: string[], now: number) => {
    const updates: Record<string, unknown> = { lastMessageAt: now, updatedAt: now, hiddenFor: [] };
    if (currentUser) updates[`deliveredAt.${currentUser.uid}`] = now;
    recipientIds.forEach((id) => { updates[`unreadCount.${id}`] = increment(1); });
    return updates;
  };

  const sendTextOrMapMessage = async (payload: Record<string, unknown> & { text: string; type: 'text' | 'map' }) => {
    if (!currentUser || !conversationId || !selectedConv || !ensureCanMessage()) return;

    const now = Date.now();
    const recipientIds = selectedConv.participants.filter((id) => id !== currentUser.uid);
    setSending(true);
    setError('');

    try {
      await addDoc(collection(db, 'messages'), {
        conversationId,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'User',
        recipientId: recipientIds[0] || '',
        readBy: [currentUser.uid],
        deliveredTo: [currentUser.uid],
        deliveredAt: { [currentUser.uid]: now },
        createdAt: now,
        ...payload
      });

      await updateDoc(doc(db, 'conversations', conversationId), {
        ...buildConversationDeliveryUpdate(recipientIds, now),
        lastMessage: payload.type === 'map' ? 'Location pin' : payload.text,
        conversationKey: (selectedConv as any).conversationKey || (recipientIds[0] ? getConversationKey(currentUser.uid, recipientIds[0]) : '')
      });
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Message failed to send. Check your Firestore rules.');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim()) return;
    await sendTextOrMapMessage({ text: newMessage.trim(), type: 'text' });
    setNewMessage('');
  };

  const handleImageSend = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (!currentUser || !conversationId || !selectedConv || !ensureCanMessage()) return;

    const now = Date.now();
    const recipientIds = selectedConv.participants.filter((id) => id !== currentUser.uid);
    setSending(true);
    setAttachMenuOpen(false);
    setError('');

    try {
      const messageRef = doc(collection(db, 'messages'));
      const uploaded = await uploadChatImage(conversationId, messageRef.id, file);
      await setDoc(messageRef, {
        conversationId,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'User',
        recipientId: recipientIds[0] || '',
        readBy: [currentUser.uid],
        deliveredTo: [currentUser.uid],
        deliveredAt: { [currentUser.uid]: now },
        createdAt: now,
        type: 'image',
        text: 'Image',
        ...uploaded
      });
      await updateDoc(doc(db, 'conversations', conversationId), {
        ...buildConversationDeliveryUpdate(recipientIds, now),
        lastMessage: 'Image',
        conversationKey: (selectedConv as any).conversationKey || (recipientIds[0] ? getConversationKey(currentUser.uid, recipientIds[0]) : '')
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
    if (!navigator.geolocation) {
      setError('Location sharing is not supported on this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const mapUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
        await sendTextOrMapMessage({ text: 'Shared location', type: 'map', mapUrl, lat: coords.latitude, lng: coords.longitude });
      },
      () => setError('Location permission was denied.')
    );
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
      await updateDoc(doc(db, 'conversations', conversationId), {
        hiddenFor: Array.from(new Set([...(selectedConv as any).hiddenFor || [], currentUser.uid])),
        [`unreadCount.${currentUser.uid}`]: 0
      });

      const messageSnap = await getDocs(query(collection(db, 'messages'), where('conversationId', '==', conversationId)));
      await Promise.all(messageSnap.docs.map((item) => {
        const data = item.data() as Message;
        return updateDoc(doc(db, 'messages', item.id), { deletedFor: Array.from(new Set([...(data as any).deletedFor || [], currentUser.uid])) });
      }));

      const notificationSnap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), where('conversationId', '==', conversationId)));
      await Promise.all(notificationSnap.docs.map((item) => updateDoc(doc(db, 'notifications', item.id), { read: true }).catch(() => null)));
      navigate('/messages');
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
      setError('');
    } catch {
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
      setError('Could not delete message for everyone. Check your Firestore rules and the 10-minute window.');
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center pb-10 sm:pb-[60px]">
        <h2 className="text-xl font-bold text-stone-700">Please log in to view messages</h2>
        <Link to="/login" className="mt-4 inline-block text-primary-600 font-medium">Log In</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 pb-10 sm:pb-[60px]">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Messages</h1>
      {error && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${error.startsWith('Could not') || error.includes('failed') || error.includes('rules') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-primary-50 border border-primary-200 text-primary-700'}`}>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '560px' }}>
        <div className="flex h-full">
          <div className={`w-full sm:w-[390px] border-r border-stone-200 flex flex-col ${conversationId ? 'hidden sm:flex' : 'flex'}`}>
            <div className="p-4 border-b border-stone-100">
              <h2 className="font-semibold text-stone-700">Conversations</h2>
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3 px-4 py-5">
                      <div className="w-14 h-14 bg-stone-200 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-stone-200 rounded w-2/3" />
                        <div className="h-3 bg-stone-100 rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-stone-500 text-sm">No conversations yet. Contact a seller to start chatting!</div>
              ) : conversations.map((conv) => {
                const photo = getOtherParticipantPhoto(conv);
                const rating = getOtherParticipantRating(conv);
                const location = getOtherParticipantLocation(conv);
                const unread = getUnreadCount(conv);
                const isSelected = conv.id === conversationId;
                const hasUnread = unread > 0;
                const accentClass = hasUnread || isSelected ? 'bg-[#ff5b5f]' : 'bg-stone-200';
                const itemClass = isSelected ? 'bg-[#fff6f6]' : 'bg-white hover:bg-[#fff8f8]';
                const dateClass = hasUnread ? 'text-[#ff5b5f] font-extrabold' : 'text-stone-500 font-medium';

                return (
                  <Link key={conv.id} to={`/messages/${conv.id}`} className={`relative block ${itemClass} transition`}>
                    <span className={`absolute left-0 top-0 h-full w-1.5 ${accentClass}`} />
                    <div className="flex items-center gap-4 px-7 py-5">
                      {photo ? (
                        <img src={photo} alt={getOtherParticipantName(conv)} className="w-14 h-14 rounded-full object-cover bg-stone-100 shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg shrink-0">
                          {getOtherParticipantInitial(conv)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-extrabold text-stone-950 text-base sm:text-lg leading-tight truncate">{getOtherParticipantName(conv)}</span>
                          <span className={`text-sm shrink-0 ${dateClass}`}>{formatThreadDate((conv as any).lastMessageAt)}</span>
                        </div>
                        <p className="text-sm text-stone-600 truncate mt-1">
                          {location || 'Location not set'} · ★ {rating.reviewCount > 0 ? `${rating.avgRating.toFixed(1)} (${rating.reviewCount})` : '0.0 (0)'}
                        </p>
                        <div className="mt-1 flex items-center gap-3">
                          <p className={`min-w-0 flex-1 truncate text-sm ${hasUnread ? 'font-semibold text-stone-800' : 'text-stone-500'}`}>{(conv as any).lastMessage || 'No messages yet'}</p>
                          {hasUnread && (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff5b5f] text-base font-extrabold text-white shadow-sm">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className={`flex-1 flex flex-col ${!conversationId ? 'hidden sm:flex' : 'flex'}`}>
            {conversationId && selectedConv ? (
              <>
                <div className="relative border-b border-stone-200 bg-white px-3 py-3 sm:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Link to="/messages" className="sm:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-stone-100">
                      <i className="las la-angle-left text-2xl text-stone-700" />
                    </Link>

                    {getOtherParticipantPhoto(selectedConv) ? (
                      <img src={getOtherParticipantPhoto(selectedConv)} alt={getOtherParticipantName(selectedConv)} className="h-10 w-10 shrink-0 rounded-full object-cover bg-stone-100" />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
                        {getOtherParticipantInitial(selectedConv)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-stone-900">{getOtherParticipantName(selectedConv)}</h3>
                      <p className="truncate text-xs text-stone-500">
                        {otherMeta?.location || 'Location not set'} {otherMeta?.reviewCount ? `· ★ ${otherMeta.avgRating.toFixed(1)} (${otherMeta.reviewCount})` : '· No reviews yet'}
                      </p>
                    </div>

                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setThreadMenuOpen((current) => !current);
                          setAttachMenuOpen(false);
                        }}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                        aria-label="Conversation actions"
                      >
                        <i className="las la-ellipsis-v text-xl" />
                      </button>

                      {threadMenuOpen && (
                        <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm shadow-2xl">
                          <button onClick={deleteConversation} disabled={deleting} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">
                            <i className="las la-trash text-xl" />{deleting ? 'Deleting...' : 'Delete chat'}
                          </button>
                          <button onClick={() => { setThreadMenuOpen(false); setShowReport(true); }} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-medium text-stone-700 hover:bg-stone-50">
                            <i className="las la-flag text-xl" />Report
                          </button>
                          <button onClick={blockUser} disabled={blocking || isBlockedByMe} className="flex w-full cursor-pointer items-center gap-3 border-t border-stone-100 px-4 py-3 text-left font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                            <i className="las la-ban text-xl" />{isBlockedByMe ? 'Blocked' : blocking ? 'Blocking...' : 'Block'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ConversationListingCard conversation={selectedConv} />
                {messagingBlocked && <div className="border-b border-primary-100 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700">{UNAVAILABLE_MESSAGE}</div>}

                <div ref={messagesPaneRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
                  {visibleMessages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const showDay = index === 0 || !isSameDay((msg as any).createdAt || 0, (visibleMessages[index - 1] as any)?.createdAt || 0);
                    const recipientIds = selectedConv.participants.filter((id) => id !== currentUser.uid);
                    const isDelivered = recipientIds.every((id) => ((msg as any).deliveredTo || []).includes(id));
                    const isRead = recipientIds.every((id) => ((msg as any).readBy || []).includes(id));
                    const imageSource = (msg as any).imageUrl || (msg as any).imageData || '';
                    const canDeleteEveryone = isMe && !(msg as any).deleted && Date.now() - ((msg as any).createdAt || 0) <= DELETE_EVERYONE_WINDOW_MS;

                    return (
                      <React.Fragment key={msg.id}>
                        {showDay && (
                          <div className="flex justify-center my-3">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500 shadow-sm">{formatDayLabel((msg as any).createdAt)}</span>
                          </div>
                        )}

                        <div className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`relative max-w-[78%] px-3 py-2 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-green-100 text-stone-900 rounded-br-sm' : 'bg-white text-stone-800 rounded-bl-sm'} ${(msg as any).deleted ? 'opacity-80' : ''}`}>
                            {(msg as any).deleted ? (
                              <p className="whitespace-pre-wrap italic text-stone-500">This message was deleted</p>
                            ) : (
                              <>
                                {(msg as any).type === 'image' && imageSource ? <img src={imageSource} alt={(msg as any).imageName || 'Sent image'} className="mb-2 max-h-72 rounded-xl object-contain" /> : null}
                                {(msg as any).type === 'map' && (msg as any).mapUrl ? (
                                  <a href={(msg as any).mapUrl} target="_blank" rel="noreferrer" className="mb-2 block rounded-xl border border-stone-200 bg-white p-3 text-[#1665CC]">
                                    <i className="las la-map-marker text-2xl" /> Open location pin
                                  </a>
                                ) : null}
                                {(msg as any).type !== 'image' || msg.text !== 'Image' ? <p className="whitespace-pre-wrap">{msg.text}</p> : null}
                              </>
                            )}

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setMessageMenuId(messageMenuId === msg.id ? null : msg.id);
                              }}
                              className={`absolute top-1 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/95 text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-white sm:flex ${isMe ? '-left-9' : '-right-9'} opacity-0 group-hover:opacity-100`}
                              aria-label="Message actions"
                            >
                              <i className="las la-angle-down text-lg" />
                            </button>

                            {messageMenuId === msg.id && (
                              <div onClick={(event) => event.stopPropagation()} className={`absolute top-8 z-40 w-52 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm shadow-2xl ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}>
                                <button type="button" onClick={() => copyMessage(msg)} disabled={(msg as any).deleted || !msg.text || msg.text === 'Image'} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"><i className="las la-copy text-xl" />Copy</button>
                                <button type="button" onClick={() => deleteMessageForMe(msg)} className="flex w-full cursor-pointer items-center gap-3 border-t border-stone-100 px-4 py-3 text-left text-red-600 hover:bg-red-50"><i className="las la-trash text-xl" />Delete for me</button>
                                {canDeleteEveryone && <button type="button" onClick={() => deleteMessageForEveryone(msg)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-red-700 hover:bg-red-50"><i className="las la-trash-alt text-xl" />Delete for everyone</button>}
                              </div>
                            )}

                            <div className={`mt-1 flex flex-wrap items-center justify-end gap-1 text-[11px] ${isMe ? 'text-stone-500' : 'text-stone-400'}`}>
                              <span>{(msg as any).createdAt ? new Date((msg as any).createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              {isMe && <span title={isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'} className={isRead ? 'text-[#1665CC]' : 'text-stone-400'}>{isRead ? '✓✓' : isDelivered ? '✓✓' : '✓'}</span>}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                <form onSubmit={handleSend} className="p-4 border-t border-stone-200 bg-white">
                  <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSend} className="hidden" />
                  <div className="flex gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setAttachMenuOpen((current) => !current);
                          setThreadMenuOpen(false);
                        }}
                        disabled={sending || messagingBlocked}
                        className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Attach"
                      >
                        <i className="las la-paperclip text-2xl" />
                      </button>

                      {attachMenuOpen && (
                        <div onClick={(event) => event.stopPropagation()} className="absolute bottom-12 left-0 z-40 w-48 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm shadow-2xl">
                          <button type="button" onClick={() => { setAttachMenuOpen(false); imageInputRef.current?.click(); }} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-medium text-stone-700 hover:bg-stone-50">
                            <i className="las la-image text-xl" />Add image
                          </button>
                          <button type="button" onClick={handleMapPin} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-medium text-stone-700 hover:bg-stone-50">
                            <i className="las la-map-marker text-xl" />Location
                          </button>
                        </div>
                      )}
                    </div>

                    <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={messagingBlocked} placeholder={messagingBlocked ? 'Messaging disabled' : 'Type a message...'} className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 outline-none transition text-sm disabled:bg-stone-100" />
                    <button type="submit" disabled={!newMessage.trim() || sending || messagingBlocked} className="cursor-pointer px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition disabled:cursor-not-allowed disabled:opacity-50 text-sm font-medium">{sending ? 'Sending...' : 'Send'}</button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4"><i className="las la-comments text-3xl text-stone-400" /></div>
                <h3 className="font-semibold text-stone-700">Select a conversation</h3>
                <p className="text-sm text-stone-500 mt-1">Choose a conversation from the left to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-stone-800">Report user</h3>
            <p className="mt-1 text-sm text-stone-500">Tell us what is wrong with this user.</p>
            <div className="mt-4 space-y-3">
              <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm">
                <option value="">Select a reason...</option>
                <option value="spam">Spam</option>
                <option value="fraud">Suspected fraud</option>
                <option value="abuse">Abusive message</option>
                <option value="other">Other</option>
              </select>
              <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Additional details..." rows={3} className="w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowReport(false)} className="cursor-pointer rounded-xl border border-stone-200 py-2.5 text-sm font-semibold">Cancel</button>
                <button onClick={reportUser} disabled={!reportReason} className="cursor-pointer rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Submit report</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
