import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LINK_BLUE = '#1665CC';
const inputClass = 'w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';

const getAuthErrorMessage = (error: any, fallback: string) => {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please log in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/popup-closed-by-user':
      return 'Google sign in was closed before it finished.';
    default:
      return error?.message || fallback;
  }
};

const AuthLogo: React.FC = () => (
  <Link to="/" className="inline-flex items-center justify-center" aria-label="Reshelved home">
    <img src="/reshelved-logo.svg" alt="Reshelved" className="h-8 w-auto" />
  </Link>
);

const GoogleIcon: React.FC = () => (
  <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.651 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const AuthFooter: React.FC = () => (
  <footer className="w-full border-t border-stone-200 bg-white/80 px-4 py-5 text-[13px] sm:text-[14px] text-stone-600">
    <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2">
      <Link to="/contact" className="hover:text-stone-900">Support</Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/contact" className="hover:text-stone-900">Contact</Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/terms" className="hover:text-stone-900">Terms of Use</Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/privacy-policy" className="hover:text-stone-900">Privacy Policy</Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/cookies" className="hover:text-stone-900">Cookie Policy</Link>
      <span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <span>© 2026 Reshelved.</span>
    </div>
  </footer>
);

const LegalAgreement: React.FC = () => (
  <p className="mt-6 max-w-md px-3 text-center text-[13px] leading-relaxed text-stone-600 sm:text-[14px]">
    By continuing, I agree to Reshelved&apos;s{' '}
    <Link to="/terms" className="underline underline-offset-2 hover:text-stone-900">terms</Link>,{' '}
    <Link to="/privacy-policy" className="underline underline-offset-2 hover:text-stone-900">privacy policy</Link>, and{' '}
    <Link to="/cookies" className="underline underline-offset-2 hover:text-stone-900">cookie policy</Link>.
  </p>
);

const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-stone-50 flex flex-col">
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
      {children}
      <LegalAgreement />
    </main>
    <AuthFooter />
  </div>
);

const Divider: React.FC = () => (
  <div className="flex items-center gap-3 py-1 text-xs text-stone-400">
    <div className="h-px flex-1 bg-stone-200" />
    <span>or</span>
    <div className="h-px flex-1 bg-stone-200" />
  </div>
);

export const Login: React.FC = () => {
  const { login, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setMessage('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/browse');
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Failed to sign in with Google'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError('');
    setMessage('');
    if (!email.trim()) {
      setError('Enter your email first, then click Forgot password.');
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(email);
      setMessage('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Failed to send password reset email'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
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
    <AuthShell>
      <section className="w-full max-w-md rounded-xl border border-stone-300 bg-white px-7 py-8 shadow-sm sm:px-9">
        <div className="text-center">
          <AuthLogo />
          <h1 className="mt-7 text-xl font-semibold text-stone-950">Log in to Reshelved</h1>
        </div>

        <div className="mt-7 space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>
          <Divider />
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {message && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-stone-800">Email</label>
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-stone-800">Password</label>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resetLoading}
                className="cursor-pointer text-xs font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: LINK_BLUE }}
              >
                {resetLoading ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold hover:underline" style={{ color: LINK_BLUE }}>
            Sign up
          </Link>
        </p>
      </section>
    </AuthShell>
  );
};

export const Register: React.FC = () => {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      setError(getAuthErrorMessage(err, 'Failed to sign up with Google'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, displayName, 'Nairobi');
      navigate('/browse');
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Failed to create account'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <section className="w-full max-w-md rounded-xl border border-stone-300 bg-white px-7 py-8 shadow-sm sm:px-9">
        <div className="text-center">
          <AuthLogo />
          <h1 className="mt-7 text-xl font-semibold text-stone-950">Create your Reshelved account</h1>
        </div>

        <div className="mt-7 space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>
          <Divider />
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-800">Full name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-800">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-800">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-800">Confirm password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold hover:underline" style={{ color: LINK_BLUE }}>
            Log in
          </Link>
        </p>
      </section>
    </AuthShell>
  );
};
