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
  createdAt: Date.now()
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureUserProfile = async (user: User, displayName?: string, location = 'Lavington') => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const existingProfile = snap.data() as UserProfile;
      const normalizedProfile = {
        ...existingProfile,
        isAdmin: existingProfile.isAdmin || isAdminEmail(existingProfile.email || user.email)
      };
      setUserProfile(normalizedProfile);
      if (normalizedProfile.isAdmin !== existingProfile.isAdmin) {
        await setDoc(userRef, { isAdmin: true }, { merge: true });
      }
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
        setUserProfile({ ...profile, isAdmin: profile.isAdmin || isAdminEmail(profile.email || auth.currentUser?.email) });
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
      createdAt: Date.now()
    };

    await setDoc(doc(db, 'users', cred.user.uid), profile, { merge: true });
    setCurrentUser(cred.user);
    setUserProfile(profile);
  };

  const login = async (email: string, password: string) => {
    await setPersistence(auth, browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    setCurrentUser(cred.user);
    setUserProfile(buildUserProfile(cred.user));
    ensureUserProfile(cred.user).catch((err) => console.error('Error syncing profile:', err));
  };

  const logout = async () => {
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
        ensureUserProfile(user).catch((err) => console.error('Error syncing user profile:', err));
      } else {
        setUserProfile(null);
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, register, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
