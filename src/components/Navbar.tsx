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
          <Link to="/" className="flex items-center shrink-0" aria-label="Reshelved home">
            <img src="/reshelved-logo.svg" alt="Reshelved" className="h-7 w-auto" />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link to="/" className="px-3 py-2 rounded-lg text-stone-600 hover:text-primary-700 hover:bg-primary-50 transition font-medium text-sm">Home</Link>
            <Link to="/browse" className="px-3 py-2 rounded-lg text-stone-600 hover:text-primary-700 hover:bg-primary-50 transition font-medium text-sm">Browse</Link>
            <a href="/#how-it-works" className="px-3 py-2 rounded-lg text-stone-600 hover:text-primary-700 hover:bg-primary-50 transition font-medium text-sm">How it Works</a>
            {currentUser && (
              <>
                <Link to="/messages" className="px-3 py-2 rounded-lg text-stone-600 hover:text-primary-700 hover:bg-primary-50 transition font-medium text-sm">Messages</Link>
                {userProfile?.isAdmin && <Link to="/admin" className="px-3 py-2 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition font-medium text-sm">Admin</Link>}
              </>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {currentUser ? (
              <>
                <Link to="/create" className="px-4 py-2 text-sm font-semibold text-stone-700 border border-[#E8E9E9] rounded-lg hover:bg-stone-50 transition">List a Book</Link>
                <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-stone-100 transition">
                  <i className="las la-bell text-2xl text-stone-600" />
                  {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </Link>
                <div className="relative">
                  <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-stone-100 transition">
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt={userProfile.displayName || 'User'} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center font-semibold text-sm">{userProfile?.displayName?.[0]?.toUpperCase() || 'U'}</div>
                    )}
                    <span className="text-sm font-medium text-stone-700 max-w-[100px] truncate">{userProfile?.displayName || 'User'}</span>
                    <i className="las la-angle-down text-stone-400" />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-stone-200 py-1 z-50">
                        <Link to="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">My Profile</Link>
                        <Link to="/my-listings" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">My Listings</Link>
                        <Link to="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Notifications {unreadCount > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">{unreadCount}</span>}</Link>
                        <hr className="my-1 border-stone-100" />
                        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Log Out</button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/create" className="px-4 py-2 text-sm font-semibold text-stone-700 border border-[#E8E9E9] rounded-lg hover:bg-stone-50 transition">List a Book</Link>
                <Link to="/register" className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition">Join Free</Link>
              </div>
            )}
          </div>

          <div className="md:hidden flex items-center gap-2">
            {currentUser && <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-stone-100 transition"><i className="las la-bell text-2xl text-stone-600" />{unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>}</Link>}
            <button className="p-2 rounded-lg hover:bg-stone-100" onClick={() => setMobileOpen(!mobileOpen)}>
              <i className={`las ${mobileOpen ? 'la-times' : 'la-bars'} text-2xl text-stone-600`} />
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-stone-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            <Link to="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">Home</Link>
            <Link to="/browse" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">Browse</Link>
            <a href="/#how-it-works" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">How it Works</a>
            <Link to="/create" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-primary-700 hover:bg-primary-50 font-medium">List a Book</Link>
            {currentUser ? (
              <>
                <Link to="/messages" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">Messages</Link>
                <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">My Profile</Link>
                <Link to="/my-listings" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-stone-700 hover:bg-primary-50 font-medium">My Listings</Link>
                {userProfile?.isAdmin && <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium">Admin</Link>}
                <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium">Log Out</button>
              </>
            ) : (
              <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-white bg-primary-600 font-medium">Join Free</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
