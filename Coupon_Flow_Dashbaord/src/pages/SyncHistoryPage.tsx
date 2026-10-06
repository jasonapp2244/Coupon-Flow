import { useState } from 'react';
import { CheckCircle, AlertTriangle, Clock, XCircle, RefreshCw } from 'lucide-react';
import { Card, PageHeader, statusBadge } from '../components/ui';
import { Drawer } from '../components/Modal';
import { Pagination, TableBodyState, filterSelectClass } from '../components/DataTable';
import { useApi, useApiList, useListControls } from '../lib/hooks';
import { dateTime, number } from '../lib/format';
import type { FeedSource, SyncRun } from '../lib/types';

const statusIcon: Record<SyncRun['status'], React.ReactElement> = {
  Completed: <CheckCircle size={13} className="text-emerald-500" />,
  Running: <Clock size={13} className="text-amber-500" />,
  Partial: <AlertTriangle size={13} className="text-amber-500" />,
  Failed: <XCircle size={13} className="text-red-500" />,
};

export default function SyncHistoryPage() {
  const list = useListControls('started_at', 'desc');
  const [selected, setSelected] = useState<SyncRun | null>(null);
  const [status, setStatus] = useState('All');
  const [source, setSource] = useState('All');
  const sources = useApi<{ data: FeedSource[] }>('/admin/feed-sources').data?.data ?? [];

  const { items, meta, loading, error, reload } = useApiList<SyncRun>('/admin/sync-runs', {
    page: list.page, per_page: list.perPage, status, feed_source_id: source,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Sync History" subtitle="Every brand feed run and CSV import, with the rows that were skipped" />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <select value={source} onChange={e => { setSource(e.target.value); list.setPage(1); }} className={filterSelectClass} aria-label="Brand feed">
            <option value="All">All brand feeds</option>
            {sources.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value); list.setPage(1); }} className={filterSelectClass} aria-label="Status">
            {['All', 'Completed', 'Partial', 'Failed', 'Running'].map(s => <option key={s} value={s}>{s === 'All' ? 'Status: All' : s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full text-sm transition-opacity ${loading && items.length ? 'opacity-60' : ''}`}>
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                {['Sync ID', 'Brand feed', 'Run', 'Started', 'Stores', 'Coupons Added', 'Updated', 'Bad rows', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <TableBodyState
                colSpan={9} loading={loading} error={error} empty={items.length === 0}
                emptyIcon={<RefreshCw size={22} />} emptyTitle="No sync runs yet" emptyText="Brand feed runs and CSV imports will be listed here." onRetry={reload}
              />
              {!error && items.map(sync => (
                <tr key={sync.id} onClick={() => setSelected(sync)}
                  className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${selected?.id === sync.id ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-4 py-3.5"><code className="text-xs font-mono text-blue-600">{sync.reference}</code></td>
                  <td className="px-4 py-3.5 text-slate-700 text-xs font-medium">{sync.feed_source ?? <span className="text-slate-400">Removed feed</span>}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{sync.type}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{dateTime(sync.started_at)}</td>
                  <td className="px-4 py-3.5 text-slate-700 font-medium">{number(sync.stores_added)}</td>
                  <td className="px-4 py-3.5 text-slate-700 font-medium">{number(sync.coupons_added)}</td>
                  <td className="px-4 py-3.5 text-slate-700 font-medium">{number(sync.coupons_updated)}</td>
                  <td className="px-4 py-3.5"><span className={sync.failed > 0 ? 'text-red-600 font-medium' : 'text-slate-300'}>{sync.failed}</span></td>
                  <td className="px-4 py-3.5"><div className="flex items-center gap-1.5">{statusIcon[sync.status]}{statusBadge(sync.status)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={meta} onPage={list.setPage} onPageSize={list.setPerPage} />
      </Card>

      {selected && (
        <Drawer open title="Sync Details" onClose={() => setSelected(null)} width="w-96">
          <div className="space-y-3 text-xs">
            {([
              ['Sync ID', <code className="font-mono text-blue-600">{selected.reference}</code>],
              ['Brand feed', selected.feed_source ?? 'Removed feed'],
              ['Run', selected.type],
              ['Status', statusBadge(selected.status)],
              ['Started', dateTime(selected.started_at)],
              ['Completed', dateTime(selected.completed_at)],
              ['Stores Added', number(selected.stores_added)],
              ['Coupons Added', number(selected.coupons_added)],
              ['Coupons Updated', number(selected.coupons_updated)],
              ['Kept (edited by staff)', number(selected.coupons_kept)],
              ['Switched Off', number(selected.coupons_deactivated)],
              ['Bad Rows', <span className={selected.failed > 0 ? 'text-red-600 font-medium' : 'text-slate-500'}>{selected.failed}</span>],
            ] as [string, React.ReactNode][]).map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-2 py-2 border-b border-slate-50">
                <span className="text-slate-400 font-medium flex-shrink-0">{label}</span>
                <span className="text-slate-700 text-right">{value}</span>
              </div>
            ))}
          </div>
          {selected.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500 mb-1.5">Skipped rows{selected.failed > selected.errors.length ? ` (first ${selected.errors.length} of ${selected.failed})` : ''}</p>
              <ul className="max-h-80 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50 divide-y divide-red-100 text-xs">
                {selected.errors.map((e, i) => (
                  <li key={i} className="px-3 py-2">
                    <span className="font-medium text-red-700">{e.row ? `Row ${e.row}` : 'Feed'}{e.external_id ? ` (${e.external_id})` : ''}:</span>{' '}
                    <span className="text-slate-700">{e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}
