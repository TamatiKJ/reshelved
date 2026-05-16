import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Browse from './pages/Browse';
import { Login, Register } from './pages/Auth';
import CreateListing from './pages/CreateListing';
import EditListing from './pages/EditListing';
import ListingDetail from './pages/ListingDetail';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Admin from './pages/AdminUserDashboard';
import Notifications from './pages/Notifications';
import LegalPage from './pages/LegalPage';

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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-stone-500 text-sm">Loading...</span>
        </div>
      </div>
    );
  }
  if (!currentUser) return <Navigate to="/login" />;
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { loading } = useAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname === '/admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <img src="/reshelved-logo.svg" alt="Reshelved" className="h-12 w-auto" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="flex items-center gap-2">
            <svg className="animate-spin w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-stone-500 font-medium">Loading Reshelved...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      <AdminFormFocusKeeper enabled={isAdminRoute} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
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
