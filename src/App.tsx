import React, { useEffect, useLayoutEffect, useRef } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatDockProvider, useChatDock } from './contexts/ChatDockContext';
import { db } from './firebase';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import MobileBottomNav from './components/MobileBottomNav';
import DesktopChatDock from './components/DesktopChatDock';
import Home from './pages/Home';
import Browse from './pages/Browse';
import { Login, Register, ForgotPassword } from './pages/Auth';
import CreateListing from './pages/CreateListing';
import EditListing from './pages/EditListing';
import ListingDetail from './pages/ListingDetail';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Admin from './pages/AdminUserDashboardNotifyWrapper';
import AdminListingCategories from './pages/AdminListingCategories';
import Notifications from './pages/Notifications';
import LegalPage from './pages/LegalPage';
import { useDesktopMedia } from './hooks/useDesktopMedia';
import type { Listing } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const safeListingDays = (value: unknown) => (
  Math.max(1, Math.min(45, Number(value) || 10))
);
const normalizeReviewAuthorName = (name?: string, deleted?: boolean) => (
  deleted || name === 'Deleted account'
    ? 'Deleted User'
    : (name?.trim() || 'Deleted User')
);

const getPageScopeClass = (pathname: string) => {
  if (pathname === '/' || pathname.startsWith('/browse')) return 'page-home';
  if (pathname.startsWith('/create')) return 'page-create-listing';
  if (pathname.startsWith('/messages')) return 'page-messages';
  if (
    pathname.startsWith('/profile')
    || pathname.startsWith('/my-listings')
    || pathname.startsWith('/user/')
  ) return 'page-profile';
  if (pathname.startsWith('/admin')) return 'page-admin';
  if (pathname.startsWith('/listing/')) return 'page-listing-detail';
  return 'page-content';
};

const ScrollToTop: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const location = useLocation();
  const { pathname, search, key } = location;
  const preserveScroll = Boolean(
    (location.state as { preserveScroll?: boolean } | null)?.preserveScroll
  );

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    if (disabled || preserveScroll) return undefined;

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
  }, [disabled, preserveScroll, pathname, search, key]);

  return null;
};

const ReviewAuthorNameSync: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const syncingRef = useRef(false);

  const syncCurrentUserReviews = async (forcedName?: string) => {
    if (!currentUser?.uid || syncingRef.current) return;
    const nextName = normalizeReviewAuthorName(
      forcedName || userProfile?.displayName,
      userProfile?.deactivated
    );
    syncingRef.current = true;
    try {
      const ratingsSnap = await getDocs(
        query(collection(db, 'ratings'), where('fromUserId', '==', currentUser.uid))
      );
      await Promise.all(ratingsSnap.docs.map((item) => {
        const data = item.data();
        if (data.fromUserName === nextName) return Promise.resolve();
        return updateDoc(doc(db, 'ratings', item.id), {
          fromUserName: nextName,
          fromUserNameSyncedAt: Date.now()
        }).catch(() => undefined);
      }));
    } catch (error) {
      console.error('Review author name sync failed:', error);
    } finally {
      syncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!currentUser?.uid || !userProfile) return;
    syncCurrentUserReviews();
  }, [currentUser?.uid, userProfile?.displayName, userProfile?.deactivated]);

  useEffect(() => {
    if (!currentUser?.uid) return undefined;

    const handleDeleteClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const button = target.closest('button');
      if (!button) return;
      if ((button.textContent || '').trim() !== 'Delete my account') return;
      syncCurrentUserReviews('Deleted User');
    };

    document.addEventListener('click', handleDeleteClick, true);
    return () => document.removeEventListener('click', handleDeleteClick, true);
  }, [currentUser?.uid, userProfile?.displayName]);

  return null;
};

const PlatformListingDurationSync: React.FC<{ enabled: boolean }> = ({
  enabled
}) => {
  const previousListingDaysRef = useRef<number | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const unsubscribe = onSnapshot(
      doc(db, 'platform', 'settings'),
      async (snapshot) => {
        if (!snapshot.exists() || syncingRef.current) return;

        const nextListingDays = safeListingDays(snapshot.data().listingDays);
        const previousListingDays = previousListingDaysRef.current;
        previousListingDaysRef.current = nextListingDays;

        if (
          previousListingDays === null
          || nextListingDays <= previousListingDays
        ) return;

        syncingRef.current = true;
        try {
          const now = Date.now();
          const listingSnap = await getDocs(collection(db, 'listings'));
          const updates: Array<Promise<void>> = [];
          const updatedListings: Listing[] = [];

          listingSnap.forEach((item) => {
            const listing = { id: item.id, ...item.data() } as Listing;
            if (
              !listing.active
              || !listing.createdAt
              || !listing.expiresAt
              || listing.expiresAt <= now
            ) return;

            const extendedExpiresAt = (
              listing.createdAt + nextListingDays * DAY_MS
            );
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
            window.dispatchEvent(new CustomEvent(
              'reshelved:listings-duration-updated',
              {
                detail: {
                  listingDays: nextListingDays,
                  count: updates.length,
                  listings: updatedListings
                }
              }
            ));
          }
        } catch (error) {
          console.error('Listing duration sync failed:', error);
        } finally {
          syncingRef.current = false;
        }
      }
    );

    return unsubscribe;
  }, [enabled]);

  return null;
};

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center px-5">
    <div className="flex flex-col items-center gap-3 p-5">
      <svg
        className="animate-spin w-8 h-8 text-primary-600"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="text-stone-500 text-sm">Loading...</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (currentUser) return <Navigate to="/browse" replace />;
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { currentUser, loading, userProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useDesktopMedia();
  const { isOpen, open } = useChatDock();
  const previousPageRef = useRef<typeof location | null>(null);
  const isMessagesRoute = location.pathname.startsWith('/messages');
  const isDesktopMessageEntry = Boolean(
    currentUser && isDesktop && isMessagesRoute
  );

  if (!isMessagesRoute) {
    previousPageRef.current = location;
  }

  const fallbackPage = {
    ...location,
    pathname: '/browse',
    search: '',
    hash: '',
    state: null,
    key: 'desktop-chat-background'
  };
  const underlyingLocation = previousPageRef.current || fallbackPage;
  const renderedLocation = isDesktopMessageEntry
    ? underlyingLocation
    : location;
  const renderedPath = renderedLocation.pathname;
  const isAdminRoute = renderedPath.startsWith('/admin');
  const isAdminEnabled = isAdminRoute && Boolean(userProfile?.isAdmin);
  const isFullPageMessages = isMessagesRoute && !isDesktop;
  const isOpenChatRoute = /^\/messages\/[^/]+/.test(location.pathname);
  const hideMobileBottomNav = (
    isAdminRoute
    || isOpenChatRoute
    || (
      renderedPath.startsWith('/listing/')
      && renderedPath.endsWith('/edit')
    )
  );
  const pageScopeClass = getPageScopeClass(renderedPath);
  const showDesktopDock = Boolean(currentUser && isDesktop && isOpen);

  useEffect(() => {
    if (!currentUser || !isDesktop) return undefined;

    const openMessageLinkInDock = (event: MouseEvent) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
        || event.altKey
      ) return;

      const target = event.target as HTMLElement;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;

      const url = new URL(anchor.href, window.location.origin);
      if (
        url.origin !== window.location.origin
        || !url.pathname.startsWith('/messages')
      ) return;

      event.preventDefault();
      event.stopPropagation();
      open(`${url.pathname}${url.search}`);
    };

    document.addEventListener('click', openMessageLinkInDock, true);
    return () => {
      document.removeEventListener('click', openMessageLinkInDock, true);
    };
  }, [currentUser, isDesktop, open]);

  useEffect(() => {
    if (!isDesktopMessageEntry) return;
    open(`${location.pathname}${location.search}`);
    const target = `${underlyingLocation.pathname}${underlyingLocation.search}${underlyingLocation.hash}`;
    navigate(target, {
      replace: true,
      state: { preserveScroll: true }
    });
  }, [
    isDesktopMessageEntry,
    location.pathname,
    location.search,
    underlyingLocation.pathname,
    underlyingLocation.search,
    underlyingLocation.hash,
    open,
    navigate
  ]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-5">
        <div className="flex w-full max-w-[220px] flex-col items-center gap-4 p-5">
          <img
            src="/reshelved-logo.svg"
            alt="Reshelved"
            className="w-[180px] max-w-full h-auto"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
          <div className="flex items-center gap-2">
            <svg
              className="animate-spin w-5 h-5 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-stone-500 font-medium whitespace-nowrap">
              Loading Reshelved...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollToTop disabled={isDesktopMessageEntry} />
      <ReviewAuthorNameSync />
      <PlatformListingDurationSync enabled={isAdminEnabled} />
      <Routes>
        <Route
          path="/login"
          element={<PublicOnlyRoute><Login /></PublicOnlyRoute>}
        />
        <Route path="/register" element={<Register />} />
        <Route
          path="/forgot-password"
          element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>}
        />
        <Route
          path="*"
          element={
            <div className={`app-shell min-h-screen bg-stone-50 flex flex-col ${isFullPageMessages ? 'max-md:h-[100dvh] max-md:min-h-0 max-md:overflow-hidden' : 'max-md:pb-24'}`}>
              {!isAdminRoute && <Navbar />}
              <main className={`app-page ${pageScopeClass} flex-1 ${isFullPageMessages ? 'max-md:min-h-0 max-md:overflow-hidden' : ''}`}>
                <Routes location={renderedLocation}>
                  <Route path="/" element={<Home />} />
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/listing/:id" element={<ListingDetail />} />
                  <Route
                    path="/listing/:id/edit"
                    element={<ProtectedRoute><EditListing /></ProtectedRoute>}
                  />
                  <Route path="/user/:userId" element={<Profile />} />
                  <Route
                    path="/create"
                    element={<ProtectedRoute><CreateListing /></ProtectedRoute>}
                  />
                  <Route
                    path="/messages"
                    element={<ProtectedRoute><Messages /></ProtectedRoute>}
                  />
                  <Route
                    path="/messages/:conversationId"
                    element={<ProtectedRoute><Messages /></ProtectedRoute>}
                  />
                  <Route
                    path="/profile"
                    element={<ProtectedRoute><Profile /></ProtectedRoute>}
                  />
                  <Route
                    path="/my-listings"
                    element={<ProtectedRoute><Profile /></ProtectedRoute>}
                  />
                  <Route
                    path="/notifications"
                    element={<ProtectedRoute><Notifications /></ProtectedRoute>}
                  />
                  <Route path="/privacy-policy" element={<LegalPage slug="privacy-policy" />} />
                  <Route path="/terms" element={<LegalPage slug="terms" />} />
                  <Route path="/cookies" element={<LegalPage slug="cookies" />} />
                  <Route path="/contact" element={<LegalPage slug="contact" />} />
                  <Route
                    path="/admin/listing-categories"
                    element={
                      <ProtectedRoute><AdminListingCategories /></ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={<ProtectedRoute><Admin /></ProtectedRoute>}
                  />
                </Routes>
              </main>
              {!isAdminRoute && !isFullPageMessages && <Footer />}
              {!hideMobileBottomNav && <MobileBottomNav />}
              {showDesktopDock && <DesktopChatDock />}
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
        <ChatDockProvider>
          <AppContent />
        </ChatDockProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
