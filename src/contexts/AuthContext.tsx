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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchProfile(currentUser.uid);
    }
  };

  const register = async (email: string, password: string, displayName: string, location: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const profile: UserProfile = {
      uid: cred.user.uid,
      displayName,
      email,
      location,
      isAdmin: false,
      flagged: false,
      flagCount: 0,
      createdAt: Date.now()
    };
    await setDoc(doc(db, 'users', cred.user.uid), profile);
    setUserProfile(profile);
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, register, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
