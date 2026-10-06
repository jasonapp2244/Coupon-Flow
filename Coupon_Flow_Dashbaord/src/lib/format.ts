export function money(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export function number(n: number): string {
  return n.toLocaleString('en-US');
}

/** "Sep 23, 2026" — accepts ISO datetimes and plain YYYY-MM-DD dates. */
export function date(value: string | null | undefined): string {
  if (!value) return '—';
  // Plain dates are calendar days: parse as local midnight, not UTC, so the day never shifts.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "Oct 25, 2026, 11:59 PM" in the viewer's time: deal windows are exact moments. */
export function dateTimeFull(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "in 5 hr" / "in 2 days" until a future moment; "" when it has passed. */
export function timeUntil(value: string | null | undefined): string {
  if (!value) return '';
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  if (seconds <= 0) return '';
  if (seconds < 3600) return `in ${Math.max(1, Math.floor(seconds / 60))} min`;
  if (seconds < 86400) return `in ${Math.floor(seconds / 3600)} hr`;
  const days = Math.floor(seconds / 86400);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** "just now", "5 min ago", "3 hr ago", "2 days ago". */
export function timeAgo(value: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  const days = Math.floor(seconds / 86400);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Chart tooltip formatters: Recharts passes loosely typed values (possibly undefined). */
export const tooltipMoney = (dollars: unknown) => money(Math.round(Number(dollars ?? 0) * 100));
export const tooltipNumber = (value: unknown) => number(Number(value ?? 0));

export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '');

/** The store's share link on the public website (same page as /stores/{slug}, which search engines index). */
export function storePublicUrl(slug: string): string {
  return `${SITE_URL}/promotions/at/${slug}`;
}

/** "2.99" (dollars as typed by an admin) -> 299 cents; empty -> 0. */
export function toCents(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function fromCents(cents: number): string {
  return cents ? (cents / 100).toFixed(2) : '';
}

/** "1 coupon", "8 coupons": count with the right word form. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${number(count)} ${count === 1 ? one : many}`;
}
