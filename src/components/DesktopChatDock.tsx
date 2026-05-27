import React from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { useChatDock } from '../contexts/ChatDockContext';
import Messages from '../pages/Messages';
import './DesktopChatDock.css';

const DesktopChatDock: React.FC = () => {
  const navigate = useNavigate();
  const { backgroundLocation, isMinimized, minimize, restore, clear } = useChatDock();

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
        className="chat-dock-minimized"
        aria-label="Restore messages"
      >
        <span className="chat-dock-icon">
          <i className="las la-comments" />
        </span>
        <span>Messages</span>
        <i className="las la-angle-up" />
      </button>
    );
  }

  return (
    <aside className="desktop-chat-dock" aria-label="Messages window">
      <header className="chat-dock-header">
        <div className="chat-dock-title">
          <span className="chat-dock-icon">
            <i className="las la-comments" />
          </span>
          <span>Chats</span>
        </div>
        <div className="chat-dock-actions">
          <button
            type="button"
            onClick={minimize}
            aria-label="Minimize messages"
          >
            <i className="las la-minus" />
          </button>
          <button
            type="button"
            onClick={closeDock}
            aria-label="Close messages"
          >
            <i className="las la-times" />
          </button>
        </div>
      </header>
      <div className="chat-dock-content">
        <Routes>
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
        </Routes>
      </div>
    </aside>
  );
};

export default DesktopChatDock;
