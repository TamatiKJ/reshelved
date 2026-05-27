import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react';

type ChatDockState = {
  isOpen: boolean;
  isMinimized: boolean;
  conversationId: string | null;
  openInbox: () => void;
  openConversation: (conversationId: string) => void;
  minimize: () => void;
  restore: () => void;
  close: () => void;
};

const ChatDockContext = createContext<ChatDockState | null>(null);

export const ChatDockProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const openInbox = useCallback(() => {
    setConversationId(null);
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const openConversation = useCallback((id: string) => {
    setConversationId(id);
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setConversationId(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      isMinimized,
      conversationId,
      openInbox,
      openConversation,
      minimize,
      restore,
      close
    }),
    [
      isOpen,
      isMinimized,
      conversationId,
      openInbox,
      openConversation,
      minimize,
      restore,
      close
    ]
  );

  return (
    <ChatDockContext.Provider value={value}>
      {children}
    </ChatDockContext.Provider>
  );
};

export const useChatDock = (): ChatDockState => {
  const context = useContext(ChatDockContext);

  if (!context) {
    throw new Error('useChatDock must be used within ChatDockProvider.');
  }

  return context;
};
