// Client for the Coupon Follow Laravel API (Sanctum bearer tokens).

// Production builds must set VITE_API_URL (vite.config.ts refuses to build without it).
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
// Separate from the admin dashboard's key, so shopper and admin sessions never mix.
const TOKEN_KEY = 'cf_shop_token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
  }

  fieldErrors(): Record<string, string> {
    return Object.fromEntries(Object.entries(this.errors).map(([k, v]) => [k, v[0]]));
  }

  /** Every validation message, flattened (checkout can reject several coupons at once). */
  allMessages(): string[] {
    const list = Object.values(this.errors).flat();
    return list.length ? list : [this.message];
  }
}

function read(storage: () => Storage): string | null {
  try { return storage().getItem(TOKEN_KEY); } catch { return null; }
}

let memoryToken: string | null = null;

export function getToken(): string | null {
  return memoryToken ?? read(() => localStorage) ?? read(() => sessionStorage);
}

export function setToken(token: string, remember: boolean): void {
  memoryToken = token;
  try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token); } catch { /* memory only */ }
}

export function clearToken(): void {
  memoryToken = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, params: Query = {}): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    qs.set(key, value === true ? '1' : String(value));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

async function request<T>(method: string, path: string, body?: unknown, absolute = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(absolute ? path : API_BASE_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Can't reach Coupon Follow right now. Check your connection and try again.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      clearToken();
      unauthorizedHandler?.();
    }
    throw new ApiError(response.status, data.message || `Request failed (${response.status})`, data.errors ?? {});
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  /** GET a full API URL (e.g. a signed link from an email). Callers must check it points at our API. */
  getAbsolute: <T>(url: string) => request<T>('GET', url, undefined, true),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
};
