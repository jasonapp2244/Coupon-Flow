import { useEffect, useState } from 'react';
import { Copy, Download, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button, Input } from './ui';
import { Modal } from './Modal';
import { FieldError } from './FormParts';
import { api, ApiError } from '../lib/api';
import { dateTime } from '../lib/format';

interface Status { enabled: boolean; confirmed_at: string | null; recovery_codes_left: number }
interface Pending { secret: string; otpauth_url: string; qr_svg: string }

/** "ABCD EFGH IJKL…" so the key is easy to type into an app by hand. */
const grouped = (secret: string) => secret.replace(/(.{4})/g, '$1 ').trim();

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* the codes stay on screen to copy by hand */ }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Coupon Follow admin recovery codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coupon-follow-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Keep these recovery codes somewhere safe, like a password manager. If you lose your phone, each code signs you in once.
        <strong className="text-slate-800"> They won't be shown again.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 font-mono text-sm text-slate-800">
        {codes.map(c => <li key={c}>{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</Button>
        <Button variant="outline" size="sm" onClick={download}><Download size={13} /> Download</Button>
        <Button size="sm" className="ml-auto" onClick={onDone}>I saved them</Button>
      </div>
    </div>
  );
}

/**
 * Two-step login for the signed-in staff member: set it up with an authenticator app, get
 * recovery codes, replace them, or turn it off. `onEnabled` fires once setup is finished.
 */
export function TwoFactorSetup({ onEnabled }: { onEnabled?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [passwordFor, setPasswordFor] = useState<'disable' | 'regenerate' | null>(null);
  const [password, setPassword] = useState('');

  const load = () => {
    setLoadError(null);
    api.get<Status>('/auth/two-factor').then(setStatus).catch((e: Error) => setLoadError(e.message));
  };
  useEffect(load, []);

  const start = async () => {
    setBusy(true); setError('');
    try { setPending(await api.post<Pending>('/auth/two-factor/setup')); setCode(''); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true); setError('');
    try {
      const res = await api.post<{ recovery_codes: string[] }>('/auth/two-factor/confirm', { code });
      setPending(null);
      setCodes(res.recovery_codes);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? (e.field('code') ?? e.message) : (e as Error).message);
    } finally { setBusy(false); }
  };

  const withPassword = async () => {
    setBusy(true); setError('');
    try {
      if (passwordFor === 'disable') {
        await api.delete('/auth/two-factor', { password });
      } else {
        const res = await api.post<{ recovery_codes: string[] }>('/auth/two-factor/recovery-codes', { password });
        setCodes(res.recovery_codes);
      }
      setPasswordFor(null); setPassword('');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? (e.field('password') ?? e.message) : (e as Error).message);
    } finally { setBusy(false); }
  };

  if (loadError) return <p className="text-sm text-red-600">Couldn't load two-step login: {loadError} <button onClick={load} className="underline">Retry</button></p>;
  if (!status) return <p className="text-sm text-slate-400">Loading…</p>;

  if (codes) return <RecoveryCodes codes={codes} onDone={() => { setCodes(null); onEnabled?.(); }} />;

  if (pending) {
    const qr = `data:image/svg+xml;base64,${btoa(pending.qr_svg)}`;
    return (
      <div className="space-y-4">
        <ol className="space-y-1 text-sm text-slate-600 list-decimal pl-5">
          <li>Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
          <li>Scan this QR code, or type the key by hand.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-5">
          <img src={qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-lg border border-slate-200 bg-white p-2" />
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Key (if you can't scan)</p>
            <p className="mt-1 font-mono text-sm text-slate-800 break-all select-all">{grouped(pending.secret)}</p>
          </div>
        </div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); confirm(); }}>
          <div className="w-40">
            <Input label="6-digit code" value={code} onChange={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="123456" />
          </div>
          <Button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Turn on'}</Button>
          <Button variant="ghost" onClick={() => { setPending(null); setError(''); }} disabled={busy}>Cancel</Button>
        </form>
        <FieldError message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {status.enabled ? (
        <>
          <p className="flex items-center gap-2 text-sm text-emerald-700"><ShieldCheck size={16} /> On since {dateTime(status.confirmed_at)}</p>
          <p className="text-xs text-slate-500">{status.recovery_codes_left} of 10 recovery codes left.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setPasswordFor('regenerate'); setError(''); }}><KeyRound size={13} /> New recovery codes</Button>
            <Button variant="outline" size="sm" onClick={() => { setPasswordFor('disable'); setError(''); }}><ShieldOff size={13} /> Turn off</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Off. With two-step login, signing in needs your password <em>and</em> a code from your phone, so a stolen password alone can't open the admin.
          </p>
          <Button size="sm" onClick={start} disabled={busy}><ShieldCheck size={13} /> {busy ? 'Starting…' : 'Set up two-step login'}</Button>
        </>
      )}
      <FieldError message={passwordFor ? undefined : error} />

      <Modal open={passwordFor !== null} onClose={() => { setPasswordFor(null); setPassword(''); }}
        title={passwordFor === 'disable' ? 'Turn off two-step login?' : 'Replace recovery codes?'}
        footer={<>
          <Button variant="ghost" onClick={() => { setPasswordFor(null); setPassword(''); }} disabled={busy}>Cancel</Button>
          <Button variant={passwordFor === 'disable' ? 'danger' : 'primary'} onClick={withPassword} disabled={busy || !password}>
            {busy ? 'Working…' : passwordFor === 'disable' ? 'Turn off' : 'Replace codes'}
          </Button>
        </>}>
        <form onSubmit={e => { e.preventDefault(); if (password) withPassword(); }} className="space-y-2">
          <p className="text-sm text-slate-600">
            {passwordFor === 'disable' ? 'Your account will be protected by your password only.' : 'Your old recovery codes stop working.'} Enter your password to continue.
          </p>
          <Input label="Password" type="password" value={password} onChange={v => { setPassword(v); setError(''); }} />
          <FieldError message={error} />
        </form>
      </Modal>
    </div>
  );
}
