import {
  browserLocalPersistence,
  GoogleAuthProvider,
  setPersistence,
  signInWithRedirect
} from 'firebase/auth';
import { auth } from '../firebase';

const AUTH_PATHS = new Set(['/login', '/register']);
const GOOGLE_BUTTON_MARKER = 'data-reshelved-google-auth';
const PENDING_SIGNUP_KEYS = [
  'reshelved:signupSessionId',
  'reshelved:pendingSignUpEmail',
  'reshelved:pendingSignUpName',
  'reshelved:pendingSignUpLocation'
];

const googleIcon = `
  <svg class="h-5 w-5 shrink-0" viewBox="0 0 18 18" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M17.64 9.20455c0-.63818-.05727-1.25273-.16364-1.84364H9v3.48182h4.84364c-.20864 1.125-.84273 2.07818-1.79636 2.71636v2.25818h2.90818C16.65818 14.25273 17.64 11.94545 17.64 9.20455z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.46727-.80591 5.95636-2.18273l-2.90818-2.25818c-.80591.54-1.83727.85909-3.04818.85909-2.34409 0-4.32818-1.58273-5.03591-3.70909H.95727v2.33182C2.43818 15.98318 5.48182 18 9 18z" />
    <path fill="#FBBC05" d="M3.96409 10.70909c-.18-.54-.28227-1.11682-.28227-1.70909s.10227-1.16909.28227-1.70909V4.95909H.95727C.34773 6.17318 0 7.54818 0 9s.34773 2.82682.95727 4.04091l3.00682-2.33182z" />
    <path fill="#EA4335" d="M9 3.58182c1.32136 0 2.50773.45409 3.44045 1.34636l2.58136-2.58136C13.46318.89182 11.42591 0 9 0 5.48182 0 2.43818 2.01682.95727 4.95909l3.00682 2.33182C4.67182 5.16455 6.65591 3.58182 9 3.58182z" />
  </svg>
`;

const getGoogleErrorMessage = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled for this Firebase project.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This website domain is not authorized for Google sign-in.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }

  return 'Google sign-in failed. Please try again.';
};

const clearPendingEmailSignup = () => {
  PENDING_SIGNUP_KEYS.forEach((key) => window.localStorage.removeItem(key));
};

const addGoogleButton = () => {
  if (!AUTH_PATHS.has(window.location.pathname)) return;

  const form = document.querySelector<HTMLFormElement>('main section form');
  if (!form || form.hasAttribute(GOOGLE_BUTTON_MARKER)) return;

  form.setAttribute(GOOGLE_BUTTON_MARKER, 'true');
  form.classList.remove('mt-8');

  const container = document.createElement('div');
  container.className = 'mt-8';
  container.innerHTML = `
    <button type="button" class="flex w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60">
      ${googleIcon}
      <span>Continue with Google</span>
    </button>
    <div class="my-6 flex items-center gap-3" aria-hidden="true">
      <span class="h-px flex-1 bg-stone-200"></span>
      <span class="text-xs font-medium uppercase tracking-wide text-stone-400">or</span>
      <span class="h-px flex-1 bg-stone-200"></span>
    </div>
  `;

  const button = container.querySelector<HTMLButtonElement>('button');
  const label = container.querySelector<HTMLSpanElement>('button span');

  button?.addEventListener('click', async () => {
    const existingError = container.querySelector('[data-google-auth-error]');
    existingError?.remove();

    if (button) button.disabled = true;
    if (label) label.textContent = 'Opening Google...';

    try {
      clearPendingEmailSignup();
      await setPersistence(auth, browserLocalPersistence);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(auth, provider);
    } catch (error) {
      if (button) button.disabled = false;
      if (label) label.textContent = 'Continue with Google';

      const errorMessage = document.createElement('p');
      errorMessage.setAttribute('data-google-auth-error', 'true');
      errorMessage.className = 'mt-4 text-sm font-medium text-red-600';
      errorMessage.textContent = getGoogleErrorMessage(error);
      container.appendChild(errorMessage);
    }
  });

  form.parentElement?.insertBefore(container, form);
};

export const enableGoogleAuthButtons = () => {
  addGoogleButton();

  const root = document.getElementById('root');
  if (!root) return;

  const observer = new MutationObserver(addGoogleButton);
  observer.observe(root, { childList: true, subtree: true });
};
