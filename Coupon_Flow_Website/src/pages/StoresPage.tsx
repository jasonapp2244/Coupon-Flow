import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState, ErrorState, Pager, Spinner, StoreCard } from '../components/States';
import { withQuery } from '../lib/api';
import { useApi, useDebounced, usePageMeta } from '../lib/hooks';
import { pageParam } from '../lib/format';
import type { Category, Paginated, Store } from '../lib/types';

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

const SORTS = [
  { value: 'name', label: 'Name A to Z' },
  { value: 'coupons_count', label: 'Most coupons' },
  { value: 'updated_at', label: 'Recently updated' },
];

export default function StoresPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const letter = params.get('letter') ?? '';
  const sort = params.get('sort') ?? 'name';
  const page = pageParam(params.get('page'));

  const [text, setText] = useState(q);
  const debounced = useDebounced(text);
  useEffect(() => { setText(q); }, [q]);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(paramsRef.current);
    for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Runs only when the debounced text settles (update reads the latest URL through paramsRef).
  useEffect(() => {
    if (debounced.trim() !== (paramsRef.current.get('q') ?? '')) update({ q: debounced.trim(), letter: '' });
  }, [debounced]);

  usePageMeta(letter ? `Stores starting with ${letter}` : 'Stores A to Z', 'Every store with live coupon codes and deals, from A to Z.');

  const categories = useApi<{ data: Category[] }>('/public/categories?type=store');
  const { data, loading, error, reload } = useApi<Paginated<Store>>(withQuery('/public/stores', {
    q, category, letter, page, per_page: 24, sort, dir: sort === 'name' ? 'asc' : 'desc',
  }));
  const stores = data?.data ?? [];

  return (
    <div className="page py-10">
      <h1 className="page-title">Stores A to Z</h1>
      <p className="mt-2 text-ink-soft">Pick a store to see every live code and deal for it.</p>

      <div className="mt-6 flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-line">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Search stores" aria-label="Search stores" className="field sm:max-w-sm" />
          <select value={category} onChange={e => update({ category: e.target.value })} aria-label="Category" className="field sm:w-52">
            <option value="">All categories</option>
            {categories.data?.data.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={sort} onChange={e => update({ sort: e.target.value === 'name' ? '' : e.target.value })} aria-label="Sort by" className="field sm:ml-auto sm:w-52">
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <nav aria-label="Stores by first letter" className="flex flex-wrap gap-1">
          <button onClick={() => update({ letter: '' })} aria-pressed={!letter}
            className={`h-9 rounded-lg px-3 text-sm font-semibold ${!letter ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper'}`}>All</button>
          {LETTERS.map(l => (
            <button key={l} onClick={() => { setText(''); update({ letter: l, q: '' }); }} aria-pressed={letter === l}
              aria-label={l === '#' ? 'Stores starting with a number' : `Stores starting with ${l}`}
              className={`h-9 w-9 rounded-lg text-sm font-semibold ${letter === l ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper'}`}>{l}</button>
          ))}
        </nav>
      </div>

      <section className="mt-8" aria-label="Stores">
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <Spinner />}
        {data && stores.length === 0 && <EmptyState title="No stores match that search">Check the spelling, or pick a different letter or category.</EmptyState>}
        <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
          {stores.map(s => <li key={s.id}><StoreCard store={s} /></li>)}
        </ul>
        <Pager meta={data?.meta ?? null} onPage={p => { update({ page: String(p) }); window.scrollTo(0, 0); }} />
      </section>
    </div>
  );
}
