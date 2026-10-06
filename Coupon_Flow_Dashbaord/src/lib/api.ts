// Thin client for the Coupon Follow Laravel API (Sanctum bearer tokens).

// Production builds must set VITE_API_URL (vite.config.ts refuses to build without it).
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const TOKEN_KEY = 'cf_token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
  }

  /** First validation message for a field, if any. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }

  /** Flattened field => first message map, handy for form error state. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(Object.entries(this.errors).map(([k, v]) => [k, v[0]]));
  }
}

// Storage can throw in private mode or when blocked; auth must still work for the session.
function readStorage(storage: () => Storage): string | null {
  try { return storage().getItem(TOKEN_KEY); } catch { return null; }
}

let memoryToken: string | null = null;

export function getToken(): string | null {
  return memoryToken ?? readStorage(() => localStorage) ?? readStorage(() => sessionStorage);
}

/** "Remember me" keeps the token across browser restarts; otherwise it lives for the tab session. */
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

/** Called when the API rejects the token (expired / revoked), so the app can return to login. */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

let twoFactorRequiredHandler: (() => void) | null = null;

/** Called when Settings → Security requires two-step login and this account hasn't set it up. */
export function onTwoFactorRequired(handler: (() => void) | null): void {
  twoFactorRequiredHandler = handler;
}

type Query = Record<string, string | number | boolean | null | undefined>;

/** Appends non-empty params; "All" is treated as "no filter", matching the dashboard's selects. */
export function withQuery(path: string, params: Query = {}): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'All') continue;
    qs.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(BASE_URL + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    // 401: the session ended (signed out, switched off, or role taken away). A 403 is only
    // "your role can't do this" and stays a normal error, except the two-step login requirement.
    if (token && response.status === 401) {
      clearToken();
      unauthorizedHandler?.();
    }
    if (response.status === 403 && data.code === 'two_factor_setup_required') twoFactorRequiredHandler?.();
    throw new ApiError(response.status, data.message || `Request failed (${response.status})`, data.errors ?? {});
  }

  return response;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await send(method, path, body);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body),

  /** Multipart update: PHP only parses files on POST, so Laravel's _method override carries the verb. */
  upload: <T>(path: string, form: FormData, method: 'POST' | 'PATCH' = 'POST') => {
    if (method !== 'POST') form.set('_method', method);
    return request<T>('POST', path, form);
  },

  /** Authenticated file download (the token can't ride along on a plain <a href>). */
  async download(path: string, fallbackName: string): Promise<void> {
    const response = await send('GET', path);
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },
};

/** Builds multipart data from a plain object; booleans become 1/0, null/undefined are skipped. */
export function toFormData(values: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    if (value instanceof Blob) form.set(key, value);
    else if (typeof value === 'boolean') form.set(key, value ? '1' : '0');
    else form.set(key, String(value));
  }
  return form;
}

/**
 * Run one request per id and wait for all of them, so one failure doesn't hide how many succeeded.
 * Rejects with a summary ("3 of 4 done; 1 failed: …") when any request failed.
 */
export async function forEachId(ids: number[], fn: (id: number) => Promise<unknown>): Promise<void> {
  const results = await Promise.allSettled(ids.map(fn));
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed.length) {
    const reason = failed[0].reason instanceof Error ? failed[0].reason.message : 'Request failed';
    throw new Error(`${ids.length - failed.length} of ${ids.length} done; ${failed.length} failed: ${reason}`);
  }
}
