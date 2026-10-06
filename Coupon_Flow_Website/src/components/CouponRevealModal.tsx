import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CheckCircle2, Copy, ExternalLink, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { expiryLabel } from '../lib/format';
import { goUrl, LEGACY_REVEAL_PARAM, openOut, revealIdFrom } from '../lib/out';
import { useSite } from '../store/site';
import { useToast } from '../store/toast';
import { Spinner, StoreLogo } from './States';
import type { RevealedCoupon } from '../lib/types';

/**
 * The code pop-up. Clicking a free coupon opens the store in a new tab and adds
 * #coupon_code-{id} to this page, so the shopper finds the code waiting here when they come back.
 * The same link opens the pop-up directly, and it stays open across a refresh.
 */
export default function CouponRevealModal() {
  const { hash, search } = useLocation();
  const navigate = useNavigate();
  const id = revealIdFrom(hash, search);
  const [coupon, setCoupon] = useState<RevealedCoupon | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const { timezone } = useSite();

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Copied ' + code + '. Paste it at checkout.');
    } catch {
      toast("Couldn't copy automatically. Select the code and copy it.", 'error');
    }
  };

  // Reads the URL at call time: also used from the fetch's error handler.
  const close = () => {
    const query = new URLSearchParams(window.location.search);
    query.delete(LEGACY_REVEAL_PARAM);
    const rest = query.toString();
    navigate({ pathname: window.location.pathname, search: rest ? `?${rest}` : '', hash: '' }, { replace: true, preventScrollReset: true });
  };

  useEffect(() => {
    if (!id) { setCoupon(null); return; }
    let live = true;
    setCoupon(null);
    api.get<{ data: RevealedCoupon }>(`/public/coupons/${id}/reveal`)
      .then(res => { if (live) setCoupon(res.data); })
      .catch((e: unknown) => {
        if (!live) return;
        toast(e instanceof ApiError && e.status === 404 ? 'This offer is no longer available.' : "Couldn't load this offer. Please try again.", 'error');
        close();
      });
    return () => { live = false; };
  }, [id]); // Only a new coupon id should refetch.

  // showModal gives the focus trap, Esc to close and the backdrop for free.
  useEffect(() => {
    if (id && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [id]);

  if (!id) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="reveal-title"
      onClose={close}
      onClick={e => { if (e.target === e.currentTarget) close(); }}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/60"
    >
      <div className="relative p-6 sm:p-8">
        <button onClick={close} aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-muted hover:text-ink">
          <X size={20} />
        </button>

        {!coupon ? <Spinner /> : (
          <div className="flex flex-col items-center gap-4 text-center">
            {coupon.store && <p className="font-display text-xl font-extrabold">{coupon.store.name}</p>}
            {coupon.store && <StoreLogo name={coupon.store.name} url={coupon.store.logo_url} size="lg" />}
            <div>
              <h2 id="reveal-title" className="font-display text-2xl font-semibold leading-snug">{coupon.title}</h2>
              <p className="mt-1 text-sm text-muted">{expiryLabel(coupon.expires_at, timezone)}</p>
            </div>

            {coupon.code ? (
              <div className="w-full">
                <button
                  onClick={() => copy(coupon.code!)}
                  className="w-full rounded-lg border-2 border-dashed border-deal bg-deal-soft px-4 py-3 font-display text-3xl font-semibold tracking-wide text-deal-dark select-all hover:bg-deal hover:text-white"
                >
                  {coupon.code}
                </button>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium text-ink-soft">
                  <Copy size={14} aria-hidden="true" /> Click To Copy and Paste Code At Checkout
                </p>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-lg bg-deal-soft px-4 py-3 font-semibold text-deal-dark">
                <CheckCircle2 size={18} aria-hidden="true" /> No Code Required
              </p>
            )}

            {coupon.description && <p className="text-sm text-ink-soft">{coupon.description}</p>}

            <button onClick={() => openOut(goUrl(coupon.id))} className="btn-primary w-full justify-center">
              {coupon.code ? 'Continue to' : 'Shop now at'} {coupon.store?.name ?? 'the store'}
              <ExternalLink size={14} aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
