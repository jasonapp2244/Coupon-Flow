import { useCallback, useEffect, useState } from 'react';
import { api, withQuery } from './api';
import { useApp } from '../store/AppContext';
import type { Category, CategoryType, PageMeta, Paginated } from './types';

type Params = Record<string, string | number | boolean | null | undefined>;

interface ListState<T> {
  items: T[];
  meta: PageMeta | null;
  loading: boolean;
  error: string | null;
}

/**
 * Server-paginated list. Refetches whenever `params` change; `reload()` refetches in place
 * (after a create/update/delete). Stale responses from superseded requests are ignored.
 */
export function useApiList<T>(path: string, params: Params = {}) {
  const url = withQuery(path, params);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<ListState<T>>({ items: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let stale = false;
    setState(s => ({ ...s, loading: true, error: null }));

    api.get<Paginated<T>>(url)
      .then(res => { if (!stale) setState({ items: res.data, meta: res.meta, loading: false, error: null }); })
      .catch((e: Error) => { if (!stale) setState(s => ({ ...s, loading: false, error: e.message })); });

    return () => { stale = true; };
  }, [url, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);

  return { ...state, reload };
}

/** Single JSON resource; pass null to skip fetching (e.g. "create" mode of an edit form). */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null, loading: path !== null, error: null,
  });

  useEffect(() => {
    if (path === null) { setState({ data: null, loading: false, error: null }); return; }
    let stale = false;
    setState(s => ({ ...s, loading: true, error: null }));

    api.get<T>(path)
      .then(data => { if (!stale) setState({ data, loading: false, error: null }); })
      .catch((e: Error) => { if (!stale) setState({ data: null, loading: false, error: e.message }); });

    return () => { stale = true; };
  }, [path, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);

  return { ...state, reload };
}

/** Paging + sorting state shared by every list page. Changing sort or size returns to page 1. */
export function useListControls(defaultSort: string, defaultDir: 'asc' | 'desc' = 'desc', defaultSize = 10) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPageState] = useState(defaultSize);
  const [sort, setSort] = useState(defaultSort);
  const [dir, setDir] = useState<'asc' | 'desc'>(defaultDir);

  const onSort = useCallback((field: string) => {
    if (field === sort) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(field); setDir('asc'); }
    setPage(1);
  }, [sort]);

  const setPerPage = useCallback((size: number) => { setPerPageState(size); setPage(1); }, []);

  return { page, setPage, perPage, setPerPage, sort, dir, onSort, params: { page, per_page: perPage, sort, dir } };
}

/** All categories of one type, for filter dropdowns and form selects. */
export function useCategories(type: CategoryType): Category[] {
  const { data } = useApi<Paginated<Category>>(withQuery('/admin/categories', { type, per_page: 100, sort: 'name', dir: 'asc' }));
  return data?.data ?? [];
}

/**
 * Runs a mutation with toast feedback. Resolves true on success so callers can
 * close modals / reload; errors are shown to the user, never swallowed silently.
 */
export function useAction() {
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(true);
    try {
      await action();
      showToast('success', success);
      return true;
    } catch (e) {
      showToast('error', (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  return { run, busy };
}

/** Delays a fast-changing value (search input) so we don't hit the API on every keystroke. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
