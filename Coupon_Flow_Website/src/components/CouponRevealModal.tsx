import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Check, CheckCircle2, Copy, ExternalLink, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { expiryLabel, stubFigure } from '../lib/format';
import { goUrl, latestToken, LEGACY_REVEAL_PARAM, newClaimToken, openOut, rememberToken, revealIdFrom } from '../lib/out';
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
  const [token, setToken] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const { timezone } = useSite();

  // The code button shows "Copied" for two seconds after a successful copy.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
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

  // Each fetch gets a number; only the newest one may update the pop-up.
  const request = useRef(0);
  const load = (couponId: number, claim: string | null) => {
    const mine = ++request.current;
    setToken(claim);
    setCoupon(null);
    setCopied(false);
    const path = `/public/coupons/${couponId}/reveal${claim ? `?t=${encodeURIComponent(claim)}` : ''}`;
    api.get<{ data: RevealedCoupon }>(path)
      .then(res => { if (mine === request.current) setCoupon(res.data); })
      .catch((e: unknown) => {
        if (mine !== request.current) return;
        toast(e instanceof ApiError && e.status === 404 ? 'Sorry, this offer has ended.' : "We couldn't load this offer. Please try again.", 'error');
        close();
      });
  };

  useEffect(() => {
    if (!id) { request.current++; setCoupon(null); setToken(null); return; }
    // The claim the coupon row just made (or the one from before a refresh): same token, same code.
    load(id, latestToken(id));
  }, [id]); // Only a new coupon id should refetch.

  /** Code list: a new claim takes the next code. Opens the store inside the click, so pop-up blockers allow it. */
  const claimAnother = () => {
    if (!id) return;
    const claim = newClaimToken();
    rememberToken(id, claim);
    openOut(goUrl(id, claim));
    load(id, claim);
  };

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
      className="m-auto w-[min(32rem,calc(100%-2rem))] overflow-hidden rounded-3xl bg-card p-0 text-ink shadow-2xl backdrop:bg-ink-deep/70 backdrop:backdrop-blur-sm"
    >
      <div className="relative">
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full bg-white/70 p-1.5 text-ink hover:bg-white">
          <X size={18} />
        </button>

        {!coupon ? <div className="p-8"><Spinner /></div> : (
          <div key={coupon.id} className="animate-tear">
            {/* The stub: the store and the offer's figure, torn off along the dashed line below. */}
            <div className={`flex items-center gap-4 px-6 pb-6 pt-7 sm:px-8 ${coupon.has_code || coupon.code_list ? 'bg-marigold' : 'bg-deal text-white'}`}>
              {coupon.store && <StoreLogo name={coupon.store.name} url={coupon.store.logo_url} size="lg" />}
              <div className="min-w-0 text-left">
                {coupon.store && <p className="truncate font-display text-xl font-extrabold">{coupon.store.name}</p>}
                <p className="font-display text-4xl font-extrabold leading-none tracking-tight">
                  {stubFigure(coupon.title).figure} <span className="text-lg font-semibold">{stubFigure(coupon.title).caption}</span>
                </p>
              </div>
            </div>

            <div className="perforation-h flex flex-col items-center gap-4 px-6 pb-7 pt-6 text-center sm:px-8">
              <div>
                <h2 id="reveal-title" className="font-display text-2xl font-semibold leading-snug">{coupon.title}</h2>
                <p className="mt-1 text-sm text-muted">{expiryLabel(coupon.expires_at, timezone)}</p>
              </div>

              {coupon.code ? (
                <div className="w-full">
                  <button
                    onClick={() => copy(coupon.code!)}
                    aria-label={`Copy code ${coupon.code}`}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed px-5 py-4 transition-colors ${copied ? 'border-deal bg-deal text-white' : 'border-deal bg-deal-soft text-deal-dark hover:bg-deal hover:text-white'}`}
                  >
                    <span className="font-display text-3xl font-semibold tracking-wider select-all">{coupon.code}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold">
                      {copied ? <><Check size={16} aria-hidden="true" /> Copied</> : <><Copy size={16} aria-hidden="true" /> Copy</>}
                    </span>
                  </button>
                  <p className="mt-2 text-sm text-ink-soft">Paste the code at the store's checkout.</p>
                </div>
              ) : coupon.code_list ? (
                !coupon.limit_reached && (
                  <p className="rounded-lg bg-deal-soft px-4 py-3 font-semibold text-deal-dark">
                    {token ? 'Every code for this offer has been claimed. Check the store for other savings.' : 'Each shopper gets a unique code.'}
                  </p>
                )
              ) : (
                <p className="flex items-center gap-2 rounded-lg bg-deal-soft px-4 py-3 font-semibold text-deal-dark">
                  <CheckCircle2 size={18} aria-hidden="true" /> No code required
                </p>
              )}

              {coupon.code_list && coupon.limit_reached && (
                <p role="status" className="rounded-lg bg-raspberry/10 px-4 py-3 text-sm font-semibold text-raspberry">
                  You've claimed the maximum number of codes for today. Come back tomorrow for another.
                </p>
              )}

              {coupon.description && <p className="text-sm text-ink-soft">{coupon.description}</p>}

              {coupon.code_list && !coupon.limit_reached && !coupon.code && !token ? (
                // A shared link: no claim yet, so the first click takes a code.
                <button onClick={claimAnother} className="btn-primary w-full justify-center">
                  Get your code
                  <ExternalLink size={14} aria-hidden="true" /><span className="sr-only">(opens {coupon.store?.name ?? 'the store'} in a new tab)</span>
                </button>
              ) : (
                <button onClick={() => openOut(goUrl(coupon.id, token))} className="btn-primary w-full justify-center">
                  {coupon.code ? 'Continue to' : 'Shop now at'} {coupon.store?.name ?? 'the store'}
                  <ExternalLink size={14} aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
                </button>
              )}

              {coupon.code_list && !coupon.limit_reached && coupon.code && (
                <button onClick={claimAnother} className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-deal-dark ring-1 ring-line hover:bg-deal-soft">
                  Get another code
                  <span className="sr-only"> (opens {coupon.store?.name ?? 'the store'} in a new tab)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
