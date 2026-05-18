import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { collection, doc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { db } from './firebase';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Browse from './pages/Browse';
import { Login, Register, ForgotPassword } from './pages/Auth';
import CreateListing from './pages/CreateListing';
import EditListing from './pages/EditListing';
import ListingDetail from './pages/ListingDetail';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Admin from './pages/AdminUserDashboardNotifyWrapper';
import Notifications from './pages/Notifications';
import LegalPage from './pages/LegalPage';
import type { Listing } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const safeListingDays = (value: unknown) => Math.max(1, Math.min(45, Number(value) || 10));

const ScrollToTop: React.FC = () => {
  const { pathname, search, key } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';

    const resetScroll = () => {
      window.scrollTo(0, 0);
      html.scrollTop = 0;
      body.scrollTop = 0;
      document.scrollingElement?.scrollTo(0, 0);
    };

    resetScroll();
    requestAnimationFrame(resetScroll);
    window.setTimeout(resetScroll, 0);

    return () => {
      html.style.scrollBehavior = previousScrollBehavior;
    };
  }, [pathname, search, key]);

  return null;
};

type AdminFieldFocus = {
  tagName: string;
  type: string;
  placeholder: string;
  maxLength: string;
  label: string;
  selectionStart: number | null;
  selectionEnd: number | null;
};

const normalizeAdminLabel = (value: string) => value
  .replace(/\d+\s*\/\s*\d+/g, '')
  .replace(/Square SVG or PNG and at least 512 by 512 pixels\./g, '')
  .replace(/days/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const getAdminFieldFocus = (element: Element | null): AdminFieldFocus | null => {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return null;
  const label = normalizeAdminLabel(element.closest('label')?.textContent || '');
  return {
    tagName: element.tagName,
    type: element instanceof HTMLInputElement ? element.type : 'textarea',
    placeholder: element.getAttribute('placeholder') || '',
    maxLength: String(element.getAttribute('maxlength') || ''),
    label,
    selectionStart: element.selectionStart,
    selectionEnd: element.selectionEnd
  };
};

const AdminFormFocusKeeper: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const lastFocusRef = useRef<AdminFieldFocus | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const rememberFocus = () => {
      lastFocusRef.current = getAdminFieldFocus(document.activeElement);
    };

    const restoreFocus = () => {
      const saved = lastFocusRef.current;
      if (!saved) return;
      window.requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
        const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'));
        const target = fields.find((field) => {
          const current = getAdminFieldFocus(field);
          return current &&
            current.tagName === saved.tagName &&
            current.type === saved.type &&
            current.placeholder === saved.placeholder &&
            current.maxLength === saved.maxLength &&
            current.label === saved.label;
        });
        if (!target) return;
        target.focus({ preventScroll: true });
        if (saved.selectionStart !== null && saved.selectionEnd !== null) {
          const nextPosition = Math.min(saved.selectionStart + 1, target.value.length);
          try { target.setSelectionRange(nextPosition, nextPosition); } catch { /* ignore unsupported inputs */ }
        }
      });
    };

    const keepSpaceInField = (event: KeyboardEvent) => {
      const target = event.target;
      if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && event.code === 'Space') {
        event.stopPropagation();
      }
    };

    document.addEventListener('focusin', rememberFocus, true);
    document.addEventListener('keydown', keepSpaceInField, true);
    document.addEventListener('input', () => { rememberFocus(); restoreFocus(); }, true);
    document.addEventListener('keyup', restoreFocus, true);

    return () => {
      document.removeEventListener('focusin', rememberFocus, true);
      document.removeEventListener('keydown', keepSpaceInField, true);
      document.removeEventListener('input', () => { rememberFocus(); restoreFocus(); }, true);
      document.removeEventListener('keyup', restoreFocus, true);
    };
  }, [enabled]);

  return null;
};

const PlatformListingDurationSync: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const previousListingDaysRef = useRef<number | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const unsubscribe = onSnapshot(doc(db, 'platform', 'settings'), async (snapshot) => {
      if (!snapshot.exists() || syncingRef.current) return;

      const nextListingDays = safeListingDays(snapshot.data().listingDays);
      const previousListingDays = previousListingDaysRef.current;
      previousListingDaysRef.current = nextListingDays;

      if (previousListingDays === null || nextListingDays <= previousListingDays) return;

      syncingRef.current = true;
      try {
        const now = Date.now();
        const listingSnap = await getDocs(collection(db, 'listings'));
        const updates: Array<Promise<void>> = [];
        const updatedListings: Listing[] = [];

        listingSnap.forEach((item) => {
          const listing = { id: item.id, ...item.data() } as Listing;
          if (!listing.active || !listing.createdAt || !listing.expiresAt || listing.expiresAt <= now) return;

          const extendedExpiresAt = listing.createdAt + nextListingDays * DAY_MS;
          if (extendedExpiresAt <= listing.expiresAt) return;

          updatedListings.push({ ...listing, expiresAt: extendedExpiresAt });
          updates.push(updateDoc(doc(db, 'listings', item.id), {
            expiresAt: extendedExpiresAt,
            listingDays: nextListingDays,
            durationAdjustedAt: now
          }));
        });

        if (updates.length > 0) {
          await Promise.all(updates);
          window.dispatchEvent(new CustomEvent('reshelved:listings-duration-updated', { detail: { listingDays: nextListingDays, count: updates.length, listings: updatedListings } }));
        }
      } catch (error) {
        console.error('Listing duration sync failed:', error);
      } finally {
        syncingRef.current = false;
      }
    });

    return unsubscribe;
  }, [enabled]);

  return null;
};

const RangeInputStyleSync: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  useEffect(() => {
    if (!enabled) return undefined;

    const paintRange = (range: HTMLInputElement) => {
      const min = Number(range.min || 0);
      const max = Number(range.max || 100);
      const value = Number(range.value || min);
      const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
      range.style.background = `linear-gradient(90deg, #1665CC 0%, #1665CC ${percent}%, #e7e5e4 ${percent}%, #e7e5e4 100%)`;
    };

    const paintAllRanges = () => {
      document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(paintRange);
    };

    const handleInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'range') paintRange(target);
    };

    paintAllRanges();
    const observer = new MutationObserver(() => paintAllRanges());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
    };
  }, [enabled]);

  return null;
};

const SettingsSavedModal: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const showModal = () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setVisible(true);
      timeoutRef.current = window.setTimeout(() => setVisible(false), 1500);
    };

    const checkToastText = () => {
      const bodyText = document.body.innerText || '';
      if (bodyText.includes('Platform settings saved.')) showModal();
    };

    const observer = new MutationObserver(checkToastText);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [enabled]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl ring-1 ring-black/5">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#FFF4E2] ring-1 ring-[#F7AF31]/30">
          <svg viewBox="0 0 96 96" className="h-20 w-20" role="img" aria-label="Settings saved illustration">
            <circle cx="48" cy="48" r="34" fill="#ffffff" stroke="#1665CC" strokeWidth="4" />
            <path d="M31 49.5L42.5 61L66.5 36.5" fill="none" stroke="#FF5F57" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="25" cy="27" r="4" fill="#F7AF31" />
            <circle cx="73" cy="69" r="5" fill="#F7AF31" />
            <path d="M70 23l6 3-6 3-3 6-3-6-6-3 6-3 3-6 3 6z" fill="#1665CC" opacity="0.9" />
          </svg>
        </div>
        <h3 className="mt-4 text-xl font-bold text-stone-950">Settings saved</h3>
        <p className="mt-2 text-sm leading-6 text-stone-500">Your platform settings have been updated successfully.</p>
      </div>
    </div>
  );
};

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center px-5">
    <div className="flex flex-col items-center gap-3 p-5">
      <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-stone-500 text-sm">Loading...</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (currentUser) return <Navigate to="/browse" replace />;
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { loading, userProfile } = useAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname === '/admin';
  const isAdminEnabled = isAdminRoute && Boolean(userProfile?.isAdmin);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-5">
        <div className="flex w-full max-w-[220px] flex-col items-center gap-4 p-5">
          <img src="/reshelved-logo.svg" alt="Reshelved" className="w-[180px] max-w-full h-auto" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="flex items-center gap-2">
            <svg className="animate-spin w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-stone-500 font-medium whitespace-nowrap">Loading Reshelved...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      <AdminFormFocusKeeper enabled={isAdminEnabled} />
      <PlatformListingDurationSync enabled={isAdminEnabled} />
      <RangeInputStyleSync enabled={isAdminEnabled} />
      <SettingsSavedModal enabled={isAdminEnabled} />
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-stone-50 flex flex-col">
              {!isAdminRoute && <Navbar />}
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/listing/:id" element={<ListingDetail />} />
                  <Route path="/listing/:id/edit" element={<ProtectedRoute><EditListing /></ProtectedRoute>} />
                  <Route path="/user/:userId" element={<Profile />} />
                  <Route path="/create" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
                  <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                  <Route path="/messages/:conversationId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/my-listings" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  <Route path="/privacy-policy" element={<LegalPage slug="privacy-policy" />} />
                  <Route path="/terms" element={<LegalPage slug="terms" />} />
                  <Route path="/cookies" element={<LegalPage slug="cookies" />} />
                  <Route path="/contact" element={<LegalPage slug="contact" />} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                </Routes>
              </main>
              {!isAdminRoute && <Footer />}
            </div>
          }
        />
      </Routes>
    </>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
