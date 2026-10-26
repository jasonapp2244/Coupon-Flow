import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import CouponTicket from '../components/CouponTicket';
import { EmptyState, ErrorState, PageHeader, Pager, TicketSkeletons } from '../components/States';
import { withQuery } from '../lib/api';
import { useApi, useDebounced, usePageMeta } from '../lib/hooks';
import { pageParam } from '../lib/format';
import type { Category, Coupon, Paginated } from '../lib/types';

const ORDERS = [
  { value: '', label: 'Recently updated' },
  { value: 'newest', label: 'Newest' },
  { value: 'ending_soon', label: 'Ending soon' },
];

export default function CouponsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const order = params.get('order') ?? '';
  const verified = params.get('verified') === '1';
  const page = pageParam(params.get('page'));

  // The input is local so typing stays smooth; the URL (and the request) follow after a pause.
  const [text, setText] = useState(q);
  const debounced = useDebounced(text);
  useEffect(() => { setText(q); }, [q]);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(paramsRef.current);
    for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Runs only when the debounced text settles (update reads the latest URL through paramsRef);
  // URL changes from elsewhere sync back via the effect above.
  useEffect(() => {
    if (debounced.trim() !== (paramsRef.current.get('q') ?? '')) update({ q: debounced.trim() });
  }, [debounced]);

  const heading = q ? `Coupons for “${q}”` : 'All coupons';
  usePageMeta(heading, 'Browse the latest promo codes and deals from top stores. Reveal a code, shop in a new tab and save at checkout.');

  const categories = useApi<{ data: Category[] }>('/public/categories?type=store');
  const { data, loading, error, reload } = useApi<Paginated<Coupon>>(withQuery('/public/coupons', {
    q, category, page, per_page: 12, verified,
    ...(order ? { order } : { sort: 'updated_at', dir: 'desc' }),
  }));

  const coupons = data?.data ?? [];
  const filtered = q || category || verified || order;

  return (
    <>
      <PageHeader title={heading} intro={<span aria-live="polite">{data ? `${data.meta.total.toLocaleString('en-US')} live ${data.meta.total === 1 ? 'coupon' : 'coupons'} and deals. Click one to open the store and see the code.` : 'Loading coupons'}</span>} />
      <div className="page py-8">
        <div className="sticky top-16 z-20 -mx-4 flex flex-col gap-3 border-b border-line bg-paper/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border-0 sm:bg-card sm:p-4 sm:shadow-[0_8px_24px_-16px_rgb(0_0_0/0.35)] sm:ring-1 sm:ring-line">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Search by store or offer" aria-label="Search coupons" className="field lg:max-w-sm" />
            <select value={category} onChange={e => update({ category: e.target.value })} aria-label="Category" className="field lg:w-52">
              <option value="">All categories</option>
              {categories.data?.data.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
            <select value={order} onChange={e => update({ order: e.target.value })} aria-label="Sort by" className="field lg:ml-auto lg:w-52">
              {ORDERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`chip cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-deal ${verified ? 'chip-active' : ''}`}>
              <input type="checkbox" checked={verified} onChange={e => update({ verified: e.target.checked ? '1' : '' })} className="sr-only" />
              Verified only
            </label>
            {filtered && (
              <button className="ml-auto text-sm font-semibold text-deal hover:underline" onClick={() => { setText(''); setParams(new URLSearchParams(), { replace: true }); }}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        <section className="mt-8" aria-label="Coupons">
          {error && <ErrorState message={error} onRetry={reload} />}
          {loading && !data && <TicketSkeletons count={4} />}
          {data && coupons.length === 0 && ![...params.keys()].some(k => k !== 'page') && <EmptyState title="No coupons yet">New codes and deals are added often. Check back soon.</EmptyState>}
          {data && coupons.length === 0 && [...params.keys()].some(k => k !== 'page') && (
            <EmptyState title="No coupons match that search">
              Try a store name instead, or <button className="font-semibold text-deal underline" onClick={() => { setText(''); setParams(new URLSearchParams(), { replace: true }); }}>clear the filters</button>.
            </EmptyState>
          )}
          <div className={`flex flex-col gap-4 ${loading ? 'opacity-60' : ''}`}>
            {coupons.map(c => <CouponTicket key={c.id} coupon={c} />)}
          </div>
          <Pager meta={data?.meta ?? null} onPage={p => { update({ page: String(p) }); window.scrollTo(0, 0); }} />
        </section>
      </div>
    </>
  );
}
