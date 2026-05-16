import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

const navLinkClass = 'relative px-3 py-2 text-stone-700 transition font-semibold text-sm after:absolute after:left-3 after:right-3 after:-bottom-[13px] after:h-[2px] after:bg-primary-600 after:scale-x-0 after:origin-left after:transition-transform hover:text-stone-950 hover:after:scale-x-100';
const activeMessageClass = 'relative px-3 py-2 text-primary-700 transition font-semibold text-sm after:absolute after:left-3 after:right-3 after:-bottom-[13px] after:h-[2px] after:bg-primary-600 after:scale-x-100';
const mobileMainLinkClass = 'flex items-center justify-between border-b border-stone-100 py-5 text-[26px] font-bold leading-none text-stone-950';
const mobileSubLinkClass = 'block py-3 text-[23px] leading-tight text-stone-800';

const Navbar: React.FC = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount, messageUnreadCount } = useNotifications();
  const profilePhoto = userProfile?.photoURL || currentUser?.photoURL || '';
  const profileName = userProfile?.displayName || currentUser?.displayName || 'User';
  const isAdmin = Boolean(userProfile?.isAdmin);

  const closeMobile = () => setMobileOpen(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setMenuOpen(false);
    setMobileOpen(false);
  };

  const MessageBadge = () => messageUnreadCount > 0 ? (
    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
      {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
    </span>
  ) : null;

  return (
    <nav className="bg-white shadow-sm border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className={`flex items-center ${isAdmin ? 'gap-8' : ''}`}>
            <Link to="/" className="flex items-center shrink-0" aria-label="Reshelved home">
              <img src="/reshelved-logo.svg" alt="Reshelved" className="h-6 w-auto" />
            </Link>

            {isAdmin && (
              <div className="hidden md:flex items-center gap-1">
                <Link to="/" className={navLinkClass}>Home</Link>
                <Link to="/browse" className={navLinkClass}>Browse</Link>
                <a href="/#how-it-works" className={navLinkClass}>How it Works</a>
                {currentUser && <Link to="/messages" className={messageUnreadCount > 0 ? activeMessageClass : navLinkClass}>Messages<MessageBadge /></Link>}
              </div>
            )}
          </div>

          {!isAdmin && (
            <div className="hidden md:flex items-center gap-1">
              <Link to="/" className={navLinkClass}>Home</Link>
              <Link to="/browse" className={navLinkClass}>Browse</Link>
              <a href="/#how-it-works" className={navLinkClass}>How it Works</a>
              {currentUser && <Link to="/messages" className={messageUnreadCount > 0 ? activeMessageClass : navLinkClass}>Messages<MessageBadge /></Link>}
            </div>
          )}

          <div className="hidden md:flex items-center gap-3">
            {currentUser ? (
              <>
                <Link to="/create" className="cursor-pointer px-4 py-2 text-sm font-semibold text-stone-700 border border-[#E8E9E9] rounded-lg hover:bg-stone-50 transition">List a Book</Link>
                {isAdmin && <Link to="/admin" className="cursor-pointer px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition">Admin</Link>}
                <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-stone-100 transition">
                  <i className="las la-bell text-2xl text-stone-600" />
                  {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </Link>
                <div className="relative">
                  <button onClick={() => setMenuOpen(!menuOpen)} className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-stone-100 transition">
                    {profilePhoto ? <img src={profilePhoto} alt={profileName} className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center font-semibold text-sm">{profileName?.[0]?.toUpperCase() || 'U'}</div>}
                    <span className="text-sm font-medium text-stone-700 max-w-[100px] truncate">{profileName}</span>
                    <i className="las la-angle-down text-stone-400" />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-stone-200 py-1 z-50">
                        <Link to="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">My Profile</Link>
                        <Link to="/my-listings" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">My Listings</Link>
                        <Link to="/messages" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Messages {messageUnreadCount > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">{messageUnreadCount}</span>}</Link>
                        <Link to="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Notifications {unreadCount > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">{unreadCount}</span>}</Link>
                        <hr className="my-1 border-stone-100" />
                        <button onClick={handleLogout} className="cursor-pointer w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Log Out</button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/create" className="cursor-pointer px-4 py-2 text-sm font-semibold text-stone-700 border border-[#E8E9E9] rounded-lg hover:bg-stone-50 transition">List a Book</Link>
                <Link to="/register" className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition">Join Free</Link>
              </div>
            )}
          </div>

          <div className="md:hidden flex items-center gap-2">
            {currentUser && <Link to="/messages" className={`relative p-2 rounded-lg transition ${messageUnreadCount > 0 ? 'bg-primary-50' : 'hover:bg-stone-100'}`}><i className={`las la-envelope text-2xl ${messageUnreadCount > 0 ? 'text-primary-700' : 'text-stone-600'}`} /><MessageBadge /></Link>}
            {currentUser && <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-stone-100 transition"><i className="las la-bell text-2xl text-stone-600" />{unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>}</Link>}
            <button className="cursor-pointer p-2 rounded-lg hover:bg-stone-100" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}><i className={`las ${mobileOpen ? 'la-times' : 'la-bars'} text-3xl text-stone-900`} /></button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="px-7 pt-8 pb-10 min-h-full flex flex-col">
            <div className="flex items-center justify-between mb-14">
              <Link to="/" onClick={closeMobile} className="flex items-center" aria-label="Reshelved home">
                <img src="/reshelved-logo.svg" alt="Reshelved" className="h-7 w-auto" />
              </Link>
              <button onClick={closeMobile} className="cursor-pointer p-1 -mr-1 text-stone-950" aria-label="Close menu">
                <i className="las la-times text-5xl leading-none" />
              </button>
            </div>

            <div className="space-y-0">
              <Link to="/browse" onClick={closeMobile} className={mobileMainLinkClass}>Browse <i className="las la-arrow-right text-2xl" /></Link>
              <a href="/#how-it-works" onClick={closeMobile} className={mobileMainLinkClass}>How it Works <i className="las la-arrow-right text-2xl" /></a>
              <Link to="/create" onClick={closeMobile} className={mobileMainLinkClass}>List a Book <i className="las la-arrow-right text-2xl" /></Link>
              {currentUser && <Link to="/messages" onClick={closeMobile} className={mobileMainLinkClass}>Messages <span className="flex items-center gap-2">{messageUnreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{messageUnreadCount > 9 ? '9+' : messageUnreadCount}</span>}<i className="las la-arrow-right text-2xl" /></span></Link>}
              {currentUser && <Link to="/notifications" onClick={closeMobile} className={mobileMainLinkClass}>Notifications <span className="flex items-center gap-2">{unreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}<i className="las la-arrow-right text-2xl" /></span></Link>}
              {isAdmin && <Link to="/admin" onClick={closeMobile} className={mobileMainLinkClass}>Admin <i className="las la-arrow-right text-2xl" /></Link>}
            </div>

            {currentUser && (
              <div className="mt-10 space-y-1">
                <Link to="/profile" onClick={closeMobile} className={mobileSubLinkClass}>My Profile</Link>
                <Link to="/my-listings" onClick={closeMobile} className={mobileSubLinkClass}>My Listings</Link>
                <button onClick={handleLogout} className="cursor-pointer block w-full py-3 text-left text-[23px] leading-tight text-red-600">Log Out</button>
              </div>
            )}

            <div className="mt-auto pt-10 space-y-4">
              {currentUser ? (
                <>
                  <Link to="/create" onClick={closeMobile} className="block w-full rounded-xl bg-primary-600 px-5 py-4 text-center text-2xl font-semibold text-white transition hover:bg-primary-700">List a Book</Link>
                  <Link to="/browse" onClick={closeMobile} className="block w-full rounded-xl border border-stone-950 px-5 py-4 text-center text-2xl font-semibold text-stone-950 transition hover:bg-stone-50">Find Books</Link>
                </>
              ) : (
                <>
                  <Link to="/register" onClick={closeMobile} className="block w-full rounded-xl bg-primary-600 px-5 py-4 text-center text-2xl font-semibold text-white transition hover:bg-primary-700">Join Free</Link>
                  <Link to="/login" onClick={closeMobile} className="block w-full rounded-xl border border-stone-950 px-5 py-4 text-center text-2xl font-semibold text-stone-950 transition hover:bg-stone-50">Log in</Link>
                </>
              )}
              {!currentUser && <Link to="/create" onClick={closeMobile} className="block py-3 text-center text-2xl font-semibold text-stone-950">List a Book</Link>}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
