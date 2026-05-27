import { createHash, randomBytes, randomInt } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const db = getFirestore("reshelved");
const otpPepper = defineSecret("SIGNUP_OTP_PEPPER");
const MINUTE = 60 * 1000;
const OTP_EXPIRY = 10 * MINUTE;
const VERIFIED_EXPIRY = 15 * MINUTE;
const MAX_ATTEMPTS = 5;

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const emailValue = (value: unknown) => {
  const email = clean(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  return email;
};
const digest = (value: string) => createHash("sha256").update(`${otpPepper.value()}:${value}`).digest("hex");
const masked = (email: string) => `${email.slice(0, 2)}***@${email.split("@")[1]}`;

async function rateLimit(referencePath: string, maximum: number) {
  const now = Date.now();
  const ref = db.doc(referencePath);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    const count = Number(data.count || 0);
    const start = Number(data.start || now);
    const active = now - start < 60 * MINUTE;
    if (active && count >= maximum) throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
    transaction.set(ref, { count: active ? count + 1 : 1, start: active ? start : now, expiresAt: now + 2 * 60 * MINUTE });
  });
}

export const requestSignupCode = onCall({ maxInstances: 10, secrets: [otpPepper] }, async (request) => {
  const email = emailValue(request.data?.email);
  const name = clean(request.data?.displayName, 80);
  if (name.length < 2) throw new HttpsError("invalid-argument", "Enter your full name.");
  const key = digest(email);
  const now = Date.now();
  await rateLimit(`signupRateLimits/email_${key}`, 3);
  const pendingRef = db.doc(`pendingSignups/${key}`);
  const existing = await pendingRef.get();
  if (existing.exists && Number(existing.data()?.resendAfter || 0) > now) throw new HttpsError("resource-exhausted", "Wait one minute before requesting another code.");
  const code = String(randomInt(100000, 1000000));
  await pendingRef.set({ email, displayName: name, codeHash: digest(`${email}:${code}`), attempts: 0, expiresAt: now + OTP_EXPIRY, resendAfter: now + MINUTE, createdAt: now });
  await db.collection("mail").add({ to: [email], template: { name: "signupVerification", data: { code } }, createdAt: now });
  return { sent: true, maskedEmail: masked(email) };
});

export const verifySignupCode = onCall({ maxInstances: 10, secrets: [otpPepper] }, async (request) => {
  const email = emailValue(request.data?.email);
  const code = clean(request.data?.code, 6);
  if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Enter the six-digit code.");
  const ref = db.doc(`pendingSignups/${digest(email)}`);
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Request a new code.");
    const data = snapshot.data() || {};
    if (Number(data.expiresAt || 0) < now) throw new HttpsError("deadline-exceeded", "This code has expired.");
    if (Number(data.attempts || 0) >= MAX_ATTEMPTS) throw new HttpsError("resource-exhausted", "Request a new code.");
    if (data.codeHash !== digest(`${email}:${code}`)) {
      transaction.update(ref, { attempts: Number(data.attempts || 0) + 1 });
      throw new HttpsError("permission-denied", "That code is not correct.");
    }
    transaction.update(ref, { codeHash: null, verifiedAt: now, tokenHash: digest(token), tokenExpiresAt: now + VERIFIED_EXPIRY });
  });
  return { token };
});

export const completeRegistration = onCall({ maxInstances: 10, secrets: [otpPepper] }, async (request) => {
  const email = emailValue(request.data?.email);
  const name = clean(request.data?.displayName, 80);
  const password = clean(request.data?.password, 128);
  const token = clean(request.data?.token, 128);
  if (name.length < 2 || password.length < 8 || !token) throw new HttpsError("invalid-argument", "Complete all registration fields.");
  const ref = db.doc(`pendingSignups/${digest(email)}`);
  const snapshot = await ref.get();
  const pending = snapshot.data() || {};
  const now = Date.now();
  if (!snapshot.exists || !pending.verifiedAt || pending.tokenHash !== digest(token) || Number(pending.tokenExpiresAt || 0) < now) throw new HttpsError("permission-denied", "Verify your email again.");
  const user = await getAuth().createUser({ email, password, displayName: name, emailVerified: true });
  const profile = { uid: user.uid, displayName: name, email, photoURL: "", location: "", phone: "", bio: "", isAdmin: false, flagged: false, flagCount: 0, createdAt: now, online: true, lastSeen: now, deactivated: false };
  const batch = db.batch();
  batch.set(db.doc(`users/${user.uid}`), profile);
  batch.set(db.doc(`publicProfiles/${user.uid}`), { uid: user.uid, displayName: name, photoURL: "", location: "", createdAt: now, ratingAverage: 0, ratingCount: 0, updatedAt: now });
  batch.delete(ref);
  await batch.commit();
  return { customToken: await getAuth().createCustomToken(user.uid) };
});
