import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react';
import type { Location } from 'react-router-dom';

type ChatDockState = {
  backgroundLocation: Location | null;
  isMinimized: boolean;
  openFrom: (location: Location) => void;
  minimize: () => void;
  restore: () => void;
  clear: () => void;
};

const ChatDockContext = createContext<ChatDockState | null>(null);

export const ChatDockProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [backgroundLocation, setBackgroundLocation] =
    useState<Location | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const openFrom = useCallback((location: Location) => {
    setBackgroundLocation(location);
    setIsMinimized(false);
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const clear = useCallback(() => {
    setBackgroundLocation(null);
    setIsMinimized(false);
  }, []);

  const value = useMemo(
    () => ({
      backgroundLocation,
      isMinimized,
      openFrom,
      minimize,
      restore,
      clear
    }),
    [backgroundLocation, isMinimized, openFrom, minimize, restore, clear]
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
