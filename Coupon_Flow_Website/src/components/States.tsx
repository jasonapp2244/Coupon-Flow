import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { siteOrigin } from '../lib/head';
import { usePageMeta } from '../lib/hooks';
import type { PageMeta, Store } from '../lib/types';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex justify-center py-16" role="status">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-deal border-t-transparent" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl bg-card px-6 py-12 text-center ring-1 ring-line" role="alert">
      <p className="font-semibold">This didn't load.</p>
      <p className="mt-1 text-sm text-ink-soft">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-secondary mt-4">Try again</button>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export function NotFound({ what = 'page' }: { what?: string }) {
  usePageMeta('Not found', { noindex: true });
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-marigold">404</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">We couldn't find that {what}</h1>
      <p className="mt-2 text-ink-soft">It may have expired or been removed.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/coupons" className="btn-primary">Browse coupons</Link>
        <Link to="/stores" className="btn-secondary">Browse stores</Link>
      </div>
    </div>
  );
}

/** Page numbers around the current page, with gaps: 1 … 4 5 6 … 12 */
function pageList(current: number, last: number): (number | 'gap')[] {
  const pages = new Set([1, last, current - 1, current, current + 1].filter(p => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap' as const, p] : [p]));
}

export function Pager({ meta, onPage }: { meta: PageMeta | null; onPage: (page: number) => void }) {
  if (!meta || meta.last_page <= 1) return null;
  const { current_page: current, last_page: last } = meta;
  const btn = 'flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold';

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      <button className={`${btn} ring-1 ring-line bg-card disabled:opacity-40`} disabled={current <= 1} onClick={() => onPage(current - 1)}>Previous</button>
      {pageList(current, last).map((p, i) => p === 'gap'
        ? <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden="true">…</span>
        : (
          <button key={p} onClick={() => onPage(p)} aria-current={p === current ? 'page' : undefined}
            className={`${btn} ${p === current ? 'bg-ink text-white' : 'bg-card ring-1 ring-line hover:ring-ink'}`}>
            {p}
          </button>
        ))}
      <button className={`${btn} ring-1 ring-line bg-card disabled:opacity-40`} disabled={current >= last} onClick={() => onPage(current + 1)}>Next</button>
    </nav>
  );
}

export interface Crumb { label: string; to?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
            {c.to ? <Link to={c.to} className="hover:text-ink hover:underline">{c.label}</Link> : <span aria-current="page" className="text-ink-soft">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** schema.org BreadcrumbList for the same trail (absolute URLs). */
export function breadcrumbJsonLd(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.to ? { item: siteOrigin() + c.to } : {}),
    })),
  };
}

export function StoreLogo({ name, url, size = 'md' }: { name: string; url: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'h-10 w-10 text-sm', md: 'h-12 w-12 text-base', lg: 'h-20 w-20 text-2xl' }[size];
  return url
    ? <img src={url} alt="" loading="lazy" className={`${box} shrink-0 rounded-xl bg-white object-contain ring-1 ring-line`} />
    : <span className={`${box} flex shrink-0 items-center justify-center rounded-xl bg-ink font-display font-extrabold text-marigold`} aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>;
}

export function StoreCard({ store }: { store: Store }) {
  const count = store.coupons_count ?? 0;
  return (
    <Link to={`/stores/${store.slug}`} className="group flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-line transition-shadow hover:ring-ink">
      <StoreLogo name={store.name} url={store.logo_url} />
      <span className="min-w-0">
        <span className="block truncate font-semibold group-hover:text-deal">{store.name}</span>
        <span className="block text-sm text-muted">{count === 0 ? 'No live coupons' : `${count} live coupon${count === 1 ? '' : 's'}`}</span>
      </span>
    </Link>
  );
}
