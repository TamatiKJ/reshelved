import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

const Navbar: React.FC = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav className="bg-white shadow-sm border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-xl font-bold text-primary-700">Reshelved</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/" className="px-3 py-2 rounded-lg text-stone-600 hover:text-primary-700 hover:bg-primary-50 transition font-medium text-sm">
              Browse
            </Link>
            {currentUser && (
              <>
                <Link to="/create" className="px-3 py-2 rounded-lg text-stone-600 hover:text-primary-700 hover:bg-primary-50 transition font-medium text-sm">
                  List a Book
                </Link>
                <Link to="/messages" className="px-3 py-2 rounded-lg text-stone-600 hover:text-primary-700 hover:bg-primary-50 transition font-medium text-sm">
                  Messages
                </Link>
                {userProfile?.isAdmin && (
                  <Link to="/admin" className="px-3 py-2 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition font-medium text-sm">
                    Admin
                  </Link>
                )}
              </>
            )}
          </div>

          {/* User Section */}
          <div className="hidden md:flex items-center gap-3">
            {currentUser ? (
              <>
                {/* Notification Bell */}
                <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-stone-100 transition">
                  <svg className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-stone-100 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
                      {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-stone-700 max-w-[100px] truncate">
                      {userProfile?.displayName || 'User'}
                    </span>
                    <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-stone-200 py-1 z-50">
                        <Link to="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">My Profile</Link>
                        <Link to="/my-listings" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">My Listings</Link>
                        <Link to="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
                          Notifications
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">{unreadCount}</span>
                          )}
                        </Link>
                        <hr className="my-1 border-stone-100" />
                        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Log Out</button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-primary-700 transition">
                  Log In
                </Link>
                <Link to="/register" className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition">
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-2">
            {currentUser && (
              <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-stone-100 transition">
                <svg className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <button className="p-2 rounded-lg hover:bg-stone-100" onClick={() => setMobileOpen(!mobileOpen)}>
              <svg className="w-6 h-6 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-stone-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            <Link to="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">Browse</Link>
            {currentUser ? (
              <>
                <Link to="/create" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">List a Book</Link>
                <Link to="/messages" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">Messages</Link>
                <Link to="/notifications" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">{unreadCount}</span>
                  )}
                </Link>
                <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">My Profile</Link>
                <Link to="/my-listings" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">My Listings</Link>
                {userProfile?.isAdmin && (
                  <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium">Admin</Link>
                )}
                <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium">Log Out</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">Log In</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-primary-700 bg-primary-50 font-medium">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
