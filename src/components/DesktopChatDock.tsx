import React from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
  const location = useLocation();
  const { isMinimized, chatPath, minimize, restore, close } = useChatDock();

  const closeDock = () => {
    const onMessagesRoute = location.pathname.startsWith('/messages');
    close();
    if (onMessagesRoute) {
      navigate('/browse', { replace: true });
    }
  };

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={restore}
        className="fixed bottom-0 right-6 z-[70] hidden cursor-pointer
          items-center gap-3 rounded-t-2xl border border-b-0 border-stone-200
          bg-white px-4 py-3 text-sm font-bold text-stone-900 shadow-2xl
          lg:flex"
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
      className="fixed bottom-0 right-5 z-[70] hidden
        h-[min(590px,calc(100vh-72px))] w-[min(800px,calc(100vw-40px))]
        flex-col overflow-hidden rounded-t-[22px] border border-b-0
        border-stone-200 bg-white shadow-2xl lg:flex"
      aria-label="Messages window"
    >
      <header className="flex shrink-0 items-center justify-between
        border-b border-stone-200 bg-white px-4 py-2.5"
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
      <div className="min-h-0 flex-1 overflow-hidden
        [&>div]:flex [&>div]:h-full [&>div]:max-w-none
        [&>div]:flex-col [&>div]:p-0
        [&>div>div:last-child]:h-auto
        [&>div>div:last-child]:min-h-0
        [&>div>div:last-child]:flex-1
        [&>div>div:last-child]:rounded-none
        [&>div>div:last-child]:border-0
        [&>div>div:last-child]:shadow-none
        [&_aside]:w-[265px] [&_aside]:min-w-[265px]
        [&_aside_h1]:hidden [&_aside_h1+div]:!mt-0"
      >
        <Routes location={chatPath}>
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
        </Routes>
      </div>
    </aside>
  );
};

export default DesktopChatDock;
