import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  type User
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  register: (email: string, password: string, displayName: string, location?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<User | null>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

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

const isVerifiedAuthUser = (user: User) => user.emailVerified === true;

const buildUserProfile = (user: User, displayName?: string, location = '', isAdmin = false): UserProfile => ({
  uid: user.uid,
  displayName: displayName || user.displayName || user.email?.split('@')[0] || 'Reshelved User',
  email: user.email || '',
  photoURL: user.photoURL || '',
  location,
  phone: '',
  bio: '',
  isAdmin,
  flagged: false,
  flagCount: 0,
  createdAt: getAuthCreatedAt(user),
  online: true,
  lastSeen: Date.now(),
  deactivated: false
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncPublicProfile = async (profile: UserProfile) => {
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

  const ensureUserProfile = async (user: User, displayName?: string, location = '') => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const adminStatus = await getIsAdminFromClaims(user, true);
    const authCreatedAt = getAuthCreatedAt(user);
    const canWriteVerifiedProfile = isVerifiedAuthUser(user);

    if (snap.exists()) {
      const existingProfile = snap.data() as UserProfile;
      const normalizedProfile = {
        ...existingProfile,
        uid: existingProfile.uid || user.uid,
        displayName: existingProfile.displayName || displayName || user.displayName || user.email?.split('@')[0] || 'Reshelved User',
        email: user.email || existingProfile.email || '',
        photoURL: existingProfile.photoURL || user.photoURL || '',
        location: existingProfile.location || location || '',
        createdAt: existingProfile.createdAt || authCreatedAt,
        isAdmin: adminStatus,
        online: true,
        lastSeen: Date.now(),
        deactivated: existingProfile.deactivated || false
      };

      if (normalizedProfile.deactivated && !normalizedProfile.isAdmin) {
        await signOut(auth);
        throw new Error('This account has been banned. Please contact Reshelved support.');
      }

      setUserProfile(normalizedProfile);

      if (canWriteVerifiedProfile) {
        await setDoc(userRef, {
          uid: normalizedProfile.uid,
          displayName: normalizedProfile.displayName,
          email: normalizedProfile.email,
          photoURL: normalizedProfile.photoURL,
          location: normalizedProfile.location,
          createdAt: normalizedProfile.createdAt,
          isAdmin: normalizedProfile.isAdmin,
          online: true,
          lastSeen: normalizedProfile.lastSeen,
          deactivated: normalizedProfile.deactivated
        }, { merge: true });
        syncPublicProfile(normalizedProfile).catch((err) => console.error('Public profile sync failed:', err));
        syncConversationProfile(normalizedProfile).catch((err) => console.error('Conversation avatar sync failed:', err));
      }

      return normalizedProfile;
    }

    const newProfile = buildUserProfile(user, displayName, location, adminStatus);
    await setDoc(userRef, newProfile, { merge: true });
    if (canWriteVerifiedProfile) await syncPublicProfile(newProfile);
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
        const normalizedProfile = {
          ...profile,
          email: auth.currentUser?.email || profile.email || '',
          location: profile.location || '',
          createdAt: profile.createdAt || authCreatedAt || Date.now(),
          isAdmin: adminStatus
        };
        setUserProfile(normalizedProfile);

        if (auth.currentUser?.uid === uid && isVerifiedAuthUser(auth.currentUser)) {
          syncPublicProfile(normalizedProfile).catch((err) => console.error('Public profile sync failed:', err));
          syncConversationProfile(normalizedProfile).catch((err) => console.error('Conversation avatar sync failed:', err));
          await setDoc(doc(db, 'users', uid), {
            email: normalizedProfile.email,
            location: normalizedProfile.location,
            createdAt: normalizedProfile.createdAt,
            isAdmin: normalizedProfile.isAdmin,
            online: true,
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
    if (currentUser) {
      await fetchProfile(currentUser.uid);
    }
  };

  const register = async (email: string, password: string, displayName: string, location = '') => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanLocation = location.trim();

    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(cred.user, { displayName: cleanName });
    const adminStatus = await getIsAdminFromClaims(cred.user, true);

    const profile = buildUserProfile(cred.user, cleanName, cleanLocation, adminStatus);

    await setDoc(doc(db, 'users', cred.user.uid), profile, { merge: true });
    await sendEmailVerification(cred.user).catch((err) => console.error('Verification email failed to send:', err));
    setCurrentUser(cred.user);
    setUserProfile(profile);
  };

  const login = async (email: string, password: string) => {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    await cred.user.reload().catch(() => undefined);
    setCurrentUser(cred.user);
    const profile = await ensureUserProfile(cred.user);
    setUserProfile(profile);
  };

  const loginWithGoogle = async () => {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithRedirect(auth, provider);
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('You must be logged in to verify your email.');
    await sendEmailVerification(auth.currentUser);
  };

  const refreshAuthUser = async () => {
    if (!auth.currentUser) return null;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true).catch(() => undefined);
    setCurrentUser(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      await ensureUserProfile(auth.currentUser).catch((err) => console.error('Profile sync after verification failed:', err));
    }
    return auth.currentUser;
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  };

  const logout = async () => {
    if (auth.currentUser && auth.currentUser.emailVerified) {
      await updatePresence(auth.currentUser.uid, false).catch((err) => console.error('Error updating presence:', err));
    }
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  const completeAuthenticatedSession = async (user: User | null) => {
    if (!user) {
      setCurrentUser(null);
      setUserProfile(null);
      setLoading(false);
      return;
    }

    try {
      await user.reload().catch(() => undefined);
      const profile = await ensureUserProfile(user);
      setCurrentUser(user);
      setUserProfile(profile);
    } catch (err) {
      console.error('Error completing authenticated session:', err);
      setCurrentUser(null);
      setUserProfile(null);
      await signOut(auth).catch(() => undefined);
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

    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await completeIfMounted(result.user);
          return;
        }
        startAuthListener();
      })
      .catch((err) => {
        console.error('Google redirect sign-in failed:', err);
        startAuthListener();
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !currentUser.emailVerified) return;

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
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, register, login, loginWithGoogle, sendVerificationEmail, refreshAuthUser, resetPassword, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};