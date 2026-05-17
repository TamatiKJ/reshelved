import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  setPersistence,
  browserSessionPersistence,
  User
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  register: (email: string, password: string, displayName: string, location: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
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

const buildUserProfile = (user: User, displayName?: string, location = 'Lavington', isAdmin = false): UserProfile => ({
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
  createdAt: Date.now(),
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

  const ensureUserProfile = async (user: User, displayName?: string, location = 'Lavington') => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const adminStatus = await getIsAdminFromClaims(user, true);

    if (snap.exists()) {
      const existingProfile = snap.data() as UserProfile;
      const normalizedProfile = {
        ...existingProfile,
        uid: existingProfile.uid || user.uid,
        displayName: existingProfile.displayName || displayName || user.displayName || user.email?.split('@')[0] || 'Reshelved User',
        email: user.email || existingProfile.email || '',
        photoURL: existingProfile.photoURL || user.photoURL || '',
        location: existingProfile.location || location,
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
      await setDoc(userRef, {
        uid: normalizedProfile.uid,
        displayName: normalizedProfile.displayName,
        email: normalizedProfile.email,
        photoURL: normalizedProfile.photoURL,
        location: normalizedProfile.location,
        isAdmin: normalizedProfile.isAdmin,
        online: true,
        lastSeen: normalizedProfile.lastSeen,
        deactivated: normalizedProfile.deactivated
      }, { merge: true });
      syncPublicProfile(normalizedProfile).catch((err) => console.error('Public profile sync failed:', err));
      syncConversationProfile(normalizedProfile).catch((err) => console.error('Conversation avatar sync failed:', err));
      return normalizedProfile;
    }

    const newProfile = buildUserProfile(user, displayName, location, adminStatus);
    await setDoc(userRef, newProfile, { merge: true });
    await syncPublicProfile(newProfile);
    setUserProfile(newProfile);
    return newProfile;
  };

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        const adminStatus = await getIsAdminFromClaims(auth.currentUser, true);
        const normalizedProfile = {
          ...profile,
          email: auth.currentUser?.email || profile.email || '',
          isAdmin: adminStatus
        };
        setUserProfile(normalizedProfile);
        syncPublicProfile(normalizedProfile).catch((err) => console.error('Public profile sync failed:', err));
        syncConversationProfile(normalizedProfile).catch((err) => console.error('Conversation avatar sync failed:', err));
        await setDoc(doc(db, 'users', uid), {
          email: normalizedProfile.email,
          isAdmin: normalizedProfile.isAdmin,
          online: true,
          lastSeen: Date.now()
        }, { merge: true });
      } else if (auth.currentUser) {
        ensureUserProfile(auth.currentUser).catch((err) => console.error('Error syncing missing profile:', err));
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      if (auth.currentUser) {
        const adminStatus = await getIsAdminFromClaims(auth.currentUser, true);
        setUserProfile(buildUserProfile(auth.currentUser, undefined, 'Lavington', adminStatus));
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

  const register = async (email: string, password: string, displayName: string, location: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanLocation = location || 'Lavington';

    await setPersistence(auth, browserSessionPersistence);
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(cred.user, { displayName: cleanName });
    const adminStatus = await getIsAdminFromClaims(cred.user, true);

    const profile: UserProfile = {
      uid: cred.user.uid,
      displayName: cleanName,
      email: cleanEmail,
      photoURL: cred.user.photoURL || '',
      bio: '',
      location: cleanLocation,
      phone: '',
      isAdmin: adminStatus,
      flagged: false,
      flagCount: 0,
      createdAt: Date.now(),
      online: true,
      lastSeen: Date.now(),
      deactivated: false
    };

    await setDoc(doc(db, 'users', cred.user.uid), profile, { merge: true });
    await syncPublicProfile(profile);
    setCurrentUser(cred.user);
    setUserProfile(profile);
  };

  const login = async (email: string, password: string) => {
    await setPersistence(auth, browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    setCurrentUser(cred.user);
    const profile = await ensureUserProfile(cred.user);
    setUserProfile(profile);
  };

  const loginWithGoogle = async () => {
    await setPersistence(auth, browserSessionPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const profile = await ensureUserProfile(cred.user);
    setCurrentUser(cred.user);
    setUserProfile(profile);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  };

  const logout = async () => {
    if (auth.currentUser) {
      await updatePresence(auth.currentUser.uid, false).catch((err) => console.error('Error updating presence:', err));
    }
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);

      if (user) {
        setUserProfile(buildUserProfile(user));
        ensureUserProfile(user).catch((err) => {
          console.error('Error syncing user profile:', err);
        });
      } else {
        setUserProfile(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUser) return;

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
    <AuthContext.Provider value={{ currentUser, userProfile, loading, register, login, loginWithGoogle, resetPassword, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
