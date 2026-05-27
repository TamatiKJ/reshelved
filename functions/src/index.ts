import { setGlobalOptions } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as functionsV1 from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

// The web application uses the named Firestore database `reshelved`.
// Server-side writes and deletion must use the same database.
const db = getFirestore("reshelved");
const bucket = admin.storage().bucket();

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_LISTING_DAYS = 45;
const DELETE_BATCH_SIZE = 350;

type RateLimitConfig = {
  key: "createListing" | "createReport" | "sendMessage";
  max: number;
  windowMs: number;
};

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

async function requireActiveUser(request: { auth?: { uid?: string; token?: admin.auth.DecodedIdToken } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be logged in.");

  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.data() || {};
  if (user.banned === true || user.disabled === true || user.deactivated === true) {
    throw new HttpsError("permission-denied", "This account is restricted.");
  }
  return { uid, user };
}

async function assertRateLimit(uid: string, config: RateLimitConfig): Promise<void> {
  const now = Date.now();
  const bucketValue = Math.floor(now / config.windowMs);
  const counterRef = db.doc(`rateLimits/${uid}/counters/${config.key}_${bucketValue}`);

  await db.runTransaction(async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const currentCount = counterSnap.exists ? Number(counterSnap.data()?.count || 0) : 0;
    if (currentCount >= config.max) {
      throw new HttpsError("resource-exhausted", "You are doing this too often. Please try again later.");
    }
    transaction.set(counterRef, {
      uid,
      key: config.key,
      bucket: bucketValue,
      count: currentCount + 1,
      windowMs: config.windowMs,
      updatedAt: now,
      expiresAt: now + config.windowMs * 2,
    }, { merge: true });
  });
}

function assertValidListingType(type: string) {
  if (!["swap", "donate", "sell"].includes(type)) {
    throw new HttpsError("invalid-argument", "Invalid listing type.");
  }
}

function getSafeImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((image): image is string => typeof image === "string" && image.trim().length > 0).slice(0, 4);
}

async function deleteQueryDocuments(queryRef: FirebaseFirestore.Query): Promise<number> {
  let deleted = 0;
  while (true) {
    const snap = await queryRef.limit(DELETE_BATCH_SIZE).get();
    if (snap.empty) return deleted;
    const batch = db.batch();
    snap.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
    deleted += snap.size;
  }
}

async function deleteStoragePrefix(prefix: string): Promise<void> {
  await bucket.deleteFiles({ prefix, force: true }).catch((err) => {
    logger.warn("Storage prefix cleanup failed", { prefix, error: String(err) });
  });
}

async function deleteMessageMediaForConversation(conversationId: string): Promise<void> {
  const messageSnap = await db.collection("messages").where("conversationId", "==", conversationId).get();
  await Promise.all(messageSnap.docs.map(async (item) => {
    const storagePath = cleanString(item.data().storagePath, 500);
    if (storagePath) await bucket.file(storagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
  }));
  await deleteQueryDocuments(db.collection("messages").where("conversationId", "==", conversationId));
}

async function deleteConversationPermanently(conversationId: string): Promise<void> {
  await deleteMessageMediaForConversation(conversationId);
  await deleteQueryDocuments(db.collection("notifications").where("conversationId", "==", conversationId));
  await db.doc(`conversations/${conversationId}`).delete().catch(() => undefined);
}

async function removeBookmarkReferences(listingId: string): Promise<void> {
  const usersSnap = await db.collection("users").where("bookmarks", "array-contains", listingId).get();
  await Promise.all(usersSnap.docs.map((item) => item.ref.update({ bookmarks: admin.firestore.FieldValue.arrayRemove(listingId) })));
}

async function deleteListingData(listingId: string, ownerId: string): Promise<void> {
  const conversations = await db.collection("conversations").where("listingId", "==", listingId).get();
  await Promise.all(conversations.docs.map((item) => deleteConversationPermanently(item.id)));
  await Promise.all([
    deleteStoragePrefix(`listings/${ownerId}/${listingId}_`),
    deleteQueryDocuments(db.collection("reports").where("listingId", "==", listingId)),
    deleteQueryDocuments(db.collection("ratings").where("listingId", "==", listingId)),
    removeBookmarkReferences(listingId),
  ]);
  await db.doc(`listings/${listingId}`).delete().catch(() => undefined);
}

export const createListing = onCall(
  { enforceAppCheck: true, maxInstances: 10 },
  async (request) => {
    const { uid, user } = await requireActiveUser(request);
    await assertRateLimit(uid, { key: "createListing", max: 5, windowMs: DAY_MS });

    const data = request.data || {};
    const now = Date.now();
    const listingDays = Math.min(Math.max(Math.floor(cleanNumber(data.listingDays, 10)), 1), MAX_LISTING_DAYS);
    const title = cleanString(data.title, 140);
    const author = cleanString(data.author, 140);
    const description = cleanString(data.description, 3000);
    const condition = cleanString(data.condition, 80);
    const category = cleanString(data.category, 80);
    const location = cleanString(data.location, 120);
    const type = cleanString(data.type, 20);

    if (!title || !author || !description || !condition || !category || !location) {
      throw new HttpsError("invalid-argument", "Missing required listing fields.");
    }
    assertValidListingType(type);
    const price = type === "sell" ? cleanNumber(data.price, 0) : 0;
    if (type === "sell" && price <= 0) throw new HttpsError("invalid-argument", "Selling listings require a valid price.");

    const listingRef = await db.collection("listings").add({
      title, author, description, condition, category, type, price,
      images: getSafeImages(data.images), userId: uid,
      userName: user.displayName || request.auth?.token?.name || "Reshelved User",
      userPhoto: user.photoURL || request.auth?.token?.picture || "",
      location, createdAt: now, expiresAt: now + listingDays * DAY_MS, listingDays,
      active: true, flagged: false, flagCount: 0,
    });
    logger.info("Listing created through rate-limited function", { uid, listingId: listingRef.id });
    return { listingId: listingRef.id };
  }
);

export const createReport = onCall(
  { enforceAppCheck: true, maxInstances: 10 },
  async (request) => {
    const { uid } = await requireActiveUser(request);
    await assertRateLimit(uid, { key: "createReport", max: 10, windowMs: DAY_MS });
    const data = request.data || {};
    const reason = cleanString(data.reason, 1000);
    const listingId = cleanString(data.listingId, 120);
    const reportedUserId = cleanString(data.reportedUserId, 120);
    const reportType = cleanString(data.type, 40) || "listing";
    if (!reason) throw new HttpsError("invalid-argument", "Report reason is required.");
    if (!listingId && !reportedUserId) throw new HttpsError("invalid-argument", "A report target is required.");
    if (reportedUserId && reportedUserId === uid) throw new HttpsError("invalid-argument", "You cannot report yourself.");
    if (listingId) {
      const listingSnap = await db.doc(`listings/${listingId}`).get();
      if (!listingSnap.exists) throw new HttpsError("not-found", "Listing not found.");
    }
    const reportId = listingId ? `listing_${listingId}_${uid}` : `user_${reportedUserId}_${uid}`;
    const reportRef = db.doc(`reports/${reportId}`);
    if ((await reportRef.get()).exists) throw new HttpsError("already-exists", "You have already reported this item.");
    await reportRef.set({ reporterId: uid, listingId, reportedUserId, type: reportType, reason, status: "pending", createdAt: Date.now() });
    logger.info("Report created through rate-limited function", { uid, reportId });
    return { reportId };
  }
);

export const sendMessage = onCall(
  { enforceAppCheck: true, maxInstances: 20 },
  async (request) => {
    const { uid, user } = await requireActiveUser(request);
    await assertRateLimit(uid, { key: "sendMessage", max: 10, windowMs: MINUTE_MS });
    const data = request.data || {};
    const conversationId = cleanString(data.conversationId, 120);
    const text = cleanString(data.text, 2000);
    if (!conversationId || !text) throw new HttpsError("invalid-argument", "Conversation and message are required.");

    const conversationRef = db.doc(`conversations/${conversationId}`);
    const conversationSnap = await conversationRef.get();
    if (!conversationSnap.exists) throw new HttpsError("not-found", "Conversation not found.");
    const participants = Array.isArray(conversationSnap.data()?.participants) ? conversationSnap.data()?.participants : [];
    if (participants.length !== 2 || !participants.includes(uid)) throw new HttpsError("permission-denied", "You are not part of this conversation.");
    if (participants[0] === participants[1]) throw new HttpsError("invalid-argument", "You cannot message yourself.");
    const recipientId = participants.find((participantId: string) => participantId !== uid);
    if (!recipientId) throw new HttpsError("invalid-argument", "Message recipient was not found.");
    const recipient = (await db.doc(`users/${recipientId}`).get()).data() || {};
    if (recipient.banned === true || recipient.disabled === true || recipient.deactivated === true) throw new HttpsError("permission-denied", "This user cannot receive messages.");

    const now = Date.now();
    const senderName = user.displayName || request.auth?.token?.name || "User";
    const messageRef = await db.collection("messages").add({ conversationId, senderId: uid, senderName, recipientId, text, type: "text", readBy: [uid], createdAt: now });
    await conversationRef.update({ lastMessage: text, lastMessageAt: now, updatedAt: now });
    await db.collection("notifications").add({ userId: recipientId, fromUserId: uid, fromUserName: senderName, fromAdmin: false, type: "message", subject: `New message from ${senderName}`, message: text, conversationId, createdAt: now, read: false });
    logger.info("Message sent through rate-limited function", { uid, messageId: messageRef.id });
    return { messageId: messageRef.id };
  }
);

export const deleteListingPermanently = onCall(
  { maxInstances: 10 },
  async (request) => {
    const { uid, user } = await requireActiveUser(request);
    const listingId = cleanString(request.data?.listingId, 120);
    if (!listingId) throw new HttpsError("invalid-argument", "Listing ID is required.");
    const listingSnap = await db.doc(`listings/${listingId}`).get();
    if (!listingSnap.exists) return { deleted: true };
    const ownerId = cleanString(listingSnap.data()?.userId, 128);
    const isAdmin = user.isAdmin === true || request.auth?.token?.admin === true;
    if (uid !== ownerId && !isAdmin) throw new HttpsError("permission-denied", "You cannot delete this listing.");
    await deleteListingData(listingId, ownerId);
    logger.info("Listing permanently deleted", { uid, listingId });
    return { deleted: true };
  }
);

export const purgeDeletedUserData = functionsV1.auth.user().onDelete(async (deletedUser) => {
  const uid = deletedUser.uid;
  const listingSnap = await db.collection("listings").where("userId", "==", uid).get();
  const conversationSnap = await db.collection("conversations").where("participants", "array-contains", uid).get();

  await Promise.all(conversationSnap.docs.map((item) => deleteConversationPermanently(item.id)));
  await Promise.all(listingSnap.docs.map((item) => deleteListingData(item.id, uid)));

  const sentMedia = await db.collection("messages").where("senderId", "==", uid).get();
  await Promise.all(sentMedia.docs.map(async (item) => {
    const path = cleanString(item.data().storagePath, 500);
    if (path) await bucket.file(path).delete({ ignoreNotFound: true }).catch(() => undefined);
  }));

  await Promise.all([
    deleteStoragePrefix(`users/${uid}/`),
    deleteStoragePrefix(`listings/${uid}/`),
    deleteQueryDocuments(db.collection("messages").where("senderId", "==", uid)),
    deleteQueryDocuments(db.collection("messages").where("recipientId", "==", uid)),
    deleteQueryDocuments(db.collection("notifications").where("userId", "==", uid)),
    deleteQueryDocuments(db.collection("notifications").where("fromUserId", "==", uid)),
    deleteQueryDocuments(db.collection("ratings").where("fromUserId", "==", uid)),
    deleteQueryDocuments(db.collection("ratings").where("toUserId", "==", uid)),
    deleteQueryDocuments(db.collection("reports").where("reporterId", "==", uid)),
    deleteQueryDocuments(db.collection("reports").where("reportedUserId", "==", uid)),
    deleteQueryDocuments(db.collection("reports").where("targetId", "==", uid)),
    db.recursiveDelete(db.doc(`rateLimits/${uid}`)).catch(() => undefined),
    db.doc(`publicProfiles/${uid}`).delete().catch(() => undefined),
    db.doc(`users/${uid}`).delete().catch(() => undefined),
  ]);

  logger.info("Deleted user data purged permanently", { uid });
});
