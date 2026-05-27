"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.purgeDeletedUserData = exports.cleanupDeletedListing = exports.deleteListingPermanently = exports.sendMessage = exports.createReport = exports.createListing = void 0;
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const functionsV1 = __importStar(require("firebase-functions/v1"));
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const firestore_2 = require("firebase-admin/firestore");
(0, firebase_functions_1.setGlobalOptions)({ maxInstances: 10 });
admin.initializeApp();
// The client app writes to this named Firestore database, not the default database.
const db = (0, firestore_2.getFirestore)("reshelved");
const bucket = admin.storage().bucket();
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_LISTING_DAYS = 45;
const DELETE_BATCH_SIZE = 350;
function cleanString(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
function cleanNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
async function requireActiveUser(request) {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    const user = (await db.doc(`users/${uid}`).get()).data() || {};
    if (user.banned === true || user.disabled === true || user.deactivated === true) {
        throw new https_1.HttpsError("permission-denied", "This account is restricted.");
    }
    return { uid, user };
}
async function assertRateLimit(uid, config) {
    const now = Date.now();
    const bucketValue = Math.floor(now / config.windowMs);
    const counterRef = db.doc(`rateLimits/${uid}/counters/${config.key}_${bucketValue}`);
    await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(counterRef);
        const count = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;
        if (count >= config.max)
            throw new https_1.HttpsError("resource-exhausted", "You are doing this too often. Please try again later.");
        transaction.set(counterRef, {
            uid,
            key: config.key,
            bucket: bucketValue,
            count: count + 1,
            windowMs: config.windowMs,
            updatedAt: now,
            expiresAt: now + config.windowMs * 2,
        }, { merge: true });
    });
}
function getSafeImages(value) {
    return Array.isArray(value)
        ? value.filter((image) => typeof image === "string" && image.trim().length > 0).slice(0, 4)
        : [];
}
async function deleteQueryDocuments(queryRef) {
    let deleted = 0;
    while (true) {
        const snapshot = await queryRef.limit(DELETE_BATCH_SIZE).get();
        if (snapshot.empty)
            return deleted;
        const batch = db.batch();
        snapshot.docs.forEach((item) => batch.delete(item.ref));
        await batch.commit();
        deleted += snapshot.size;
    }
}
async function deleteStoragePrefix(prefix) {
    await bucket.deleteFiles({ prefix, force: true }).catch((error) => logger.warn("Storage cleanup failed", { prefix, error: String(error) }));
}
async function deleteConversationPermanently(conversationId) {
    const messages = await db.collection("messages").where("conversationId", "==", conversationId).get();
    await Promise.all(messages.docs.map(async (message) => {
        const path = cleanString(message.data().storagePath, 500);
        if (path)
            await bucket.file(path).delete({ ignoreNotFound: true }).catch(() => undefined);
    }));
    await Promise.all([
        deleteQueryDocuments(db.collection("messages").where("conversationId", "==", conversationId)),
        deleteQueryDocuments(db.collection("notifications").where("conversationId", "==", conversationId)),
    ]);
    await db.doc(`conversations/${conversationId}`).delete().catch(() => undefined);
}
async function removeBookmarkReferences(listingId) {
    const users = await db.collection("users").where("bookmarks", "array-contains", listingId).get();
    await Promise.all(users.docs.map((user) => user.ref.update({ bookmarks: admin.firestore.FieldValue.arrayRemove(listingId) })));
}
async function cleanupListingAssociations(listingId, ownerId) {
    const conversations = await db.collection("conversations").where("listingId", "==", listingId).get();
    await Promise.all(conversations.docs.map((conversation) => deleteConversationPermanently(conversation.id)));
    await Promise.all([
        ownerId ? deleteStoragePrefix(`listings/${ownerId}/${listingId}_`) : Promise.resolve(),
        deleteQueryDocuments(db.collection("reports").where("listingId", "==", listingId)),
        deleteQueryDocuments(db.collection("ratings").where("listingId", "==", listingId)),
        removeBookmarkReferences(listingId),
    ]);
}
async function deleteListingData(listingId, ownerId) {
    await cleanupListingAssociations(listingId, ownerId);
    await db.doc(`listings/${listingId}`).delete().catch(() => undefined);
}
exports.createListing = (0, https_1.onCall)({ enforceAppCheck: true, maxInstances: 10 }, async (request) => {
    const { uid, user } = await requireActiveUser(request);
    await assertRateLimit(uid, { key: "createListing", max: 5, windowMs: DAY_MS });
    const data = request.data || {};
    const title = cleanString(data.title, 140);
    const author = cleanString(data.author, 140);
    const description = cleanString(data.description, 3000);
    const condition = cleanString(data.condition, 80);
    const category = cleanString(data.category, 80);
    const location = cleanString(data.location, 120);
    const type = cleanString(data.type, 20);
    if (!title || !author || !description || !condition || !category || !location)
        throw new https_1.HttpsError("invalid-argument", "Missing required listing fields.");
    if (!["swap", "donate", "sell"].includes(type))
        throw new https_1.HttpsError("invalid-argument", "Invalid listing type.");
    const price = type === "sell" ? cleanNumber(data.price, 0) : 0;
    if (type === "sell" && price <= 0)
        throw new https_1.HttpsError("invalid-argument", "Selling listings require a valid price.");
    const now = Date.now();
    const listingDays = Math.min(Math.max(Math.floor(cleanNumber(data.listingDays, 10)), 1), MAX_LISTING_DAYS);
    const created = await db.collection("listings").add({
        title, author, description, condition, category, type, price, images: getSafeImages(data.images),
        userId: uid, userName: user.displayName || request.auth?.token?.name || "Reshelved User",
        userPhoto: user.photoURL || request.auth?.token?.picture || "", location, createdAt: now,
        expiresAt: now + listingDays * DAY_MS, listingDays, active: true, flagged: false, flagCount: 0,
    });
    logger.info("Listing created", { uid, listingId: created.id });
    return { listingId: created.id };
});
exports.createReport = (0, https_1.onCall)({ enforceAppCheck: true, maxInstances: 10 }, async (request) => {
    const { uid } = await requireActiveUser(request);
    await assertRateLimit(uid, { key: "createReport", max: 10, windowMs: DAY_MS });
    const data = request.data || {};
    const reason = cleanString(data.reason, 1000);
    const listingId = cleanString(data.listingId, 120);
    const reportedUserId = cleanString(data.reportedUserId, 120);
    const reportType = cleanString(data.type, 40) || "listing";
    if (!reason)
        throw new https_1.HttpsError("invalid-argument", "Report reason is required.");
    if (!listingId && !reportedUserId)
        throw new https_1.HttpsError("invalid-argument", "A report target is required.");
    if (reportedUserId === uid)
        throw new https_1.HttpsError("invalid-argument", "You cannot report yourself.");
    if (listingId && !(await db.doc(`listings/${listingId}`).get()).exists)
        throw new https_1.HttpsError("not-found", "Listing not found.");
    const reportId = listingId ? `listing_${listingId}_${uid}` : `user_${reportedUserId}_${uid}`;
    if ((await db.doc(`reports/${reportId}`).get()).exists)
        throw new https_1.HttpsError("already-exists", "You have already reported this item.");
    await db.doc(`reports/${reportId}`).set({ reporterId: uid, listingId, reportedUserId, type: reportType, reason, status: "pending", createdAt: Date.now() });
    return { reportId };
});
exports.sendMessage = (0, https_1.onCall)({ enforceAppCheck: true, maxInstances: 20 }, async (request) => {
    const { uid, user } = await requireActiveUser(request);
    await assertRateLimit(uid, { key: "sendMessage", max: 10, windowMs: MINUTE_MS });
    const conversationId = cleanString(request.data?.conversationId, 120);
    const text = cleanString(request.data?.text, 2000);
    if (!conversationId || !text)
        throw new https_1.HttpsError("invalid-argument", "Conversation and message are required.");
    const conversationRef = db.doc(`conversations/${conversationId}`);
    const conversation = (await conversationRef.get()).data();
    if (!conversation)
        throw new https_1.HttpsError("not-found", "Conversation not found.");
    const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
    if (participants.length !== 2 || !participants.includes(uid) || participants[0] === participants[1])
        throw new https_1.HttpsError("permission-denied", "You are not part of this conversation.");
    const recipientId = participants.find((participant) => participant !== uid);
    if (!recipientId)
        throw new https_1.HttpsError("invalid-argument", "Message recipient was not found.");
    const recipient = (await db.doc(`users/${recipientId}`).get()).data() || {};
    if (recipient.banned === true || recipient.disabled === true || recipient.deactivated === true)
        throw new https_1.HttpsError("permission-denied", "This user cannot receive messages.");
    const now = Date.now();
    const senderName = user.displayName || request.auth?.token?.name || "User";
    const message = await db.collection("messages").add({ conversationId, senderId: uid, senderName, recipientId, text, type: "text", readBy: [uid], createdAt: now });
    await conversationRef.update({ lastMessage: text, lastMessageAt: now, updatedAt: now });
    await db.collection("notifications").add({ userId: recipientId, fromUserId: uid, fromUserName: senderName, fromAdmin: false, type: "message", subject: `New message from ${senderName}`, message: text, conversationId, createdAt: now, read: false });
    return { messageId: message.id };
});
exports.deleteListingPermanently = (0, https_1.onCall)({ maxInstances: 10 }, async (request) => {
    const { uid, user } = await requireActiveUser(request);
    const listingId = cleanString(request.data?.listingId, 120);
    if (!listingId)
        throw new https_1.HttpsError("invalid-argument", "Listing ID is required.");
    const listing = await db.doc(`listings/${listingId}`).get();
    if (!listing.exists)
        return { deleted: true };
    const ownerId = cleanString(listing.data()?.userId, 128);
    if (uid !== ownerId && user.isAdmin !== true && request.auth?.token?.admin !== true)
        throw new https_1.HttpsError("permission-denied", "You cannot delete this listing.");
    await deleteListingData(listingId, ownerId);
    logger.info("Listing permanently deleted", { uid, listingId });
    return { deleted: true };
});
// Covers direct Firestore deletes, including deletion from admin management screens.
exports.cleanupDeletedListing = (0, firestore_1.onDocumentDeleted)({ document: "listings/{listingId}", database: "reshelved" }, async (event) => {
    const listingId = event.params.listingId;
    const ownerId = cleanString(event.data?.data()?.userId, 128);
    await cleanupListingAssociations(listingId, ownerId);
    logger.info("Deleted listing associations purged", { listingId });
});
// The existing profile flow deletes the Firebase Auth user. This trigger completes permanent data erasure.
exports.purgeDeletedUserData = functionsV1.auth.user().onDelete(async (deletedUser) => {
    const uid = deletedUser.uid;
    const [listings, conversations] = await Promise.all([
        db.collection("listings").where("userId", "==", uid).get(),
        db.collection("conversations").where("participants", "array-contains", uid).get(),
    ]);
    await Promise.all(conversations.docs.map((conversation) => deleteConversationPermanently(conversation.id)));
    await Promise.all(listings.docs.map((listing) => deleteListingData(listing.id, uid)));
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
//# sourceMappingURL=index.js.map