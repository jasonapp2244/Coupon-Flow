import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BadgeCheck, MailWarning, Receipt, ShoppingBag } from 'lucide-react';
import { Spinner } from '../components/States';
import { API_BASE_URL, api, ApiError } from '../lib/api';
import { useApi, usePageMeta } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { useToast } from '../store/toast';
import type { Order, Paginated, User } from '../lib/types';

function Field({ label, error, ...input }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `account-${input.name}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} {...input} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className="field" />
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-raspberry">{error}</p>}
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const emailChanged = email.trim() !== user.email;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await api.put<{ data: User }>('/auth/profile', {
        name: name.trim(),
        ...(emailChanged ? { email: email.trim(), current_password: password } : {}),
      });
      setUser(res.data);
      setPassword('');
      toast(emailChanged ? 'Saved. Check your inbox to confirm the new address.' : 'Profile saved');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      else toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-line" noValidate>
      <h2 className="font-display text-xl font-semibold">Profile</h2>
      <Field label="Name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} error={errors.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
      {emailChanged && (
        <Field label="Current password" name="current_password" type="password" autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)} error={errors.current_password} />
      )}
      <button type="submit" disabled={busy || !name.trim()} className="btn-primary self-start">{busy ? 'Saving…' : 'Save profile'}</button>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) { setErrors({ password: 'Use at least 8 characters.' }); return; }
    if (next !== confirm) { setErrors({ password_confirmation: 'The two passwords are different.' }); return; }
    setBusy(true);
    setErrors({});
    try {
      await api.put('/auth/profile', { current_password: current, password: next, password_confirmation: confirm });
      setCurrent(''); setNext(''); setConfirm('');
      toast('Password changed. Other devices have been signed out.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      else toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-line" noValidate>
      <h2 className="font-display text-xl font-semibold">Change password</h2>
      <Field label="Current password" name="pw_current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} error={errors.current_password} />
      <Field label="New password" name="pw_new" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} error={errors.password} />
      <Field label="Repeat new password" name="pw_confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} error={errors.password_confirmation} />
      <button type="submit" disabled={busy || !current || !next} className="btn-primary self-start">{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}

function EmailStatus({ user }: { user: User }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (user.email_verified) {
    return <p className="flex items-center gap-2 text-sm text-deal"><BadgeCheck size={16} aria-hidden="true" /> {user.email} is confirmed</p>;
  }

  const resend = async () => {
    setBusy(true);
    try {
      toast((await api.post<{ message: string }>('/auth/email/resend')).message);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-marigold-soft px-4 py-3 text-sm">
      <MailWarning size={16} aria-hidden="true" />
      <span className="flex-1">Confirm {user.email} to buy exclusive codes.</span>
      <button onClick={resend} disabled={busy} className="font-semibold text-deal underline">{busy ? 'Sending…' : 'Send confirmation link'}</button>
    </div>
  );
}

export function AccountPage() {
  const { user } = useAuth();
  const orders = useApi<Paginated<Order>>('/orders?per_page=1');
  usePageMeta('My account', { noindex: true });

  if (!user) return null;
  const orderCount = orders.data?.meta.total;

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="page-title">Hi, {user.name.split(' ')[0]}</h1>
      <div className="mt-4"><EmailStatus user={user} /></div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/account/orders" className="flex items-center gap-4 rounded-xl bg-card p-5 ring-1 ring-line hover:ring-ink">
          <Receipt className="text-deal" aria-hidden="true" />
          <span><span className="block font-semibold">My orders</span><span className="text-sm text-muted">{orderCount === undefined ? 'Your bought codes' : `${orderCount} ${orderCount === 1 ? 'order' : 'orders'}`}</span></span>
        </Link>
        <Link to="/coupons?kind=paid" className="flex items-center gap-4 rounded-xl bg-card p-5 ring-1 ring-line hover:ring-ink">
          <ShoppingBag className="text-deal" aria-hidden="true" />
          <span><span className="block font-semibold">Exclusive codes</span><span className="text-sm text-muted">Codes you can only get here</span></span>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ProfileForm user={user} />
        <PasswordForm />
      </div>
    </div>
  );
}

/**
 * The emailed confirmation link lands here with the signed API URL in ?link=.
 * Only links that point at our own API are followed.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const link = params.get('link') ?? '';
  const { refresh, user } = useAuth();
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const started = useRef(false);

  usePageMeta('Confirm your email', { noindex: true });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!link.startsWith(`${API_BASE_URL}/auth/email/verify/`)) { setState('failed'); return; }
    api.getAbsolute(link)
      .then(() => { setState('done'); return refresh(); })
      .catch(() => setState('failed'));
  }, [link, refresh]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      {state === 'working' && <><h1 className="page-title">Confirming…</h1><Spinner /></>}
      {state === 'done' && (
        <>
          <BadgeCheck size={48} className="mx-auto text-deal" aria-hidden="true" />
          <h1 className="page-title mt-4">Email confirmed</h1>
          <p className="mt-2 text-ink-soft">You can now buy exclusive codes. They'll be sent to this address.</p>
          <Link to={user ? '/cart' : '/login'} className="btn-primary mt-6">{user ? 'Go to your cart' : 'Sign in'}</Link>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1 className="page-title">This link didn't work</h1>
          <p className="mt-2 text-ink-soft">It may have expired (links last 24 hours) or already been used. Sign in and send yourself a new one from My account.</p>
          <Link to="/account" className="btn-primary mt-6">Go to My account</Link>
        </>
      )}
    </div>
  );
}
