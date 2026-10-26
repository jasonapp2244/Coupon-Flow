import { useLocation, useNavigate } from 'react-router';
import { BadgeCheck, Clock, Copy, Sparkles } from 'lucide-react';
import { expiryLabel, msLeft, stubFigure } from '../lib/format';
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

/** The tear-off stub: the offer's headline figure ("20% off", "$50 off", "Free shipping"). Marigold for codes, green for deals. */
export function TicketStub({ coupon, row = false, className = '' }: { coupon: Coupon; row?: boolean; className?: string }) {
  const { figure, caption } = stubFigure(coupon.title);
  const tone = coupon.has_code ? 'bg-marigold text-ink' : 'bg-deal text-white';
  // `row`: on phones the stub becomes a strip across the top of the ticket.
  const layout = row
    ? 'flex-row justify-start gap-3 py-3 sm:flex-col sm:justify-center sm:gap-0 sm:py-5'
    : 'flex-col justify-center py-5';
  return (
    <div className={`stub-edge flex shrink-0 items-center px-4 text-center ${layout} ${tone} ${className}`} aria-hidden="true">
      <span className={`font-display font-extrabold leading-none tracking-tight ${row ? 'text-3xl sm:text-4xl' : 'text-4xl'}`}>{figure}</span>
      <span className={`text-sm font-semibold ${row ? 'sm:mt-1' : 'mt-1'}`}>{caption}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${coupon.has_code ? 'bg-ink/10' : 'bg-white/15'} ${row ? 'ml-auto sm:ml-0 sm:mt-3' : 'mt-3'}`}>
        {coupon.has_code ? 'Code' : 'Deal'}
      </span>
    </div>
  );
}

/**
 * One coupon as a torn-off ticket: the stub with the offer's figure, a perforation, then the store,
 * title, description, expiry and use count, and one action. The stub, title and button all do the
 * same thing: open the store in a new tab and show the code ("No Code Required" for a deal) here.
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
  const hot = (coupon.used_percent ?? 0) >= 80;

  return (
    <article id={`${REVEAL_HASH_PREFIX}${coupon.id}`}
      className="group flex scroll-mt-24 overflow-hidden rounded-2xl bg-card shadow-[0_1px_0_var(--color-line)] ring-1 ring-line transition-shadow hover:shadow-[0_10px_30px_-12px_rgb(0_0_0/0.25)] max-sm:flex-col">
      <button onClick={open} tabIndex={-1} aria-hidden="true" className="flex sm:w-36">
        <TicketStub coupon={coupon} row className="w-full" />
      </button>

      <div className="perforation perforation-stack flex min-w-0 flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showStore && store && (
              <span className="mr-1 flex items-center gap-2.5 text-sm font-semibold text-ink">
                <StoreLogo name={store.name} url={store.logo_url} size="sm" />
                {store.name}
              </span>
            )}
            {coupon.is_verified && <span className="badge bg-deal-soft text-deal-dark"><BadgeCheck size={13} aria-hidden="true" /> Verified</span>}
            {coupon.is_exclusive && <span className="badge bg-marigold-soft text-ink"><Sparkles size={13} aria-hidden="true" /> Exclusive</span>}
          </div>
          <h3 className="mt-1.5 font-display text-xl font-semibold leading-snug">
            <button onClick={open} className="text-left decoration-marigold decoration-2 underline-offset-4 hover:underline">{coupon.title}</button>
          </h3>
          {coupon.description && <p className="mt-1 text-ink-soft line-clamp-2">{coupon.description}</p>}
          <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className={endingSoon ? 'inline-flex items-center gap-1 font-semibold text-raspberry' : 'inline-flex items-center gap-1'}>
              <Clock size={14} aria-hidden="true" />{expiryLabel(coupon.expires_at, timezone)}
            </span>
            {coupon.usage_limit === null && used > 0 && <span>Used {used} {used === 1 ? 'time' : 'times'}</span>}
          </p>
          {coupon.usage_limit !== null && coupon.uses_left !== null && (
            <div className="mt-2 max-w-72">
              <p className="text-sm text-muted">
                {coupon.code_list ? (
                  <span className={hot ? 'font-semibold text-raspberry' : ''}>{coupon.uses_left} {coupon.uses_left === 1 ? 'code' : 'codes'} left</span>
                ) : (
                  <>Used {used} {used === 1 ? 'time' : 'times'}, <span className={hot ? 'font-semibold text-raspberry' : ''}>{coupon.uses_left} left</span></>
                )}
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={coupon.used_percent ?? 0} aria-label={`${coupon.used_percent ?? 0}% of uses taken`}>
                <div className={`h-full rounded-full ${hot ? 'bg-raspberry' : 'bg-deal'}`} style={{ width: `${Math.min(100, coupon.used_percent ?? 0)}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0">
          {coupon.has_code ? (
            // The right end of the button is a dashed "peel" that hints at the hidden code.
            <button onClick={open} className="group/btn relative flex w-full items-stretch overflow-hidden rounded-lg text-sm font-semibold sm:w-52">
              <span className="flex flex-1 items-center justify-center bg-deal px-4 py-3 text-white shadow-[inset_0_-2px_0_var(--color-deal-dark)] transition-colors group-hover/btn:bg-deal-dark">
                Show coupon code
              </span>
              <span className="flex w-12 items-center justify-center border-2 border-l-0 border-dashed border-deal bg-deal-soft font-display text-deal-dark transition-all group-hover/btn:w-9" aria-hidden="true">
                •••
              </span>
              <span className="sr-only"> (opens {store?.name ?? 'the store'} in a new tab)</span>
            </button>
          ) : (
            <button onClick={open} className="btn-primary w-full py-3 sm:w-52">
              Get deal
              <span className="sr-only"> (opens {store?.name ?? 'the store'} in a new tab)</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
