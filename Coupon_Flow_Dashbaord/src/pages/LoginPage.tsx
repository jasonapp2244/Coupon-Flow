import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff, ArrowRight, ShieldCheck, TrendingUp, Tag, Store, ShoppingCart, Zap } from 'lucide-react';
import { api, ApiError, clearToken, setToken } from '../lib/api';
import { isStaff } from '../lib/permissions';
import type { User } from '../lib/types';

type AuthView = 'login' | 'forgot' | 'reset';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

// ─── Floating visual card components ────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/12 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
        <TrendingUp size={14} className="text-white" />
      </div>
      <div>
        <p className="text-white font-bold text-base leading-none">{value}</p>
        <p className="text-white/60 text-xs mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function CouponCard({ code, store, discount }: { code: string; store: string; discount: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
        <Tag size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold font-mono">{code}</p>
        <p className="text-white/60 text-[11px]">{store}</p>
      </div>
      <span className="text-emerald-300 text-xs font-bold">{discount}</span>
    </div>
  );
}

// ─── Login Form ──────────────────────────────────────────────────────────────

function LoginForm({ onLogin, onForgot }: { onLogin: (user: User) => void; onForgot: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [credError, setCredError] = useState('');

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    return e;
  };

  const [challenge, setChallenge] = useState<string | null>(null);

  /** Token in hand (after the password, or the password + code): staff only. */
  const finish = async (res: { token: string; user: User }) => {
    setToken(res.token, rememberMe);
    if (!isStaff(res.user)) {
      // Valid customer credentials, but this panel is for staff only: drop the token again.
      await api.post('/auth/logout').catch(() => undefined);
      clearToken();
      setChallenge(null);
      setCredError('This account does not have admin access.');
      setLoading(false);
      return;
    }
    onLogin(res.user);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setCredError('');
    try {
      const res = await api.post<{ token: string; user: User } | { two_factor: true; challenge: string }>('/auth/login', { email, password, device_name: 'admin-dashboard' });
      if ('two_factor' in res) {
        setChallenge(res.challenge);
        setLoading(false);
        return;
      }
      await finish(res);
    } catch (err) {
      setCredError(err instanceof ApiError && err.status === 422
        ? (err.field('email') ?? 'Incorrect email or password.')
        : (err as Error).message);
      setLoading(false);
    }
  };

  if (challenge) {
    return <TwoFactorStep challenge={challenge} onSignedIn={finish} onRestart={() => { setChallenge(null); setPassword(''); setCredError('This sign-in expired. Enter your password again.'); }} onBack={() => { setChallenge(null); setPassword(''); }} />;
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
        <p className="text-slate-500 text-sm mt-1.5">Sign in to your Coupon Follow dashboard.</p>
      </div>

      {credError && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
          {credError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="login-email" className="text-sm font-medium text-slate-700 block mb-1.5">Email Address</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); setCredError(''); }}
            placeholder="Enter your email address"
            className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-all placeholder:text-slate-400 ${errors.email ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-100 focus:border-red-400' : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400'}`}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1.5">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="login-password" className="text-sm font-medium text-slate-700 block mb-1.5">Password</label>
          <div className="relative">
            <input
              id="login-password"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); setCredError(''); }}
              placeholder="Enter your password"
              className={`w-full px-4 py-2.5 pr-11 text-sm rounded-xl border outline-none transition-all placeholder:text-slate-400 ${errors.password ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-100 focus:border-red-400' : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400'}`}
            />
            <button
              type="button"
              onClick={() => setShowPwd(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="sr-only" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
            <div
              aria-hidden="true"
              className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}
            >
              {rememberMe && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className="text-sm text-slate-600">Remember me</span>
          </label>
          <button type="button" onClick={onForgot} className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors">
            Forgot password?
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all shadow-sm shadow-blue-200"
      >
        {loading ? (
          <>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2"/>
              <path d="M14 8a6 6 0 01-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Signing In…
          </>
        ) : (
          <>Sign In <ArrowRight size={15} /></>
        )}
      </button>

      <p className="mt-6 text-center text-xs text-slate-400">
        Need help accessing your account?{' '}
        <a href="mailto:support@couponfollow.com" className="text-blue-600 hover:underline font-medium">Contact Support</a>
      </p>
    </form>
  );
}

// ─── Two-step login: the code from the authenticator app ────────────────────

function TwoFactorStep({ challenge, onSignedIn, onRestart, onBack }: {
  challenge: string;
  onSignedIn: (res: { token: string; user: User }) => Promise<void>;
  onRestart: () => void;
  onBack: () => void;
}) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/two-factor', useRecovery
        ? { challenge, recovery_code: value.trim() }
        : { challenge, code: value });
      await onSignedIn(res);
    } catch (err) {
      if (err instanceof ApiError && err.field('challenge')) { onRestart(); return; }
      setError(err instanceof ApiError ? (err.field(useRecovery ? 'recovery_code' : 'code') ?? err.message) : (err as Error).message);
      setValue('');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm mx-auto">
      <div className="mb-8">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4"><ShieldCheck size={22} className="text-blue-600" /></div>
        <h1 className="text-2xl font-bold text-slate-900">Two-step login</h1>
        <p className="text-slate-500 text-sm mt-1.5">
          {useRecovery ? 'Enter one of the recovery codes you saved when you set up two-step login.' : 'Enter the 6-digit code from your authenticator app.'}
        </p>
      </div>

      {error && <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">{error}</div>}

      <label htmlFor="two-factor-code" className="text-sm font-medium text-slate-700 block mb-1.5">{useRecovery ? 'Recovery code' : 'Code'}</label>
      <input
        id="two-factor-code"
        autoFocus
        autoComplete="one-time-code"
        inputMode={useRecovery ? 'text' : 'numeric'}
        value={value}
        onChange={e => { setValue(useRecovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
        placeholder={useRecovery ? 'abcde-12345' : '123456'}
        className="w-full px-4 py-2.5 text-lg tracking-widest font-mono rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
      />

      <button type="submit" disabled={loading || (!useRecovery && value.length !== 6) || (useRecovery && !value.trim())}
        className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all shadow-sm shadow-blue-200">
        {loading ? 'Checking…' : <>Verify <ArrowRight size={15} /></>}
      </button>

      <div className="mt-5 flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">Back</button>
        <button type="button" onClick={() => { setUseRecovery(r => !r); setValue(''); setError(''); }} className="text-blue-600 hover:underline font-medium">
          {useRecovery ? 'Use the app code' : 'Lost your phone? Use a recovery code'}
        </button>
      </div>
    </form>
  );
}

// ─── Forgot Password Form ────────────────────────────────────────────────────

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email address is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {sent ? (
        <div className="text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Reset link sent</h2>
          <p className="text-slate-500 text-sm mt-2">Check your inbox for password reset instructions.</p>
          <p className="text-xs text-slate-400 mt-1">Sent to: <span className="font-medium text-slate-600">{email}</span></p>
          <button onClick={onBack} className="mt-6 w-full px-6 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            Back to Login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Reset Your Password</h2>
            <p className="text-slate-500 text-sm mt-1.5">Enter your email address and we'll send instructions to reset your password.</p>
          </div>
          <div>
            <label htmlFor="forgot-email" className="text-sm font-medium text-slate-700 block mb-1.5">Email Address</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="Enter your email address"
              className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-all placeholder:text-slate-400 ${error ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-100' : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400'}`}
            />
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all"
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <button type="button" onClick={onBack} className="mt-3 w-full px-6 py-3 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
            ← Back to Login
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Reset Password Form ─────────────────────────────────────────────────────

function ResetPasswordForm({ token, email, onBack }: { token: string; email: string; onBack: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasLength = password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!password) errs.password = 'Password is required';
    else if (!hasLength || !hasUpper || !hasNumber) errs.password = 'Password does not meet requirements';
    if (!confirm) errs.confirm = 'Please confirm your password';
    else if (confirm !== password) errs.confirm = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, email, password, password_confirmation: confirm });
      setDone(true);
    } catch (err) {
      // An expired/used token comes back as an "email" error from the password broker.
      setErrors({ password: err instanceof ApiError ? (err.field('email') ?? err.field('password') ?? err.message) : (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {done ? (
        <div className="text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Password updated</h2>
          <p className="text-slate-500 text-sm mt-2">Your password has been updated successfully.</p>
          <button onClick={onBack} className="mt-6 w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all">
            Back to Login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Set New Password</h2>
            <p className="text-slate-500 text-sm mt-1.5">Choose a strong password for your account.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="reset-password" className="text-sm font-medium text-slate-700 block mb-1.5">New Password</label>
              <div className="relative">
                <input
                  id="reset-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Enter new password"
                  className={`w-full px-4 py-2.5 pr-11 text-sm rounded-xl border outline-none transition-all placeholder:text-slate-400 ${errors.password ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400'}`}
                />
                <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>}
              <div className="mt-2.5 space-y-1">
                {[
                  { ok: hasLength, label: 'Minimum 8 characters' },
                  { ok: hasUpper, label: 'One uppercase letter' },
                  { ok: hasNumber, label: 'One number' },
                ].map(({ ok, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                      {ok && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className={`text-xs ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="reset-confirm" className="text-sm font-medium text-slate-700 block mb-1.5">Confirm Password</label>
              <input
                id="reset-confirm"
                type="password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); if (errors.confirm) setErrors(p => ({ ...p, confirm: '' })); }}
                placeholder="Re-enter new password"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-all placeholder:text-slate-400 ${errors.confirm ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400'}`}
              />
              {errors.confirm && <p className="text-xs text-red-500 mt-1.5">{errors.confirm}</p>}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
          <button type="button" onClick={onBack} className="mt-3 w-full px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
            ← Back to Login
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Left brand panel ────────────────────────────────────────────────────────

function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-[#0D1117] via-[#111827] to-[#1E2A3A] p-10 relative overflow-hidden">
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
        backgroundSize: '48px 48px'
      }} />

      {/* Soft glows */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />

      {/* Logo */}
      <div className="relative flex items-center gap-2.5 mb-auto">
        <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30">
          <Tag size={16} className="text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">Coupon Follow</span>
      </div>

      {/* Headline */}
      <div className="relative mt-auto mb-10">
        <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
          Manage Every Deal.<br />
          <span className="text-blue-400">Track Every Conversion.</span>
        </h2>
        <p className="text-white/50 text-base mt-4 leading-relaxed max-w-xs">
          Control your stores, coupons, redemptions and performance from one powerful platform.
        </p>
      </div>

      {/* Floating cards */}
      <div className="relative space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Clicks" value="284.1K" color="bg-blue-600" />
          <StatCard label="Redemptions" value="18,429" color="bg-emerald-600" />
        </div>
        <CouponCard code="SAVE20FALL" store="Amazon" discount="20% OFF" />
        <CouponCard code="NIKE15RUN" store="Nike" discount="15% OFF" />
        <div className="flex gap-3">
          <div className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-amber-500/80 rounded-lg flex items-center justify-center"><Store size={12} className="text-white" /></div>
            <div><p className="text-white font-semibold text-sm">8,732</p><p className="text-white/50 text-[11px]">Stores</p></div>
          </div>
          <div className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-violet-500/80 rounded-lg flex items-center justify-center"><ShoppingCart size={12} className="text-white" /></div>
            <div><p className="text-white font-semibold text-sm">$128K</p><p className="text-white/50 text-[11px]">Revenue</p></div>
          </div>
          <div className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-rose-500/80 rounded-lg flex items-center justify-center"><Zap size={12} className="text-white" /></div>
            <div><p className="text-white font-semibold text-sm">6.5%</p><p className="text-white/50 text-[11px]">CVR</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function LoginPage({ onLogin }: LoginPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const resetToken = params.get('token');
  const resetEmail = params.get('email');
  // Password-reset emails link to #/reset-password?token=…&email=…
  const [view, setView] = useState<AuthView>(
    location.pathname === '/reset-password' && resetToken && resetEmail ? 'reset' : 'login',
  );
  const backToLogin = () => { setView('login'); navigate('/', { replace: true }); };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <BrandPanel />

      {/* Right panel */}
      <div className="flex-1 lg:max-w-[460px] flex flex-col">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 px-8 py-6 border-b border-slate-200 bg-white">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Tag size={14} className="text-white" />
          </div>
          <span className="font-bold text-slate-900 text-base">Coupon Follow</span>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-10 bg-white lg:border-l lg:border-slate-200">
          {view === 'login' && <LoginForm onLogin={onLogin} onForgot={() => setView('forgot')} />}
          {view === 'forgot' && <ForgotPasswordForm onBack={() => setView('login')} />}
          {view === 'reset' && resetToken && resetEmail && <ResetPasswordForm token={resetToken} email={resetEmail} onBack={backToLogin} />}
        </div>
      </div>
    </div>
  );
}
