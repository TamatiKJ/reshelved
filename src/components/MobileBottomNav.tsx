import React from 'react';
import { NavLink } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

const badgeClass = 'absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-extrabold leading-none text-white ring-2 ring-white';

const MobileBottomNav: React.FC = () => {
  const { unreadCount, messageUnreadCount } = useNotifications();

  const items = [
    { to: '/browse', label: 'Browse', icon: 'la-search', badge: 0 },
    { to: '/create', label: 'List', icon: 'la-plus-circle', badge: 0 },
    { to: '/messages', label: 'Messages', icon: 'la-comments', badge: messageUnreadCount },
    { to: '/profile', label: 'Profile', icon: 'la-user', badge: unreadCount }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[60] border-t border-stone-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(28,25,23,0.08)] backdrop-blur md:hidden" aria-label="Mobile navigation">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold transition ${isActive ? 'bg-[#FFF4E2] text-primary-600' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}
          >
            <span className="relative flex h-6 w-6 items-center justify-center">
              <i className={`las ${item.icon} text-2xl leading-none`} />
              {item.badge > 0 && <span className={badgeClass}>{item.badge > 9 ? '9+' : item.badge}</span>}
            </span>
            <span className="truncate leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
