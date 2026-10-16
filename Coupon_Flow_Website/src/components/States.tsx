import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Award, ChevronRight, Flame, SearchX, TriangleAlert } from 'lucide-react';
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

/** Ticket-shaped placeholders while a coupon list loads. */
export function TicketSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status">
      <span className="sr-only">Loading coupons</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex overflow-hidden rounded-2xl bg-card ring-1 ring-line" aria-hidden="true">
          <div className="hidden w-36 shrink-0 bg-marigold-soft sm:block" />
          <div className="flex flex-1 flex-col gap-3 p-5">
            <span className="skeleton h-4 w-32" />
            <span className="skeleton h-6 w-3/4" />
            <span className="skeleton h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Card placeholders while a store or article grid loads. */
export function CardSkeletons({ count = 6, className = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' }: { count?: number; className?: string }) {
  return (
    <div className={className} role="status">
      <span className="sr-only">Loading</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-line" aria-hidden="true">
          <span className="skeleton h-14 w-14 shrink-0 rounded-xl" />
          <span className="flex flex-1 flex-col gap-2"><span className="skeleton h-4 w-2/3" /><span className="skeleton h-3 w-1/3" /></span>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-12 text-center" role="alert">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-raspberry/10 text-raspberry"><TriangleAlert size={22} aria-hidden="true" /></span>
      <p className="mt-4 font-display text-xl font-semibold">Something went wrong</p>
      <p className="mt-1 text-sm text-ink-soft">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-secondary mt-5">Try again</button>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-line bg-card/60 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-marigold-soft text-ink"><SearchX size={22} aria-hidden="true" /></span>
      <p className="mt-4 font-display text-xl font-semibold">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export function NotFound({ what = 'page' }: { what?: string }) {
  usePageMeta('Not found', { noindex: true });
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      {/* A ticket with its stub torn off. */}
      <div className="mx-auto flex w-64 -rotate-3 overflow-hidden rounded-2xl bg-card shadow-xl ring-1 ring-line" aria-hidden="true">
        <div className="stub-edge flex w-24 flex-col items-center justify-center bg-marigold py-6">
          <span className="font-display text-3xl font-extrabold leading-none">404</span>
        </div>
        <div className="perforation flex flex-1 flex-col justify-center gap-2 p-4">
          <span className="h-3 w-3/4 rounded bg-line" /><span className="h-3 w-1/2 rounded bg-line" />
        </div>
      </div>
      <h1 className="mt-10 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">We couldn't find that {what}</h1>
      <p className="mt-2 text-ink-soft">It may have ended or moved. Try searching, or browse the latest offers below.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/coupons" className="btn-primary">Browse coupons</Link>
        <Link to="/stores" className="btn-secondary">Browse stores</Link>
      </div>
    </div>
  );
}

/**
 * The band at the top of every listing page: optional breadcrumbs, the title, a line under it, and
 * an optional right-hand slot (a count, a button).
 */
export function PageHeader({ title, intro, crumbs, aside, children }: {
  title: ReactNode; intro?: ReactNode; crumbs?: Crumb[]; aside?: ReactNode; children?: ReactNode;
}) {
  return (
    <section className="border-b border-line bg-card [--notch:var(--color-card)]">
      <div className="page py-10 sm:py-12">
        {crumbs && <div className="mb-5"><Breadcrumbs items={crumbs} /></div>}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="page-title">{title}</h1>
            {intro && <div className="mt-3 max-w-2xl text-lg text-ink-soft">{intro}</div>}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        {children}
      </div>
    </section>
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
  const btn = 'flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors';

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      <button className={`${btn} bg-card ring-1 ring-line hover:ring-ink disabled:opacity-40`} disabled={current <= 1} onClick={() => onPage(current - 1)}>Previous</button>
      {pageList(current, last).map((p, i) => p === 'gap'
        ? <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden="true">…</span>
        : (
          <button key={p} onClick={() => onPage(p)} aria-current={p === current ? 'page' : undefined}
            className={`${btn} ${p === current ? 'bg-ink text-white' : 'bg-card ring-1 ring-line hover:ring-ink'}`}>
            {p}
          </button>
        ))}
      <button className={`${btn} bg-card ring-1 ring-line hover:ring-ink disabled:opacity-40`} disabled={current >= last} onClick={() => onPage(current + 1)}>Next</button>
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
            {c.to ? <Link to={c.to} className="-my-1 inline-block py-1 hover:text-ink hover:underline">{c.label}</Link> : <span aria-current="page" className="text-ink-soft">{c.label}</span>}
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

export function StoreLogo({ name, url, size = 'md' }: { name: string; url: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const box = {
    xs: 'h-6 w-6 rounded-md text-[10px]',
    sm: 'h-10 w-10 rounded-xl text-sm',
    md: 'h-14 w-14 rounded-xl text-base',
    lg: 'h-20 w-20 rounded-2xl text-2xl',
    xl: 'h-28 w-28 rounded-2xl text-3xl',
  }[size];
  return url
    ? <img src={url} alt="" loading="lazy" className={`${box} shrink-0 bg-white object-contain p-1 ring-1 ring-line`} />
    : <span className={`${box} flex shrink-0 items-center justify-center bg-ink font-display font-extrabold text-marigold`} aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>;
}

export function StoreCard({ store }: { store: Store }) {
  const count = store.coupons_count ?? 0;
  return (
    <Link to={`/stores/${store.slug}`} className="group flex h-full items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-14px_rgb(27_36_48/0.3)] hover:ring-ink">
      <StoreLogo name={store.name} url={store.logo_url} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{store.name}</span>
          {store.is_editor_choice && <Award size={15} className="shrink-0 text-marigold-deep" role="img" aria-label="Editor's choice" />}
          {store.is_top && !store.is_editor_choice && <Flame size={15} className="shrink-0 text-raspberry" role="img" aria-label="Top store" />}
        </span>
        <span className="mt-0.5 block text-sm text-muted">{count === 0 ? 'No live coupons' : `${count} live coupon${count === 1 ? '' : 's'}`}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-line transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
    </Link>
  );
}
