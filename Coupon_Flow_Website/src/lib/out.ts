import { API_BASE_URL } from './api';

// Click-outs go through the API's /api/go redirect, which records the click and holds the
// merchant link, so no merchant or affiliate URL is ever written into the site's pages.
const GO_BASE = `${API_BASE_URL.replace(/\/v\d+$/, '')}/go`;

export const goUrl = (couponId: number) => `${GO_BASE}/${couponId}`;
export const goStoreUrl = (slug: string) => `${GO_BASE}/store/${encodeURIComponent(slug)}`;

/** Opens the merchant in a new tab. Call it inside the click handler so pop-up blockers allow it. */
export function openOut(url: string): void {
  window.open(url, '_blank', 'noopener');
}

/**
 * The code pop-up is opened by `#coupon_code-{id}` on any page (the reference sites' format):
 * shareable, survives a refresh, and is also the coupon row's element id.
 */
export const REVEAL_HASH_PREFIX = 'coupon_code-';
export const revealHash = (couponId: number) => `#${REVEAL_HASH_PREFIX}${couponId}`;

/** Older shared links used `?c={id}`; they still open the pop-up. */
export const LEGACY_REVEAL_PARAM = 'c';

/** The coupon id the current URL asks the pop-up to show, or null. */
export function revealIdFrom(hash: string, search: string): number | null {
  const fromHash = new RegExp(`^#${REVEAL_HASH_PREFIX}(\\d+)$`).exec(hash);
  const raw = fromHash?.[1] ?? new URLSearchParams(search).get(LEGACY_REVEAL_PARAM);
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
