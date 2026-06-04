import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, arrayUnion, collection, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { hideConversationForUser, markConversationMessagesRead, markConversationNotificationsRead, sendChatMessage } from '../services/messagesService';
import type { Conversation, Message } from '../types';

const CHAT_GREEN = '#25D366';
const DELETE_EVERYONE_WINDOW_MS = 30 * 60 * 1000;
const UNAVAILABLE_MESSAGE = "You can't message this user at this time.";
const formatTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const formatDate = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
type ConversationFilter = 'all' | 'swap' | 'donate' | 'sell';

const FloatingMessagesButton: React.FC = () => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const { messageUnreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredConversations = useMemo(() => (
    filter === 'all'
      ? conversations
      : conversations.filter((conversation) => (conversation as any).listingType === filter)
  ), [conversations, filter]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const getOtherParticipantId = (conversation: Conversation) => currentUser ? conversation.participants.find((id) => id !== currentUser.uid) || '' : '';
  const getOtherParticipantName = (conversation: Conversation) => conversation.participantNames?.[getOtherParticipantId(conversation)] || 'User';
  const getOtherParticipantPhoto = (conversation: Conversation) => conversation.participantPhotos?.[getOtherParticipantId(conversation)] || '';
  const getUnreadCount = (conversation: Conversation) => currentUser ? Number(conversation.unreadCount?.[currentUser.uid] || 0) : 0;

  const otherParticipantId = selectedConversation ? getOtherParticipantId(selectedConversation) : '';
  const isBlockedByMe = Boolean(otherParticipantId && userProfile?.blockedUsers?.includes(otherParticipantId));

  useEffect(() => {
    const handleOpenChat = (event: Event) => {
      const conversationId = (event as CustomEvent<{ conversationId?: string }>).detail?.conversationId || '';
      if (conversationId) setSelectedConversationId(conversationId);
      setOpen(true);
    };

    window.addEventListener('reshelved:open-chat', handleOpenChat);
    return () => window.removeEventListener('reshelved:open-chat', handleOpenChat);
  }, []);

  useEffect(() => {
    if (!error) return undefined;
    const timeout = window.setTimeout(() => setError(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    const closeMenus = () => {
      setThreadMenuOpen(false);
      setMessageMenuId(null);
    };
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, []);

  useEffect(() => {
    if (!currentUser || !open) return undefined;

    const conversationsQuery = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUser.uid));
    return onSnapshot(conversationsQuery, (snapshot) => {
      const items: Conversation[] = [];
      snapshot.forEach((item) => items.push({ id: item.id, ...item.data() } as Conversation));
      const visibleItems = items
        .filter((conversation) => !conversation.hiddenFor?.includes(currentUser.uid))
        .sort((a, b) => Number(b.lastMessageAt || b.createdAt || 0) - Number(a.lastMessageAt || a.createdAt || 0));

      setConversations(visibleItems);
      setSelectedConversationId((current) => current && visibleItems.some((item) => item.id === current) ? current : visibleItems[0]?.id || '');
    }, (err) => {
      console.error('Floating chat conversations failed:', err);
      setError('Could not load chats.');
    });
  }, [currentUser?.uid, open]);

  useEffect(() => {
    if (!currentUser || !selectedConversationId || !open) {
      setMessages([]);
      return undefined;
    }

    const messagesQuery = query(collection(db, 'messages'), where('conversationId', '==', selectedConversationId));
    return onSnapshot(messagesQuery, (snapshot) => {
      const items: Message[] = [];
      snapshot.forEach((item) => items.push({ id: item.id, ...item.data() } as Message));
      items.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
      setMessages(items);
      window.requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
      markConversationNotificationsRead(selectedConversationId, currentUser.uid).catch(() => undefined);
      markConversationMessagesRead({ conversationId: selectedConversationId, userId: currentUser.uid, messages: items }).catch(() => undefined);
    }, (err) => {
      console.error('Floating chat messages failed:', err);
      setError('Could not load messages.');
    });
  }, [currentUser?.uid, selectedConversationId, open]);

  useEffect(() => {
    if (!filteredConversations.length) return;
    if (!filteredConversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [filteredConversations, selectedConversationId]);

  if (!currentUser || userProfile?.onboardingStatus !== 'complete') return null;

  const selectedName = selectedConversation ? getOtherParticipantName(selectedConversation) : 'Select a chat';
  const selectedPhoto = selectedConversation ? getOtherParticipantPhoto(selectedConversation) : '';
  const selectedInitial = selectedName[0]?.toUpperCase() || 'U';
  const visibleMessages = currentUser ? messages.filter((message) => !message.deletedFor?.includes(currentUser.uid)) : [];
  const filterItems: Array<{ label: string; value: ConversationFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Swap', value: 'swap' },
    { label: 'Donate', value: 'donate' },
    { label: 'Sell', value: 'sell' }
  ];

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = newMessage.trim();
    if (!text || !selectedConversation || !currentUser || sending || isBlockedByMe) return;

    setSending(true);
    setError('');
    try {
      await sendChatMessage({
        conversationId: selectedConversation.id,
        conversation: selectedConversation,
        senderId: currentUser.uid,
        senderName: userProfile.displayName || currentUser.displayName || 'User',
        payload: { text, type: 'text' },
        lastMessage: text
      });
      setNewMessage('');
    } catch (err) {
      console.error('Floating chat send failed:', err);
      setError('Message failed to send.');
    } finally {
      setSending(false);
    }
  };

  const deleteConversation = async () => {
    if (!selectedConversation || !currentUser || deleting) return;
    if (!confirm('Delete this chat from your inbox only?')) return;
    setDeleting(true);
    setThreadMenuOpen(false);
    setError('');
    try {
      await hideConversationForUser({ conversationId: selectedConversation.id, conversation: selectedConversation, userId: currentUser.uid });
      const messageSnap = await getDocs(query(collection(db, 'messages'), where('conversationId', '==', selectedConversation.id)));
      await Promise.all(messageSnap.docs.map((item) => updateDoc(doc(db, 'messages', item.id), { deletedFor: Array.from(new Set([...(item.data() as any).deletedFor || [], currentUser.uid])) })));
      await markConversationNotificationsRead(selectedConversation.id, currentUser.uid);
      setSelectedConversationId(filteredConversations.find((item) => item.id !== selectedConversation.id)?.id || '');
      setError('Chat deleted.');
    } catch (err) {
      console.error('Floating chat delete failed:', err);
      setError('Could not delete this chat.');
    } finally {
      setDeleting(false);
    }
  };

  const blockUser = async () => {
    if (!currentUser || !otherParticipantId || !selectedConversation || blocking) return;
    if (!confirm(`Block ${getOtherParticipantName(selectedConversation)}? They will not be able to start new chats or message you.`)) return;
    setBlocking(true);
    setThreadMenuOpen(false);
    setError('');
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { blockedUsers: arrayUnion(otherParticipantId), lastSeen: Date.now() }, { merge: true });
      await refreshProfile();
      setError(UNAVAILABLE_MESSAGE);
    } catch (err) {
      console.error('Floating chat block failed:', err);
      setError('Could not block this user.');
    } finally {
      setBlocking(false);
    }
  };

  const reportUser = async () => {
    if (!currentUser || !selectedConversation || !otherParticipantId || !reportReason) return;
    try {
      await addDoc(collection(db, 'reports'), { reporterId: currentUser.uid, reporterName: userProfile?.displayName || 'User', targetType: 'user', targetId: otherParticipantId, targetName: getOtherParticipantName(selectedConversation), reason: reportReason, details: reportDetails, createdAt: Date.now(), resolved: false });
      setShowReport(false);
      setReportReason('');
      setReportDetails('');
      setError('Report submitted.');
    } catch (err) {
      console.error('Floating chat report failed:', err);
      setError('Could not submit report.');
    }
  };

  const copyMessage = async (message: Message) => {
    if (message.deleted || !message.text || message.text === 'Image') return;
    try {
      await navigator.clipboard.writeText(message.text);
      setMessageMenuId(null);
      setError('Message copied.');
    } catch {
      setError('Could not copy message.');
    }
  };

  const deleteMessageForMe = async (message: Message) => {
    try {
      await updateDoc(doc(db, 'messages', message.id), { deletedFor: Array.from(new Set([...(message as any).deletedFor || [], currentUser.uid])) });
      setMessageMenuId(null);
    } catch {
      setError('Could not delete message for you.');
    }
  };

  const deleteMessageForEveryone = async (message: Message) => {
    if (message.senderId !== currentUser.uid || message.deleted || Date.now() - Number(message.createdAt || 0) > DELETE_EVERYONE_WINDOW_MS) return;
    if (!confirm('Delete this message for everyone? This cannot be undone.')) return;
    try {
      await updateDoc(doc(db, 'messages', message.id), { deleted: true, deletedAt: Date.now(), deletedBy: currentUser.uid, text: 'This message was deleted', type: 'text', imageUrl: '', imageData: '', imageName: '', imageSize: 0, storagePath: '', mapUrl: '', lat: null, lng: null });
      setMessageMenuId(null);
    } catch {
      setError('Could not delete message for everyone.');
    }
  };

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-[70] hidden h-14 w-14 items-center justify-center rounded-full bg-stone-950 text-white shadow-[0_14px_35px_rgba(28,25,23,0.28)] transition hover:-translate-y-0.5 hover:bg-stone-800 md:flex" aria-label="Open messages">
          <i className="las la-comments text-3xl leading-none" />
          {messageUnreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold leading-none text-white ring-2 ring-white" style={{ backgroundColor: CHAT_GREEN }}>{messageUnreadCount > 9 ? '9+' : messageUnreadCount}</span>}
        </button>
      )}

      {open && (
        <section className="fixed bottom-0 right-6 z-[70] hidden h-[560px] w-[780px] overflow-hidden rounded-t-2xl border border-b-0 border-stone-200 bg-white shadow-[0_22px_70px_rgba(28,25,23,0.22)] md:flex" aria-label="Messages dock">
          <aside className="flex w-[310px] shrink-0 flex-col border-r border-stone-200 bg-white">
            <header className="flex h-14 items-center justify-between border-b border-stone-200 bg-white px-4"><div className="font-extrabold text-stone-950">Chats</div><button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-950" aria-label="Collapse messages"><i className="las la-minus text-xl" /></button></header>
            <div className="px-4 py-3"><div className="flex items-center justify-between text-sm font-bold text-stone-700"><span>Threads</span><span>{filteredConversations.length}</span></div><div className="mt-3 flex flex-wrap gap-2">{filterItems.map((item) => { const active = filter === item.value; return <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-full border px-3 py-1 text-xs font-bold transition ${active ? 'text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`} style={active ? { backgroundColor: CHAT_GREEN, borderColor: CHAT_GREEN } : undefined}>{item.label}</button>; })}</div></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{filteredConversations.length === 0 ? <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-stone-500"><i className="las la-comment-slash text-4xl text-stone-300" /><p className="mt-2 font-semibold">No chats found.</p></div> : filteredConversations.map((conversation) => { const active = conversation.id === selectedConversationId; const photo = getOtherParticipantPhoto(conversation); const name = getOtherParticipantName(conversation); const unread = getUnreadCount(conversation); return <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-stone-50 shadow-sm' : 'hover:bg-stone-50'}`}>{photo ? <img src={photo} alt={name} className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: CHAT_GREEN }}>{name[0]?.toUpperCase() || 'U'}</div>}<div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-extrabold text-stone-900">{name}</span><span className="shrink-0 text-[11px] font-semibold text-stone-400">{formatDate(conversation.lastMessageAt)}</span></div><p className={`mt-0.5 truncate text-xs ${unread ? 'font-bold text-stone-900' : 'text-stone-500'}`}>{conversation.lastMessage || 'No messages yet'}</p></div>{unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold text-white" style={{ backgroundColor: CHAT_GREEN }}>{unread > 9 ? '9+' : unread}</span>}</button>; })}</div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col bg-white">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 px-4"><div className="flex min-w-0 items-center gap-3">{selectedConversation && (selectedPhoto ? <img src={selectedPhoto} alt={selectedName} className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: CHAT_GREEN }}>{selectedInitial}</div>)}<div className="min-w-0"><p className="truncate text-sm font-extrabold text-stone-950">{selectedName}</p>{selectedConversation?.listingTitle && <p className="truncate text-xs text-stone-500">{selectedConversation.listingTitle}</p>}</div></div><div className="relative flex shrink-0 items-center gap-1"><button type="button" onClick={(event) => { event.stopPropagation(); setThreadMenuOpen((current) => !current); setMessageMenuId(null); }} className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-950" aria-label="Conversation actions"><i className="las la-ellipsis-v text-xl" /></button>{threadMenuOpen && selectedConversation && <div onClick={(event) => event.stopPropagation()} className="absolute right-9 top-9 z-50 w-52 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm shadow-2xl"><button type="button" onClick={deleteConversation} disabled={deleting} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"><i className="las la-trash text-xl" />{deleting ? 'Deleting...' : 'Delete chat'}</button><button type="button" onClick={() => { setThreadMenuOpen(false); setShowReport(true); }} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left font-semibold text-stone-700 hover:bg-stone-50"><i className="las la-flag text-xl" />Report</button><button type="button" onClick={blockUser} disabled={blocking || isBlockedByMe} className="flex w-full cursor-pointer items-center gap-3 border-t border-stone-100 px-4 py-3 text-left font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><i className="las la-ban text-xl" />{isBlockedByMe ? 'Blocked' : blocking ? 'Blocking...' : 'Block'}</button></div>}<button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-950" aria-label="Close messages"><i className="las la-times text-xl" /></button></div></header>
            {isBlockedByMe && <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">{UNAVAILABLE_MESSAGE}</div>}
            {error && <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">{!selectedConversation ? <div className="flex h-full flex-col items-center justify-center text-center text-sm text-stone-500"><i className="las la-comments text-5xl text-stone-300" /><p className="mt-3 font-semibold">Pick a thread to start chatting.</p></div> : visibleMessages.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-center text-sm text-stone-500"><div className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ backgroundColor: CHAT_GREEN }}><i className="las la-comment text-3xl" /></div><p className="mt-3 font-semibold">No messages yet.</p></div> : visibleMessages.map((message) => { const mine = message.senderId === currentUser.uid; const imageSource = message.imageUrl || message.imageData || ''; const canDeleteEveryone = mine && !message.deleted && Date.now() - Number(message.createdAt || 0) <= DELETE_EVERYONE_WINDOW_MS; return <div key={message.id} className={`group mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}><div onContextMenu={(event) => { event.preventDefault(); setMessageMenuId(message.id); }} className={`relative max-w-[74%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${mine ? 'rounded-br-md text-white' : 'rounded-bl-md bg-stone-100 text-stone-900'}`} style={mine ? { backgroundColor: CHAT_GREEN } : undefined}>{message.deleted ? <p className="italic opacity-75">This message was deleted</p> : <>{message.type === 'image' && imageSource && <img src={imageSource} alt={message.imageName || 'Sent image'} className="mb-2 max-h-56 rounded-xl object-contain" />}{message.type !== 'image' || message.text !== 'Image' ? <p className="whitespace-pre-wrap leading-6">{message.text}</p> : null}</>}<button type="button" onClick={(event) => { event.stopPropagation(); setMessageMenuId(messageMenuId === message.id ? null : message.id); setThreadMenuOpen(false); }} className={`absolute top-1 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50 md:flex ${mine ? '-left-9' : '-right-9'} opacity-0 group-hover:opacity-100`} aria-label="Message actions"><i className="las la-angle-down text-base" /></button>{messageMenuId === message.id && <div onClick={(event) => event.stopPropagation()} className={`absolute top-8 z-50 w-48 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm text-stone-700 shadow-2xl ${mine ? 'right-full mr-2' : 'left-full ml-2'}`}><button type="button" onClick={() => copyMessage(message)} disabled={message.deleted || !message.text || message.text === 'Image'} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"><i className="las la-copy text-xl" />Copy</button><button type="button" onClick={() => deleteMessageForMe(message)} className="flex w-full cursor-pointer items-center gap-3 border-t border-stone-100 px-4 py-3 text-left text-red-600 hover:bg-red-50"><i className="las la-trash text-xl" />Delete for me</button>{canDeleteEveryone && <button type="button" onClick={() => deleteMessageForEveryone(message)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-red-700 hover:bg-red-50"><i className="las la-trash-alt text-xl" />Delete for everyone</button>}</div>}<div className={`mt-1 text-right text-[11px] ${mine ? 'text-white/80' : 'text-stone-500'}`}>{formatTime(message.createdAt)}</div></div></div>; })}<div ref={messagesEndRef} /></div>
            <form onSubmit={handleSend} className="shrink-0 border-t border-stone-200 bg-white px-4 py-3"><div className="flex items-center gap-2 rounded-2xl bg-stone-100 px-3 py-2"><input type="text" value={newMessage} onChange={(event) => setNewMessage(event.target.value)} disabled={!selectedConversation || sending || isBlockedByMe} placeholder={isBlockedByMe ? 'Messaging disabled' : selectedConversation ? 'Message' : 'Select a chat first'} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-stone-400 disabled:cursor-not-allowed" /><button type="submit" disabled={!newMessage.trim() || !selectedConversation || sending || isBlockedByMe} className="flex h-9 w-9 items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundColor: CHAT_GREEN }} aria-label="Send message"><i className="las la-paper-plane text-xl" /></button></div></form>
          </div>
        </section>
      )}
      {showReport && selectedConversation && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-bold text-stone-800">Report user</h3><p className="mt-1 text-sm text-stone-500">Tell us what is wrong with this user.</p><div className="mt-4 space-y-3"><select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none"><option value="">Select a reason...</option><option value="spam">Spam</option><option value="fraud">Suspected fraud</option><option value="abuse">Abusive message</option><option value="other">Other</option></select><textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Additional details..." rows={3} className="w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none" /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setShowReport(false)} className="cursor-pointer rounded-full border border-stone-200 py-2.5 text-sm font-bold">Cancel</button><button type="button" onClick={reportUser} disabled={!reportReason} className="cursor-pointer rounded-full bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">Submit report</button></div></div></div></div>}
    </>
  );
};

export default FloatingMessagesButton;
