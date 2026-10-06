export function money(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

/** "Oct 31, 2026" — plain YYYY-MM-DD dates are parsed as local days so they never shift. */
export function date(value: string | null | undefined): string {
  if (!value) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Oct 25, 2026, 11:59 PM EDT" in the store's timezone: deals end at the store's time, not the shopper's. */
export function dealTime(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(new Date(value));
  } catch {
    // An unknown timezone name: fall back to the shopper's own clock.
    return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
}

/** Milliseconds until the deal ends (negative once over), or null when it has no end. */
export function msLeft(expiresAt: string | null): number | null {
  return expiresAt ? new Date(expiresAt).getTime() - Date.now() : null;
}

/** "Expires Oct 25, 2026, 11:59 PM EDT", or a countdown in the last 24 hours ("Ends in 5h 20m"). */
export function expiryLabel(expiresAt: string | null, timezone: string): string {
  const left = msLeft(expiresAt);
  if (left === null || !expiresAt) return 'No expiry date';
  if (left <= 0) return 'Ended';
  const minutes = Math.floor(left / 60_000);
  if (minutes < 60) return `Ends in ${Math.max(1, minutes)} min`;
  if (minutes < 24 * 60) return `Ends in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `Expires ${dealTime(expiresAt, timezone)}`;
}

/**
 * The big figure printed on a coupon's stub, pulled from its title:
 * "Save 20% on…" -> "20%", "$50 Off $250+" -> "$50", "Buy 2 Get 1 Free" -> "B2G1", "Free Shipping…" -> "Free".
 */
export function stubFigure(title: string): { figure: string; caption: string } {
  const percent = /(\d{1,2})\s?%/.exec(title);
  if (percent) return { figure: `${percent[1]}%`, caption: 'off' };
  const amount = /\$\s?(\d[\d,]*)/.exec(title);
  if (amount) return { figure: `$${amount[1]}`, caption: 'off' };
  const bogo = /buy\s+(\d)\s+get\s+(\d)/i.exec(title);
  if (bogo) return { figure: `B${bogo[1]}G${bogo[2]}`, caption: 'free' };
  if (/free shipping/i.test(title)) return { figure: 'Free', caption: 'shipping' };
  return { figure: 'Deal', caption: 'today' };
}

/** ?page= from the URL as a whole number of at least 1 (bad values fall back to 1). */
export function pageParam(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
