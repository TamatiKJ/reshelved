import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { uploadChatImage } from '../utils/chatMedia';
import ConversationListingCard from './ConversationListingCard';
import type { Conversation, Message, Rating, UserProfile } from '../types';

type ParticipantMeta = { photoURL: string; location: string; avgRating: number; reviewCount: number; blockedUsers: string[] };

const DELETE_EVERYONE_WINDOW_MS = 10 * 60 * 1000;
const isSameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const getConversationKey = (a: string, b: string) => [a, b].sort().join('_');
const formatDayLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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
  const messagesPaneRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const convs: Conversation[] = [];
      snap.forEach((item) => convs.push({ id: item.id, ...item.data() } as Conversation));
      const visible = convs.filter((conv) => !(conv.hiddenFor || []).includes(currentUser.uid));
      visible.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
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

    const markNotificationsRead = async () => {
      try {
        const nq = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), where('conversationId', '==', conversationId), where('read', '==', false));
        const snap = await getDocs(nq);
        await Promise.all(snap.docs.map((item) => updateDoc(doc(db, 'notifications', item.id), { read: true })));
      } catch (err) {
        console.error('Could not mark notifications as read:', err);
      }
    };

    const markMessagesRead = async (items: Message[]) => {
      const unread = items.filter((msg) => msg.senderId !== currentUser.uid && !(msg.readBy || []).includes(currentUser.uid) && !msg.deleted);
      await Promise.all(unread.map((msg) => updateDoc(doc(db, 'messages', msg.id), { readBy: Array.from(new Set([...(msg.readBy || []), currentUser.uid])) }).catch(() => null)));
    };

    markNotificationsRead();
    const q = query(collection(db, 'messages'), where('conversationId', '==', conversationId));
    const unsub = onSnapshot(q, (snap) => {
      const items: Message[] = [];
      snap.forEach((item) => items.push({ id: item.id, ...item.data() } as Message));
      items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setMessages(items);
      requestAnimationFrame(() => messagesPaneRef.current?.scrollTo({ top: messagesPaneRef.current.scrollHeight, behavior: 'auto' }));
      markNotificationsRead();
      markMessagesRead(items);
    }, (err) => {
      console.error('Error loading messages:', err);
      setError('Could not load messages. Check your Firestore rules.');
    });
    return unsub;
  }, [conversationId, currentUser]);

  useEffect(() => {
    setSelectedConv(conversationId ? conversations.find((conv) => conv.id === conversationId) || null : null);
  }, [conversationId, conversations]);

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
        if (ratings.length > 0) meta[uid] = { ...meta[uid], avgRating: ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length, reviewCount: ratings.length };
      } catch {
        // Use fallback metadata.
      }
    }));
    setParticipantMeta(meta);
  };

  const otherParticipantId = selectedConv && currentUser ? selectedConv.participants.find((id) => id !== currentUser.uid) || '' : '';
  const otherMeta = otherParticipantId ? participantMeta[otherParticipantId] : undefined;
  const isBlockedByMe = Boolean(otherParticipantId && userProfile?.blockedUsers?.includes(otherParticipantId));
  const hasBlockedMe = Boolean(currentUser && otherMeta?.blockedUsers?.includes(currentUser.uid));
  const messagingBlocked = isBlockedByMe || hasBlockedMe;
  const visibleMessages = useMemo(() => currentUser ? messages.filter((msg) => !(msg.deletedFor || []).includes(currentUser.uid)) : [], [messages, currentUser]);
  const getOtherParticipantId = (conv: Conversation) => currentUser ? conv.participants.find((id) => id !== currentUser.uid) || '' : '';
  const getOtherParticipantName = (conv: Conversation) => conv.participantNames?.[getOtherParticipantId(conv)] || 'User';
  const getOtherParticipantPhoto = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)]?.photoURL || conv.participantPhotos?.[getOtherParticipantId(conv)] || '';
  const getOtherParticipantInitial = (conv: Conversation) => getOtherParticipantName(conv)[0]?.toUpperCase() || 'U';
  const getOtherParticipantLocation = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)]?.location || '';
  const getOtherParticipantRating = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)] || { avgRating: 0, reviewCount: 0, location: '', photoURL: '', blockedUsers: [] };

  const ensureCanMessage = () => {
    if (isBlockedByMe) {
      setError('You blocked this user. Unblock them before sending messages.');
      return false;
    }
    if (hasBlockedMe) {
      setError('This user is not available for messaging.');
      return false;
    }
    return true;
  };

  const blockUser = async () => {
    if (!currentUser || !otherParticipantId || !selectedConv) return;
    if (!confirm(`Block ${getOtherParticipantName(selectedConv)}? They will not be able to start new chats or message you.`)) return;
    setBlocking(true);
    setError('');
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { blockedUsers: arrayUnion(otherParticipantId), lastSeen: Date.now() }, { merge: true });
      await refreshProfile();
      setError('User blocked. Firestore rules will reject new messages from them.');
    } catch (err) {
      console.error('Could not block user:', err);
      setError('Could not block this user. Check your Firestore rules.');
    } finally {
      setBlocking(false);
    }
  };

  const notifyRecipients = async (recipientIds: string[], text: string, subject: string, now: number) => {
    if (!currentUser || !selectedConv || !conversationId) return;
    await Promise.all(recipientIds.map((recipientId) => addDoc(collection(db, 'notifications'), { userId: recipientId, fromUserId: currentUser.uid, fromUserName: userProfile?.displayName || currentUser.displayName || 'User', type: 'message', subject, message: text, conversationId, listingId: selectedConv.listingId, createdAt: now, read: false })));
  };

  const sendTextOrMapMessage = async (payload: Partial<Message> & { text: string; type: 'text' | 'map' }) => {
    if (!currentUser || !conversationId || !selectedConv || !ensureCanMessage()) return;
    const now = Date.now();
    const recipientIds = selectedConv.participants.filter((id) => id !== currentUser.uid);
    setSending(true);
    setError('');
    try {
      await addDoc(collection(db, 'messages'), { conversationId, senderId: currentUser.uid, senderName: userProfile?.displayName || currentUser.displayName || 'User', recipientId: recipientIds[0] || '', readBy: [currentUser.uid], createdAt: now, ...payload });
      await updateDoc(doc(db, 'conversations', conversationId), { lastMessage: payload.type === 'map' ? 'Location pin' : payload.text, lastMessageAt: now, updatedAt: now, hiddenFor: [], conversationKey: selectedConv.conversationKey || (recipientIds[0] ? getConversationKey(currentUser.uid, recipientIds[0]) : '') });
      await notifyRecipients(recipientIds, payload.text, `New message from ${userProfile?.displayName || currentUser.displayName || 'User'}`, now);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Message failed to send. The other user may have blocked you or Firestore rules rejected the write.');
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
    setError('');
    try {
      const messageRef = doc(collection(db, 'messages'));
      const uploaded = await uploadChatImage(conversationId, messageRef.id, file);
      await setDoc(messageRef, { conversationId, senderId: currentUser.uid, senderName: userProfile?.displayName || currentUser.displayName || 'User', recipientId: recipientIds[0] || '', readBy: [currentUser.uid], createdAt: now, type: 'image', text: 'Image', ...uploaded });
      await updateDoc(doc(db, 'conversations', conversationId), { lastMessage: 'Image', lastMessageAt: now, updatedAt: now, hiddenFor: [], conversationKey: selectedConv.conversationKey || (recipientIds[0] ? getConversationKey(currentUser.uid, recipientIds[0]) : '') });
      await notifyRecipients(recipientIds, 'Image', `New image from ${userProfile?.displayName || currentUser.displayName || 'User'}`, now);
    } catch (err: any) {
      console.error('Could not send image:', err);
      setError(err?.message || 'Could not send image. The other user may have blocked you.');
    } finally {
      setSending(false);
    }
  };

  const handleMapPin = async () => setError('Location sharing will be connected after launch-safe storage rules are in place.');

  const deleteMessageForMe = async (message: Message) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'messages', message.id), { deletedFor: Array.from(new Set([...(message.deletedFor || []), currentUser.uid])) });
    } catch {
      setError('Could not delete message for you. Check your Firestore rules.');
    }
  };

  const deleteMessageForEveryone = async (message: Message) => {
    if (!currentUser) return;
    const isOwner = message.senderId === currentUser.uid;
    const withinWindow = Date.now() - (message.createdAt || 0) <= DELETE_EVERYONE_WINDOW_MS;
    if (!isOwner || message.deleted || !withinWindow) return;
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
    } catch {
      setError('Could not delete message for everyone. Check your Firestore rules and the 10-minute window.');
    }
  };

  const deleteConversation = async () => {
    if (!conversationId || !selectedConv || !currentUser) return;
    if (!confirm('Delete this chat from your inbox only?')) return;
    setDeleting(true);
    setError('');
    try {
      await updateDoc(doc(db, 'conversations', conversationId), { hiddenFor: Array.from(new Set([...(selectedConv.hiddenFor || []), currentUser.uid])) });
      const messageSnap = await getDocs(query(collection(db, 'messages'), where('conversationId', '==', conversationId)));
      await Promise.all(messageSnap.docs.map((item) => {
        const data = item.data() as Message;
        return updateDoc(doc(db, 'messages', item.id), { deletedFor: Array.from(new Set([...(data.deletedFor || []), currentUser.uid])) });
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
      await addDoc(collection(db, 'reports'), { reporterId: currentUser.uid, reporterName: userProfile?.displayName || 'User', targetType: 'user', targetId: otherParticipantId, targetName: getOtherParticipantName(selectedConv), reason: reportReason, details: reportDetails, createdAt: Date.now(), resolved: false });
      setShowReport(false);
      setReportReason('');
      setReportDetails('');
      setError('');
    } catch {
      setError('Could not submit report.');
    }
  };

  if (!currentUser) return <div className="max-w-4xl mx-auto px-4 py-16 text-center pb-10 sm:pb-[60px]"><h2 className="text-xl font-bold text-stone-700">Please log in to view messages</h2><Link to="/login" className="mt-4 inline-block text-primary-600 font-medium">Log In</Link></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-10 sm:pb-[60px]">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Messages</h1>
      {error && <div className={`mb-4 p-3 rounded-xl text-sm ${error.startsWith('Could not') || error.includes('failed') || error.includes('blocked') || error.includes('rejected') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>{error}</div>}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '560px' }}>
        <div className="flex h-full">
          <div className={`w-full sm:w-[352px] border-r border-stone-200 flex flex-col ${conversationId ? 'hidden sm:flex' : 'flex'}`}>
            <div className="p-4 border-b border-stone-100"><h2 className="font-semibold text-stone-700">Conversations</h2></div>
            <div className="flex-1 overflow-y-auto">
              {loading ? <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="animate-pulse flex items-center gap-3"><div className="w-10 h-10 bg-stone-200 rounded-full" /><div className="flex-1 space-y-2"><div className="h-3 bg-stone-200 rounded w-2/3" /><div className="h-2 bg-stone-100 rounded w-full" /></div></div>)}</div> : conversations.length === 0 ? <div className="p-6 text-center text-stone-500 text-sm">No conversations yet. Contact a seller to start chatting!</div> : conversations.map((conv) => {
                const photo = getOtherParticipantPhoto(conv);
                const rating = getOtherParticipantRating(conv);
                const location = getOtherParticipantLocation(conv);
                return <Link key={conv.id} to={`/messages/${conv.id}`} className={`block border-b border-l-4 p-4 ${conv.id === conversationId ? 'border-b-stone-50 border-l-[#1665CC] bg-[#1665CC]/10' : 'border-b-stone-50 border-l-transparent hover:bg-[#1665CC]/5'}`}><div className="flex items-center gap-3">{photo ? <img src={photo} alt={getOtherParticipantName(conv)} className="w-11 h-11 rounded-full object-cover bg-stone-100 shrink-0" /> : <div className="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm shrink-0">{getOtherParticipantInitial(conv)}</div>}<div className="min-w-0 flex-1"><div className="flex items-center justify-between"><span className="font-semibold text-stone-900 text-sm truncate">{getOtherParticipantName(conv)}</span><span className="text-[11px] text-stone-400 shrink-0 ml-2">{conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ''}</span></div><p className="text-xs text-stone-500 truncate mt-0.5">{location || 'Location not set'} {rating.reviewCount > 0 ? `· ★ ${rating.avgRating.toFixed(1)} (${rating.reviewCount})` : '· No reviews yet'}</p><p className="text-xs text-stone-500 truncate mt-0.5">{conv.lastMessage}</p></div></div></Link>;
              })}
            </div>
          </div>
          <div className={`flex-1 flex flex-col ${!conversationId ? 'hidden sm:flex' : 'flex'}`}>
            {conversationId && selectedConv ? <>
              <div className="p-4 border-b border-stone-200 flex items-center gap-3"><Link to="/messages" className="sm:hidden p-1 hover:bg-stone-100 rounded-lg"><i className="las la-angle-left text-2xl text-stone-600" /></Link>{getOtherParticipantPhoto(selectedConv) ? <img src={getOtherParticipantPhoto(selectedConv)} alt={getOtherParticipantName(selectedConv)} className="w-10 h-10 rounded-full object-cover bg-stone-100" /> : <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">{getOtherParticipantInitial(selectedConv)}</div>}<div className="min-w-0 flex-1"><h3 className="font-semibold text-stone-900 text-sm truncate">{getOtherParticipantName(selectedConv)}</h3><p className="text-xs text-stone-500 truncate">{otherMeta?.location || 'Location not set'} {otherMeta?.reviewCount ? `· ★ ${otherMeta.avgRating.toFixed(1)} (${otherMeta.reviewCount})` : '· No reviews yet'}</p></div><button onClick={blockUser} disabled={blocking || isBlockedByMe} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">{isBlockedByMe ? 'Blocked' : blocking ? 'Blocking...' : 'Block user'}</button><button onClick={() => setShowReport(true)} className="cursor-pointer rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"><i className="las la-flag mr-1" />Report user</button><button onClick={deleteConversation} disabled={deleting} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete chat'}</button></div>
              <ConversationListingCard conversation={selectedConv} />
              {messagingBlocked && <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{isBlockedByMe ? 'You blocked this user. New messages are disabled.' : 'Messaging is unavailable for this conversation.'}</div>}
              <div ref={messagesPaneRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">{visibleMessages.map((msg, index) => { const isMe = msg.senderId === currentUser.uid; const showDay = index === 0 || !isSameDay(msg.createdAt || 0, visibleMessages[index - 1]?.createdAt || 0); const isRead = selectedConv.participants.filter((id) => id !== currentUser.uid).every((id) => (msg.readBy || []).includes(id)); const imageSource = msg.imageUrl || msg.imageData || ''; const canDeleteEveryone = isMe && !msg.deleted && Date.now() - (msg.createdAt || 0) <= DELETE_EVERYONE_WINDOW_MS; return <React.Fragment key={msg.id}>{showDay && <div className="flex justify-center my-3"><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500 shadow-sm">{formatDayLabel(msg.createdAt)}</span></div>}<div className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-green-100 text-stone-900 rounded-br-sm' : 'bg-white text-stone-800 rounded-bl-sm'} ${msg.deleted ? 'opacity-80' : ''}`}>{msg.deleted ? <p className="whitespace-pre-wrap italic text-stone-500">This message was deleted</p> : <>{msg.type === 'image' && imageSource ? <img src={imageSource} alt={msg.imageName || 'Sent image'} className="mb-2 max-h-72 rounded-xl object-contain" /> : null}{msg.type === 'map' && msg.mapUrl ? <a href={msg.mapUrl} target="_blank" rel="noreferrer" className="mb-2 block rounded-xl border border-stone-200 bg-white p-3 text-[#1665CC]"><i className="las la-map-marker text-2xl" /> Open location pin</a> : null}{msg.type !== 'image' || msg.text !== 'Image' ? <p className="whitespace-pre-wrap">{msg.text}</p> : null}</>}<div className={`mt-1 flex flex-wrap items-center justify-end gap-1 text-[11px] ${isMe ? 'text-stone-500' : 'text-stone-400'}`}><span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>{isMe && <span className={isRead ? 'text-[#1665CC]' : 'text-stone-400'}>{isRead ? '✓✓' : '✓'}</span>}<button type="button" onClick={() => deleteMessageForMe(msg)} className="ml-2 hidden cursor-pointer text-red-500 group-hover:inline">Delete for me</button>{canDeleteEveryone && <button type="button" onClick={() => deleteMessageForEveryone(msg)} className="ml-2 hidden cursor-pointer text-red-600 group-hover:inline">Delete for everyone</button>}</div></div></div></React.Fragment>; })}</div>
              <form onSubmit={handleSend} className="p-4 border-t border-stone-200 bg-white"><input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSend} className="hidden" /><div className="flex gap-2"><button type="button" onClick={() => imageInputRef.current?.click()} disabled={sending || messagingBlocked} className="cursor-pointer rounded-xl border border-stone-200 px-3 text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"><i className="las la-image text-2xl" /></button><button type="button" onClick={handleMapPin} disabled={sending || messagingBlocked} className="cursor-pointer rounded-xl border border-stone-200 px-3 text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"><i className="las la-map-marker text-2xl" /></button><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={messagingBlocked} placeholder={messagingBlocked ? 'Messaging disabled' : 'Type a message...'} className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 outline-none transition text-sm disabled:bg-stone-100" /><button type="submit" disabled={!newMessage.trim() || sending || messagingBlocked} className="cursor-pointer px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition disabled:cursor-not-allowed disabled:opacity-50 text-sm font-medium">{sending ? 'Sending...' : 'Send'}</button></div></form>
            </> : <div className="flex-1 flex flex-col items-center justify-center text-center p-8"><div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4"><i className="las la-comments text-3xl text-stone-400" /></div><h3 className="font-semibold text-stone-700">Select a conversation</h3><p className="text-sm text-stone-500 mt-1">Choose a conversation from the left to start messaging</p></div>}
          </div>
        </div>
      </div>
      {showReport && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><h3 className="text-lg font-bold text-stone-800">Report user</h3><p className="mt-1 text-sm text-stone-500">Tell us what is wrong with this user.</p><div className="mt-4 space-y-3"><select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm"><option value="">Select a reason...</option><option value="spam">Spam</option><option value="fraud">Suspected fraud</option><option value="abuse">Abusive message</option><option value="other">Other</option></select><textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Additional details..." rows={3} className="w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm" /><div className="grid grid-cols-2 gap-2"><button onClick={() => setShowReport(false)} className="cursor-pointer rounded-xl border border-stone-200 py-2.5 text-sm font-semibold">Cancel</button><button onClick={reportUser} disabled={!reportReason} className="cursor-pointer rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Submit report</button></div></div></div></div>}
    </div>
  );
};

export default MessagesPage;
