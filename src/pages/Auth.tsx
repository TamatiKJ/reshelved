import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, updatePassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const LINK_BLUE = '#1665CC';
const SIGNUP_EMAIL_KEY = 'reshelved.signup.email';
const SIGNUP_NAME_KEY = 'reshelved.signup.name';
const inputClass = 'w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const passwordInputClass = 'w-full rounded-md border border-stone-300 px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-[#1665CC] focus:ring-2 focus:ring-[#1665CC]/10';
const labelClass = 'text-sm font-bold text-stone-800';
const errorClass = 'mt-6 text-sm font-medium text-red-600';

const getAuthErrorMessage = (error: any, fallback: string) => {
  switch (error?.code) {
    case 'auth/email-already-in-use': return 'This email is already registered. Please log in instead.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 8 characters.';
    case 'auth/invalid-action-code': return 'This verification link is no longer valid. Request a new link.';
    case 'auth/expired-action-code': return 'This verification link has expired. Request a new link.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Invalid email or password.';
    default: return error?.message || fallback;
  }
};

const AuthLogo: React.FC = () => (
  <Link to="/" className="inline-flex items-center justify-center" aria-label="Reshelved home">
    <img src="/reshelved-logo.svg" alt="Reshelved" className="h-8 w-auto" />
  </Link>
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
  <footer className="w-full border-t border-stone-200 bg-white/80 px-4 py-5 text-[13px] text-stone-600 sm:text-[14px]">
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

const LegalAgreement: React.FC = () => (
  <p className="mt-6 max-w-md px-3 text-center text-[13px] leading-relaxed text-stone-600 sm:text-[14px]">
    By continuing, I agree to Reshelved&apos;s <Link to="/terms" className="underline underline-offset-2 hover:text-stone-900">terms</Link>, <Link to="/privacy-policy" className="underline underline-offset-2 hover:text-stone-900">privacy policy</Link>, and <Link to="/cookies" className="underline underline-offset-2 hover:text-stone-900">cookie policy</Link>.
  </p>
);

const AuthShell: React.FC<{ children: React.ReactNode; showLegal?: boolean }> = ({ children, showLegal = true }) => (
  <div className="min-h-screen bg-stone-50 flex flex-col">
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">{children}{showLegal && <LegalAgreement />}</main>
    <AuthFooter />
  </div>
);

export const Login: React.FC = () => {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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
    try { await login(email, password); navigate('/browse'); }
    catch (err: any) { setError(getAuthErrorMessage(err, 'Failed to log in')); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <section className="w-full max-w-md rounded-xl border border-stone-300 bg-white px-7 py-8 shadow-sm sm:px-9">
        <div className="text-center"><AuthLogo /><h1 className="mt-7 text-xl font-semibold text-stone-950">Log in to Reshelved</h1></div>
        {error && <p className={errorClass}>{error}</p>}
        {message && <div className="mt-6 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div><div className="mb-1 flex items-center justify-between gap-3"><label className={labelClass}>Email</label></div><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" /></div>
          <div><div className="mb-1 flex items-center justify-between gap-3"><label className={labelClass}>Password</label><button type="button" onClick={handlePasswordReset} disabled={resetLoading} className="cursor-pointer text-xs font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-60" style={{ color: LINK_BLUE }}>{resetLoading ? 'Sending...' : 'Forgot password?'}</button></div><PasswordField value={password} onChange={setPassword} autoComplete="current-password" /></div>
          <button type="submit" disabled={loading} className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Logging in...' : 'Log in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-600">Don&apos;t have an account? <Link to="/register" className="font-semibold hover:underline" style={{ color: LINK_BLUE }}>Sign up</Link></p>
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

  const sendReset = async (e?: React.FormEvent) => {
    e?.preventDefault(); setError('');
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setLoading(true);
    try { await resetPassword(email); setSentEmail(email.trim().toLowerCase()); }
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
          <p className="mt-8 text-2xl font-bold text-stone-900">Don&apos;t see the email? Check your SPAM folder.</p>
          <button onClick={() => sendReset()} disabled={loading} className="mt-8 w-full max-w-xl cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-4 text-base font-semibold text-stone-900 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Resending...' : 'Resend email'}</button>
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
        <form onSubmit={sendReset} className="mt-7 space-y-4"><div><label className={`mb-1 block ${labelClass}`}>Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" /></div><button type="submit" disabled={loading} className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Sending...' : 'Send reset email'}</button></form>
        <button onClick={() => navigate('/login')} className="mt-4 w-full cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-50">Go back</button>
      </section>
    </AuthShell>
  );
};

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const returningFromEmail = useMemo(() => isSignInWithEmailLink(auth, window.location.href), []);
  const [displayName, setDisplayName] = useState(() => window.localStorage.getItem(SIGNUP_NAME_KEY) || '');
  const [email, setEmail] = useState(() => window.localStorage.getItem(SIGNUP_EMAIL_KEY) || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendVerificationLink = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError('');
    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2) { setError('Please enter your full name.'); return; }
    if (!cleanEmail) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    try {
      await sendSignInLinkToEmail(auth, cleanEmail, { url: `${window.location.origin}/register`, handleCodeInApp: true });
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
    if (displayName.trim().length < 2 || !email.trim()) { setError('Confirm your name and email to continue.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const credential = await signInWithEmailLink(auth, email.trim().toLowerCase(), window.location.href);
      await updateProfile(credential.user, { displayName: displayName.trim() });
      await updatePassword(credential.user, password);
      const now = Date.now();
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        displayName: displayName.trim(),
        email: credential.user.email || email.trim().toLowerCase(),
        photoURL: credential.user.photoURL || '',
        location: '', phone: '', bio: '', isAdmin: false, flagged: false, flagCount: 0,
        createdAt: now, online: true, lastSeen: now, deactivated: false, emailVerified: true
      }, { merge: true });
      await setDoc(doc(db, 'publicProfiles', credential.user.uid), {
        uid: credential.user.uid, displayName: displayName.trim(), photoURL: '', location: '',
        createdAt: now, ratingAverage: 0, ratingCount: 0, updatedAt: now
      }, { merge: true });
      window.localStorage.removeItem(SIGNUP_EMAIL_KEY);
      window.localStorage.removeItem(SIGNUP_NAME_KEY);
      navigate('/browse');
    } catch (err: any) {
      setError(getAuthErrorMessage(err, 'Could not finish registration. Request a new link and try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (returningFromEmail) {
    return (
      <AuthShell>
        <section className="w-full max-w-md rounded-xl border border-stone-300 bg-white px-7 py-8 shadow-sm sm:px-9">
          <div className="text-center"><AuthLogo /><div className="mx-auto mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF4E2] text-primary-600"><i className="las la-check text-3xl" /></div><h1 className="mt-5 text-xl font-semibold text-stone-950">Email verified</h1><p className="mt-2 text-sm leading-relaxed text-stone-500">Create your password to finish setting up your Reshelved account.</p></div>
          {error && <p className={errorClass}>{error}</p>}
          <form onSubmit={finishVerifiedRegistration} className="mt-7 space-y-4">
            <div><label className={`mb-1 block ${labelClass}`}>Full name</label><input type="text" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} autoComplete="name" /></div>
            <div><label className={`mb-1 block ${labelClass}`}>Email</label><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} autoComplete="email" /></div>
            <div><label className={`mb-1 block ${labelClass}`}>Password</label><PasswordField value={password} onChange={setPassword} autoComplete="new-password" /></div>
            <div><label className={`mb-1 block ${labelClass}`}>Confirm password</label><PasswordField value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" /></div>
            <button type="submit" disabled={loading} className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Finishing account...' : 'Finish creating account'}</button>
          </form>
        </section>
      </AuthShell>
    );
  }

  if (sent) {
    return (
      <AuthShell showLegal={false}>
        <section className="w-full max-w-2xl px-4 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-[#FFF4E2] text-primary-600"><i className="las la-envelope-open-text text-6xl" /></div>
          <h1 className="mt-9 text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">Verify your email to create your account.</h1>
          <p className="mx-auto mt-6 max-w-md text-lg font-semibold leading-snug text-stone-700">We sent a secure sign-up link to<br />{email}.</p>
          <p className="mt-7 text-base font-semibold text-stone-800">Click the link in your email to continue. Check your spam folder if it is missing.</p>
          <button type="button" onClick={() => sendVerificationLink()} disabled={loading} className="mt-8 w-full max-w-xl cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-4 text-base font-semibold text-stone-900 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Sending...' : 'Resend verification link'}</button>
          <button type="button" onClick={() => setSent(false)} className="mt-4 w-full max-w-xl cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-4 text-base font-semibold text-stone-900 hover:bg-stone-50">Change email address</button>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <section className="w-full max-w-md rounded-xl border border-stone-300 bg-white px-7 py-8 shadow-sm sm:px-9">
        <div className="text-center"><AuthLogo /><h1 className="mt-7 text-xl font-semibold text-stone-950">Create your Reshelved account</h1><p className="mt-2 text-sm text-stone-500">Verify your email before your account is created.</p></div>
        {error && <p className={errorClass}>{error}</p>}
        <form onSubmit={sendVerificationLink} className="mt-7 space-y-4">
          <div><label className={`mb-1 block ${labelClass}`}>Full name</label><input type="text" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} autoComplete="name" /></div>
          <div><label className={`mb-1 block ${labelClass}`}>Email</label><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} autoComplete="email" /></div>
          <button type="submit" disabled={loading} className="w-full cursor-pointer rounded-md bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Sending link...' : 'Continue with email'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-600">Already have an account? <Link to="/login" className="font-semibold hover:underline" style={{ color: LINK_BLUE }}>Log in</Link></p>
      </section>
    </AuthShell>
  );
};
