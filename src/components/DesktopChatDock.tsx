import React from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { useChatDock } from '../contexts/ChatDockContext';
import Messages from '../pages/Messages';

const iconClass = [
  'flex h-9 w-9 items-center justify-center rounded-full',
  'bg-primary-600 text-xl text-white'
].join(' ');

const actionClass = [
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-full',
  'text-xl text-stone-600 transition hover:bg-stone-100'
].join(' ');

const DesktopChatDock: React.FC = () => {
  const navigate = useNavigate();
  const { backgroundLocation, isMinimized, minimize, restore, clear } =
    useChatDock();

  const closeDock = () => {
    const target = backgroundLocation
      ? `${backgroundLocation.pathname}${backgroundLocation.search}`
      : '/browse';

    clear();
    navigate(target, { replace: true });
  };

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={restore}
        className="fixed bottom-6 right-6 z-[70] hidden cursor-pointer
          items-center gap-3 rounded-2xl border border-stone-200 bg-white
          px-4 py-3 text-sm font-bold text-stone-900 shadow-2xl lg:flex"
        aria-label="Restore messages"
      >
        <span className={iconClass}>
          <i className="las la-comments" />
        </span>
        <span>Messages</span>
        <i className="las la-angle-up text-lg text-stone-500" />
      </button>
    );
  }

  return (
    <aside
      className="fixed bottom-5 right-5 z-[70] hidden h-[min(720px,calc(100vh-92px))]
        w-[min(1040px,calc(100vw-40px))] flex-col overflow-hidden rounded-[24px]
        border border-stone-200 bg-white shadow-2xl lg:flex"
      aria-label="Messages window"
    >
      <header className="flex h-14 shrink-0 items-center justify-between
        border-b border-stone-200 bg-white px-5"
      >
        <div className="flex items-center gap-3 font-['Work_Sans']
          text-lg font-bold text-stone-950"
        >
          <span className={iconClass}>
            <i className="las la-comments" />
          </span>
          <span>Chats</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={minimize}
            className={actionClass}
            aria-label="Minimize messages"
          >
            <i className="las la-minus" />
          </button>
          <button
            type="button"
            onClick={closeDock}
            className={actionClass}
            aria-label="Close messages"
          >
            <i className="las la-times" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden [&>div]:flex
        [&>div]:h-full [&>div]:max-w-none [&>div]:flex-col [&>div]:p-0
        [&>div>div:last-child]:h-auto [&>div>div:last-child]:min-h-0
        [&>div>div:last-child]:flex-1 [&>div>div:last-child]:rounded-none
        [&>div>div:last-child]:border-0 [&>div>div:last-child]:shadow-none
        [&_aside]:w-[330px] [&_aside]:min-w-[330px]"
      >
        <Routes>
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
        </Routes>
      </div>
    </aside>
  );
};

export default DesktopChatDock;
