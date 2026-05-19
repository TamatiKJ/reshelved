import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

const navLinkClass = 'relative px-3 py-2 text-stone-700 transition font-semibold text-sm after:absolute after:left-3 after:right-3 after:-bottom-[13px] after:h-[2px] after:bg-primary-600 after:scale-x-0 after:origin-left after:transition-transform hover:text-stone-950 hover:after:scale-x-100';
const mobileMainLinkClass = 'flex items-center justify-between border-b border-[#E8E9E9] py-4 text-[18px] font-bold leading-none text-stone-950 font-[Work_Sans]';
const mobileSubLinkClass = 'flex items-center gap-3 py-2.5 text-[16px] leading-tight text-stone-800 font-[Inter]';
const redBadgeClass = 'flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white';

const Navbar: React.FC = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const { unreadCount, messageUnreadCount } = useNotifications();
  const profilePhoto = userProfile?.photoURL || currentUser?.photoURL || '';
  const profileName = userProfile?.displayName || currentUser?.displayName || 'User';
  const isAdmin = Boolean(userProfile?.isAdmin);

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    document.body.classList.toggle('reshelved-mobile-menu-open', mobileOpen);
    return () => document.body.classList.remove('reshelved-mobile-menu-open');
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setMenuOpen(false);
    setMobileOpen(false);
  };

  const handleHeaderSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = headerSearch.trim();
    if (!value) return;
    navigate(`/browse?search=${encodeURIComponent(value)}&scope=book`);
    setHeaderSearch('');
  };

  const closeProfileMenu = () => setMenuOpen(false);
  const openProfileMenu = () => setMenuOpen(true);

  const handleProfileMenuBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      closeProfileMenu();
    }
  };

  const CountBadge = ({ count }: { count: number }) => count > 0 ? (
    <span className={redBadgeClass}>{count > 9 ? '9+' : count}</span>
  ) : null;

  return (
    <nav className="bg-white shadow-sm border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link to="/" className="flex items-center shrink-0 max-md:w-[40%]" aria-label="Reshelved home">
              <img src="/reshelved-logo.svg" alt="Reshelved" className="h-6 w-auto max-md:h-auto max-md:w-full" />
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <Link to="/" className={navLinkClass}>Home</Link>
              <Link to="/browse" className={navLinkClass}>Browse</Link>
              <a href="/#how-it-works" className={navLinkClass}>How it Works</a>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <form onSubmit={handleHeaderSearch} className="relative hidden lg:block">
              <i className="las la-search absolute left-4 top-1/2 -translate-y-1/2 text-xl text-stone-950 pointer-events-none" />
              <input
                type="search"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                placeholder="Search title or author..."
                aria-label="Search book titles and authors"
                className="w-[270px] rounded-lg border border-[#D6D8DA] bg-white py-2 pl-11 pr-4 text-sm font-semibold text-stone-950 placeholder:text-stone-500 outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10"
              />
            </form>
            {currentUser ? (
              <>
                <Link to="/create" className="cursor-pointer px-4 py-2 text-sm font-semibold text-stone-700 border border-[#D6D8DA] rounded-lg hover:bg-stone-50 transition">List a Book</Link>
                {isAdmin && <Link to="/admin" className="cursor-pointer px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition">Admin</Link>}
                <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-stone-100 transition">
                  <i className="las la-bell text-2xl text-stone-600" />
                  {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </Link>
                <div
                  className="relative py-3 -my-3"
                  onMouseEnter={openProfileMenu}
                  onMouseLeave={closeProfileMenu}
                  onFocus={openProfileMenu}
                  onBlur={handleProfileMenuBlur}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-stone-100 transition"
                  >
                    {profilePhoto ? <img src={profilePhoto} alt={profileName} className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center font-semibold text-sm">{profileName?.[0]?.toUpperCase() || 'U'}</div>}
                    <span className="text-sm font-medium text-stone-700 max-w-[100px] truncate">{profileName}</span>
                    <i className="las la-angle-down text-stone-400" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-[calc(100%-12px)] w-56 bg-white rounded-xl shadow-lg border border-stone-200 py-1 z-50" role="menu">
                      <Link to="/profile" onClick={closeProfileMenu} className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50" role="menuitem"><i className="las la-user text-lg text-stone-500" />My Profile</Link>
                      <Link to="/my-listings" onClick={closeProfileMenu} className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50" role="menuitem"><i className="las la-book text-lg text-stone-500" />My Listings</Link>
                      <Link to="/messages" onClick={closeProfileMenu} className="flex items-center justify-between px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50" role="menuitem"><span className="flex items-center gap-3"><i className="las la-comments text-lg text-stone-500" />Messages</span><CountBadge count={messageUnreadCount} /></Link>
                      <Link to="/notifications" onClick={closeProfileMenu} className="flex items-center justify-between px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50" role="menuitem"><span className="flex items-center gap-3"><i className="las la-bell text-lg text-stone-500" />Notifications</span><CountBadge count={unreadCount} /></Link>
                      <hr className="my-1 border-stone-100" />
                      <button onClick={handleLogout} className="cursor-pointer flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50" role="menuitem"><i className="las la-sign-out-alt text-lg" />Log Out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/create" className="cursor-pointer px-4 py-2 text-sm font-semibold text-stone-700 border border-[#D6D8DA] rounded-lg hover:bg-stone-50 transition">List a Book</Link>
                <Link to="/register" className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition">Join Free</Link>
              </div>
            )}
          </div>
          <div className="md:hidden flex items-center gap-2">
            {currentUser && <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-stone-100 transition"><i className="las la-bell text-2xl text-stone-600" />{unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>}</Link>}
            <button className="cursor-pointer p-2 rounded-lg hover:bg-stone-100" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}><i className={`las ${mobileOpen ? 'la-times' : 'la-bars'} text-3xl text-stone-900`} /></button>
          </div>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[10000] bg-white overflow-y-auto">
          <div className="p-5 min-h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <Link to="/" onClick={closeMobile} className="flex items-center w-[40%]" aria-label="Reshelved home">
                <img src="/reshelved-logo.svg" alt="Reshelved" className="w-full h-auto" />
              </Link>
              <button onClick={closeMobile} className="cursor-pointer p-1 -mr-1 text-stone-950" aria-label="Close menu"><i className="las la-times text-[20px] leading-none" /></button>
            </div>
            <div className="space-y-0">
              <Link to="/browse" onClick={closeMobile} className={mobileMainLinkClass}>Browse <i className="las la-angle-right text-xl" /></Link>
              <a href="/#how-it-works" onClick={closeMobile} className={mobileMainLinkClass}>How it Works <i className="las la-angle-right text-xl" /></a>
              <Link to="/create" onClick={closeMobile} className={mobileMainLinkClass}>List a Book <i className="las la-angle-right text-xl" /></Link>
              {currentUser && <Link to="/messages" onClick={closeMobile} className={mobileMainLinkClass}>Messages <span className="flex items-center gap-2"><CountBadge count={messageUnreadCount} /><i className="las la-angle-right text-xl" /></span></Link>}
              {currentUser && <Link to="/notifications" onClick={closeMobile} className={mobileMainLinkClass}>Notifications <span className="flex items-center gap-2">{unreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}<i className="las la-angle-right text-xl" /></span></Link>}
              {isAdmin && <Link to="/admin" onClick={closeMobile} className={mobileMainLinkClass}>Admin <i className="las la-angle-right text-xl" /></Link>}
            </div>
            {currentUser && (
              <div className="mt-4 space-y-1">
                <Link to="/profile" onClick={closeMobile} className={mobileSubLinkClass}><i className="las la-user text-xl text-stone-600" /> My Profile</Link>
                <Link to="/my-listings" onClick={closeMobile} className={mobileSubLinkClass}><i className="las la-book text-xl text-stone-600" /> My Listings</Link>
                <button onClick={handleLogout} className="cursor-pointer flex w-full items-center gap-3 py-2.5 text-left text-[16px] leading-tight text-red-600 font-[Inter]"><i className="las la-sign-out-alt text-xl" /> Log Out</button>
              </div>
            )}
            <div className="mt-[30px] space-y-3">
              {currentUser ? (
                <>
                  <Link to="/create" onClick={closeMobile} className="block w-full rounded-xl bg-primary-600 px-5 py-3 text-center text-[16px] font-semibold text-white transition hover:bg-primary-700">List a Book</Link>
                  <Link to="/browse" onClick={closeMobile} className="block w-full rounded-xl border border-stone-950 px-5 py-2.5 text-center text-[16px] font-semibold text-stone-950 transition hover:bg-stone-50">Find Books</Link>
                </>
              ) : (
                <>
                  <Link to="/register" onClick={closeMobile} className="block w-full rounded-xl bg-primary-600 px-5 py-3 text-center text-[16px] font-semibold text-white transition hover:bg-primary-700">Join Free</Link>
                  <Link to="/browse" onClick={closeMobile} className="block w-full rounded-xl border border-stone-950 px-5 py-2.5 text-center text-[16px] font-semibold text-stone-950 transition hover:bg-stone-50">Find Books</Link>
                  <Link to="/login" onClick={closeMobile} className="block py-2 text-center text-[16px] font-semibold text-[#00BFCC]">Log in</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
