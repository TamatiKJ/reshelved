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
  chatPath: string;
  open: (path?: string) => void;
  updatePath: (path: string) => void;
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
  const [chatPath, setChatPath] = useState('/messages');

  const open = useCallback((path = '/messages') => {
    setChatPath(path);
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const updatePath = useCallback((path: string) => {
    setChatPath(path);
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setChatPath('/messages');
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      isMinimized,
      chatPath,
      open,
      updatePath,
      minimize,
      restore,
      close
    }),
    [isOpen, isMinimized, chatPath, open, updatePath, minimize, restore, close]
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
