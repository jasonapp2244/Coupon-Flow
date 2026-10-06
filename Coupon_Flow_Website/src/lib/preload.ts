/**
 * API responses baked into a pre-rendered page (see scripts/prerender.mjs), keyed by API path.
 * The first render of that page uses them, so it shows the same content as the HTML instead of a
 * spinner; useApi still refetches straight away, so a stale snapshot corrects itself.
 */
const cache = new Map<string, unknown>();

/** While pre-rendering: API paths the page asked for that weren't supplied yet. */
let misses: Set<string> | null = null;

export function seedPreload(data: Record<string, unknown>): void {
  cache.clear();
  for (const [path, value] of Object.entries(data)) cache.set(path, value);
}

export function peekPreload<T>(path: string): T | undefined {
  if (!cache.has(path)) misses?.add(path);
  return cache.get(path) as T | undefined;
}

/** Starts recording misses; the returned function stops and returns them (build only). */
export function recordMisses(): () => string[] {
  const seen = new Set<string>();
  misses = seen;
  return () => {
    misses = null;
    return [...seen];
  };
}

/** Reads the JSON the pre-renderer put in the page, if any. */
export function readEmbeddedPreload(): void {
  const tag = document.getElementById('preload');
  if (!tag?.textContent) return;
  try { seedPreload(JSON.parse(tag.textContent)); } catch { /* render normally */ }
}
