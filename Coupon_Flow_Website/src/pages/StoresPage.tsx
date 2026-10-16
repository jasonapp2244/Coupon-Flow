import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CardSkeletons, EmptyState, ErrorState, PageHeader, Pager, StoreCard } from '../components/States';
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

  usePageMeta(letter ? `Stores starting with ${letter}` : 'Stores A to Z', 'Browse every store on the site from A to Z and find promo codes and deals for the brands you shop.');

  const categories = useApi<{ data: Category[] }>('/public/categories?type=store');
  const { data, loading, error, reload } = useApi<Paginated<Store>>(withQuery('/public/stores', {
    q, category, letter, page, per_page: 24, sort, dir: sort === 'name' ? 'asc' : 'desc',
  }));
  const stores = data?.data ?? [];

  return (
    <>
      <PageHeader title="Stores A to Z" intro="Choose a store to see all of its current codes and deals."
        aside={data && <p className="text-sm font-semibold text-ink-soft">{data.meta.total.toLocaleString('en-US')} {data.meta.total === 1 ? 'store' : 'stores'}</p>} />
      <div className="page py-8">
        <div className="panel flex flex-col gap-3 p-4">
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
              className={`h-9 rounded-lg px-3 text-sm font-semibold ${!letter ? 'bg-ink text-white' : 'text-ink-soft hover:bg-marigold-soft hover:text-ink'}`}>All</button>
            {LETTERS.map(l => (
              <button key={l} onClick={() => { setText(''); update({ letter: l, q: '' }); }} aria-pressed={letter === l}
                aria-label={l === '#' ? 'Stores starting with a number' : `Stores starting with ${l}`}
                className={`h-9 w-9 rounded-lg text-sm font-semibold ${letter === l ? 'bg-ink text-white' : 'text-ink-soft hover:bg-marigold-soft hover:text-ink'}`}>{l}</button>
            ))}
          </nav>
        </div>

        <section className="mt-8" aria-label="Stores">
          {error && <ErrorState message={error} onRetry={reload} />}
          {loading && !data && <CardSkeletons count={9} />}
          {data && stores.length === 0 && ([...params.keys()].some(k => k !== 'page')
            ? <EmptyState title="No stores found">Check the spelling, or try a different letter or category.</EmptyState>
            : <EmptyState title="No stores yet">Stores are being added. Check back soon.</EmptyState>)}
          <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {stores.map(s => <li key={s.id}><StoreCard store={s} /></li>)}
          </ul>
          <Pager meta={data?.meta ?? null} onPage={p => { update({ page: String(p) }); window.scrollTo(0, 0); }} />
        </section>
      </div>
    </>
  );
}
