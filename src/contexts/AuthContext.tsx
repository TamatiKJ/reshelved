import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  isSignInWithEmailLink,
  signOut,
  updatePassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  type ActionCodeSettings,
  type User
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

const SIGNUP_SESSION_ID_KEY = 'reshelved:signupSessionId';
const PENDING_SIGNUP_EMAIL_KEY = 'reshelved:pendingSignUpEmail';
const PENDING_SIGNUP_NAME_KEY = 'reshelved:pendingSignUpName';
const PENDING_SIGNUP_LOCATION_KEY = 'reshelved:pendingSignUpLocation';
const GOOGLE_AUTH_PENDING_KEY = 'reshelved:googleAuthPending';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  register: (email: string, displayName: string, location?: string, existingSessionId?: string) => Promise<string>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<User | null>;
  setAccountPassword: (password: string, sessionId?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

const getCurrentSessionId = () => new URLSearchParams(window.location.search).get('sessionId') || window.localStorage.getItem(SIGNUP_SESSION_ID_KEY) || '';
const getEmailFromContinueUrl = () => new URLSearchParams(window.location.search).get('email')?.trim().toLowerCase() || '';
const generateSessionId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getSignInLinkSettings = (email: string, sessionId: string): ActionCodeSettings => ({
  url: `${window.location.origin}/auth/verify?sessionId=${encodeURIComponent(sessionId)}&email=${encodeURIComponent(email.trim().toLowerCase())}`,
  handleCodeInApp: true
});

const savePendingSignUp = (sessionId: string, email: string, displayName: string, location = '') => {
  window.localStorage.setItem(SIGNUP_SESSION_ID_KEY, sessionId);
  window.localStorage.setItem(PENDING_SIGNUP_EMAIL_KEY, email.trim().toLowerCase());
  window.localStorage.setItem(PENDING_SIGNUP_NAME_KEY, displayName.trim());
  window.localStorage.setItem(PENDING_SIGNUP_LOCATION_KEY, location.trim());
};

const clearPendingSignUp = () => {
  window.localStorage.removeItem(SIGNUP_SESSION_ID_KEY);
  window.localStorage.removeItem(PENDING_SIGNUP_EMAIL_KEY);
  window.localStorage.removeItem(PENDING_SIGNUP_NAME_KEY);
  window.localStorage.removeItem(PENDING_SIGNUP_LOCATION_KEY);
};

const markGoogleAuthPending = () => window.localStorage.setItem(GOOGLE_AUTH_PENDING_KEY, 'true');
const clearGoogleAuthPending = () => window.localStorage.removeItem(GOOGLE_AUTH_PENDING_KEY);
const hasGoogleAuthPending = () => window.localStorage.getItem(GOOGLE_AUTH_PENDING_KEY) === 'true';

const getIsAdminFromClaims = async (user: User | null, forceRefresh = false) => {
  if (!user) return false;
  try {
    const token = await user.getIdTokenResult(forceRefresh);
    return token.claims.admin === true;
  } catch (err) {
    console.error('Error reading admin custom claim:', err);
    return false;
  }
};

const getAuthCreatedAt = (user: User) => {
  const createdAt = user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : 0;
  return Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now();
};

const isGoogleAuthUser = (user: User) => user.providerData.some((provider) => provider.providerId === 'google.com');
const isVerifiedAuthUser = (user: User) => user.emailVerified === true || isGoogleAuthUser(user);

const getInitialOnboardingStatus = (user: User, isGoogleUser = false): UserProfile['onboardingStatus'] => {
  if (isGoogleUser) return 'complete';
  return user.emailVerified ? 'password_required' : 'pending';
};

const buildUserProfile = (user: User, displayName?: string, location = '', isAdmin = false, onboardingStatus?: UserProfile['onboardingStatus']): UserProfile => {
  const isGoogleUser = isGoogleAuthUser(user);
  return {
    uid: user.uid,
    displayName: displayName || user.displayName || user.email?.split('@')[0] || 'Reshelved User',
    email: user.email || '',
    emailVerified: isVerifiedAuthUser(user),
    photoURL: user.photoURL || '',
    location,
    phone: '',
    bio: '',
    isAdmin,
    flagged: false,
    flagCount: 0,
    createdAt: getAuthCreatedAt(user),
    onboardingStatus: onboardingStatus || getInitialOnboardingStatus(user, isGoogleUser),
    online: true,
    lastSeen: Date.now(),
    deactivated: false
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncPublicProfile = async (profile: UserProfile) => {
    if (profile.onboardingStatus !== 'complete') return;
    const ratingSnap = await getDocs(query(collection(db, 'ratings'), where('toUserId', '==', profile.uid))).catch(() => null);
    let ratingAverage = 0;
    let ratingCount = 0;
    if (ratingSnap) {
      const ratings = ratingSnap.docs.map((item) => Number(item.data().rating || 0)).filter((rating) => rating > 0);
      ratingCount = ratings.length;
      ratingAverage = ratingCount ? ratings.reduce((sum, rating) => sum + rating, 0) / ratingCount : 0;
    }

    await setDoc(doc(db, 'publicProfiles', profile.uid), {
      uid: profile.uid,
      displayName: profile.displayName || 'Reshelved User',
      photoURL: profile.photoURL || '',
      location: profile.location || '',
      createdAt: profile.createdAt || Date.now(),
      ratingAverage,
      ratingCount,
      updatedAt: Date.now()
    }, { merge: true }).catch((err) => console.error('Error syncing public profile:', err));
  };

  const syncConversationProfile = async (profile: UserProfile) => {
    if (profile.onboardingStatus !== 'complete') return;
    const snap = await getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', profile.uid))).catch(() => null);
    if (!snap) return;
    await Promise.all(snap.docs.map((item) => updateDoc(doc(db, 'conversations', item.id), {
      [`participantNames.${profile.uid}`]: profile.displayName || 'Reshelved User',
      [`participantPhotos.${profile.uid}`]: profile.photoURL || ''
    }).catch(() => undefined)));
  };

  const updatePresence = async (uid: string, online: boolean) => {
    await setDoc(doc(db, 'users', uid), {
      online,
      lastSeen: Date.now()
    }, { merge: true });
  };

  const ensureUserProfile = async (user: User, displayName?: string, location = '', statusOverride?: UserProfile['onboardingStatus']) => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const adminStatus = await getIsAdminFromClaims(user, true);
    const authCreatedAt = getAuthCreatedAt(user);
    const isGoogleUser = isGoogleAuthUser(user);
    const hasPendingEmailSignup = Boolean(window.localStorage.getItem(SIGNUP_SESSION_ID_KEY));
    const shouldCompleteExistingPasswordUser = !statusOverride && !isGoogleUser && user.emailVerified && !hasPendingEmailSignup;
    const nextStatus = statusOverride || (isGoogleUser || shouldCompleteExistingPasswordUser ? 'complete' : undefined);

    if (snap.exists()) {
      const existingProfile = snap.data() as UserProfile;
      const normalizedProfile: UserProfile = {
        ...existingProfile,
        uid: existingProfile.uid || user.uid,
        displayName: displayName || existingProfile.displayName || user.displayName || user.email?.split('@')[0] || 'Reshelved User',
        email: user.email || existingProfile.email || '',
        emailVerified: isVerifiedAuthUser(user) || existingProfile.emailVerified === true,
        photoURL: existingProfile.photoURL || user.photoURL || '',
        location: existingProfile.location || location || '',
        createdAt: existingProfile.createdAt || authCreatedAt,
        isAdmin: adminStatus,
        onboardingStatus: nextStatus || existingProfile.onboardingStatus || getInitialOnboardingStatus(user, isGoogleUser),
        online: true,
        lastSeen: Date.now(),
        deactivated: existingProfile.deactivated || false
      };

      if (normalizedProfile.deactivated && !normalizedProfile.isAdmin) {
        await signOut(auth);
        throw new Error('This account has been banned. Please contact Reshelved support.');
      }

      setUserProfile(normalizedProfile);

      if (isVerifiedAuthUser(user) || normalizedProfile.onboardingStatus === 'complete') {
        await setDoc(userRef, {
          uid: normalizedProfile.uid,
          displayName: normalizedProfile.displayName,
          email: normalizedProfile.email,
          emailVerified: normalizedProfile.emailVerified === true,
          photoURL: normalizedProfile.photoURL,
          location: normalizedProfile.location,
          createdAt: normalizedProfile.createdAt,
          isAdmin: normalizedProfile.isAdmin,
          onboardingStatus: normalizedProfile.onboardingStatus,
          online: normalizedProfile.onboardingStatus === 'complete',
          lastSeen: normalizedProfile.lastSeen,
          deactivated: normalizedProfile.deactivated
        }, { merge: true });
        syncPublicProfile(normalizedProfile).catch((err) => console.error('Public profile sync failed:', err));
        syncConversationProfile(normalizedProfile).catch((err) => console.error('Conversation avatar sync failed:', err));
      }

      return normalizedProfile;
    }

    const newProfile = buildUserProfile(user, displayName, location, adminStatus, nextStatus);
    await setDoc(userRef, newProfile, { merge: true });
    syncPublicProfile(newProfile).catch((err) => console.error('Public profile sync failed:', err));
    setUserProfile(newProfile);
    return newProfile;
  };

  const fetchProfile = async (uid: string) => {
    try {
      if (auth.currentUser?.uid === uid) {
        await auth.currentUser.reload().catch(() => undefined);
      }
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        const adminStatus = await getIsAdminFromClaims(auth.currentUser, true);
        const authCreatedAt = auth.currentUser?.uid === uid ? getAuthCreatedAt(auth.currentUser) : 0;
        const isGoogleUser = auth.currentUser ? isGoogleAuthUser(auth.currentUser) : false;
        const normalizedProfile: UserProfile = {
          ...profile,
          email: auth.currentUser?.email || profile.email || '',
          emailVerified: profile.emailVerified === true || Boolean(auth.currentUser && isVerifiedAuthUser(auth.currentUser)),
          location: profile.location || '',
          createdAt: profile.createdAt || authCreatedAt || Date.now(),
          isAdmin: adminStatus,
          onboardingStatus: isGoogleUser ? 'complete' : profile.onboardingStatus || (auth.currentUser?.emailVerified ? 'complete' : 'pending')
        };
        setUserProfile(normalizedProfile);

        if (auth.currentUser?.uid === uid && (isVerifiedAuthUser(auth.currentUser) || normalizedProfile.onboardingStatus === 'complete')) {
          syncPublicProfile(normalizedProfile).catch((err) => console.error('Public profile sync failed:', err));
          syncConversationProfile(normalizedProfile).catch((err) => console.error('Conversation avatar sync failed:', err));
          await setDoc(doc(db, 'users', uid), {
            email: normalizedProfile.email,
            emailVerified: normalizedProfile.emailVerified === true,
            location: normalizedProfile.location,
            createdAt: normalizedProfile.createdAt,
            isAdmin: normalizedProfile.isAdmin,
            onboardingStatus: normalizedProfile.onboardingStatus,
            online: normalizedProfile.onboardingStatus === 'complete',
            lastSeen: Date.now()
          }, { merge: true });
        }
      } else if (auth.currentUser) {
        ensureUserProfile(auth.currentUser).catch((err) => console.error('Error syncing missing profile:', err));
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      if (auth.currentUser) {
        const adminStatus = await getIsAdminFromClaims(auth.currentUser, true);
        setUserProfile(buildUserProfile(auth.currentUser, undefined, '', adminStatus));
      } else {
        setUserProfile(null);
      }
    }
  };

  const refreshProfile = async () => {
    if (currentUser) await fetchProfile(currentUser.uid);
  };

  const register = async (email: string, displayName: string, location = '', existingSessionId?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanLocation = location.trim();
    const sessionId = existingSessionId || generateSessionId();
    const now = Date.now();

    clearGoogleAuthPending();
    await setPersistence(auth, browserLocalPersistence);
    await setDoc(doc(db, 'pendingSignups', sessionId), {
      sessionId,
      email: cleanEmail,
      displayName: cleanName,
      location: cleanLocation,
      onboardingStatus: 'pending',
      createdAt: now,
      updatedAt: now,
      lastSentAt: now,
      resendCount: existingSessionId ? 1 : 0
    }, { merge: true });
    savePendingSignUp(sessionId, cleanEmail, cleanName, cleanLocation);
    await sendSignInLinkToEmail(auth, cleanEmail, getSignInLinkSettings(cleanEmail, sessionId));
    return sessionId;
  };

  const login = async (email: string, password: string) => {
    clearPendingSignUp();
    clearGoogleAuthPending();
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    await cred.user.reload().catch(() => undefined);
    setCurrentUser(cred.user);
    const profile = await ensureUserProfile(cred.user, undefined, '', 'complete');
    setUserProfile(profile);
  };

  const loginWithGoogle = async () => {
    clearPendingSignUp();
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    markGoogleAuthPending();
    await signInWithRedirect(auth, provider);
  };

  const sendVerificationEmail = async () => {
    const sessionId = window.localStorage.getItem(SIGNUP_SESSION_ID_KEY) || '';
    const pendingEmail = window.localStorage.getItem(PENDING_SIGNUP_EMAIL_KEY) || '';
    const pendingName = window.localStorage.getItem(PENDING_SIGNUP_NAME_KEY) || '';
    const pendingLocation = window.localStorage.getItem(PENDING_SIGNUP_LOCATION_KEY) || '';
    if (!pendingEmail || !sessionId) throw new Error('Enter your email address again to request a new link.');
    await register(pendingEmail, pendingName, pendingLocation, sessionId);
  };

  const refreshAuthUser = async () => {
    if (!auth.currentUser) return null;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true).catch(() => undefined);
    setCurrentUser(auth.currentUser);
    if (isVerifiedAuthUser(auth.currentUser)) {
      await ensureUserProfile(auth.currentUser).catch((err) => console.error('Profile sync after verification failed:', err));
    }
    return auth.currentUser;
  };

  const setAccountPassword = async (password: string, sessionId?: string) => {
    if (!auth.currentUser) throw new Error('You must be signed in to set a password.');
    await updatePassword(auth.currentUser, password);
    await auth.currentUser.getIdToken(true).catch(() => undefined);
    const completedProfile = await ensureUserProfile(auth.currentUser, undefined, '', 'complete');
    if (sessionId) {
      await setDoc(doc(db, 'pendingSignups', sessionId), {
        onboardingStatus: 'complete',
        completedAt: Date.now(),
        updatedAt: Date.now(),
        uid: auth.currentUser.uid
      }, { merge: true }).catch((err) => console.error('Pending signup completion failed:', err));
    }
    clearPendingSignUp();
    clearGoogleAuthPending();
    setCurrentUser(auth.currentUser);
    setUserProfile(completedProfile);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  };

  const logout = async () => {
    clearGoogleAuthPending();
    if (auth.currentUser && isVerifiedAuthUser(auth.currentUser)) {
      await updatePresence(auth.currentUser.uid, false).catch((err) => console.error('Error updating presence:', err));
    }
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  const completeEmailLinkSignIn = async () => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return false;

    clearGoogleAuthPending();
    const sessionId = getCurrentSessionId();
    const pendingEmail = window.localStorage.getItem(PENDING_SIGNUP_EMAIL_KEY) || getEmailFromContinueUrl();
    const pendingName = window.localStorage.getItem(PENDING_SIGNUP_NAME_KEY) || '';
    const pendingLocation = window.localStorage.getItem(PENDING_SIGNUP_LOCATION_KEY) || '';

    if (!pendingEmail || !sessionId) {
      window.history.replaceState({}, document.title, '/auth/verify?error=missing-session');
      return false;
    }

    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailLink(auth, pendingEmail, window.location.href);
    const sessionSnap = await getDoc(doc(db, 'pendingSignups', sessionId)).catch(() => null);
    const session = sessionSnap?.exists() ? sessionSnap.data() : null;
    const displayName = String(session?.displayName || pendingName || '').trim();
    const location = String(session?.location || pendingLocation || '').trim();

    if (displayName && cred.user.displayName !== displayName) {
      await updateProfile(cred.user, { displayName });
    }
    await cred.user.reload().catch(() => undefined);
    await cred.user.getIdToken(true).catch(() => undefined);
    const sessionCompleted = session?.onboardingStatus === 'complete';
    const profile = await ensureUserProfile(cred.user, displayName, location, sessionCompleted ? 'complete' : 'password_required');
    await setDoc(doc(db, 'pendingSignups', sessionId), {
      onboardingStatus: sessionCompleted ? 'complete' : 'password_required',
      verifiedAt: session?.verifiedAt || Date.now(),
      updatedAt: Date.now(),
      uid: cred.user.uid
    }, { merge: true });
    setCurrentUser(cred.user);
    setUserProfile(profile);
    window.localStorage.setItem(SIGNUP_SESSION_ID_KEY, sessionId);
    window.history.replaceState({}, document.title, `/auth/verify?sessionId=${encodeURIComponent(sessionId)}`);
    return true;
  };

  const completeGoogleSession = async (user: User) => {
    clearPendingSignUp();
    await user.reload().catch(() => undefined);
    await user.getIdToken(true).catch(() => undefined);
    const profile = await ensureUserProfile(user, undefined, '', 'complete');
    clearGoogleAuthPending();
    setCurrentUser(user);
    setUserProfile(profile);
    return profile;
  };

  const completeAuthenticatedSession = async (user: User | null) => {
    if (!user) {
      setCurrentUser(null);
      setUserProfile(null);
      setLoading(false);
      return;
    }

    try {
      if (hasGoogleAuthPending() || isGoogleAuthUser(user)) {
        await completeGoogleSession(user);
      } else {
        await user.reload().catch(() => undefined);
        const profile = await ensureUserProfile(user);
        setCurrentUser(user);
        setUserProfile(profile);
      }
    } catch (err: any) {
      console.error('Error completing authenticated session:', err);
      if (String(err?.message || '').includes('banned')) {
        setCurrentUser(null);
        setUserProfile(null);
        await signOut(auth).catch(() => undefined);
      } else {
        const adminStatus = await getIsAdminFromClaims(user, true);
        const fallbackStatus = hasGoogleAuthPending() || isGoogleAuthUser(user) ? 'complete' : undefined;
        setCurrentUser(user);
        setUserProfile(buildUserProfile(user, undefined, '', adminStatus, fallbackStatus));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const completeIfMounted = async (user: User | null) => {
      if (cancelled) return;
      await completeAuthenticatedSession(user);
    };

    const startAuthListener = () => {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        await completeIfMounted(user);
      });
    };

    completeEmailLinkSignIn()
      .then(async (completedEmailLink) => {
        if (completedEmailLink) {
          setLoading(false);
          return;
        }
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await completeGoogleSession(result.user);
          setLoading(false);
          return;
        }
        if (auth.currentUser && hasGoogleAuthPending()) {
          await completeGoogleSession(auth.currentUser);
          setLoading(false);
          return;
        }
        startAuthListener();
      })
      .catch((err) => {
        console.error('Auth redirect/link sign-in failed:', err);
        startAuthListener();
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !isVerifiedAuthUser(currentUser) || userProfile?.onboardingStatus !== 'complete') return;

    updatePresence(currentUser.uid, true).catch((err) => console.error('Error updating presence:', err));
    const interval = window.setInterval(() => {
      updatePresence(currentUser.uid, true).catch((err) => console.error('Error updating presence:', err));
    }, 60 * 1000);

    const handleBeforeUnload = () => {
      setDoc(doc(db, 'users', currentUser.uid), {
        online: false,
        lastSeen: Date.now()
      }, { merge: true }).catch(() => undefined);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence(currentUser.uid, false).catch(() => undefined);
    };
  }, [currentUser, userProfile?.onboardingStatus]);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, register, login, loginWithGoogle, sendVerificationEmail, refreshAuthUser, setAccountPassword, resetPassword, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
