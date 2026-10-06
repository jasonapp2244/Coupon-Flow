import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { api, withQuery } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import type { Paginated, Store } from '../lib/types';

/**
 * Searchable store picker. Asks the API as you type, so it works for any number of stores
 * (a plain <select> would only ever list the first page).
 *
 * `value` is the store id ('' = none); `label` is the name to show for it before any search.
 */
export function StorePicker({ value, label, onChange, allLabel, compact = false, invalid = false }: {
  value: string;
  label?: string | null;
  onChange: (id: string, name: string) => void;
  /** When set, the picker offers a "clear" choice with this text (used by filters). */
  allLabel?: string;
  compact?: boolean;
  invalid?: boolean;
}) {
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [selectedName, setSelectedName] = useState(label ?? '');
  const term = useDebounced(query, 250);

  useEffect(() => { if (label) setSelectedName(label); }, [label]);
  useEffect(() => { if (!value) setSelectedName(''); }, [value]);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    setLoading(true);
    api.get<Paginated<Store>>(withQuery('/admin/stores', { q: term, per_page: 20, sort: 'name', dir: 'asc' }))
      .then(res => { if (!stale) { setResults(res.data); setActive(0); } })
      .catch(() => { if (!stale) setResults([]); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [term, open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (id: string, name: string) => {
    setSelectedName(name);
    onChange(id, name);
    setOpen(false);
    setQuery('');
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); choose(String(results[active].id), results[active].name); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const size = compact ? 'px-3 py-2 text-xs' : 'px-3 py-2 text-sm';
  const border = invalid ? 'border-red-300' : 'border-slate-200';

  return (
    <div ref={box} className={`relative ${compact ? 'min-w-44' : 'w-full'}`}>
      <div className={`flex items-center gap-2 bg-white border ${border} rounded-lg ${size} focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400`}>
        <Search size={13} className="text-slate-400 shrink-0" />
        <input
          role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-label="Store"
          value={open ? query : selectedName || ''}
          placeholder={selectedName || allLabel || 'Search stores…'}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKey}
          className="flex-1 min-w-0 bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
        />
        {value && allLabel ? (
          <button type="button" onClick={() => choose('', '')} aria-label="Clear store filter" className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
        ) : (
          <ChevronDown size={13} className="text-slate-400 shrink-0" />
        )}
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 w-full max-h-64 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-sm">
          {allLabel && (
            <li role="option" aria-selected={!value} onMouseDown={() => choose('', '')}
              className="px-3 py-2 cursor-pointer text-slate-500 hover:bg-slate-50">{allLabel}</li>
          )}
          {loading && results.length === 0 && <li className="px-3 py-2 text-slate-400">Searching…</li>}
          {!loading && results.length === 0 && <li className="px-3 py-2 text-slate-400">No stores match “{query}”.</li>}
          {results.map((s, i) => (
            <li key={s.id} role="option" aria-selected={String(s.id) === value}
              onMouseDown={() => choose(String(s.id), s.name)} onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 cursor-pointer flex justify-between gap-2 ${i === active ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}>
              <span className="truncate">{s.name}</span>
              {s.status !== 'Active' && <span className="text-xs text-slate-400">{s.status}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
