import { useRef, useState } from 'react';
import { FileUp, KeyRound, Trash2 } from 'lucide-react';
import { Button, Card } from './ui';
import { ConfirmModal } from './Modal';
import { FieldError } from './FormParts';
import { CodesLeftBar } from './CouponUsage';
import { Pagination, TableBodyState } from './DataTable';
import { api, ApiError, toFormData, withQuery } from '../lib/api';
import { useApi } from '../lib/hooks';
import { dateTime, number } from '../lib/format';
import { useApp } from '../store/AppContext';
import type { CouponCodeEntry, CouponCodeList, CouponCodesAdded, PageMeta } from '../lib/types';

/** Splits pasted text the way the API does: one code per line (commas also separate), trimmed. */
export function parseCodes(text: string): string[] {
  return text.split(/[\r\n,]+/).map(c => c.trim()).filter(Boolean);
}

/** "Added 40 codes (2 skipped as duplicates). 38 of 40 left." */
export function addedMessage(res: CouponCodesAdded): string {
  const skipped = res.skipped ? ` (${number(res.skipped)} skipped: duplicates or invalid)` : '';
  return `Added ${number(res.added)} ${res.added === 1 ? 'code' : 'codes'}${skipped}. ${number(res.left)} of ${number(res.total)} left.`;
}

const PER_PAGE = 20;

/**
 * The code list of a "Code list" coupon: how many are left, paste or upload more, and browse
 * free / used codes. Editors and admins can add and delete (free codes only); viewers only read.
 */
export function CouponCodesCard({ couponId, canWrite, onCountsChange }: {
  couponId: number; canWrite: boolean; onCountsChange?: (counts: { total: number; left: number }) => void;
}) {
  const { showToast } = useApp();
  const base = `/admin/coupons/${couponId}/codes`;
  const [tab, setTab] = useState<'free' | 'used'>('free');
  const [page, setPage] = useState(1);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<CouponCodeEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const list = useApi<CouponCodeList>(withQuery(base, { state: tab, page, per_page: PER_PAGE }));
  const counts = list.data?.counts;
  const raw = list.data?.meta;
  const rows = list.data?.data ?? [];
  const meta: PageMeta | null = raw ? {
    ...raw,
    from: raw.total ? (raw.current_page - 1) * raw.per_page + 1 : null,
    to: raw.total ? Math.min(raw.total, raw.current_page * raw.per_page) : null,
  } : null;

  const refresh = (res?: { total: number; left: number }) => {
    if (res) onCountsChange?.({ total: res.total, left: res.left });
    list.reload();
  };

  const add = async (body: { codes: string } | FormData) => {
    setAdding(true);
    setError('');
    try {
      const res = body instanceof FormData
        ? await api.upload<CouponCodesAdded>(base, body)
        : await api.post<CouponCodesAdded>(base, body);
      showToast('success', addedMessage(res));
      setText('');
      if (tab !== 'free' || page !== 1) { setTab('free'); setPage(1); }
      refresh(res);
    } catch (e) {
      const message = e instanceof ApiError ? (e.field('codes') ?? e.field('file') ?? e.message) : (e as Error).message;
      setError(message);
      showToast('error', message);
    } finally {
      setAdding(false);
    }
  };

  const addPasted = () => {
    const codes = parseCodes(text);
    if (!codes.length) { setError('Paste at least one code'); return; }
    if (codes.length > 5000) { setError(`That's ${number(codes.length)} codes. Add at most 5,000 at a time.`); return; }
    add({ codes: codes.join('\n') });
  };

  const upload = (picked: File | undefined) => {
    if (!picked) return;
    add(toFormData({ file: picked }));
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`${base}/${toDelete.id}`);
      showToast('success', `Code ${toDelete.code} deleted`);
      setToDelete(null);
      if (counts) onCountsChange?.({ total: Math.max(0, counts.total - 1), left: Math.max(0, counts.left - 1) });
      if (rows.length === 1 && page > 1) setPage(p => p - 1);
      else list.reload();
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const switchTab = (next: 'free' | 'used') => { setTab(next); setPage(1); };

  return (
    <Card padding={false}>
      <div className="p-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Codes</h2>
          <p className="text-xs text-slate-400 mt-0.5">Each "Show coupon code" click gets the next unused code. When none are left the coupon counts as used up.</p>
        </div>
        <div className="w-56">
          {counts ? <CodesLeftBar left={counts.left} total={counts.total} /> : <span className="text-xs text-slate-400">{list.loading ? 'Loading…' : '—'}</span>}
        </div>
      </div>

      {canWrite && (
        <div className="p-5 border-b border-slate-100 space-y-2">
          <label htmlFor={`codes-${couponId}`} className="text-sm font-medium text-slate-700">Paste codes, one per line</label>
          <textarea id={`codes-${couponId}`} rows={5} value={text} onChange={e => { setText(e.target.value); setError(''); }}
            placeholder={'SAVE-8K2Q\nSAVE-91ZD\nSAVE-4MXP'}
            className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-slate-700 placeholder:text-slate-400 resize-y" />
          <FieldError message={error} />
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={addPasted} disabled={adding || !text.trim()}>
              <KeyRound size={13} /> {adding ? 'Adding…' : `Add ${parseCodes(text).length ? number(parseCodes(text).length) + ' ' : ''}codes`}
            </Button>
            <input ref={file} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden"
              onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            <Button size="sm" variant="outline" onClick={() => file.current?.click()} disabled={adding}>
              <FileUp size={13} /> Upload CSV / TXT
            </Button>
            <span className="text-xs text-slate-400">CSV: the first column is read. Duplicates are skipped. Up to 5,000 at a time.</span>
          </div>
        </div>
      )}

      <div className="flex border-b border-slate-100">
        {(['free', 'used'] as const).map(t => (
          <button key={t} type="button" onClick={() => switchTab(t)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'free' ? 'Free' : 'Used'}
            {counts && <span className="ml-1.5 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{number(t === 'free' ? counts.left : counts.total - counts.left)}</span>}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className={`w-full text-sm transition-opacity ${list.loading && rows.length ? 'opacity-60' : ''}`}>
          <thead>
            <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Used at</th>
              <th className="px-4 py-3 text-left">Redemption</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <TableBodyState colSpan={4} loading={list.loading && !rows.length} error={list.error} empty={rows.length === 0}
              emptyIcon={<KeyRound size={22} />} emptyTitle={tab === 'free' ? 'No free codes' : 'No codes used yet'}
              emptyText={tab === 'free' ? (canWrite ? 'Paste or upload codes above.' : 'Nothing here yet.') : 'Codes appear here once shoppers take them.'}
              onRetry={list.reload} />
            {!list.error && rows.map(c => (
              <tr key={c.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3"><code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">{c.code}</code></td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{c.used ? dateTime(c.assigned_at) : '—'}</td>
                <td className="px-4 py-3">{c.redemption_reference ? <code className="text-xs font-mono text-blue-600">{c.redemption_reference}</code> : <span className="text-xs text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-right">
                  {canWrite && !c.used && (
                    <button type="button" onClick={() => setToDelete(c)} aria-label={`Delete code ${c.code}`} className="p-1 text-slate-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPage={setPage} />

      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} loading={deleting}
        title="Delete code?" message={`${toDelete?.code ?? ''} will be removed from the list. Shoppers won't get it.`} confirmLabel="Delete" />
    </Card>
  );
}
