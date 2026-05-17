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

const formatMessageTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

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
        const nq = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), where('conversationId', '==', conversationId), where('read', '==', false));
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
          meta[uid] = { ...meta[uid], photoURL: data.photoURL || fallback, location: data.location || '', avgRating: Number(data.ratingAverage || 0), reviewCount: Number(data.ratingCount || 0) };
        }

        const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
        if (userSnap?.exists()) {
          const user = { uid, ...userSnap.data() } as UserProfile;
          meta[uid] = { ...meta[uid], photoURL: user.photoURL || meta[uid].photoURL, location: user.location || meta[uid].location, blockedUsers: user.blockedUsers || [] };
        }

        const ratingsSnap = await getDocs(query(collection(db, 'ratings'), where('toUserId', '==', uid))).catch(() => null);
        const ratings: Rating[] = [];
        ratingsSnap?.forEach((item) => ratings.push({ id: item.id, ...item.data() } as Rating));
        if (ratings.length > 0) {
          meta[uid] = { ...meta[uid], avgRating: ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length, reviewCount: ratings.length };
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
      <div className="mx-auto max-w-4xl px-4 py-16 text-center pb-10 sm:pb-[60px]">
        <h2 className="text-xl font-bold text-stone-700">Please log in to view messages</h2>
        <Link to="/login" className="mt-4 inline-block font-semibold text-primary-600">Log In</Link>
      </div>
    );
  }

  const selectedPhoto = selectedConv ? getOtherParticipantPhoto(selectedConv) : '';
  const selectedName = selectedConv ? getOtherParticipantName(selectedConv) : '';
  const selectedInitial = selectedConv ? getOtherParticipantInitial(selectedConv) : 'U';

  return (
    <div className="mx-auto max-w-[1180px] px-3 py-5 pb-8 sm:px-6 sm:py-7 sm:pb-[60px]">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Inbox</p>
          <h1 className="mt-1 font-['Work_Sans'] text-[28px] font-bold tracking-tight text-stone-950 sm:text-[34px]">Messages</h1>
        </div>
        <Link to="/browse" className="hidden rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-50 sm:inline-flex">Browse books</Link>
      </div>

      {error && <div className={`mb-4 rounded-2xl p-3 text-sm font-medium ${error.startsWith('Could not') || error.includes('failed') || error.includes('rules') ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-primary-200 bg-primary-50 text-primary-700'}`}>{error}</div>}

      <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_18px_50px_rgba(28,25,23,0.08)]" style={{ height: 'calc(100vh - 185px)', minHeight: '620px' }}>
        <div className="flex h-full min-h-0">
          <aside className={`w-full border-r border-stone-200 bg-white sm:w-[390px] sm:min-w-[390px] ${conversationId ? 'hidden sm:flex' : 'flex'} flex-col`}>
            <div className="border-b border-stone-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-['Work_Sans'] text-lg font-bold text-stone-950">Conversations</h2>
                  <p className="mt-0.5 text-xs text-stone-500">{conversations.length} chat{conversations.length === 1 ? '' : 's'}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF4E2] text-primary-700"><i className="las la-comments text-2xl" /></span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white px-2 py-2">
              {loading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl p-3">
                      <div className="h-12 w-12 rounded-full bg-stone-200" />
                      <div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-stone-200" /><div className="h-2 w-full rounded bg-stone-100" /></div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-400"><i className="las la-comment-slash text-3xl" /></div>
                  <h3 className="mt-4 font-bold text-stone-900">No conversations yet</h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">Message a seller from a listing and your chats will appear here.</p>
                </div>
              ) : conversations.map((conv) => {
                const photo = getOtherParticipantPhoto(conv);
                const rating = getOtherParticipantRating(conv);
                const location = getOtherParticipantLocation(conv);
                const unread = getUnreadCount(conv);
                const isSelected = conv.id === conversationId;
                const hasUnread = unread > 0;

                return (
                  <Link key={conv.id} to={`/messages/${conv.id}`} className={`group relative block rounded-2xl transition ${isSelected ? 'bg-[#fff4f1]' : 'hover:bg-stone-50'}`}>
                    {isSelected && <span className="absolute bottom-3 left-2 top-3 w-1 rounded-full bg-primary-600" />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {photo ? (
                        <img src={photo} alt={getOtherParticipantName(conv)} className="h-[52px] w-[52px] shrink-0 rounded-full bg-stone-100 object-cover ring-1 ring-stone-100" />
                      ) : (
                        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#FFF4E2] text-sm font-bold text-primary-700 ring-1 ring-stone-100">{getOtherParticipantInitial(conv)}</div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[15px] font-extrabold leading-tight text-stone-950">{getOtherParticipantName(conv)}</span>
                          <span className={`shrink-0 text-[11px] ${hasUnread ? 'font-extrabold text-primary-600' : 'font-semibold text-stone-400'}`}>{formatThreadDate((conv as any).lastMessageAt)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-stone-500">{location || 'Location not set'} · ★ {rating.reviewCount > 0 ? `${rating.avgRating.toFixed(1)} (${rating.reviewCount})` : '0.0 (0)'}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className={`min-w-0 flex-1 truncate text-sm ${hasUnread ? 'font-bold text-stone-900' : 'text-stone-500'}`}>{(conv as any).lastMessage || 'No messages yet'}</p>
                          {hasUnread && <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 px-2 text-[11px] font-extrabold text-white shadow-sm">{unread > 99 ? '99+' : unread}</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>

          <section className={`min-w-0 flex-1 flex-col bg-[#fbfaf8] ${!conversationId ? 'hidden sm:flex' : 'flex'}`}>
            {conversationId && selectedConv ? (
              <>
                <header className="relative border-b border-stone-200 bg-white px-3 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Link to="/messages" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-700 hover:bg-stone-100 sm:hidden"><i className="las la-angle-left text-2xl" /></Link>
                    {selectedPhoto ? <img src={selectedPhoto} alt={selectedName} className="h-11 w-11 shrink-0 rounded-full bg-stone-100 object-cover ring-1 ring-stone-100" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF4E2] text-sm font-bold text-primary-700">{selectedInitial}</div>}
                    <div className="min-w-0 flex-1"><h3 className="truncate text-base font-extrabold text-stone-950">{selectedName}</h3><p className="truncate text-xs text-stone-500">{otherMeta?.location || 'Location not set'} {otherMeta?.reviewCount ? `· ★ ${otherMeta.avgRating.toFixed(1)} (${otherMeta.reviewCount})` : '· No reviews yet'}</p></div>
                    <div className="relative shrink-0">
                      <button type="button" onClick={(event) => { event.stopPropagation(); setThreadMenuOpen((current) => !current); setAttachMenuOpen(false); }} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50" aria-label="Conversation actions"><i className="las la-ellipsis-v text-xl" /></button>
                      {threadMenuOpen && <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm shadow-2xl"><button onClick={deleteConversation} disabled={deleting} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"><i className="las la-trash text-xl" />{deleting ? 'Deleting...' : 'Delete chat'}</button><button onClick={() => { setThreadMenuOpen(false); setShowReport(true); }} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50"><i className="las la-flag text-xl" />Report</button><button onClick={blockUser} disabled={blocking || isBlockedByMe} className="flex w-full cursor-pointer items-center gap-3 border-t border-stone-100 px-4 py-3 text-left font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><i className="las la-ban text-xl" />{isBlockedByMe ? 'Blocked' : blocking ? 'Blocking...' : 'Block'}</button></div>}
                    </div>
                  </div>
                </header>

                <div className="border-b border-stone-200 bg-white px-3 py-2 sm:px-5"><ConversationListingCard conversation={selectedConv} /></div>
                {messagingBlocked && <div className="border-b border-primary-100 bg-primary-50 px-5 py-3 text-sm font-bold text-primary-700">{UNAVAILABLE_MESSAGE}</div>}

                <div ref={messagesPaneRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-6">
                  {visibleMessages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const showDay = index === 0 || !isSameDay((msg as any).createdAt || 0, (visibleMessages[index - 1] as any)?.createdAt || 0);
                    const recipientIds = selectedConv.participants.filter((id) => id !== currentUser.uid);
                    const isDelivered = recipientIds.every((id) => ((msg as any).deliveredTo || []).includes(id));
                    const isRead = recipientIds.every((id) => ((msg as any).readBy || []).includes(id));
                    const imageSource = (msg as any).imageUrl || (msg as any).imageData || '';
                    const canDeleteEveryone = isMe && !(msg as any).deleted && Date.now() - ((msg as any).createdAt || 0) <= DELETE_EVERYONE_WINDOW_MS;

                    return <React.Fragment key={msg.id}>{showDay && <div className="flex justify-center py-1"><span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-bold text-stone-500 shadow-sm">{formatDayLabel((msg as any).createdAt)}</span></div>}<div className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}><div className={`relative max-w-[86%] px-4 py-3 text-sm shadow-sm sm:max-w-[72%] ${isMe ? 'rounded-[22px] rounded-br-md border border-primary-600/10 bg-[#FFF4E2] text-stone-950' : 'rounded-[22px] rounded-bl-md border border-stone-200 bg-white text-stone-800'} ${(msg as any).deleted ? 'opacity-80' : ''}`}>{(msg as any).deleted ? <p className="whitespace-pre-wrap italic text-stone-500">This message was deleted</p> : <>{(msg as any).type === 'image' && imageSource ? <img src={imageSource} alt={(msg as any).imageName || 'Sent image'} className="mb-2 max-h-72 rounded-2xl object-contain" /> : null}{(msg as any).type === 'map' && (msg as any).mapUrl ? <a href={(msg as any).mapUrl} target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 font-bold text-[#1665CC]"><i className="las la-map-marker text-2xl" /> Open location pin</a> : null}{(msg as any).type !== 'image' || msg.text !== 'Image' ? <p className="whitespace-pre-wrap leading-6">{msg.text}</p> : null}</>}<button type="button" onClick={(event) => { event.stopPropagation(); setMessageMenuId(messageMenuId === msg.id ? null : msg.id); }} className={`absolute top-1 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50 sm:flex ${isMe ? '-left-10' : '-right-10'} opacity-0 group-hover:opacity-100`} aria-label="Message actions"><i className="las la-angle-down text-lg" /></button>{messageMenuId === msg.id && <div onClick={(event) => event.stopPropagation()} className={`absolute top-9 z-40 w-52 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm shadow-2xl ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}><button type="button" onClick={() => copyMessage(msg)} disabled={(msg as any).deleted || !msg.text || msg.text === 'Image'} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"><i className="las la-copy text-xl" />Copy</button><button type="button" onClick={() => deleteMessageForMe(msg)} className="flex w-full cursor-pointer items-center gap-3 border-t border-stone-100 px-4 py-3 text-left text-red-600 hover:bg-red-50"><i className="las la-trash text-xl" />Delete for me</button>{canDeleteEveryone && <button type="button" onClick={() => deleteMessageForEveryone(msg)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-red-700 hover:bg-red-50"><i className="las la-trash-alt text-xl" />Delete for everyone</button>}</div>}<div className={`mt-1 flex flex-wrap items-center justify-end gap-1 text-[11px] ${isMe ? 'text-stone-500' : 'text-stone-400'}`}><span>{formatMessageTime((msg as any).createdAt)}</span>{isMe && <span title={isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'} className={isRead ? 'text-[#1665CC]' : 'text-stone-400'}>{isRead ? '✓✓' : isDelivered ? '✓✓' : '✓'}</span>}</div></div></div></React.Fragment>;
                  })}
                </div>

                <form onSubmit={handleSend} className="border-t border-stone-200 bg-white px-3 py-3 sm:px-5"><input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSend} className="hidden" /><div className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 p-1.5"><div className="relative"><button type="button" onClick={(event) => { event.stopPropagation(); setAttachMenuOpen((current) => !current); setThreadMenuOpen(false); }} disabled={sending || messagingBlocked} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-stone-700 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Attach"><i className="las la-paperclip text-2xl" /></button>{attachMenuOpen && <div onClick={(event) => event.stopPropagation()} className="absolute bottom-12 left-0 z-40 w-48 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm shadow-2xl"><button type="button" onClick={() => { setAttachMenuOpen(false); imageInputRef.current?.click(); }} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50"><i className="las la-image text-xl" />Add image</button><button type="button" onClick={handleMapPin} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50"><i className="las la-map-marker text-xl" />Location</button></div>}</div><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={messagingBlocked} placeholder={messagingBlocked ? 'Messaging disabled' : 'Type a message...'} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none disabled:text-stone-400" /><button type="submit" disabled={!newMessage.trim() || sending || messagingBlocked} className="cursor-pointer rounded-full bg-primary-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{sending ? 'Sending...' : 'Send'}</button></div></form>
              </>
            ) : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white text-stone-400 shadow-sm ring-1 ring-stone-200"><i className="las la-comments text-4xl" /></div><h3 className="font-['Work_Sans'] text-xl font-bold text-stone-900">Select a conversation</h3><p className="mt-2 max-w-xs text-sm leading-6 text-stone-500">Choose a chat from the left to view messages and respond.</p></div>}
          </section>
        </div>
      </div>

      {showReport && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-bold text-stone-800">Report user</h3><p className="mt-1 text-sm text-stone-500">Tell us what is wrong with this user.</p><div className="mt-4 space-y-3"><select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none"><option value="">Select a reason...</option><option value="spam">Spam</option><option value="fraud">Suspected fraud</option><option value="abuse">Abusive message</option><option value="other">Other</option></select><textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Additional details..." rows={3} className="w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none" /><div className="grid grid-cols-2 gap-2"><button onClick={() => setShowReport(false)} className="cursor-pointer rounded-full border border-stone-200 py-2.5 text-sm font-bold">Cancel</button><button onClick={reportUser} disabled={!reportReason} className="cursor-pointer rounded-full bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">Submit report</button></div></div></div></div>}
    </div>
  );
};

export default MessagesPage;
