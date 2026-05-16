import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Conversation, Message, Rating, UserProfile } from '../types';

const BLUE = '#1665CC';
const MAX_CHAT_IMAGE_WIDTH = 900;
const MAX_CHAT_IMAGE_BYTES = 700 * 1024;

type ParticipantMeta = {
  photoURL: string;
  location: string;
  avgRating: number;
  reviewCount: number;
};

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
const getConversationKey = (a: string, b: string) => [a, b].sort().join('_');

const compressImageToDataUrl = async (file: File): Promise<{ dataUrl: string; size: number }> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image.')); };
    img.src = url;
  });
  const scale = Math.min(1, MAX_CHAT_IMAGE_WIDTH / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image compression is not supported in this browser.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/webp', 0.65);
  const size = Math.round((dataUrl.length * 3) / 4);
  if (size > MAX_CHAT_IMAGE_BYTES) throw new Error('Image is still too large after compression. Try a smaller photo.');
  return { dataUrl, size };
};

const Messages: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const messagesPaneRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [participantMeta, setParticipantMeta] = useState<Record<string, ParticipantMeta>>({});
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const convs: Conversation[] = [];
      snap.forEach(d => convs.push({ id: d.id, ...d.data() } as Conversation));
      convs.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      setConversations(convs);
      if (conversationId) setSelectedConv(convs.find(c => c.id === conversationId) || null);
      await loadParticipantMeta(convs);
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
    setError('');
    const markConversationNotificationsRead = async () => {
      try {
        const nq = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), where('conversationId', '==', conversationId), where('read', '==', false));
        const snap = await getDocs(nq);
        await Promise.all(snap.docs.map((item) => updateDoc(doc(db, 'notifications', item.id), { read: true })));
      } catch (err) {
        console.error('Could not mark message notifications as read:', err);
      }
    };
    const markMessagesRead = async (items: Message[]) => {
      const unread = items.filter((msg) => msg.senderId !== currentUser.uid && !(msg.readBy || []).includes(currentUser.uid) && !msg.deleted);
      if (unread.length === 0) return;
      await Promise.all(unread.map((msg) => updateDoc(doc(db, 'messages', msg.id), { readBy: Array.from(new Set([...(msg.readBy || []), currentUser.uid])) }).catch(() => null)));
    };
    markConversationNotificationsRead();
    const q = query(collection(db, 'messages'), where('conversationId', '==', conversationId));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() } as Message));
      msgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setMessages(msgs);
      requestAnimationFrame(() => messagesPaneRef.current?.scrollTo({ top: messagesPaneRef.current.scrollHeight, behavior: 'auto' }));
      markConversationNotificationsRead();
      markMessagesRead(msgs);
    }, (err) => {
      console.error('Error loading messages:', err);
      setError('Could not load messages. Check your Firestore rules.');
    });
    return unsub;
  }, [conversationId, currentUser]);

  useEffect(() => {
    if (conversationId) setSelectedConv(conversations.find(c => c.id === conversationId) || null);
  }, [conversationId, conversations]);

  const loadParticipantMeta = async (convs: Conversation[]) => {
    const userIds = Array.from(new Set(convs.flatMap((conv) => conv.participants)));
    const meta: Record<string, ParticipantMeta> = {};
    await Promise.all(userIds.map(async (uid) => {
      try {
        const [userSnap, ratingsSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDocs(query(collection(db, 'ratings'), where('toUserId', '==', uid))).catch(() => null)
        ]);
        const user = userSnap.exists() ? { uid, ...userSnap.data() } as UserProfile : null;
        const ratings: Rating[] = [];
        ratingsSnap?.forEach((item) => ratings.push({ id: item.id, ...item.data() } as Rating));
        const avgRating = ratings.length ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length : 0;
        const fallback = convs.find((conv) => conv.participants.includes(uid))?.participantPhotos?.[uid] || '';
        meta[uid] = { photoURL: user?.photoURL || fallback, location: user?.location || '', avgRating, reviewCount: ratings.length };
      } catch {
        const fallback = convs.find((conv) => conv.participants.includes(uid))?.participantPhotos?.[uid] || '';
        meta[uid] = { photoURL: fallback, location: '', avgRating: 0, reviewCount: 0 };
      }
    }));
    setParticipantMeta(meta);
  };

  const otherParticipantId = selectedConv && currentUser ? selectedConv.participants.find(p => p !== currentUser.uid) || '' : '';
  const otherMeta = otherParticipantId ? participantMeta[otherParticipantId] : undefined;
  const visibleMessages = useMemo(() => currentUser ? messages.filter((msg) => !(msg.deletedFor || []).includes(currentUser.uid) && !msg.deleted) : [], [messages, currentUser]);

  const getOtherParticipantId = (conv: Conversation) => currentUser ? conv.participants.find(p => p !== currentUser.uid) || '' : '';
  const getOtherParticipantName = (conv: Conversation) => conv.participantNames?.[getOtherParticipantId(conv)] || 'User';
  const getOtherParticipantPhoto = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)]?.photoURL || conv.participantPhotos?.[getOtherParticipantId(conv)] || '';
  const getOtherParticipantInitial = (conv: Conversation) => getOtherParticipantName(conv)[0]?.toUpperCase() || 'U';
  const getOtherParticipantLocation = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)]?.location || '';
  const getOtherParticipantRating = (conv: Conversation) => participantMeta[getOtherParticipantId(conv)] || { avgRating: 0, reviewCount: 0, location: '', photoURL: '' };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !conversationId || !selectedConv) return;
    await sendMessage({ text: newMessage.trim(), type: 'text' });
    setNewMessage('');
  };

  const sendMessage = async (payload: Partial<Message> & { text: string; type: 'text' | 'image' | 'map' }) => {
    if (!currentUser || !conversationId || !selectedConv) return;
    const now = Date.now();
    const recipientIds = selectedConv.participants.filter((id) => id !== currentUser.uid);
    setSending(true);
    setError('');
    try {
      await addDoc(collection(db, 'messages'), { conversationId, senderId: currentUser.uid, senderName: userProfile?.displayName || currentUser.displayName || 'User', recipientId: recipientIds[0] || '', readBy: [currentUser.uid], createdAt: now, ...payload });
      await updateDoc(doc(db, 'conversations', conversationId), { lastMessage: payload.type === 'image' ? '📷 Image' : payload.type === 'map' ? '📍 Location pin' : payload.text, lastMessageAt: now, updatedAt: now, conversationKey: selectedConv.conversationKey || (recipientIds[0] ? getConversationKey(currentUser.uid, recipientIds[0]) : '') });
      await Promise.all(recipientIds.map((recipientId) => addDoc(collection(db, 'notifications'), { userId: recipientId, fromUserId: currentUser.uid, fromUserName: userProfile?.displayName || currentUser.displayName || 'User', type: 'message', subject: `New message from ${userProfile?.displayName || currentUser.displayName || 'User'}`, message: payload.text, conversationId, listingId: selectedConv.listingId, createdAt: now, read: false })));
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Message failed to send. Check your Firestore rules.');
    } finally {
      setSending(false);
    }
  };

  const handleImageSend = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const compressed = await compressImageToDataUrl(file);
      await sendMessage({ type: 'image', text: 'Image', imageData: compressed.dataUrl, imageName: file.name, imageSize: compressed.size });
    } catch (err: any) {
      setError(err?.message || 'Could not send image.');
    }
  };

  const handleMapPin = async () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location sharing.');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = Number(position.coords.latitude.toFixed(6));
      const lng = Number(position.coords.longitude.toFixed(6));
      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      await sendMessage({ type: 'map', text: 'Location pin', lat, lng, mapUrl });
    }, () => setError('Location permission was blocked.'));
  };

  const deleteMessage = async (message: Message) => {
    if (!currentUser || !confirm('Delete this message?')) return;
    try {
      await updateDoc(doc(db, 'messages', message.id), { deletedFor: Array.from(new Set([...(message.deletedFor || []), currentUser.uid])) });
    } catch {
      setError('Could not delete message.');
    }
  };

  const deleteConversation = async () => {
    if (!conversationId || !selectedConv) return;
    if (!confirm('Delete this chat permanently?')) return;
    setDeleting(true);
    setError('');
    try {
      const messageSnap = await getDocs(query(collection(db, 'messages'), where('conversationId', '==', conversationId)));
      const notificationSnap = await getDocs(query(collection(db, 'notifications'), where('conversationId', '==', conversationId)));
      await Promise.all([
        ...messageSnap.docs.map((item) => deleteDoc(doc(db, 'messages', item.id))),
        ...notificationSnap.docs.map((item) => deleteDoc(doc(db, 'notifications', item.id))),
        deleteDoc(doc(db, 'conversations', conversationId))
      ]);
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
      {error && <div className={`mb-4 p-3 rounded-xl text-sm ${error === 'Location permission was blocked.' || error.startsWith('Could not') || error.includes('failed') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>{error}</div>}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '560px' }}>
        <div className="flex h-full">
          <div className={`w-full sm:w-88 border-r border-stone-200 flex flex-col ${conversationId ? 'hidden sm:flex' : 'flex'}`}>
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
              <div className="p-4 border-b border-stone-200 flex items-center gap-3">
                <Link to="/messages" className="sm:hidden p-1 hover:bg-stone-100 rounded-lg"><i className="las la-angle-left text-2xl text-stone-600" /></Link>
                {getOtherParticipantPhoto(selectedConv) ? <img src={getOtherParticipantPhoto(selectedConv)} alt={getOtherParticipantName(selectedConv)} className="w-10 h-10 rounded-full object-cover bg-stone-100" /> : <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">{getOtherParticipantInitial(selectedConv)}</div>}
                <div className="min-w-0 flex-1"><h3 className="font-semibold text-stone-900 text-sm truncate">{getOtherParticipantName(selectedConv)}</h3><p className="text-xs text-stone-500 truncate">{otherMeta?.location || 'Location not set'} {otherMeta?.reviewCount ? `· ★ ${otherMeta.avgRating.toFixed(1)} (${otherMeta.reviewCount})` : '· No reviews yet'}</p></div>
                <button onClick={() => setShowReport(true)} className="cursor-pointer rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"><i className="las la-flag mr-1" />Report user</button>
                <button onClick={deleteConversation} disabled={deleting} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete chat'}</button>
              </div>
              <div ref={messagesPaneRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
                {visibleMessages.map((msg, index) => {
                  const isMe = msg.senderId === currentUser.uid;
                  const showDay = index === 0 || !isSameDay(msg.createdAt || 0, visibleMessages[index - 1]?.createdAt || 0);
                  const isRead = selectedConv.participants.filter((id) => id !== currentUser.uid).every((id) => (msg.readBy || []).includes(id));
                  return <React.Fragment key={msg.id}>{showDay && <div className="flex justify-center my-3"><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500 shadow-sm">{formatDayLabel(msg.createdAt)}</span></div>}<div className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-green-100 text-stone-900 rounded-br-sm' : 'bg-white text-stone-800 rounded-bl-sm'}`}>{msg.type === 'image' && msg.imageData ? <img src={msg.imageData} alt={msg.imageName || 'Sent image'} className="mb-2 max-h-72 rounded-xl object-contain" /> : null}{msg.type === 'map' && msg.mapUrl ? <a href={msg.mapUrl} target="_blank" rel="noreferrer" className="mb-2 block rounded-xl border border-stone-200 bg-white p-3 text-[#1665CC]"><i className="las la-map-marker text-2xl" /> Open location pin</a> : null}{msg.type !== 'image' || msg.text !== 'Image' ? <p className="whitespace-pre-wrap">{msg.text}</p> : null}<div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${isMe ? 'text-stone-500' : 'text-stone-400'}`}><span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>{isMe && <span className={isRead ? 'text-[#1665CC]' : 'text-stone-400'}>{isRead ? '✓✓' : '✓'}</span>}<button type="button" onClick={() => deleteMessage(msg)} className="ml-2 hidden cursor-pointer text-red-500 group-hover:inline">Delete</button></div></div></div></React.Fragment>;
                })}
              </div>
              <form onSubmit={handleSend} className="p-4 border-t border-stone-200 bg-white"><input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSend} className="hidden" /><div className="flex gap-2"><button type="button" onClick={() => imageInputRef.current?.click()} className="cursor-pointer rounded-xl border border-stone-200 px-3 text-stone-600 hover:bg-stone-50"><i className="las la-image text-2xl" /></button><button type="button" onClick={handleMapPin} className="cursor-pointer rounded-xl border border-stone-200 px-3 text-stone-600 hover:bg-stone-50"><i className="las la-map-marker text-2xl" /></button><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10 outline-none transition text-sm" /><button type="submit" disabled={!newMessage.trim() || sending} className="cursor-pointer px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition disabled:cursor-not-allowed disabled:opacity-50 text-sm font-medium">{sending ? 'Sending...' : 'Send'}</button></div></form>
            </> : <div className="flex-1 flex flex-col items-center justify-center text-center p-8"><div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4"><i className="las la-comments text-3xl text-stone-400" /></div><h3 className="font-semibold text-stone-700">Select a conversation</h3><p className="text-sm text-stone-500 mt-1">Choose a conversation from the left to start messaging</p></div>}
          </div>
        </div>
      </div>

      {showReport && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><h3 className="text-lg font-bold text-stone-800">Report user</h3><p className="mt-1 text-sm text-stone-500">Tell us what is wrong with this user.</p><div className="mt-4 space-y-3"><select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm"><option value="">Select a reason...</option><option value="spam">Spam</option><option value="fraud">Suspected fraud</option><option value="abuse">Abusive message</option><option value="other">Other</option></select><textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Additional details..." rows={3} className="w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm" /><div className="grid grid-cols-2 gap-2"><button onClick={() => setShowReport(false)} className="cursor-pointer rounded-xl border border-stone-200 py-2.5 text-sm font-semibold">Cancel</button><button onClick={reportUser} disabled={!reportReason} className="cursor-pointer rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Submit report</button></div></div></div></div>}
    </div>
  );
};

export default Messages;
