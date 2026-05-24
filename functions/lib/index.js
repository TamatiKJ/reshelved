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
exports.sendMessage = exports.createReport = exports.createListing = void 0;
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
(0, firebase_functions_1.setGlobalOptions)({ maxInstances: 10 });
admin.initializeApp();
const db = admin.firestore();
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_LISTING_DAYS = 45;
function cleanString(value, maxLength) {
    if (typeof value !== "string")
        return "";
    return value.trim().slice(0, maxLength);
}
function cleanNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}
async function requireActiveUser(request) {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const userSnap = await db.doc(`users/${uid}`).get();
    const user = userSnap.data() || {};
    if (user.banned === true || user.disabled === true || user.deactivated === true) {
        throw new https_1.HttpsError("permission-denied", "This account is restricted.");
    }
    return { uid, user };
}
async function assertRateLimit(uid, config) {
    const now = Date.now();
    const bucket = Math.floor(now / config.windowMs);
    const counterRef = db.doc(`rateLimits/${uid}/counters/${config.key}_${bucket}`);
    await db.runTransaction(async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const currentCount = counterSnap.exists ? Number(counterSnap.data()?.count || 0) : 0;
        if (currentCount >= config.max) {
            throw new https_1.HttpsError("resource-exhausted", "You are doing this too often. Please try again later.");
        }
        transaction.set(counterRef, {
            uid,
            key: config.key,
            bucket,
            count: currentCount + 1,
            windowMs: config.windowMs,
            updatedAt: now,
            expiresAt: now + config.windowMs * 2,
        }, { merge: true });
    });
}
function assertValidListingType(type) {
    if (!["swap", "donate", "sell"].includes(type)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid listing type.");
    }
}
function getSafeImages(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((image) => typeof image === "string" && image.trim().length > 0)
        .slice(0, 4);
}
exports.createListing = (0, https_1.onCall)({ enforceAppCheck: true, maxInstances: 10 }, async (request) => {
    const { uid, user } = await requireActiveUser(request);
    await assertRateLimit(uid, {
        key: "createListing",
        max: 5,
        windowMs: DAY_MS,
    });
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
        throw new https_1.HttpsError("invalid-argument", "Missing required listing fields.");
    }
    assertValidListingType(type);
    const price = type === "sell" ? cleanNumber(data.price, 0) : 0;
    if (type === "sell" && price <= 0) {
        throw new https_1.HttpsError("invalid-argument", "Selling listings require a valid price.");
    }
    const listingRef = await db.collection("listings").add({
        title,
        author,
        description,
        condition,
        category,
        type,
        price,
        images: getSafeImages(data.images),
        userId: uid,
        userName: user.displayName || request.auth?.token?.name || "Reshelved User",
        userPhoto: user.photoURL || request.auth?.token?.picture || "",
        location,
        createdAt: now,
        expiresAt: now + listingDays * DAY_MS,
        listingDays,
        active: true,
        flagged: false,
        flagCount: 0,
    });
    logger.info("Listing created through rate-limited function", { uid, listingId: listingRef.id });
    return { listingId: listingRef.id };
});
exports.createReport = (0, https_1.onCall)({ enforceAppCheck: true, maxInstances: 10 }, async (request) => {
    const { uid } = await requireActiveUser(request);
    await assertRateLimit(uid, {
        key: "createReport",
        max: 10,
        windowMs: DAY_MS,
    });
    const data = request.data || {};
    const reason = cleanString(data.reason, 1000);
    const listingId = cleanString(data.listingId, 120);
    const reportedUserId = cleanString(data.reportedUserId, 120);
    const reportType = cleanString(data.type, 40) || "listing";
    if (!reason) {
        throw new https_1.HttpsError("invalid-argument", "Report reason is required.");
    }
    if (!listingId && !reportedUserId) {
        throw new https_1.HttpsError("invalid-argument", "A report target is required.");
    }
    if (reportedUserId && reportedUserId === uid) {
        throw new https_1.HttpsError("invalid-argument", "You cannot report yourself.");
    }
    if (listingId) {
        const listingSnap = await db.doc(`listings/${listingId}`).get();
        if (!listingSnap.exists) {
            throw new https_1.HttpsError("not-found", "Listing not found.");
        }
    }
    const reportId = listingId ? `listing_${listingId}_${uid}` : `user_${reportedUserId}_${uid}`;
    const reportRef = db.doc(`reports/${reportId}`);
    const existingReport = await reportRef.get();
    if (existingReport.exists) {
        throw new https_1.HttpsError("already-exists", "You have already reported this item.");
    }
    await reportRef.set({
        reporterId: uid,
        listingId,
        reportedUserId,
        type: reportType,
        reason,
        status: "pending",
        createdAt: Date.now(),
    });
    logger.info("Report created through rate-limited function", { uid, reportId });
    return { reportId };
});
exports.sendMessage = (0, https_1.onCall)({ enforceAppCheck: true, maxInstances: 20 }, async (request) => {
    const { uid, user } = await requireActiveUser(request);
    await assertRateLimit(uid, {
        key: "sendMessage",
        max: 10,
        windowMs: MINUTE_MS,
    });
    const data = request.data || {};
    const conversationId = cleanString(data.conversationId, 120);
    const text = cleanString(data.text, 2000);
    if (!conversationId || !text) {
        throw new https_1.HttpsError("invalid-argument", "Conversation and message are required.");
    }
    const conversationRef = db.doc(`conversations/${conversationId}`);
    const conversationSnap = await conversationRef.get();
    if (!conversationSnap.exists) {
        throw new https_1.HttpsError("not-found", "Conversation not found.");
    }
    const conversation = conversationSnap.data() || {};
    const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
    if (participants.length !== 2 || !participants.includes(uid)) {
        throw new https_1.HttpsError("permission-denied", "You are not part of this conversation.");
    }
    if (participants[0] === participants[1]) {
        throw new https_1.HttpsError("invalid-argument", "You cannot message yourself.");
    }
    const recipientId = participants.find((participantId) => participantId !== uid);
    if (!recipientId) {
        throw new https_1.HttpsError("invalid-argument", "Message recipient was not found.");
    }
    const recipientSnap = await db.doc(`users/${recipientId}`).get();
    const recipient = recipientSnap.data() || {};
    if (recipient.banned === true || recipient.disabled === true || recipient.deactivated === true) {
        throw new https_1.HttpsError("permission-denied", "This user cannot receive messages.");
    }
    const now = Date.now();
    const senderName = user.displayName || request.auth?.token?.name || "User";
    const messageRef = await db.collection("messages").add({
        conversationId,
        senderId: uid,
        senderName,
        recipientId,
        text,
        type: "text",
        readBy: [uid],
        createdAt: now,
    });
    await conversationRef.update({
        lastMessage: text,
        lastMessageAt: now,
        updatedAt: now,
    });
    await db.collection("notifications").add({
        userId: recipientId,
        fromUserId: uid,
        fromUserName: senderName,
        fromAdmin: false,
        type: "message",
        subject: `New message from ${senderName}`,
        message: text,
        conversationId,
        createdAt: now,
        read: false,
    });
    logger.info("Message sent through rate-limited function", { uid, messageId: messageRef.id });
    return { messageId: messageRef.id };
});
//# sourceMappingURL=index.js.map