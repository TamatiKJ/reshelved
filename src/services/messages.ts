import { addDoc, arrayRemove, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Listing } from '../types';

const getConversationKey = (a: string, b: string) => [a, b].sort().join('_');

export const findOrCreateListingConversation = async ({
  buyerId,
  buyerName,
  buyerPhoto,
  listing,
  sellerPhoto,
  listingImage
}: {
  buyerId: string;
  buyerName: string;
  buyerPhoto: string;
  listing: Listing;
  sellerPhoto: string;
  listingImage: string;
}): Promise<string> => {
  const conversationKey = `${getConversationKey(buyerId, listing.userId)}_${listing.id}`;
  const listingPrice = typeof listing.price === 'number' ? listing.price : null;
  const conversationsQuery = query(collection(db, 'conversations'), where('participants', 'array-contains', buyerId));
  const conversationsSnap = await getDocs(conversationsQuery);
  let existingConversationId: string | null = null;

  conversationsSnap.forEach((conversationDoc) => {
    const data = conversationDoc.data();
    if (Array.isArray(data.participants) && data.participants.includes(listing.userId) && data.listingId === listing.id) {
      existingConversationId = conversationDoc.id;
    }
  });

  if (existingConversationId) {
    await updateDoc(doc(db, 'conversations', existingConversationId), {
      conversationKey,
      listingId: listing.id,
      listingTitle: listing.title,
      listingImage,
      listingPrice,
      listingType: listing.type,
      hiddenFor: arrayRemove(buyerId),
      updatedAt: Date.now()
    });
    return existingConversationId;
  }

  const now = Date.now();
  const sellerName = listing.userName || 'Seller';
  const initialMessage = `Hi! I'm interested in \"${listing.title}\"`;

  const conversationRef = await addDoc(collection(db, 'conversations'), {
    participants: [buyerId, listing.userId],
    conversationKey,
    buyerId,
    sellerId: listing.userId,
    participantNames: { [buyerId]: buyerName, [listing.userId]: sellerName },
    participantPhotos: { [buyerId]: buyerPhoto, [listing.userId]: sellerPhoto || listing.userPhoto || '' },
    listingId: listing.id,
    listingTitle: listing.title,
    listingImage,
    listingPrice,
    listingType: listing.type,
    lastMessage: initialMessage,
    lastMessageAt: now,
    updatedAt: now,
    createdAt: now
  });

  await addDoc(collection(db, 'messages'), {
    conversationId: conversationRef.id,
    senderId: buyerId,
    senderName: buyerName,
    recipientId: listing.userId,
    text: initialMessage,
    type: 'text',
    readBy: [buyerId],
    createdAt: now
  });

  await addDoc(collection(db, 'notifications'), {
    userId: listing.userId,
    fromUserId: buyerId,
    fromUserName: buyerName,
    fromAdmin: false,
    type: 'message',
    subject: `New message from ${buyerName}`,
    message: initialMessage,
    conversationId: conversationRef.id,
    listingId: listing.id,
    createdAt: now,
    read: false
  });

  await addDoc(collection(db, 'contacts'), {
    userId: buyerId,
    listingId: listing.id,
    listingTitle: listing.title,
    sellerId: listing.userId,
    sellerName,
    contactedAt: now,
    reviewPromptShown: false,
    reviewed: false
  });

  return conversationRef.id;
};
