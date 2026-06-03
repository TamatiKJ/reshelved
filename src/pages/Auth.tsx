import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';

const LINK_BLUE = '#1665CC';
const RESEND_COOLDOWN_SECONDS = 60;
const SIGNUP_SESSION_ID_KEY = 'reshelved:signupSessionId';
const PENDING_SIGNUP_EMAIL_KEY = 'reshelved:pendingSignUpEmail';
const PENDING_SIGNUP_NAME_KEY = 'reshelved:pendingSignUpName';
const inputClass = 'w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const passwordInputClass = 'w-full rounded-md border border-stone-300 px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const labelClass = 'text-sm font-bold text-stone-800';
const errorClass = 'mt-6 text-sm font-medium text-red-600';

type PendingSignup = {
  sessionId?: string;
  email?: string;
  displayName?: string;
  onboardingStatus?: 'pending' | 'password_required' | 'complete' | 'expired';
  createdAt?: number;
  updatedAt?: number;
  verifiedAt?: number;
  completedAt?: number;
  uid?: string;
};

const getPendingSignUpEmail = () => window.localStorage.getItem(PENDING_SIGNUP_EMAIL_KEY) || '';
const getPendingSignUpName = () => window.localStorage.getItem(PENDING_SIGNUP_NAME_KEY) || '';
const getStoredSessionId = () => window.localStorage.getItem(SIGNUP_SESSION_ID_KEY) || '';
const getSessionIdFromUrl = () => new URLSearchParams(window.location.search).get('sessionId') || '';
const clearPendingSignUp = () => {
  window.localStorage.removeItem(SIGNUP_SESSION_ID_KEY);
  window.localStorage.removeItem(PENDING_SIGNUP_EMAIL_KEY);
  window.localStorage.removeItem(PENDING_SIGNUP_NAME_KEY);
};

const getAuthErrorMessage = (error: any, fallback: string) => {
  switch (error?.code) {
    case 'auth/email-already-in-use': return 'This email is already registered. Please log in instead.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/expired-action-code': return 'This verification link has expired. Request a new link.';
    case 'auth/invalid-action-code': return 'This verification link is invalid or has already been used. Request a new link.';
    case 'auth/requires-recent-login': return 'This session expired. Request a new verification link and try again.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-blocked': return 'Allow pop-ups in your browser, then try Google sign-in again.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Invalid email or password.';
    default: return error?.message || fallback;
  }
};

const AuthLogo: React.FC<{ className?: string }> = ({ className = 'h-5 w-auto' }) => (
  <Link to="/" className="inline-flex items-center justify-center" aria-label="Reshelved home">
    <img src="/reshelved-logo.svg" alt="Reshelved" className={className} />
  </Link>
);

const GoogleIcon: React.FC = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 18 18" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M17.64 9.20455c0-.63818-.05727-1.25273-.16364-1.84364H9v3.48182h4.84364c-.20864 1.125-.84273 2.07818-1.79636 2.71636v2.25818h2.90818C16.65818 14.25273 17.64 11.94545 17.64 9.20455z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.46727-.80591 5.95636-2.18273l-2.90818-2.25818c-.80591.54-1.83727.85909-3.04818.85909-2.34409 0-4.32818-1.58273-5.03591-3.70909H.95727v2.33182C2.43818 15.98318 5.48182 18 9 18z" />
    <path fill="#FBBC05" d="M3.96409 10.70909c-.18-.54-.28227-1.11682-.28227-1.70909s.10227-1.16909.28227-1.70909V4.95909H.95727C.34773 6.17318 0 7.54818 0 9s.34773 2.82682.95727 4.04091l3.00682-2.33182z" />
    <path fill="#EA4335" d="M9 3.58182c1.32136 0 2.50773.45409 3.44045 1.34636l2.58136-2.58136C13.46318.89182 11.42591 0 9 0 5.48182 0 2.43818 2.01682.95727 4.95909l3.00682 2.33182C4.67182 5.16455 6.65591 3.58182 9 3.58182z" />
  </svg>
);

const PasswordField: React.FC<{ value: string; onChange: (value: string) => void; autoComplete: string; required?: boolean; placeholder?: string }> = ({ value, onChange, autoComplete, required = true, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input type={visible ? 'text' : 'password'} required={required} value={value} onChange={(e) => onChange(e.target.value)} className={passwordInputClass} autoComplete={autoComplete} placeholder={placeholder} />
      <button type="button" onClick={() => setVisible((current) => !current)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-800" aria-label={visible ? 'Hide password' : 'Show password'}>
        <i className={`las ${visible ? 'la-eye-slash' : 'la-eye'} text-xl`} />
      </button>
    </div>
  );
};

const AuthFooter: React.FC = () => (
  <footer className="w-full border-t border-stone-200 bg-white/80 px-4 py-5 text-[13px] sm:text-[14px] text-stone-600">
    <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2">
      <Link to="/contact" className="hover:text-stone-900">Support</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/contact" className="hover:text-stone-900">Contact</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/terms" className="hover:text-stone-900">Terms of Use</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/privacy-policy" className="hover:text-stone-900">Privacy Policy</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <Link to="/cookies" className="hover:text-stone-900">Cookie Policy</Link><span className="hidden h-4 w-px bg-stone-200 sm:inline-block" />
      <span>© 2026 Reshelved.</span>
    </div>
  </footer>
);

const LegalAgreement: React.FC<{ className?: string }> = ({ className = 'mt-6 max-w-md px-3 text-center text-[13px] leading-relaxed text-stone-600 sm:text-[14px]' }) => (
  <p className={className}>
    By continuing, I agree to Reshelved&apos;s <Link to="/terms" className="underline underline-offset-2 hover:text-stone-900">terms</Link>, <Link to="/privacy-policy" className="underline underline-offset-2 hover:text-stone-900">privacy policy</Link>, and <Link to="/cookies" className="underline underline-offset-2 hover:text-stone-900">cookie policy</Link>.
  </p>
);

const AuthShell: React.FC<{ children: React.ReactNode; showLegal?: boolean; white?: boolean }> = ({ children, showLegal = true, white = false }) => (
  <div className={`min-h-screen flex flex-col ${white ? 'bg-white' : 'bg-stone-50'}`}>
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">{children}{showLegal && <LegalAgreement />}</main>
    <AuthFooter />
  </div>
);

const AuthSplitCard: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <AuthShell showLegal={false}>
    <section className="grid min-h-[600px] w-full max-w-[1024px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:grid-cols-[1.08fr_1fr]">
      <aside className="hidden flex-col items-center justify-between bg-[#FFF4E2] px-10 py-[68px] md:flex">
        <AuthLogo className="h-6 w-auto" />
        <p className="text-center text-base leading-7 text-stone-700">Find affordable books and swap with readers near you.</p>
      </aside>
      <div className="flex items-center justify-center px-7 py-10 sm:px-12 md:px-14">
        <div className="w-full max-w-[388px]">
          <div className="text-center">
            <div className="mb-7 md:hidden"><AuthLogo /></div>
            <h5 className="text-stone-950">{title}</h5>
            <p className="mt-3 text-sm text-stone-500">{subtitle}</p>
          </div>
          {children}
          <LegalAgreement className="mx-auto mt-8 max-w-[360px] text-center text-[13px] leading-relaxed text-stone-600" />
        </div>
      </div>
    </section>
  </AuthShell>
);

const GoogleAuthButton: React.FC<{ label: string; disabled?: boolean; onError: (message: string) => void }> = ({ label, disabled, onError }) => {
  const { loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleAuth = async () => {
    onError('');
    setGoogleLoading(true);
    try { await loginWithGoogle(); }
    catch (err: any) { setGoogleLoading(false); onError(getAuthErrorMessage(err, 'Google sign-in failed. Please try again.')); }
  };

  return (
    <button type="button" onClick={handleGoogleAuth} disabled={disabled || googleLoading} className="mt-8 flex w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60">
      <GoogleIcon />
      {googleLoading ? 'Opening Google...' : label}
    </button>
  );
};

const SetPasswordForm: React.FC<{ sessionId?: string; compact?: boolean }> = ({ sessionId, compact = false }) => {
  const { setAccountPassword, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await setAccountPassword(password, sessionId);
      setCreated(true);
      window.setTimeout(() => navigate('/profile', { replace: true }), 1500);
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Could not set your password.'));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <section className={`${compact ? 'mx-auto mt-8 w-full max-w-md' : 'w-full max-w-md rounded-xl border border-stone-300 bg-white px-7 py-8 shadow-sm sm:px-9'} text-center`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
          <i className="las la-check text-4xl" />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-stone-950">Account created successfully.</h1>
        <p className="mt-3 text-sm text-stone-500">Taking you to your profile.</p>
      </section>
    );
  }

  return (
    <section className={`${compact ? 'mx-auto mt-8 w-full max-w-md' : 'w-full max-w-md rounded-xl border border-stone-300 bg-white px-7 py-8 shadow-sm sm:px-9'}`}>
      <div className="text-center">
        {!compact && <AuthLogo />}
        <h1 className={`${compact ? 'text-3xl sm:text-4xl' : 'mt-7 text-xl'} font-bold text-stone-950`}>Email verified.</h1>
        <p className="mt-2 text-sm text-stone-500">Create your password to finish setting up your account.</p>
      </div>
      {error && <p className={errorClass}>{error}</p>}
      <form onSubmit={handleSubmit} className="mt-7 space-y-4 text-left">
        <div><label className={`mb-1 block ${labelClass}`}>Password</label><PasswordField value={password} onChange={setPassword} autoComplete="new-password" /></div>
        <div><label className={`mb-1 block ${labelClass}`}>Confirm password</label><PasswordField value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" /></div>
        <button type="submit" disabled={saving || authLoading} className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Set password and continue'}</button>
      </form>
    </section>
  );
};

const EmailVerificationFlow: React.FC<{ email: string; sessionId: string; onResend: () => Promise<string>; onChangeEmail: () => void }> = ({ email, sessionId, onResend, onChangeEmail }) => {
  const { currentUser, userProfile } = useAuth();
  const [session, setSession] = useState<PendingSignup | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!sessionId) return undefined;
    return onSnapshot(doc(db, 'pendingSignups', sessionId), (snapshot) => {
      setSession(snapshot.exists() ? snapshot.data() as PendingSignup : null);
    }, (err) => setError(getAuthErrorMessage(err, 'Could not read verification status.')));
  }, [sessionId]);

  useEffect(() => {
    if (cooldownRemaining <= 0) return undefined;
    const timer = window.setInterval(() => setCooldownRemaining((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownRemaining]);

  const resend = async () => {
    if (cooldownRemaining > 0) return;
    setError(''); setMessage(''); setResending(true);
    try {
      await onResend();
      setMessage('Verification link sent again.');
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) { setError(getAuthErrorMessage(err, 'Could not resend the verification link.')); }
    finally { setResending(false); }
  };

  const status = userProfile?.onboardingStatus || session?.onboardingStatus || 'pending';
  const passwordRequired = status === 'password_required';
  const completed = status === 'complete';

  return (
    <AuthShell showLegal={false} white>
      <section className="w-full max-w-3xl px-4 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center text-primary-600"><i className={`las ${passwordRequired || completed ? 'la-check-circle' : 'la-envelope'} text-7xl`} /></div>
        {!passwordRequired && !completed && <>
          <h1 className="mt-8 text-4xl font-black leading-tight tracking-tight text-stone-950 sm:text-6xl">Verify your email to create your account.</h1>
          <p className="mx-auto mt-8 max-w-md text-xl font-bold leading-snug text-stone-800">We sent a secure sign-up link to<br />{email}.</p>
          <p className="mt-10 text-lg font-bold" style={{ color: LINK_BLUE }}>Check your spam folder if the email is missing.</p>
          {error && <p className={errorClass}>{error}</p>}
          {message && <div className="mx-auto mt-6 max-w-xl rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
          <button onClick={resend} disabled={resending || cooldownRemaining > 0} className="mt-10 w-full max-w-2xl cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-5 text-lg font-bold text-stone-950 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60">{resending ? 'Sending...' : cooldownRemaining > 0 ? `Resend verification link in ${cooldownRemaining}s` : 'Resend verification link'}</button>
          <button onClick={onChangeEmail} className="mt-8 block w-full cursor-pointer text-lg font-bold text-stone-800 hover:underline">Change email address</button>
        </>}
        {passwordRequired && <SetPasswordForm sessionId={sessionId} compact />}
        {completed && <>
          <h1 className="mt-8 text-4xl font-black leading-tight tracking-tight text-stone-950 sm:text-6xl">Account complete.</h1>
          <p className="mx-auto mt-8 max-w-md text-xl font-bold leading-snug text-stone-800">Your account is ready.</p>
          <Link to="/profile" className="mt-10 inline-flex w-full max-w-2xl items-center justify-center rounded-md bg-primary-600 px-4 py-5 text-lg font-bold text-white hover:bg-primary-700">Go to profile</Link>
        </>}
      </section>
    </AuthShell>
  );
};

export const Login: React.FC = () => {
  const { login, resetPassword, currentUser, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && currentUser && userProfile) navigate(userProfile.onboardingStatus === 'complete' ? '/browse' : '/auth/verify', { replace: true });
  }, [authLoading, currentUser, userProfile, navigate]);

  const handlePasswordReset = async () => {
    setError(''); setMessage('');
    if (!email.trim()) { setError('Enter your email first, then click Forgot password.'); return; }
    setResetLoading(true);
    try { await resetPassword(email); navigate('/forgot-password', { state: { sentEmail: email.trim().toLowerCase() } }); }
    catch (err: any) { setError(getAuthErrorMessage(err, 'Failed to send password reset email')); }
    finally { setResetLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try { await login(email, password); navigate('/browse', { replace: true }); }
    catch (err: any) { setError(getAuthErrorMessage(err, 'Failed to log in')); }
    finally { setLoading(false); }
  };

  return (
    <AuthSplitCard title="Welcome back" subtitle="Log in to continue using Reshelved.">
      {error && <p className={errorClass}>{error}</p>}
      {message && <div className="mt-6 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
      <GoogleAuthButton label="Continue with Google" disabled={loading || authLoading} onError={setError} />
      <div className="my-7 flex items-center gap-5 text-sm text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><div className="mb-1 flex items-center justify-between gap-3"><label className={labelClass}>Email</label></div><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" placeholder="Email" /></div>
        <div><div className="mb-1 flex items-center justify-between gap-3"><label className={labelClass}>Password</label></div><PasswordField value={password} onChange={setPassword} autoComplete="current-password" placeholder="Password" /><button type="button" onClick={handlePasswordReset} disabled={resetLoading} className="mt-2 cursor-pointer text-sm font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-60" style={{ color: LINK_BLUE }}>{resetLoading ? 'Sending...' : 'Forgot password?'}</button></div>
        <button type="submit" disabled={loading || authLoading} className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-600">Don&apos;t have an account? <Link to="/register" className="font-semibold hover:underline" style={{ color: LINK_BLUE }}>Sign up</Link></p>
    </AuthSplitCard>
  );
};

export const VerifyEmail: React.FC = () => {
  const { currentUser, userProfile, loading: authLoading, sendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const sessionId = useMemo(() => getSessionIdFromUrl() || getStoredSessionId(), []);
  const [session, setSession] = useState<PendingSignup | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return undefined;
    window.localStorage.setItem(SIGNUP_SESSION_ID_KEY, sessionId);
    return onSnapshot(doc(db, 'pendingSignups', sessionId), (snapshot) => {
      setSession(snapshot.exists() ? snapshot.data() as PendingSignup : null);
    }, (err) => setError(getAuthErrorMessage(err, 'Could not read verification status.')));
  }, [sessionId]);

  useEffect(() => {
    if (!authLoading && userProfile?.onboardingStatus === 'complete' && !sessionId) navigate('/browse', { replace: true });
  }, [authLoading, userProfile?.onboardingStatus, sessionId, navigate]);

  const email = session?.email || getPendingSignUpEmail() || currentUser?.email || '';

  if (authLoading) return <AuthShell showLegal={false} white><p className="text-stone-500">Loading...</p></AuthShell>;
  if (!sessionId && !currentUser) return <AuthShell showLegal={false} white><section className="text-center"><h1 className="text-3xl font-bold text-stone-950">Verification link missing.</h1><p className="mt-4 text-stone-600">Request a new link to continue.</p><Link to="/register" className="mt-8 inline-flex rounded-md bg-primary-600 px-6 py-3 font-bold text-white">Request new link</Link></section></AuthShell>;

  return <EmailVerificationFlow email={email || 'your email'} sessionId={sessionId} onResend={sendVerificationEmail} onChangeEmail={() => { clearPendingSignUp(); navigate('/register', { replace: true }); }} />;
};

export const SetPassword: React.FC = () => {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const sessionId = getStoredSessionId();

  useEffect(() => {
    if (!authLoading && !currentUser) navigate('/login', { replace: true });
    if (!authLoading && currentUser && userProfile?.onboardingStatus !== 'password_required' && userProfile?.onboardingStatus !== 'complete') navigate('/auth/verify', { replace: true });
    if (!authLoading && userProfile?.onboardingStatus === 'complete') navigate('/browse', { replace: true });
  }, [authLoading, currentUser, userProfile?.onboardingStatus, navigate]);

  return <AuthShell><SetPasswordForm sessionId={sessionId} /></AuthShell>;
};

export const ForgotPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const state = window.history.state?.usr as { sentEmail?: string } | undefined;
  const [email, setEmail] = useState(state?.sentEmail || '');
  const [sentEmail, setSentEmail] = useState(state?.sentEmail || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(state?.sentEmail ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldownRemaining <= 0) return undefined;
    const timer = window.setInterval(() => setCooldownRemaining((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownRemaining]);

  const sendReset = async (e?: React.FormEvent) => {
    e?.preventDefault(); setError('');
    if (cooldownRemaining > 0) return;
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setLoading(true);
    try { await resetPassword(email); setSentEmail(email.trim().toLowerCase()); setCooldownRemaining(RESEND_COOLDOWN_SECONDS); }
    catch (err: any) { setError(getAuthErrorMessage(err, 'Failed to send password reset email')); }
    finally { setLoading(false); }
  };

  if (sentEmail) {
    return (
      <AuthShell showLegal={false}>
        <section className="w-full max-w-2xl px-4 text-center">
          <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-3xl border-4 border-stone-500 text-primary-600"><i className="las la-envelope-open-text text-7xl" /></div>
          <h1 className="mt-10 text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">Check your email to continue.</h1>
          <p className="mx-auto mt-6 max-w-md text-xl font-semibold leading-snug text-stone-800">We sent password reset instructions to<br />{sentEmail}.</p>
          <p className="mt-8 text-2xl font-bold text-stone-900">Don&apos;t see the email? <span style={{ color: LINK_BLUE }}>Check your SPAM folder.</span></p>
          {error && <p className={errorClass}>{error}</p>}
          <button onClick={() => sendReset()} disabled={loading || cooldownRemaining > 0} className="mt-8 w-full max-w-xl cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-4 text-base font-semibold text-stone-900 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Resending...' : cooldownRemaining > 0 ? `Resend email in ${cooldownRemaining}s` : 'Resend email'}</button>
          <button onClick={() => navigate('/login')} className="mt-4 w-full max-w-xl cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-4 text-base font-semibold text-stone-900 hover:bg-stone-50">Go back</button>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <section className="w-full max-w-md rounded-xl border border-stone-300 bg-white px-7 py-8 shadow-sm sm:px-9">
        <div className="text-center"><AuthLogo /><h1 className="mt-7 text-xl font-semibold text-stone-950">Reset your password</h1><p className="mt-2 text-sm text-stone-500">Enter your email and we will send reset instructions.</p></div>
        {error && <p className={errorClass}>{error}</p>}
        <form onSubmit={sendReset} className="mt-7 space-y-4"><div><label className={`mb-1 block ${labelClass}`}>Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" /></div><button type="submit" disabled={loading || cooldownRemaining > 0} className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Sending...' : cooldownRemaining > 0 ? `Send reset email in ${cooldownRemaining}s` : 'Send reset email'}</button></form>
        <button onClick={() => navigate('/login')} className="mt-4 w-full cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-50">Go back</button>
      </section>
    </AuthShell>
  );
};

export const Register: React.FC = () => {
  const { register, currentUser, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(getPendingSignUpName());
  const [email, setEmail] = useState(getPendingSignUpEmail());
  const [sessionId, setSessionId] = useState(getStoredSessionId());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && currentUser && userProfile) navigate(userProfile.onboardingStatus === 'complete' ? '/browse' : `/auth/verify${sessionId ? `?sessionId=${sessionId}` : ''}`, { replace: true });
  }, [authLoading, currentUser, userProfile, sessionId, navigate]);

  const sendSignUpLink = async () => {
    setError('');
    if (!displayName.trim()) { setError('Enter your full name.'); return; }
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setLoading(true);
    try {
      const nextSessionId = await register(email, displayName, '', sessionId || undefined);
      setSessionId(nextSessionId);
    }
    catch (err: any) { setError(getAuthErrorMessage(err, 'Failed to send verification link.')); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendSignUpLink();
  };

  if (sessionId) {
    return <EmailVerificationFlow email={email || getPendingSignUpEmail()} sessionId={sessionId} onResend={sendSignUpLink} onChangeEmail={() => { clearPendingSignUp(); setSessionId(''); setError(''); }} />;
  }

  return (
    <AuthSplitCard title="Create your Reshelved account" subtitle="Join Reshelved and start finding books near you.">
      {error && <p className={errorClass}>{error}</p>}
      <GoogleAuthButton label="Sign up with Google" disabled={loading || authLoading} onError={setError} />
      <div className="my-7 flex items-center gap-5 text-sm text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className={`mb-1 block ${labelClass}`}>Full name</label><input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} autoComplete="name" placeholder="Full name" /></div>
        <div><label className={`mb-1 block ${labelClass}`}>Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" placeholder="Email" /></div>
        <button type="submit" disabled={loading || authLoading} className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Sending link...' : 'Continue with email'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-600">Already have an account? <Link to="/login" className="font-semibold hover:underline" style={{ color: LINK_BLUE }}>Log in</Link></p>
    </AuthSplitCard>
  );
};
