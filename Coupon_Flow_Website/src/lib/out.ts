import { API_BASE_URL } from './api';

// Click-outs go through the API's /api/go redirect, which records the click and holds the
// merchant link, so no merchant or affiliate URL is ever written into the site's pages.
const GO_BASE = `${API_BASE_URL.replace(/\/v\d+$/, '')}/go`;

/**
 * The click-out link. `token` names one claim: for a code-list coupon the same token always
 * gets the same code, and a new token asks for the next one.
 */
export const goUrl = (couponId: number, token?: string | null) =>
  `${GO_BASE}/${couponId}${token ? `?t=${encodeURIComponent(token)}` : ''}`;

/** A fresh claim token: 16-64 chars of [A-Za-z0-9-], which a UUID is. */
export function newClaimToken(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* insecure context: fall through */ }
  let token = '';
  while (token.length < 32) token += Math.random().toString(36).slice(2);
  return token.slice(0, 32);
}

// The visitor's latest claim per coupon, so a refresh or a re-opened pop-up shows the same code.
// Storage can throw (private mode, blocked site data); the in-memory copy covers this tab.
const CLAIM_KEY = (couponId: number) => `cf_claim_${couponId}`;
const claimMemory = new Map<number, string>();

export function latestToken(couponId: number): string | null {
  try {
    const stored = sessionStorage.getItem(CLAIM_KEY(couponId));
    if (stored) return stored;
  } catch { /* use memory */ }
  return claimMemory.get(couponId) ?? null;
}

export function rememberToken(couponId: number, token: string): void {
  claimMemory.set(couponId, token);
  try { sessionStorage.setItem(CLAIM_KEY(couponId), token); } catch { /* memory only */ }
}
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
