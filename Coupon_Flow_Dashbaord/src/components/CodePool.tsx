import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { KeyRound, Trash2, Upload } from 'lucide-react';
import { Badge, Button } from './ui';
import { ConfirmModal } from './Modal';
import { Pagination, SearchInput, TableBodyState, filterSelectClass } from './DataTable';
import { api } from '../lib/api';
import { useApiList, useDebounced } from '../lib/hooks';
import { dateTime, number, plural } from '../lib/format';
import { useApp } from '../store/AppContext';
import type { CouponCode } from '../lib/types';

/** The API accepts up to 5,000 codes per request; bigger pastes are sent in batches. */
const BATCH = 5000;

/** One code per line; commas, semicolons and tabs also separate codes (CSV/TSV exports). */
export function parseCodes(text: string): string[] {
  return text.split(/[\r\n,;\t]+/).map(c => c.trim()).filter(Boolean);
}

export interface AddResult { added: number; duplicates: number; delivered: number; stock: number }

/** Sends codes in batches and adds up the results. */
export async function addCodes(couponId: number, codes: string[]): Promise<AddResult> {
  const total: AddResult = { added: 0, duplicates: 0, delivered: 0, stock: 0 };
  for (let i = 0; i < codes.length; i += BATCH) {
    const res = await api.post<AddResult>(`/admin/coupons/${couponId}/codes`, { codes: codes.slice(i, i + BATCH) });
    total.added += res.added;
    total.duplicates += res.duplicates;
    total.delivered += res.delivered;
    total.stock = res.stock;
  }
  return total;
}

export function describeAdd(r: AddResult): string {
  const parts = [`Added ${plural(r.added, 'code')}`];
  if (r.duplicates) parts.push(`skipped ${number(r.duplicates)} already in the pool`);
  if (r.delivered) parts.push(`sent ${number(r.delivered)} to paid orders that were waiting`);
  return parts.join(', ');
}

/** Textarea + file import shared by the create form (codes queued) and the pool manager (codes sent). */
export function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useApp();
  const count = parseCodes(value).length;

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('error', 'That file is over 5 MB. Split it into smaller files.'); return; }
    const text = await file.text();
    onChange(value.trim() ? `${value.trim()}\n${text}` : text);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div>
      <label htmlFor="pool-codes" className="text-sm font-medium text-slate-700">Codes to add</label>
      <textarea id="pool-codes" rows={5} value={value} onChange={e => onChange(e.target.value)} spellCheck={false}
        placeholder={'NIKE-7Q2X\nNIKE-K9LM\nNIKE-3RTB'}
        className="mt-1 w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-slate-700 placeholder:text-slate-300 resize-y" />
      <div className="mt-1 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-400">One per line, or a .txt/.csv file. Duplicates are skipped. {count > 0 && <span className="text-slate-600 font-medium">{plural(count, 'code')} ready.</span>}</p>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer">
          <Upload size={13} /> Import file
          <input ref={fileRef} type="file" accept=".txt,.csv,text/plain,text/csv" className="sr-only" onChange={e => importFile(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}

/** Manage the codes of a saved coupon: add more, see which sold to which order, remove unsold ones. */
export function CodePool({ couponId, onStock }: { couponId: number; onStock: (stock: number) => void }) {
  const { showToast } = useApp();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<'' | 'available' | 'sold'>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<CouponCode | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search);

  const list = useApiList<CouponCode>(`/admin/coupons/${couponId}/codes`, { status, q, page, per_page: 10 });

  const add = async () => {
    const codes = parseCodes(draft);
    if (!codes.length) return;
    setAdding(true);
    try {
      const res = await addCodes(couponId, codes);
      showToast('success', describeAdd(res));
      onStock(res.stock);
      setDraft('');
      list.reload();
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      const res = await api.delete<{ stock: number }>(`/admin/coupons/${couponId}/codes/${removing.id}`);
      onStock(res.stock);
      showToast('success', `Removed ${removing.code}`);
      list.reload();
    } catch (err) {
      showToast('error', (err as Error).message);
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <CodeInput value={draft} onChange={setDraft} />
      <div className="flex justify-end">
        <Button onClick={add} disabled={adding || !parseCodes(draft).length}>{adding ? 'Adding…' : 'Add codes'}</Button>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="flex gap-2 p-3 border-b border-slate-100 flex-wrap">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Find a code" />
          <select aria-label="Filter codes" value={status} onChange={e => { setStatus(e.target.value as typeof status); setPage(1); }} className={filterSelectClass}>
            <option value="">All codes</option>
            <option value="available">Unsold</option>
            <option value="sold">Sold</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Code</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Order</th>
                <th className="px-4 py-2.5 text-left">Sold</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.items.length === 0 || list.error ? (
                <TableBodyState colSpan={5} loading={list.loading} error={list.error} empty={list.items.length === 0}
                  emptyIcon={<KeyRound size={20} className="text-slate-300" />} emptyTitle={q || status ? 'No matching codes' : 'No codes yet'}
                  emptyText={q || status ? 'Try another search or filter.' : 'Add codes above. Each buyer receives one of them.'}
                  onRetry={list.reload} onClear={q || status ? () => { setSearch(''); setStatus(''); } : undefined} />
              ) : list.items.map(code => (
                <tr key={code.id}>
                  <td className="px-4 py-2.5 font-mono text-slate-700">{code.code}</td>
                  <td className="px-4 py-2.5">{code.status === 'sold' ? <Badge variant="success">Sold</Badge> : <Badge>Unsold</Badge>}</td>
                  <td className="px-4 py-2.5 text-slate-500">{code.order_id ? <Link to={`/orders?q=${code.order_id}`} className="text-blue-600 hover:underline">#{code.order_id}</Link> : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{code.assigned_at ? dateTime(code.assigned_at) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {code.status === 'available' && (
                      <button onClick={() => setRemoving(code)} aria-label={`Remove ${code.code}`} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(list.meta?.total ?? 0) > 0 && <Pagination meta={list.meta} onPage={setPage} />}
      </div>

      <ConfirmModal open={removing !== null} onClose={() => setRemoving(null)} onConfirm={remove} loading={busy}
        title="Remove code?" confirmLabel="Remove"
        message={`${removing?.code ?? ''} will no longer be sold. Sold codes stay with their buyers.`} />
    </div>
  );
}
