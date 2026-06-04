import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { markConversationMessagesRead, markConversationNotificationsRead, sendChatMessage } from '../services/messagesService';
import type { Conversation, Message } from '../types';

const formatTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const formatDate = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

const FloatingMessagesButton: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const { messageUnreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const getOtherParticipantId = (conversation: Conversation) => currentUser ? conversation.participants.find((id) => id !== currentUser.uid) || '' : '';
  const getOtherParticipantName = (conversation: Conversation) => conversation.participantNames?.[getOtherParticipantId(conversation)] || 'User';
  const getOtherParticipantPhoto = (conversation: Conversation) => conversation.participantPhotos?.[getOtherParticipantId(conversation)] || '';
  const getUnreadCount = (conversation: Conversation) => currentUser ? Number(conversation.unreadCount?.[currentUser.uid] || 0) : 0;

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

  if (!currentUser || userProfile?.onboardingStatus !== 'complete') return null;

  const selectedName = selectedConversation ? getOtherParticipantName(selectedConversation) : 'Select a chat';
  const selectedPhoto = selectedConversation ? getOtherParticipantPhoto(selectedConversation) : '';
  const selectedInitial = selectedName[0]?.toUpperCase() || 'U';
  const visibleMessages = currentUser ? messages.filter((message) => !message.deletedFor?.includes(currentUser.uid)) : [];

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = newMessage.trim();
    if (!text || !selectedConversation || !currentUser || sending) return;

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

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[70] hidden h-14 w-14 items-center justify-center rounded-full bg-stone-950 text-white shadow-[0_14px_35px_rgba(28,25,23,0.28)] transition hover:-translate-y-0.5 hover:bg-stone-800 md:flex"
          aria-label="Open messages"
        >
          <i className="las la-comments text-3xl leading-none" />
          {messageUnreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-extrabold leading-none text-white ring-2 ring-white">
              {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <section className="fixed bottom-6 right-6 z-[70] hidden h-[560px] w-[780px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_22px_70px_rgba(28,25,23,0.22)] md:flex" aria-label="Messages dock">
          <aside className="flex w-[310px] shrink-0 flex-col border-r border-stone-200 bg-[#F8FAFC]">
            <header className="flex h-14 items-center justify-between border-b border-stone-200 bg-white px-4">
              <div className="flex items-center gap-2 font-extrabold text-stone-950">
                <i className="lab la-reddit-alien text-2xl text-primary-600" />
                Chats
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-950" aria-label="Collapse messages">
                <i className="las la-minus text-xl" />
              </button>
            </header>

            <div className="flex items-center justify-between px-4 py-3 text-sm font-bold text-stone-700">
              <span className="flex items-center gap-2"><i className="las la-arrow-left text-xl" /> Threads</span>
              <span>{conversations.length}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {conversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-stone-500">
                  <i className="las la-comment-slash text-4xl text-stone-300" />
                  <p className="mt-2 font-semibold">No chats yet.</p>
                </div>
              ) : conversations.map((conversation) => {
                const active = conversation.id === selectedConversationId;
                const photo = getOtherParticipantPhoto(conversation);
                const name = getOtherParticipantName(conversation);
                const unread = getUnreadCount(conversation);

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-white shadow-sm' : 'hover:bg-white/70'}`}
                  >
                    {photo ? <img src={photo} alt={name} className="h-10 w-10 rounded-full object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">{name[0]?.toUpperCase() || 'U'}</div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-extrabold text-stone-900">{name}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-stone-400">{formatDate(conversation.lastMessageAt)}</span>
                      </div>
                      <p className={`mt-0.5 truncate text-xs ${unread ? 'font-bold text-stone-900' : 'text-stone-500'}`}>{conversation.lastMessage || 'No messages yet'}</p>
                    </div>
                    {unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-extrabold text-white">{unread > 9 ? '9+' : unread}</span>}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col bg-white">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 px-4">
              <div className="flex min-w-0 items-center gap-3">
                {selectedConversation && (selectedPhoto ? <img src={selectedPhoto} alt={selectedName} className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">{selectedInitial}</div>)}
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-stone-950">{selectedName}</p>
                  {selectedConversation?.listingTitle && <p className="truncate text-xs text-stone-500">{selectedConversation.listingTitle}</p>}
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-950" aria-label="Close messages">
                <i className="las la-times text-xl" />
              </button>
            </header>

            {error && <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              {!selectedConversation ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-stone-500">
                  <i className="las la-comments text-5xl text-stone-300" />
                  <p className="mt-3 font-semibold">Pick a thread to start chatting.</p>
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-stone-500">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600"><i className="las la-comment text-3xl" /></div>
                  <p className="mt-3 font-semibold">No messages yet.</p>
                </div>
              ) : visibleMessages.map((message) => {
                const mine = message.senderId === currentUser.uid;
                const imageSource = message.imageUrl || message.imageData || '';

                return (
                  <div key={message.id} className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[74%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${mine ? 'rounded-br-md bg-primary-600 text-white' : 'rounded-bl-md bg-stone-100 text-stone-900'}`}>
                      {message.deleted ? <p className="italic opacity-75">This message was deleted</p> : <>
                        {message.type === 'image' && imageSource && <img src={imageSource} alt={message.imageName || 'Sent image'} className="mb-2 max-h-56 rounded-xl object-contain" />}
                        {message.type !== 'image' || message.text !== 'Image' ? <p className="whitespace-pre-wrap leading-6">{message.text}</p> : null}
                      </>}
                      <div className={`mt-1 text-right text-[11px] ${mine ? 'text-white/70' : 'text-stone-500'}`}>{formatTime(message.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="shrink-0 border-t border-stone-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 rounded-2xl bg-stone-100 px-3 py-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  disabled={!selectedConversation || sending}
                  placeholder={selectedConversation ? 'Message' : 'Select a chat first'}
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-stone-400 disabled:cursor-not-allowed"
                />
                <button type="submit" disabled={!newMessage.trim() || !selectedConversation || sending} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message">
                  <i className="las la-paper-plane text-xl" />
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </>
  );
};

export default FloatingMessagesButton;
