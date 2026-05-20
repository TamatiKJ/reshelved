import { collection, doc, getDocs, query, updateDoc, where, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase';
import type { Conversation, Message } from '../types';

export type ChatMessagePayload = Record<string, unknown> & {
  text: string;
  type: 'text' | 'map' | 'image';
};

export const getConversationKey = (a: string, b: string) => [a, b].sort().join('_');

export const getConversationRecipientIds = (conversation: Conversation, senderId: string) => {
  return conversation.participants.filter((id) => id !== senderId);
};

export const createMessageDocumentId = () => doc(collection(db, 'messages')).id;

export const sendChatMessage = async ({
  conversationId,
  conversation,
  senderId,
  senderName,
  payload,
  lastMessage,
  messageId
}: {
  conversationId: string;
  conversation: Conversation;
  senderId: string;
  senderName: string;
  payload: ChatMessagePayload;
  lastMessage: string;
  messageId?: string;
}) => {
  const now = Date.now();
  const recipientIds = getConversationRecipientIds(conversation, senderId);
  const primaryRecipientId = recipientIds[0] || '';
  const nextMessageId = messageId || createMessageDocumentId();
  const messageRef = doc(db, 'messages', nextMessageId);
  const conversationRef = doc(db, 'conversations', conversationId);
  const batch = writeBatch(db);

  batch.set(messageRef, {
    conversationId,
    senderId,
    senderName,
    recipientId: primaryRecipientId,
    readBy: [senderId],
    deliveredTo: [senderId],
    deliveredAt: { [senderId]: now },
    status: 'sent',
    messageStatus: 'sent',
    attachments: [],
    editedAt: null,
    deletedAt: null,
    deletedBy: '',
    deletedFor: [],
    createdAt: now,
    ...payload
  });

  const conversationUpdate: Record<string, unknown> = {
    lastMessage,
    lastMessageAt: now,
    lastMessageBy: senderId,
    updatedAt: now,
    hiddenFor: [],
    deletedFor: [],
    blockedUsers: (conversation as any).blockedUsers || [],
    conversationKey: (conversation as any).conversationKey || (primaryRecipientId ? getConversationKey(senderId, primaryRecipientId) : '')
  };

  recipientIds.forEach((id) => {
    conversationUpdate[`unreadCount.${id}`] = increment(1);
  });

  conversationUpdate[`unreadCount.${senderId}`] = 0;
  conversationUpdate[`lastReadAt.${senderId}`] = now;

  batch.update(conversationRef, conversationUpdate);
  await batch.commit();

  return nextMessageId;
};

export const markConversationMessagesRead = async ({
  conversationId,
  userId,
  messages
}: {
  conversationId: string;
  userId: string;
  messages: Message[];
}) => {
  const incomingToUpdate = messages.filter((message) => {
    const data = message as any;
    if (message.senderId === userId || data.deleted) return false;
    const deliveredTo = Array.isArray(data.deliveredTo) ? data.deliveredTo : [];
    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
    return !deliveredTo.includes(userId) || !readBy.includes(userId) || data.status !== 'read' || data.messageStatus !== 'read';
  });

  const now = Date.now();
  const batch = writeBatch(db);

  incomingToUpdate.forEach((message) => {
    const data = message as any;
    const deliveredTo = Array.isArray(data.deliveredTo) ? data.deliveredTo : [];
    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
    const update: Record<string, unknown> = {
      deliveredTo: Array.from(new Set([...deliveredTo, userId])),
      readBy: Array.from(new Set([...readBy, userId])),
      status: 'read',
      messageStatus: 'read'
    };

    if (!deliveredTo.includes(userId)) update[`deliveredAt.${userId}`] = now;
    batch.update(doc(db, 'messages', message.id), update);
  });

  batch.update(doc(db, 'conversations', conversationId), {
    [`unreadCount.${userId}`]: 0,
    [`lastReadAt.${userId}`]: now
  });
  await batch.commit();
};

export const hideConversationForUser = async ({
  conversationId,
  conversation,
  userId
}: {
  conversationId: string;
  conversation: Conversation;
  userId: string;
}) => {
  const deletedFor = Array.from(new Set([...(conversation as any).deletedFor || [], userId]));
  const hiddenFor = Array.from(new Set([...(conversation as any).hiddenFor || [], userId]));

  await updateDoc(doc(db, 'conversations', conversationId), {
    deletedFor,
    hiddenFor,
    [`unreadCount.${userId}`]: 0,
    [`lastReadAt.${userId}`]: Date.now()
  });
};

export const markConversationNotificationsRead = async (conversationId: string, userId: string) => {
  const notificationSnap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId), where('conversationId', '==', conversationId), where('read', '==', false)));
  await Promise.all(notificationSnap.docs.map((item) => updateDoc(doc(db, 'notifications', item.id), { read: true })));
};
