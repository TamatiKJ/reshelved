import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

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

const buildUserProfile = (user: User, displayName?: string, location = 'Nairobi'): UserProfile => ({
  uid: user.uid,
  displayName: displayName || user.displayName || user.email?.split('@')[0] || 'Reshelved User',
  email: user.email || '',
  photoURL: user.photoURL || '',
  location,
  phone: '',
  bio: '',
  isAdmin: false,
  flagged: false,
  flagCount: 0,
  createdAt: Date.now()
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureUserProfile = async (user: User, displayName?: string, location = 'Nairobi') => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const existingProfile = snap.data() as UserProfile;
      setUserProfile(existingProfile);
      return existingProfile;
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
        setUserProfile(snap.data() as UserProfile);
      } else if (auth.currentUser) {
        await ensureUserProfile(auth.currentUser);
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setUserProfile(null);
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
    const cleanLocation = location || 'Nairobi';

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
      isAdmin: false,
      flagged: false,
      flagCount: 0,
      createdAt: Date.now()
    };

    await setDoc(doc(db, 'users', cred.user.uid), profile, { merge: true });
    setCurrentUser(cred.user);
    setUserProfile(profile);
  };

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    await ensureUserProfile(cred.user);
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      try {
        if (user) {
          await ensureUserProfile(user);
        } else {
          setUserProfile(null);
        }
      } catch (err) {
        console.error('Error syncing user profile:', err);
        setUserProfile(null);
      } finally {
        setLoading(false);
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
