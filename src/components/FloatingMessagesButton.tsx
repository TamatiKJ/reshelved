import React from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

const FloatingMessagesButton: React.FC = () => {
  const { messageUnreadCount } = useNotifications();

  return (
    <Link
      to="/messages"
      className="fixed bottom-24 right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-stone-950 text-white shadow-[0_14px_35px_rgba(28,25,23,0.28)] transition hover:-translate-y-0.5 hover:bg-stone-800 md:bottom-6 md:right-6"
      aria-label="Open messages"
    >
      <i className="las la-comments text-3xl leading-none" />
      {messageUnreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-extrabold leading-none text-white ring-2 ring-white">
          {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
        </span>
      )}
    </Link>
  );
};

export default FloatingMessagesButton;
