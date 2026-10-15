import { useLocation, useNavigate } from 'react-router';
import { BadgeCheck, Clock, Copy } from 'lucide-react';
import { expiryLabel, msLeft } from '../lib/format';
import { goUrl, newClaimToken, openOut, rememberToken, revealHash, REVEAL_HASH_PREFIX } from '../lib/out';
import { useSite } from '../store/site';
import { useToast } from '../store/toast';
import { StoreLogo } from './States';
import type { Coupon } from '../lib/types';

export function CodeBox({ code, size = 'md' }: { code: string; size?: 'md' | 'lg' }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast(`Copied ${code}`);
    } catch {
      toast("Couldn't copy automatically. Select the code and copy it.", 'error');
    }
  };

  return (
    <div className="flex items-stretch rounded-lg border-2 border-dashed border-deal bg-deal-soft">
      <span className={`flex-1 px-3 py-2 font-display font-semibold tracking-wide text-deal-dark select-all ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>{code}</span>
      <button onClick={copy} className="flex items-center gap-1.5 border-l-2 border-dashed border-deal px-3 text-sm font-semibold text-deal-dark hover:bg-deal hover:text-white">
        <Copy size={14} aria-hidden="true" /> Copy
      </button>
    </div>
  );
}

/**
 * Free code or deal: the store opens in a new tab (through /api/go, which records the click)
 * and this page gets #coupon_code-{id}, which shows the code pop-up, so the code is waiting
 * when the shopper comes back.
 */
export function useClickOut() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return (couponId: number) => {
    // Every click is a new claim: for a code-list coupon it gets the next code, and the pop-up
    // reads the same token back so a refresh keeps showing that code.
    const token = newClaimToken();
    rememberToken(couponId, token);
    openOut(goUrl(couponId, token));
    navigate({ pathname, search, hash: revealHash(couponId) }, { preventScrollReset: true });
  };
}

/**
 * One coupon, laid out like the reference coupon sites: store logo, title, description, expiry,
 * use count, and one action. The logo, title and button all do the same thing: open the store in a new tab and show the code ("No Code Required" for a deal) here.
 * The store name is plain text, never a link: every click on a coupon goes to the store.
 */
export default function CouponTicket({ coupon, showStore = true }: { coupon: Coupon; showStore?: boolean }) {
  const clickOut = useClickOut();
  const { timezone } = useSite();
  const open = () => clickOut(coupon.id);
  const used = coupon.uses_count;
  const store = coupon.store;
  const left = msLeft(coupon.expires_at);
  const endingSoon = left !== null && left > 0 && left < 24 * 3_600_000;

  return (
    <article id={`${REVEAL_HASH_PREFIX}${coupon.id}`} className="flex scroll-mt-24 flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-line sm:flex-row sm:items-center">
      {store && (
        <button onClick={open} tabIndex={-1} aria-hidden="true" className="hidden shrink-0 sm:block">
          <StoreLogo name={store.name} url={store.logo_url} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        {showStore && store && <p className="text-sm font-semibold text-ink-soft">{store.name}</p>}
        <h3 className="font-display text-xl font-semibold leading-snug">
          <button onClick={open} className="text-left hover:text-deal">{coupon.title}</button>
        </h3>
        {coupon.description && <p className="mt-1 font-medium text-ink-soft line-clamp-2">{coupon.description}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className={endingSoon ? 'inline-flex items-center gap-1 font-semibold text-raspberry' : ''}>
            {endingSoon && <Clock size={14} aria-hidden="true" />}{expiryLabel(coupon.expires_at, timezone)}
          </span>
          {coupon.is_verified && <span className="inline-flex items-center gap-1 font-medium text-deal"><BadgeCheck size={14} aria-hidden="true" /> Verified</span>}
        </p>
        {coupon.usage_limit !== null && coupon.uses_left !== null ? (
          <div className="mt-1 max-w-64">
            <p className="text-sm text-muted">
              {coupon.code_list ? (
                <span className={(coupon.used_percent ?? 0) >= 80 ? 'font-semibold text-raspberry' : ''}>{coupon.uses_left} {coupon.uses_left === 1 ? 'code' : 'codes'} left</span>
              ) : (
                <>Used {used} {used === 1 ? 'time' : 'times'} · <span className={(coupon.used_percent ?? 0) >= 80 ? 'font-semibold text-raspberry' : ''}>{coupon.uses_left} left</span></>
              )}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={coupon.used_percent ?? 0} aria-label={`${coupon.used_percent ?? 0}% of uses taken`}>
              <div className={`h-full rounded-full ${(coupon.used_percent ?? 0) >= 80 ? 'bg-raspberry' : 'bg-deal'}`} style={{ width: `${Math.min(100, coupon.used_percent ?? 0)}%` }} />
            </div>
          </div>
        ) : used > 0 && <p className="text-sm text-muted">Used {used} {used === 1 ? 'time' : 'times'}</p>}
      </div>

      <div className="shrink-0">
        <button onClick={open} className="btn-primary w-full uppercase sm:w-auto sm:min-w-44">
          {coupon.has_code ? 'Show coupon code' : 'Get deal'}
          <span className="sr-only"> (opens {store?.name ?? 'the store'} in a new tab)</span>
        </button>
      </div>
    </article>
  );
}
