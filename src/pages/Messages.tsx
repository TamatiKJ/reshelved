import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Conversation, Message } from '../types';

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
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [participantPhotos, setParticipantPhotos] = useState<Record<string, string>>({});

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

      if (conversationId) {
        const sel = convs.find(c => c.id === conversationId);
        setSelectedConv(sel || null);
      }

      const userIds = Array.from(new Set(convs.flatMap((conv) => conv.participants)));
      const photoMap: Record<string, string> = {};
      await Promise.all(userIds.map(async (uid) => {
        try {
          const snapUser = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
          if (!snapUser.empty) {
            const photoURL = snapUser.docs[0].data().photoURL;
            if (typeof photoURL === 'string') photoMap[uid] = photoURL;
            return;
          }
          const directSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', uid)) as any).catch(() => null);
          const directPhoto = directSnap && !directSnap.empty ? directSnap.docs[0].data().photoURL : '';
          if (typeof directPhoto === 'string') photoMap[uid] = directPhoto;
        } catch (err) {
          const fallback = convs.find((conv) => conv.participants.includes(uid))?.participantPhotos?.[uid];
          if (fallback) photoMap[uid] = fallback;
        }
      }));
      setParticipantPhotos(photoMap);

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
    messagesPaneRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const markConversationNotificationsRead = async () => {
      try {
        const nq = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), where('conversationId', '==', conversationId), where('read', '==', false));
        const snap = await getDocs(nq);
        await Promise.all(snap.docs.map((item) => updateDoc(doc(db, 'notifications', item.id), { read: true })));
      } catch (err) {
        console.error('Could not mark message notifications as read:', err);
      }
    };

    markConversationNotificationsRead();

    const q = query(collection(db, 'messages'), where('conversationId', '==', conversationId));

    const unsub = onSnapshot(q, (snap) => {
      const msgs: Message[] = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() } as Message));
      msgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setMessages(msgs);
      requestAnimationFrame(() => messagesPaneRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
      markConversationNotificationsRead();
    }, (err) => {
      console.error('Error loading messages:', err);
      setError('Could not load messages. Check your Firestore rules.');
    });

    return unsub;
  }, [conversationId, currentUser]);

  useEffect(() => {
    if (conversationId) {
      const sel = conversations.find(c => c.id === conversationId);
      setSelectedConv(sel || null);
    }
  }, [conversationId, conversations]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !conversationId || !selectedConv) return;

    const messageText = newMessage.trim();
    const now = Date.now();
    setSending(true);
    setError('');

    try {
      await addDoc(collection(db, 'messages'), { conversationId, senderId: currentUser.uid, senderName: userProfile?.displayName || currentUser.displayName || 'User', text: messageText, createdAt: now });
      await updateDoc(doc(db, 'conversations', conversationId), { lastMessage: messageText, lastMessageAt: now, updatedAt: now });
      const recipientIds = selectedConv.participants.filter((id) => id !== currentUser.uid);
      await Promise.all(recipientIds.map((recipientId) => addDoc(collection(db, 'notifications'), { userId: recipientId, fromUserId: currentUser.uid, fromUserName: userProfile?.displayName || currentUser.displayName || 'User', type: 'message', subject: `New message from ${userProfile?.displayName || currentUser.displayName || 'User'}`, message: messageText, conversationId, listingId: selectedConv.listingId, createdAt: now, read: false })));
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Message failed to send. Check your Firestore rules.');
    } finally {
      setSending(false);
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

  const getOtherParticipantId = (conv: Conversation) => currentUser ? conv.participants.find(p => p !== currentUser.uid) || '' : '';
  const getOtherParticipantName = (conv: Conversation) => {
    const otherId = getOtherParticipantId(conv);
    return conv.participantNames?.[otherId] || 'User';
  };
  const getOtherParticipantPhoto = (conv: Conversation) => {
    const otherId = getOtherParticipantId(conv);
    return participantPhotos[otherId] || conv.participantPhotos?.[otherId] || '';
  };
  const getOtherParticipantInitial = (conv: Conversation) => getOtherParticipantName(conv)[0]?.toUpperCase() || 'U';

  if (!currentUser) return <div className="max-w-4xl mx-auto px-4 py-16 text-center pb-10 sm:pb-[60px]"><h2 className="text-xl font-bold text-stone-700">Please log in to view messages</h2><Link to="/login" className="mt-4 inline-block text-primary-600 font-medium">Log In</Link></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-10 sm:pb-[60px]">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Messages</h1>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
        <div className="flex h-full">
          <div className={`w-full sm:w-80 border-r border-stone-200 flex flex-col ${conversationId ? 'hidden sm:flex' : 'flex'}`}>
            <div className="p-4 border-b border-stone-100"><h2 className="font-semibold text-stone-700">Conversations</h2></div>
            <div className="flex-1 overflow-y-auto">
              {loading ? <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="animate-pulse flex items-center gap-3"><div className="w-10 h-10 bg-stone-200 rounded-full" /><div className="flex-1 space-y-2"><div className="h-3 bg-stone-200 rounded w-2/3" /><div className="h-2 bg-stone-100 rounded w-full" /></div></div>)}</div> : conversations.length === 0 ? <div className="p-6 text-center text-stone-500 text-sm">No conversations yet. Contact a seller to start chatting!</div> : conversations.map((conv) => {
                const photo = getOtherParticipantPhoto(conv);
                return <Link key={conv.id} to={`/messages/${conv.id}`} className={`block p-4 border-b border-stone-50 hover:bg-stone-50 transition ${conv.id === conversationId ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''}`}><div className="flex items-center gap-3">{photo ? <img src={photo} alt={getOtherParticipantName(conv)} className="w-10 h-10 rounded-full object-cover bg-stone-100 shrink-0" /> : <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm shrink-0">{getOtherParticipantInitial(conv)}</div>}<div className="min-w-0 flex-1"><div className="flex items-center justify-between"><span className="font-medium text-stone-800 text-sm truncate">{getOtherParticipantName(conv)}</span><span className="text-xs text-stone-400 shrink-0 ml-2">{conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ''}</span></div><p className="text-xs text-stone-500 truncate mt-0.5">{conv.listingTitle}</p><p className="text-xs text-stone-400 truncate mt-0.5">{conv.lastMessage}</p></div></div></Link>;
              })}
            </div>
          </div>

          <div className={`flex-1 flex flex-col ${!conversationId ? 'hidden sm:flex' : 'flex'}`}>
            {conversationId && selectedConv ? <>
              <div className="p-4 border-b border-stone-200 flex items-center gap-3">
                <Link to="/messages" className="sm:hidden p-1 hover:bg-stone-100 rounded-lg"><svg className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></Link>
                {getOtherParticipantPhoto(selectedConv) ? <img src={getOtherParticipantPhoto(selectedConv)} alt={getOtherParticipantName(selectedConv)} className="w-9 h-9 rounded-full object-cover bg-stone-100" /> : <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">{getOtherParticipantInitial(selectedConv)}</div>}
                <div className="min-w-0 flex-1"><h3 className="font-semibold text-stone-800 text-sm truncate">{getOtherParticipantName(selectedConv)}</h3>{selectedConv.listingId ? <Link to={`/listing/${selectedConv.listingId}`} className="text-xs text-primary-600 hover:underline truncate block">Re: {selectedConv.listingTitle}</Link> : <p className="text-xs text-stone-500 truncate">Profile message</p>}</div>
                <button onClick={deleteConversation} disabled={deleting} className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
              </div>
              <div ref={messagesPaneRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => { const isMe = msg.senderId === currentUser.uid; return <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-stone-100 text-stone-800 rounded-bl-sm'}`}><p>{msg.text}</p><p className={`text-xs mt-1 ${isMe ? 'text-primary-200' : 'text-stone-400'}`}>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p></div></div>; })}
              </div>
              <form onSubmit={handleSend} className="p-4 border-t border-stone-200"><div className="flex gap-2"><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition text-sm" /><button type="submit" disabled={!newMessage.trim() || sending} className="cursor-pointer px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition disabled:cursor-not-allowed disabled:opacity-50 text-sm font-medium">{sending ? 'Sending...' : 'Send'}</button></div></form>
            </> : <div className="flex-1 flex flex-col items-center justify-center text-center p-8"><div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4"><i className="las la-comments text-3xl text-stone-400" /></div><h3 className="font-semibold text-stone-700">Select a conversation</h3><p className="text-sm text-stone-500 mt-1">Choose a conversation from the left to start messaging</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;
