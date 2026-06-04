import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { collection, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { db } from './firebase';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import MobileBottomNav from './components/MobileBottomNav';
import FloatingMessagesButton from './components/FloatingMessagesButton';
import AdminUploadedMediaBridge from './components/AdminUploadedMediaBridge';
import Home from './pages/Home';
import Browse from './pages/Browse';
import HowItWorks from './pages/HowItWorks';
import { Login, Register, ForgotPassword, VerifyEmail, SetPassword } from './pages/Auth';
import CreateListing from './pages/CreateListing';
import EditListing from './pages/EditListing';
import ListingDetail from './pages/ListingDetail';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Admin from './pages/AdminUserDashboardNotifyWrapper';
import AdminListingCategories from './pages/AdminListingCategories';
import Notifications from './pages/Notifications';
import LegalPage from './pages/LegalPage';
import type { Listing } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const safeListingDays = (value: unknown) => Math.max(1, Math.min(45, Number(value) || 10));
const normalizeReviewAuthorName = (name?: string, deleted?: boolean) => deleted || name === 'Deleted account' ? 'Deleted User' : (name?.trim() || 'Deleted User');

const getPageScopeClass = (pathname: string) => {
  if (pathname === '/' || pathname.startsWith('/browse')) return 'page-home';
  if (pathname.startsWith('/create')) return 'page-create-listing';
  if (pathname.startsWith('/messages')) return 'page-messages';
  if (pathname.startsWith('/profile') || pathname.startsWith('/my-listings') || pathname.startsWith('/user/')) return 'page-profile';
  if (pathname.startsWith('/admin')) return 'page-admin';
  if (pathname.startsWith('/listing/')) return 'page-listing-detail';
  if (pathname.startsWith('/how-it-works')) return 'page-how-it-works';
  return 'page-content';
};

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

const ReviewAuthorNameSync: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const syncingRef = useRef(false);

  const syncCurrentUserReviews = async (forcedName?: string) => {
    if (!currentUser?.uid || syncingRef.current || !currentUser.emailVerified || userProfile?.onboardingStatus !== 'complete') return;
    const nextName = normalizeReviewAuthorName(forcedName || userProfile?.displayName, userProfile?.deactivated);
    syncingRef.current = true;
    try {
      const ratingsSnap = await getDocs(query(collection(db, 'ratings'), where('fromUserId', '==', currentUser.uid)));
      await Promise.all(ratingsSnap.docs.map((item) => {
        const data = item.data();
        if (data.fromUserName === nextName) return Promise.resolve();
        return updateDoc(doc(db, 'ratings', item.id), { fromUserName: nextName, fromUserNameSyncedAt: Date.now() }).catch(() => undefined);
      }));
    } catch (error) {
      console.error('Review author name sync failed:', error);
    } finally {
      syncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!currentUser?.uid || !currentUser.emailVerified || userProfile?.onboardingStatus !== 'complete') return;
    syncCurrentUserReviews();
  }, [currentUser?.uid, currentUser?.emailVerified, userProfile?.onboardingStatus, userProfile?.displayName, userProfile?.deactivated]);

  useEffect(() => {
    if (!currentUser?.uid || !currentUser.emailVerified || userProfile?.onboardingStatus !== 'complete') return undefined;

    const handleDeleteClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const button = target.closest('button');
      if (!button) return;
      if ((button.textContent || '').trim() !== 'Delete my account') return;
      syncCurrentUserReviews('Deleted User');
    };

    document.addEventListener('click', handleDeleteClick, true);
    return () => document.removeEventListener('click', handleDeleteClick, true);
  }, [currentUser?.uid, currentUser?.emailVerified, userProfile?.onboardingStatus, userProfile?.displayName]);

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
  const { currentUser, userProfile, loading } = useAuth();
  if (loading || (currentUser && !userProfile)) return <LoadingScreen />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (userProfile?.onboardingStatus !== 'complete') return <Navigate to="/auth/verify" replace />;
  return <>{children}</>;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile, loading } = useAuth();
  if (loading || (currentUser && !userProfile)) return <LoadingScreen />;
  if (currentUser) return <Navigate to={userProfile?.onboardingStatus === 'complete' ? '/browse' : '/auth/verify'} replace />;
  return <>{children}</>;
};

const VerifyEmailRoute: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();
  if (loading || (currentUser && !userProfile)) return <LoadingScreen />;
  if (!currentUser) return <VerifyEmail />;
  if (userProfile?.onboardingStatus === 'complete') return <Navigate to="/browse" replace />;
  if (userProfile?.onboardingStatus === 'password_required') return <VerifyEmail />;
  return <Navigate to="/login" replace />;
};

const AppContent: React.FC = () => {
  const { currentUser, loading, userProfile } = useAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isFullyOnboarded = Boolean(currentUser && userProfile?.onboardingStatus === 'complete');
  const isAdminEnabled = isAdminRoute && Boolean(userProfile?.isAdmin) && isFullyOnboarded;
  const isMessagesRoute = location.pathname.startsWith('/messages');
  const isOpenChatRoute = /^\/messages\/[^/]+/.test(location.pathname);
  const isListingEditRoute = location.pathname.startsWith('/listing/') && location.pathname.endsWith('/edit');
  const hideMobileBottomNav = isAdminRoute || isOpenChatRoute || isListingEditRoute;
  const shouldShowMobileBottomNav = isFullyOnboarded && !hideMobileBottomNav;
  const shouldShowFloatingMessages = isFullyOnboarded && !isAdminRoute && !isMessagesRoute && !isListingEditRoute;
  const pageScopeClass = getPageScopeClass(location.pathname);

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
      <ReviewAuthorNameSync />
      <PlatformListingDurationSync enabled={isAdminEnabled} />
      {isAdminEnabled && <AdminUploadedMediaBridge />}
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
        <Route path="/auth/verify" element={<VerifyEmailRoute />} />
        <Route path="/verify-email" element={<Navigate to="/auth/verify" replace />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route
          path="*"
          element={
            <div className={`app-shell min-h-screen bg-stone-50 flex flex-col ${isMessagesRoute ? 'max-md:h-[100dvh] max-md:min-h-0 max-md:overflow-hidden' : shouldShowMobileBottomNav ? 'max-md:pb-24' : ''}`}>
              {!isAdminRoute && <Navbar />}
              <main className={`app-page ${pageScopeClass} flex-1 ${isMessagesRoute ? 'max-md:min-h-0 max-md:overflow-hidden' : ''}`}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
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
                  <Route path="/admin/listing-categories" element={<ProtectedRoute><AdminListingCategories /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                </Routes>
              </main>
              {!isAdminRoute && !isMessagesRoute && <Footer />}
              {shouldShowMobileBottomNav && <MobileBottomNav />}
              {shouldShowFloatingMessages && <FloatingMessagesButton />}
            </div>
          }
        />
      </Routes>
    </>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
