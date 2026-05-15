import React, { useEffect, useLayoutEffect } from 'react';
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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-stone-50 flex flex-col">
              <Navbar />
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
              <Footer />
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
