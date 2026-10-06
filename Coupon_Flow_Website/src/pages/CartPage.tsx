import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, Lock, Trash2 } from 'lucide-react';
import { EmptyState } from '../components/States';
import { api, ApiError } from '../lib/api';
import { usePageMeta } from '../lib/hooks';
import { money } from '../lib/format';
import { useAuth } from '../store/auth';
import { useCart } from '../store/cart';
import { usePurchases } from '../store/purchases';
import { useToast } from '../store/toast';
import type { Coupon } from '../lib/types';

type Availability = 'ok' | 'sold_out' | 'gone';

/** Re-checks every cart line against the live catalogue (prices, stock, still published). */
function useAvailability() {
  const cart = useCart();
  const [status, setStatus] = useState<Record<number, Availability>>({});
  const ids = cart.items.map(i => i.id).join(',');

  useEffect(() => {
    let stale = false;
    Promise.all(cart.items.map(item =>
      api.get<{ data: Coupon }>(`/public/coupons/${item.id}`)
        .then(res => {
          if (!stale) cart.refresh(res.data);
          return [item.id, res.data.in_stock ? 'ok' : 'sold_out'] as const;
        })
        .catch((e: unknown) => [item.id, e instanceof ApiError && e.status === 404 ? 'gone' : 'ok'] as const),
    )).then(entries => { if (!stale) setStatus(Object.fromEntries(entries)); });
    return () => { stale = true; };
    // Re-run when the set of coupons changes, not on every price refresh.
  }, [ids]);

  return status;
}

function VerifyEmailNotice({ email }: { email: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>('/auth/email/resend');
      toast(res.message);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg bg-marigold-soft px-4 py-3 text-sm" role="alert">
      <p className="font-semibold">Confirm your email to check out</p>
      <p className="mt-1 text-ink-soft">Your codes are sent to {email}, so we need to know it reaches you. Open the link we emailed you, then come back.</p>
      <button onClick={resend} disabled={busy} className="mt-2 font-semibold text-deal underline disabled:opacity-60">{busy ? 'Sending…' : 'Send the link again'}</button>
    </div>
  );
}

export default function CartPage() {
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const availability = useAvailability();
  const purchases = usePurchases();
  const [errors, setErrors] = useState<string[]>([]);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [busy, setBusy] = useState(false);

  usePageMeta('Your cart', { noindex: true });

  const unavailable = cart.items
    .filter(i => purchases.orderFor(i.id) !== undefined || (availability[i.id] && availability[i.id] !== 'ok'))
    .map(i => i.id);
  const currency = cart.items[0]?.currency ?? 'usd';
  const unverified = !!user && user.role === 'customer' && !user.email_verified;

  const checkout = async () => {
    if (!user) { navigate('/login?next=/cart'); return; }
    setBusy(true);
    setErrors([]);
    try {
      const res = await api.post<{ order_id: number; checkout_url: string }>('/checkout', { coupon_ids: cart.items.map(i => i.id) });
      // Hand over to Stripe's hosted page; bought coupons leave the cart once payment succeeds.
      window.location.assign(res.checkout_url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setErrors(["Card payments aren't switched on yet. Please try again later."]);
      } else if (err instanceof ApiError && err.status === 403 && user.role === 'customer') {
        setNeedsVerify(true);
      } else if (err instanceof ApiError && err.status === 403) {
        setErrors(['Admin accounts cannot buy codes. Sign in with a shopper account.']);
      } else {
        setErrors(err instanceof ApiError ? err.allMessages() : [(err as Error).message]);
      }
      setBusy(false);
    }
  };

  if (cart.count === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-14">
        <h1 className="page-title">Your cart</h1>
        <div className="mt-8">
          <EmptyState title="Your cart is empty">
            Exclusive codes you add will wait here. <Link to="/coupons?kind=paid" className="font-semibold text-deal underline">Browse exclusive codes</Link>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 lg:grid-cols-[1fr_22rem]">
      <div>
        <h1 className="page-title">Your cart</h1>
        <p className="mt-2 text-ink-soft">Each code is bought once and belongs to you after payment.</p>

        {unavailable.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg bg-raspberry/10 px-4 py-3 text-sm text-raspberry" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span className="flex-1">{unavailable.length === 1 ? 'One code is' : `${unavailable.length} codes are`} no longer available to buy.</span>
            <button onClick={() => cart.removeMany(unavailable)} className="font-semibold underline">Remove {unavailable.length === 1 ? 'it' : 'them'}</button>
          </div>
        )}

        <ul className="mt-6 divide-y divide-line rounded-xl bg-card ring-1 ring-line">
          {cart.items.map(item => {
            const state = availability[item.id];
            const boughtIn = purchases.orderFor(item.id);
            return (
              <li key={item.id} className="flex items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  {item.storeSlug
                    ? <Link to={`/stores/${item.storeSlug}`} className="text-sm font-semibold text-muted hover:text-ink">{item.store}</Link>
                    : <span className="text-sm font-semibold text-muted">{item.store}</span>}
                  <p className="font-display text-lg font-semibold leading-snug">{item.title}</p>
                  {boughtIn !== undefined ? (
                    <p className="mt-1 text-sm font-semibold text-deal">
                      Already yours. <Link to={`/account/orders/${boughtIn}`} className="underline">View the code</Link>
                    </p>
                  ) : state === 'sold_out' && <p className="mt-1 text-sm font-semibold text-raspberry">Sold out</p>}
                  {boughtIn === undefined && state === 'gone' && <p className="mt-1 text-sm font-semibold text-raspberry">No longer offered</p>}
                </div>
                <span className="font-semibold">{money(item.price_cents, item.currency)}</span>
                <button onClick={() => cart.remove(item.id)} aria-label={`Remove ${item.title}`} className="rounded-lg p-2 text-muted hover:bg-paper hover:text-raspberry">
                  <Trash2 size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="h-fit rounded-xl bg-card p-6 ring-1 ring-line lg:sticky lg:top-24 lg:mt-24">
        <h2 className="font-semibold">Order summary</h2>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">{cart.count} {cart.count === 1 ? 'code' : 'codes'}</dt><dd>{money(cart.totalCents, currency)}</dd></div>
          <div className="flex items-center justify-between border-t border-line pt-3 text-base">
            <dt className="font-semibold">Total</dt><dd className="font-display text-3xl font-extrabold">{money(cart.totalCents, currency)}</dd>
          </div>
        </dl>

        {(unverified || needsVerify) && user && <VerifyEmailNotice email={user.email} />}

        {errors.length > 0 && (
          <ul className="mt-4 list-disc rounded-lg bg-raspberry/10 py-3 pl-8 pr-4 text-sm text-raspberry" role="alert">
            {errors.map(e => <li key={e}>{e}</li>)}
          </ul>
        )}

        <button onClick={checkout} disabled={busy || unavailable.length > 0} className="btn-primary mt-5 w-full py-3.5 text-base">
          <Lock size={16} aria-hidden="true" />
          {busy ? 'Opening secure checkout…' : user ? `Pay ${money(cart.totalCents, currency)} by card` : 'Sign in to check out'}
        </button>
        <p className="mt-3 text-center text-sm text-muted">Payment runs on Stripe. Your card details never reach us.</p>
        <p className="mt-2 text-center text-sm"><Link to="/refund-policy" className="text-ink-soft underline">Refund policy</Link></p>
      </aside>
    </div>
  );
}
