import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  updatePassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const LINK_BLUE = '#1665CC';
const SIGNUP_EMAIL_KEY = 'reshelved.signup.email';
const SIGNUP_NAME_KEY = 'reshelved.signup.name';
const inputClass = [
  'w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm',
  'outline-none transition focus:border-[#1665CC]',
  'focus:ring-2 focus:ring-[#1665CC]/10'
].join(' ');
const passwordInputClass = `${inputClass} pr-10`;
const labelClass = 'text-sm font-bold text-stone-800';
const errorClass = 'mt-6 text-sm font-medium text-red-600';
const primaryButtonClass = [
  'w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm',
  'font-semibold text-white transition hover:bg-primary-700',
  'disabled:cursor-not-allowed disabled:opacity-50'
].join(' ');

const getAuthErrorMessage = (error: any, fallback: string) => {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please log in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters.';
    case 'auth/invalid-action-code':
      return 'This verification link is no longer valid. Request a new link.';
    case 'auth/expired-action-code':
      return 'This verification link has expired. Request a new link.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Allow pop-ups in your browser, then try Google sign-in again.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled yet. Please use email sign-in.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email. Log in using your original method.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    default:
      return error?.message || fallback;
  }
};

const AuthLogo: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <Link
    to="/"
    className="inline-flex items-center justify-center"
    aria-label="Reshelved home"
  >
    <img
      src="/reshelved-logo.svg"
      alt="Reshelved"
      className={`${compact ? 'h-5' : 'h-8'} w-auto`}
    />
  </Link>
);

const PasswordField: React.FC<{
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  required?: boolean;
  placeholder?: string;
}> = ({
  id,
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={passwordInputClass}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2
          cursor-pointer items-center justify-center rounded-md text-stone-500
          hover:bg-stone-100 hover:text-stone-800"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        <i className={`las ${visible ? 'la-eye-slash' : 'la-eye'} text-xl`} />
      </button>
    </div>
  );
};

const GoogleMark: React.FC = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.35 0-4.34-1.59-5.05-3.72H.93v2.33A9 9 0 0 0 9 18Z"
    />
    <path
      fill="#FBBC05"
      d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.93A9 9 0 0 0 0 9c0 1.45.35 2.82.93 4.03l3.02-2.33Z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.34L15.02 2.34C13.46.89 11.43 0 9 0A9 9 0 0 0 .93 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58Z"
    />
  </svg>
);

const GoogleButton: React.FC<{
  loading: boolean;
  onClick: () => void;
}> = ({ loading, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="flex w-full cursor-pointer items-center justify-center gap-3
      rounded-md border border-stone-300 bg-white px-4 py-3 text-sm
      font-semibold text-stone-800 transition hover:bg-stone-50
      disabled:cursor-not-allowed disabled:opacity-60"
  >
    <GoogleMark />
    {loading ? 'Connecting...' : 'Continue with Google'}
  </button>
);

const OrDivider: React.FC = () => (
  <div className="my-6 flex items-center gap-4 text-sm text-stone-500">
    <span className="h-px flex-1 bg-stone-200" />
    <span>or</span>
    <span className="h-px flex-1 bg-stone-200" />
  </div>
);

const AuthFooter: React.FC = () => (
  <footer className="w-full border-t border-stone-200 bg-white/80 px-4 py-5
    text-[13px] text-stone-600 sm:text-[14px]"
  >
    <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center
      gap-x-5 gap-y-2"
    >
      <Link to="/contact" className="hover:text-stone-900">Support</Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/contact" className="hover:text-stone-900">Contact</Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/terms" className="hover:text-stone-900">Terms of Use</Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/privacy-policy" className="hover:text-stone-900">
        Privacy Policy
      </Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/cookies" className="hover:text-stone-900">Cookie Policy</Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <span>© 2026 Reshelved.</span>
    </div>
  </footer>
);

const LegalAgreement: React.FC<{ className?: string }> = ({ className = '' }) => (
  <p className={`text-center text-[13px] leading-relaxed text-stone-600
    sm:text-[14px] ${className}`}
  >
    By continuing, I agree to Reshelved&apos;s{' '}
    <Link to="/terms" className="underline underline-offset-2 hover:text-stone-900">
      terms
    </Link>
    ,{' '}
    <Link
      to="/privacy-policy"
      className="underline underline-offset-2 hover:text-stone-900"
    >
      privacy policy
    </Link>
    , and{' '}
    <Link
      to="/cookies"
      className="underline underline-offset-2 hover:text-stone-900"
    >
      cookie policy
    </Link>
    .
  </p>
);

const AuthShell: React.FC<{
  children: React.ReactNode;
  showLegal?: boolean;
  pageClassName?: string;
}> = ({ children, showLegal = true, pageClassName = 'bg-stone-50' }) => (
  <div className={`min-h-screen ${pageClassName} flex flex-col`}>
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
      {children}
      {showLegal && <LegalAgreement className="mt-6 max-w-md px-3" />}
    </main>
    <AuthFooter />
  </div>
);

const SplitAuthShell: React.FC<{
  children: React.ReactNode;
  tagline: string;
}> = ({ children, tagline }) => (
  <div className="flex min-h-screen flex-col bg-stone-50">
    <main className="flex flex-1 items-center justify-center px-4 py-8 lg:py-12">
      <section className="grid w-full max-w-[1040px] overflow-hidden rounded-2xl
        border border-stone-200 bg-white shadow-sm lg:min-h-[620px]
        lg:grid-cols-[1fr_0.98fr]"
      >
        <aside className="hidden flex-col items-center justify-center bg-[#FFF4E2]
          px-12 text-center lg:flex"
        >
          <img
            src="/reshelved-logo.svg"
            alt="Reshelved"
            className="w-[270px] max-w-full"
          />
          <p className="mt-auto pb-10 text-base text-stone-700">{tagline}</p>
        </aside>
        <div className="flex flex-col justify-center px-6 py-8 sm:px-10 lg:px-12">
          {children}
        </div>
      </section>
    </main>
    <AuthFooter />
  </div>
);

export const Login: React.FC = () => {
  const { login, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/browse');
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Could not continue with Google.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError('');
    if (!email.trim()) {
      setError('Enter your email first, then click Forgot password.');
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(email);
      navigate('/forgot-password', {
        state: { sentEmail: email.trim().toLowerCase() }
      });
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Failed to send password reset email'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/browse');
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Failed to log in'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SplitAuthShell tagline="Find affordable books and swap with readers near you.">
      <div className="mx-auto w-full max-w-[390px]">
        <div className="text-center">
          <div className="mb-7 lg:hidden"><AuthLogo compact /></div>
          <h1 className="text-2xl font-bold text-stone-950">Welcome back</h1>
          <p className="mt-2 text-sm text-stone-500">
            Log in to continue using Reshelved.
          </p>
        </div>
        {error && <p className={errorClass}>{error}</p>}
        <div className="mt-7">
          <GoogleButton
            loading={googleLoading}
            onClick={handleGoogleSignIn}
          />
        </div>
        <OrDivider />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`mb-1 block ${labelClass}`}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              autoComplete="email"
              placeholder="Email"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className={labelClass}>Password</label>
            </div>
            <PasswordField
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetLoading}
              className="mt-2 cursor-pointer text-sm font-semibold hover:underline
                disabled:cursor-not-allowed disabled:opacity-60"
              style={{ color: LINK_BLUE }}
            >
              {resetLoading ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || googleLoading}
            className={primaryButtonClass}
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-600">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-semibold hover:underline"
            style={{ color: LINK_BLUE }}
          >
            Sign up
          </Link>
        </p>
        <LegalAgreement className="mt-6" />
      </div>
    </SplitAuthShell>
  );
};

export const ForgotPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const state = window.history.state?.usr as { sentEmail?: string } | undefined;
  const [email, setEmail] = useState(state?.sentEmail || '');
  const [sentEmail, setSentEmail] = useState(state?.sentEmail || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendReset = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setSentEmail(email.trim().toLowerCase());
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Failed to send password reset email'));
    } finally {
      setLoading(false);
    }
  };

  if (sentEmail) {
    return (
      <AuthShell showLegal={false}>
        <section className="w-full max-w-2xl px-4 text-center">
          <div className="mx-auto flex h-32 w-32 items-center justify-center
            rounded-3xl border-4 border-stone-500 text-primary-600"
          >
            <i className="las la-envelope-open-text text-7xl" />
          </div>
          <h1 className="mt-10 text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">
            Check your email to continue.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-xl font-semibold leading-snug text-stone-800">
            We sent password reset instructions to<br />{sentEmail}.
          </p>
          <p className="mt-8 text-2xl font-bold text-stone-900">
            Don&apos;t see the email? Check your SPAM folder.
          </p>
          <button
            onClick={() => sendReset()}
            disabled={loading}
            className="mt-8 w-full max-w-xl cursor-pointer rounded-md border
              border-stone-300 bg-white px-4 py-4 text-base font-semibold
              text-stone-900 hover:bg-stone-50 disabled:cursor-not-allowed
              disabled:opacity-60"
          >
            {loading ? 'Resending...' : 'Resend email'}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 w-full max-w-xl cursor-pointer rounded-md border
              border-stone-300 bg-white px-4 py-4 text-base font-semibold
              text-stone-900 hover:bg-stone-50"
          >
            Go back
          </button>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <section className="w-full max-w-md rounded-xl border border-stone-300
        bg-white px-7 py-8 shadow-sm sm:px-9"
      >
        <div className="text-center">
          <AuthLogo />
          <h1 className="mt-7 text-xl font-semibold text-stone-950">
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Enter your email and we will send reset instructions.
          </p>
        </div>
        {error && <p className={errorClass}>{error}</p>}
        <form onSubmit={sendReset} className="mt-7 space-y-4">
          <div>
            <label className={`mb-1 block ${labelClass}`}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={primaryButtonClass}
          >
            {loading ? 'Sending...' : 'Send reset email'}
          </button>
        </form>
        <button
          onClick={() => navigate('/login')}
          className="mt-4 w-full cursor-pointer rounded-md border border-stone-300
            bg-white px-4 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-50"
        >
          Go back
        </button>
      </section>
    </AuthShell>
  );
};

export const Register: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const returningFromEmail = useMemo(
    () => isSignInWithEmailLink(auth, window.location.href),
    []
  );
  const [displayName, setDisplayName] = useState(
    () => window.localStorage.getItem(SIGNUP_NAME_KEY) || ''
  );
  const [email, setEmail] = useState(
    () => window.localStorage.getItem(SIGNUP_EMAIL_KEY) || ''
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/browse');
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Could not continue with Google.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const sendVerificationLink = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError('');
    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await sendSignInLinkToEmail(auth, cleanEmail, {
        url: `${window.location.origin}/register`,
        handleCodeInApp: true
      });
      window.localStorage.setItem(SIGNUP_EMAIL_KEY, cleanEmail);
      window.localStorage.setItem(SIGNUP_NAME_KEY, cleanName);
      setEmail(cleanEmail);
      setSent(true);
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Could not send the verification link.'));
    } finally {
      setLoading(false);
    }
  };

  const finishVerifiedRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (displayName.trim().length < 2 || !email.trim()) {
      setError('Confirm your name and email to continue.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const credential = await signInWithEmailLink(
        auth,
        email.trim().toLowerCase(),
        window.location.href
      );
      await updateProfile(credential.user, { displayName: displayName.trim() });
      await updatePassword(credential.user, password);
      const now = Date.now();
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        displayName: displayName.trim(),
        email: credential.user.email || email.trim().toLowerCase(),
        photoURL: credential.user.photoURL || '',
        location: '',
        phone: '',
        bio: '',
        isAdmin: false,
        flagged: false,
        flagCount: 0,
        createdAt: now,
        online: true,
        lastSeen: now,
        deactivated: false,
        emailVerified: true
      }, { merge: true });
      await setDoc(doc(db, 'publicProfiles', credential.user.uid), {
        uid: credential.user.uid,
        displayName: displayName.trim(),
        photoURL: '',
        location: '',
        createdAt: now,
        ratingAverage: 0,
        ratingCount: 0,
        updatedAt: now
      }, { merge: true });
      window.localStorage.removeItem(SIGNUP_EMAIL_KEY);
      window.localStorage.removeItem(SIGNUP_NAME_KEY);
      navigate('/browse');
    } catch (err: any) {
      setError(getAuthErrorMessage(
        err,
        'Could not finish registration. Request a new link and try again.'
      ));
    } finally {
      setLoading(false);
    }
  };

  if (returningFromEmail) {
    return (
      <AuthShell showLegal={false} pageClassName="bg-white">
        <section className="w-full max-w-2xl px-4 text-center">
          <img
            src="/white-heavy-check-mark-svgrepo-com.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto h-[104px] w-[104px] object-contain"
          />
          <h1 className="mt-8 text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">
            Your email is verified.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-stone-600">
            Complete your sign-up details below to start using Reshelved.
          </p>
          {error && (
            <p className={`${errorClass} mx-auto max-w-[408px] text-left`}>
              {error}
            </p>
          )}
          <form
            onSubmit={finishVerifiedRegistration}
            className="mx-auto mt-8 max-w-[408px] space-y-4 text-left"
          >
            <div>
              <label className={`mb-1 block ${labelClass}`}>Full name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={inputClass}
                autoComplete="name"
              />
            </div>
            <div>
              <label className={`mb-1 block ${labelClass}`}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                autoComplete="email"
              />
            </div>
            <div>
              <label className={`mb-1 block ${labelClass}`}>Password</label>
              <PasswordField
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <p className="mt-1.5 text-xs text-stone-500">
                Password must be 8 characters minimum.
              </p>
            </div>
            <div>
              <label className={`mb-1 block ${labelClass}`}>
                Confirm password
              </label>
              <PasswordField
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={primaryButtonClass}
            >
              {loading ? 'Completing signup...' : 'Complete Signup'}
            </button>
          </form>
        </section>
      </AuthShell>
    );
  }

  if (sent) {
    return (
      <AuthShell showLegal={false} pageClassName="bg-white">
        <section className="w-full max-w-2xl px-4 text-center">
          <div className="mx-auto flex h-[92px] items-center justify-center">
            <span
              className="flex h-[72px] items-center justify-center text-[72px]
                leading-none"
              role="img"
              aria-label="Verification email sent"
            >
              📩
            </span>
          </div>
          <h1 className="mt-9 text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">
            Verify your email to create your account.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-lg font-semibold leading-snug text-stone-700">
            We sent a secure sign-up link to<br />{email}.
          </p>
          <p className="mt-7 text-base font-semibold text-stone-800">
            Check your spam folder if the email is missing.
          </p>
          <button
            type="button"
            onClick={() => sendVerificationLink()}
            disabled={loading}
            className="mt-8 w-full max-w-xl cursor-pointer rounded-md border
              border-stone-300 bg-white px-4 py-4 text-base font-semibold
              text-stone-900 transition hover:bg-stone-50 disabled:cursor-not-allowed
              disabled:opacity-60"
          >
            {loading ? 'Sending...' : 'Resend verification link'}
          </button>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-4 cursor-pointer border-0 bg-transparent px-4 py-3
              text-base font-semibold text-stone-700 transition hover:text-primary-600"
          >
            Change email address
          </button>
        </section>
      </AuthShell>
    );
  }

  return (
    <SplitAuthShell tagline="Create your shelf and start swapping books near you.">
      <div className="mx-auto w-full max-w-[390px]">
        <div className="text-center">
          <div className="mb-7 lg:hidden"><AuthLogo compact /></div>
          <h1 className="text-2xl font-bold text-stone-950">
            Create your Reshelved account
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Verify your email before your account is created.
          </p>
        </div>
        {error && <p className={errorClass}>{error}</p>}
        <div className="mt-7">
          <GoogleButton
            loading={googleLoading}
            onClick={handleGoogleSignIn}
          />
        </div>
        <OrDivider />
        <form onSubmit={sendVerificationLink} className="space-y-4">
          <div>
            <label className={`mb-1 block ${labelClass}`}>Full name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
              autoComplete="name"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className={`mb-1 block ${labelClass}`}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              autoComplete="email"
              placeholder="Email"
            />
          </div>
          <button
            type="submit"
            disabled={loading || googleLoading}
            className={primaryButtonClass}
          >
            {loading ? 'Sending link...' : 'Continue with email'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold hover:underline"
            style={{ color: LINK_BLUE }}
          >
            Log in
          </Link>
        </p>
        <LegalAgreement className="mt-6" />
      </div>
    </SplitAuthShell>
  );
};
