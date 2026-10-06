import { type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search, AlertTriangle, MoreHorizontal } from 'lucide-react';
import { Button, EmptyState } from './ui';
import type { PageMeta } from '../lib/types';

export type SortDir = 'asc' | 'desc';

export function SortableTh({ label, field, sort, dir, onSort, className = 'px-4 py-3' }: {
  label: string; field: string; sort: string; dir: SortDir; onSort: (field: string) => void; className?: string;
}) {
  const active = sort === field;
  return (
    <th className={`${className} text-left cursor-pointer hover:text-slate-600 select-none`} onClick={() => onSort(field)}>
      <span className="flex items-center gap-1">
        {label}
        {active ? (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} className="opacity-30" />}
      </span>
    </th>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-40">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
      />
    </div>
  );
}

export const filterSelectClass = 'px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none text-slate-600 cursor-pointer';

/** Loading / error / empty row, so each table only renders its happy path. */
export function TableBodyState({ colSpan, loading, error, empty, emptyIcon, emptyTitle, emptyText = 'Nothing here yet.', onRetry, onClear }: {
  colSpan: number; loading: boolean; error: string | null; empty: boolean;
  emptyIcon: ReactNode; emptyTitle: string; emptyText?: string; onRetry: () => void;
  /** Present only while filters are active: shows the "adjust filters" hint and a clear button. */
  onClear?: () => void;
}) {
  if (error) {
    return (
      <tr><td colSpan={colSpan}>
        <div className="flex flex-col items-center py-14 text-center">
          <AlertTriangle size={20} className="text-red-400 mb-2" />
          <p className="text-sm font-medium text-slate-700">Couldn't load data</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>
        </div>
      </td></tr>
    );
  }
  if (loading && empty) {
    return (
      <tr><td colSpan={colSpan}>
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </td></tr>
    );
  }
  if (empty) {
    return (
      <tr><td colSpan={colSpan}>
        <EmptyState icon={emptyIcon} title={emptyTitle} description={onClear ? 'Try adjusting your filters or search terms.' : emptyText} />
        {onClear && <div className="flex justify-center pb-8"><Button variant="outline" size="sm" onClick={onClear}>Clear Filters</Button></div>}
      </td></tr>
    );
  }
  return null;
}

const PAGE_SIZES = [10, 20, 50, 100];

export function Pagination({ meta, onPage, onPageSize }: {
  meta: PageMeta | null; onPage: (page: number) => void; onPageSize?: (size: number) => void;
}) {
  const page = meta?.current_page ?? 1;
  const last = meta?.last_page ?? 1;
  const count = Math.min(5, last);
  const start = last <= 5 ? 1 : page <= 3 ? 1 : page >= last - 2 ? last - 4 : page - 2;

  return (
    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">
          Showing {meta?.from ?? 0}–{meta?.to ?? 0} of {(meta?.total ?? 0).toLocaleString()}
        </span>
        {onPageSize && (
          <select value={meta?.per_page ?? 10} onChange={e => onPageSize(Number(e.target.value))} className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} per page</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={13} /></button>
        {Array.from({ length: count }, (_, i) => start + i).map(p => (
          <button key={p} onClick={() => onPage(p)} className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium ${p === page ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{p}</button>
        ))}
        <button disabled={page >= last} onClick={() => onPage(page + 1)} aria-label="Next page" className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={13} /></button>
      </div>
    </div>
  );
}

/** Row "⋯" menu. Positioning and close-on-select are shared by every table. */
export function RowMenu({ open, onToggle, children, width = 'w-36' }: {
  open: boolean; onToggle: () => void; children: ReactNode; width?: string;
}) {
  return (
    <div className="relative">
      <button onClick={onToggle} aria-label="Row actions" className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className={`absolute right-0 top-8 ${width} bg-white rounded-lg border border-slate-200 shadow-lg z-20 py-1`}>
          {children}
        </div>
      )}
    </div>
  );
}

export function RowMenuItem({ onClick, icon, children, danger }: { onClick: () => void; icon?: ReactNode; children: ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      {icon}{children}
    </button>
  );
}
