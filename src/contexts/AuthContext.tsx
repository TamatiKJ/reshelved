import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  setPersistence,
  browserSessionPersistence,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

const ADMIN_EMAIL = 'tamatikraido@gmail.com';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  register: (email: string, password: string, displayName: string, location: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

const isAdminEmail = (email?: string | null) => email?.trim().toLowerCase() === ADMIN_EMAIL;

const buildUserProfile = (user: User, displayName?: string, location = 'Lavington'): UserProfile => ({
  uid: user.uid,
  displayName: displayName || user.displayName || user.email?.split('@')[0] || 'Reshelved User',
  email: user.email || '',
  photoURL: user.photoURL || '',
  location,
  phone: '',
  bio: '',
  isAdmin: isAdminEmail(user.email),
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

  const updatePresence = async (uid: string, online: boolean) => {
    await setDoc(doc(db, 'users', uid), {
      online,
      lastSeen: Date.now()
    }, { merge: true });
  };

  const ensureUserProfile = async (user: User, displayName?: string, location = 'Lavington') => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const existingProfile = snap.data() as UserProfile;
      const normalizedProfile = {
        ...existingProfile,
        uid: existingProfile.uid || user.uid,
        isAdmin: existingProfile.isAdmin || isAdminEmail(existingProfile.email || user.email),
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
        isAdmin: normalizedProfile.isAdmin,
        online: true,
        lastSeen: normalizedProfile.lastSeen,
        deactivated: normalizedProfile.deactivated
      }, { merge: true });
      return normalizedProfile;
    }

    const newProfile = buildUserProfile(user, displayName, location);
    await setDoc(userRef, newProfile, { merge: true });
    setUserProfile(newProfile);
    return newProfile;
  };

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        const normalizedProfile = {
          ...profile,
          isAdmin: profile.isAdmin || isAdminEmail(profile.email || auth.currentUser?.email)
        };
        setUserProfile(normalizedProfile);
      } else if (auth.currentUser) {
        await ensureUserProfile(auth.currentUser);
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      if (auth.currentUser) {
        setUserProfile(buildUserProfile(auth.currentUser));
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

    const profile: UserProfile = {
      uid: cred.user.uid,
      displayName: cleanName,
      email: cleanEmail,
      photoURL: cred.user.photoURL || '',
      bio: '',
      location: cleanLocation,
      phone: '',
      isAdmin: isAdminEmail(cleanEmail),
      flagged: false,
      flagCount: 0,
      createdAt: Date.now(),
      online: true,
      lastSeen: Date.now(),
      deactivated: false
    };

    await setDoc(doc(db, 'users', cred.user.uid), profile, { merge: true });
    setCurrentUser(cred.user);
    setUserProfile(profile);
  };

  const login = async (email: string, password: string) => {
    await setPersistence(auth, browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const profile = await ensureUserProfile(cred.user);
    setCurrentUser(cred.user);
    setUserProfile(profile);
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
          setCurrentUser(null);
          setUserProfile(null);
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
      }, { merge: true });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence(currentUser.uid, false).catch(() => undefined);
    };
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, register, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
