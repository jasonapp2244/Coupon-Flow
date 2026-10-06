import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '../lib/api';
import { usePageMeta } from '../lib/hooks';
import { useAuth } from '../store/auth';

/** Only same-site relative paths are allowed as the post-login destination. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function AuthCard({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
      <div className="mt-2 text-ink-soft">{intro}</div>
      <div className="mt-8 rounded-xl bg-card p-6 ring-1 ring-line sm:p-8">{children}</div>
    </div>
  );
}

function Field({ label, error, ...input }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = input.name ?? label;
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} {...input} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className="field" />
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-raspberry">{error}</p>}
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return message ? <p className="rounded-lg bg-raspberry/10 px-3 py-2 text-sm font-medium text-raspberry" role="alert">{message}</p> : null;
}

export function LoginPage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  usePageMeta('Sign in', { noindex: true });
  if (user?.role === 'customer') return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const signedIn = await login(email, password, remember);
      if (signedIn.role !== 'customer') {
        await logout();
        setError('This is an admin account. Use the admin dashboard, or sign in with a shopper account.');
        return;
      }
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 422 ? 'That email and password combination is not right.' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Sign in" intro={<>New here? <Link to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-deal underline">Create an account</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        <Field label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="h-4 w-4 accent-deal" />
            Keep me signed in
          </label>
          <Link to="/forgot-password" className="font-semibold text-deal hover:underline">Forgot password?</Link>
        </div>
        <button type="submit" disabled={busy || !email || !password} className="btn-primary py-3 text-base">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  usePageMeta('Create an account', { noindex: true });
  if (user?.role === 'customer') return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setErrors({ password: 'Use at least 8 characters.' }); return; }
    setBusy(true);
    setErrors({});
    setError('');
    try {
      await register(name.trim(), email.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create an account" intro={<>Already have one? <Link to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-deal underline">Sign in</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        <Field label="Name" name="name" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} error={errors.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} error={errors.password} />
        <p className="text-sm text-muted">Your account keeps every code you buy in one place.</p>
        <button type="submit" disabled={busy || !name || !email || !password} className="btn-primary py-3 text-base">{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  usePageMeta('Reset your password', { noindex: true });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Reset your password" intro="We'll email you a link to choose a new one.">
      {sent ? (
        <div>
          <p className="font-semibold">Check your inbox</p>
          <p className="mt-1 text-sm text-ink-soft">If {email} has an account, a reset link is on its way. It works for 60 minutes.</p>
          <Link to="/login" className="btn-secondary mt-5">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormError message={error} />
          <Field label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <button type="submit" disabled={busy || !email} className="btn-primary py-3 text-base">{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  usePageMeta('Choose a new password', { noindex: true });

  if (!token || !email) {
    return (
      <AuthCard title="This link is incomplete" intro="Open the link from your email again, or request a new one.">
        <Link to="/forgot-password" className="btn-primary">Request a new link</Link>
      </AuthCard>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, email, password, password_confirmation: password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors().email ?? err.fieldErrors().password ?? err.message) : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Choose a new password" intro={`For ${email}`}>
      {done ? (
        <div>
          <p className="font-semibold">Password changed</p>
          <p className="mt-1 text-sm text-ink-soft">Sign in with your new password.</p>
          <Link to="/login" className="btn-primary mt-5">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormError message={error} />
          <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={busy || !password} className="btn-primary py-3 text-base">{busy ? 'Saving…' : 'Save new password'}</button>
        </form>
      )}
    </AuthCard>
  );
}
