import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

export const useDesktopMedia = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const updateMatch = () => setIsDesktop(mediaQuery.matches);

    updateMatch();
    mediaQuery.addEventListener('change', updateMatch);

    return () => mediaQuery.removeEventListener('change', updateMatch);
  }, []);

  return isDesktop;
};
