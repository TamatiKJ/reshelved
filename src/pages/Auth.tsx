import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LINK_BLUE = '#1665CC';
const RESEND_COOLDOWN_SECONDS = 60;
const PENDING_SIGNUP_EMAIL_KEY = 'reshelved:pendingSignUpEmail';
const PENDING_SIGNUP_NAME_KEY = 'reshelved:pendingSignUpName';
const EMAIL_LINK_VERIFIED_KEY = 'reshelved:emailLinkVerified';
const inputClass = 'w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const passwordInputClass = 'w-full rounded-md border border-stone-300 px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const labelClass = 'text-sm font-bold text-stone-800';
const errorClass = 'mt-6 text-sm font-medium text-red-600';

const getPendingSignUpEmail = () => window.localStorage.getItem(PENDING_SIGNUP_EMAIL_KEY) || '';
const getPendingSignUpName = () => window.localStorage.getItem(PENDING_SIGNUP_NAME_KEY) || '';
const clearPendingSignUp = () => {
  window.localStorage.removeItem(PENDING_SIGNUP_EMAIL_KEY);
  window.localStorage.removeItem(PENDING_SIGNUP_NAME_KEY);
};
const hasVerifiedEmailLink = (email: string) => {
  try {
    const raw = window.localStorage.getItem(EMAIL_LINK_VERIFIED_KEY);
    if (!raw || !email) return false;
    const parsed = JSON.parse(raw) as { email?: string; verifiedAt?: number };
    return parsed.email === email && Number(parsed.verifiedAt || 0) > 0;
  } catch {
    return false;
  }
};

const getAuthErrorMessage = (error: any, fallback: string) => {
  switch (error?.code) {
    case 'auth/email-already-in-use': return 'This email is already registered. Please log in instead.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
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
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

const PasswordField: React.FC<{ id?: string; value: string; onChange: (value: string) => void; autoComplete: string; required?: boolean; placeholder?: string; }> = ({ id, value, onChange, autoComplete, required = true, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={visible ? 'text' : 'password'} required={required} value={value} onChange={(e) => onChange(e.target.value)} className={passwordInputClass} autoComplete={autoComplete} placeholder={placeholder} />
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

const AuthShell: React.FC<{ children: React.ReactNode; showLegal?: boolean }> = ({ children, showLegal = true }) => (
  <div className="min-h-screen bg-stone-50 flex flex-col">
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
            <h1 className="text-2xl font-bold tracking-tight text-stone-950">{title}</h1>
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
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setGoogleLoading(false);
      onError(getAuthErrorMessage(err, 'Google sign-in failed. Please try again.'));
    }
  };

  return (
    <button type="button" onClick={handleGoogleAuth} disabled={disabled || googleLoading} className="mt-8 flex w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60">
      <GoogleIcon />
      {googleLoading ? 'Redirecting to Google...' : label}
    </button>
  );
};

const EmailLinkSentScreen: React.FC<{ email: string; onResend: () => Promise<void>; onChangeEmail: () => void }> = ({ email, onResend, onChangeEmail }) => {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(RESEND_COOLDOWN_SECONDS);
  const [verified, setVerified] = useState(hasVerifiedEmailLink(email));

  useEffect(() => {
    if (cooldownRemaining <= 0) return undefined;
    const timer = window.setInterval(() => setCooldownRemaining((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownRemaining]);

  useEffect(() => {
    const checkVerified = () => setVerified(hasVerifiedEmailLink(email));
    const timer = window.setInterval(checkVerified, 1000);
    window.addEventListener('storage', checkVerified);
    checkVerified();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', checkVerified);
    };
  }, [email]);

  const resend = async () => {
    if (cooldownRemaining > 0) return;
    setError('');
    setMessage('');
    setResending(true);
    try {
      await onResend();
      setMessage('Verification link sent again.');
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Could not resend the verification link.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
        <section className="w-full max-w-3xl px-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center text-primary-600"><i className={`las ${verified ? 'la-check-circle' : 'la-envelope'} text-7xl`} /></div>
          <h1 className="mt-8 text-4xl font-black leading-tight tracking-tight text-stone-950 sm:text-6xl">{verified ? 'Email verified.' : 'Verify your email to create your account.'}</h1>
          <p className="mx-auto mt-8 max-w-md text-xl font-bold leading-snug text-stone-800">{verified ? 'Your email has been verified. Continue in the tab that opened from your email to set your password.' : <>We sent a secure sign-up link to<br />{email}.</>}</p>
          {!verified && <p className="mt-10 text-lg font-bold" style={{ color: LINK_BLUE }}>Check your spam folder if the email is missing.</p>}
          {error && <p className={errorClass}>{error}</p>}
          {message && <div className="mx-auto mt-6 max-w-xl rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
          {!verified && <button onClick={resend} disabled={resending || cooldownRemaining > 0} className="mt-10 w-full max-w-2xl cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-5 text-lg font-bold text-stone-950 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60">{resending ? 'Sending...' : cooldownRemaining > 0 ? `Resend verification link in ${cooldownRemaining}s` : 'Resend verification link'}</button>}
          {verified ? <button onClick={() => window.location.assign('/set-password')} className="mt-10 w-full max-w-2xl cursor-pointer rounded-md bg-primary-600 px-4 py-5 text-lg font-bold text-white hover:bg-primary-700">Set your password</button> : <button onClick={onChangeEmail} className="mt-8 block w-full cursor-pointer text-lg font-bold text-stone-800 hover:underline">Change email address</button>}
        </section>
      </main>
      <AuthFooter />
    </div>
  );
};

export const Login: React.FC = () => {
  const { login, resetPassword, currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && currentUser) navigate(currentUser.emailVerified ? '/browse' : '/verify-email', { replace: true });
  }, [authLoading, currentUser, navigate]);

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
  const { currentUser, loading: authLoading, sendVerificationEmail, refreshAuthUser, logout } = useAuth();
  const navigate = useNavigate();
  const pendingEmail = getPendingSignUpEmail();
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!authLoading && currentUser?.emailVerified) navigate('/set-password', { replace: true });
    if (!authLoading && !currentUser && !pendingEmail) navigate('/login', { replace: true });
  }, [authLoading, currentUser, pendingEmail, navigate]);

  const handleVerified = async () => {
    setError(''); setChecking(true);
    try {
      const user = await refreshAuthUser();
      if (user?.emailVerified) {
        navigate('/set-password', { replace: true });
        return;
      }
      setError('Open the secure link in your email to finish signing up.');
    } catch (err: any) { setError(getAuthErrorMessage(err, 'Could not check verification status.')); }
    finally { setChecking(false); }
  };

  if (pendingEmail) {
    return <EmailLinkSentScreen email={pendingEmail} onResend={sendVerificationEmail} onChangeEmail={() => { clearPendingSignUp(); navigate('/register', { replace: true }); }} />;
  }

  return (
    <AuthShell showLegal={false}>
      <section className="w-full max-w-2xl px-4 text-center">
        <AuthLogo className="mx-auto h-7 w-auto" />
        <div className="mx-auto mt-10 flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-stone-500 text-primary-600"><i className="las la-envelope-open-text text-6xl" /></div>
        <h1 className="mt-8 text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">Check your email.</h1>
        <p className="mx-auto mt-5 max-w-md text-lg font-semibold leading-snug text-stone-800">Open the secure link sent to<br />{currentUser?.email || 'your email address'}.</p>
        <p className="mt-6 text-base font-bold text-stone-900">Don&apos;t see it? <span style={{ color: LINK_BLUE }}>Check your spam folder.</span></p>
        {error && <p className={errorClass}>{error}</p>}
        <button onClick={handleVerified} disabled={checking || authLoading} className="mt-8 w-full max-w-xl cursor-pointer rounded-md bg-primary-600 px-4 py-4 text-base font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60">{checking ? 'Checking...' : "I've verified"}</button>
        <button onClick={() => logout()} className="mt-4 w-full max-w-xl cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-4 text-base font-semibold text-stone-900 hover:bg-stone-50">Use another account</button>
      </section>
    </AuthShell>
  );
};

export const SetPassword: React.FC = () => {
  const { currentUser, loading: authLoading, setAccountPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !currentUser) navigate('/login', { replace: true });
    if (!authLoading && currentUser && !currentUser.emailVerified) navigate('/verify-email', { replace: true });
  }, [authLoading, currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await setAccountPassword(password);
      window.localStorage.removeItem(EMAIL_LINK_VERIFIED_KEY);
      navigate('/browse', { replace: true });
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Could not set your password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell>
      <section className="w-full max-w-md rounded-xl border border-stone-300 bg-white px-7 py-8 shadow-sm sm:px-9">
        <div className="text-center"><AuthLogo /><h1 className="mt-7 text-xl font-semibold text-stone-950">Set your password</h1><p className="mt-2 text-sm text-stone-500">Your email is verified. Create a password to finish setting up your account.</p></div>
        {error && <p className={errorClass}>{error}</p>}
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div><label className={`mb-1 block ${labelClass}`}>Password</label><PasswordField value={password} onChange={setPassword} autoComplete="new-password" /></div>
          <div><label className={`mb-1 block ${labelClass}`}>Confirm password</label><PasswordField value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" /></div>
          <button type="submit" disabled={saving || authLoading} className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Set password and continue'}</button>
        </form>
      </section>
    </AuthShell>
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
    try {
      await resetPassword(email);
      setSentEmail(email.trim().toLowerCase());
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
    }
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
  const { register, currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(getPendingSignUpName());
  const [email, setEmail] = useState(getPendingSignUpEmail());
  const [sentEmail, setSentEmail] = useState(getPendingSignUpEmail());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && currentUser) navigate(currentUser.emailVerified ? '/set-password' : '/verify-email', { replace: true });
  }, [authLoading, currentUser, navigate]);

  const sendSignUpLink = async () => {
    setError('');
    if (!displayName.trim()) { setError('Enter your full name.'); return; }
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setLoading(true);
    try {
      await register(email, displayName, '');
      setSentEmail(email.trim().toLowerCase());
    }
    catch (err: any) { setError(getAuthErrorMessage(err, 'Failed to send verification link.')); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendSignUpLink();
  };

  if (sentEmail) {
    return <EmailLinkSentScreen email={sentEmail} onResend={sendSignUpLink} onChangeEmail={() => { clearPendingSignUp(); setSentEmail(''); setError(''); }} />;
  }

  return (
    <AuthSplitCard title="Create your account" subtitle="Join Reshelved and start finding books near you.">
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