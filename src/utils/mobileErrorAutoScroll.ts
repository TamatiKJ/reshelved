const MOBILE_MAX_WIDTH = 767;
let lastErrorText = '';
let observer: MutationObserver | null = null;

const isMobileViewport = () => window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;

const shouldScrollForPath = () => {
  const path = window.location.pathname;
  return path === '/create' || path.includes('/edit');
};

const getVisibleErrorElement = () => {
  const errors = Array.from(document.querySelectorAll<HTMLElement>('.border-red-200.bg-red-50.text-red-700'));
  return errors.find((element) => {
    const rect = element.getBoundingClientRect();
    const text = element.textContent?.trim() || '';
    return text.length > 0 && rect.width > 0 && rect.height > 0;
  }) || null;
};

const scrollVisibleErrorIntoView = () => {
  if (!isMobileViewport() || !shouldScrollForPath()) return;
  const errorElement = getVisibleErrorElement();
  if (!errorElement) return;

  const nextErrorText = errorElement.textContent?.trim() || '';
  if (!nextErrorText || nextErrorText === lastErrorText) return;
  lastErrorText = nextErrorText;

  window.requestAnimationFrame(() => {
    errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
};

export const enableMobileErrorAutoScroll = () => {
  if (typeof window === 'undefined' || observer) return;

  observer = new MutationObserver(scrollVisibleErrorIntoView);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('popstate', () => { lastErrorText = ''; });
};
