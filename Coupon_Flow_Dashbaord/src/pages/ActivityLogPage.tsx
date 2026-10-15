import { useState } from 'react';
import { History, X } from 'lucide-react';
import { Card, PageHeader } from '../components/ui';
import { Drawer } from '../components/Modal';
import { Pagination, SearchInput, TableBodyState, filterSelectClass } from '../components/DataTable';
import { useApi, useApiList, useDebounced, useListControls } from '../lib/hooks';
import { dateTime } from '../lib/format';
import type { ActivityEntry, Paginated, StaffMember } from '../lib/types';

/** Plain-language names for the logged actions. */
const ACTIONS: Record<string, string> = {
  created: 'Created', updated: 'Changed', deleted: 'Moved to trash', restored: 'Restored', deleted_permanently: 'Deleted permanently',
  login: 'Signed in', logout: 'Signed out', login_failed: 'Failed sign-in', two_factor_failed: 'Wrong two-step code',
  two_factor_enabled: 'Turned on two-step login', two_factor_disabled: 'Turned off two-step login', two_factor_reset: 'Reset two-step login',
  recovery_code_used: 'Used a recovery code', recovery_codes_replaced: 'Replaced recovery codes', profile_updated: 'Updated own profile',
  staff_created: 'Added staff member', staff_updated: 'Changed staff member', staff_invite_sent: 'Sent set-password link',
  settings_updated: 'Changed settings', ratings_reset: 'Reset store rating', rating_removed: 'Removed a rating',
  uses_reset: 'Reset coupon uses', feed_synced: 'Ran brand feed', csv_imported: 'Imported CSV',
};

const label = (action: string) => ACTIONS[action] ?? action.replace(/_/g, ' ');
const show = (value: unknown) => value === null || value === undefined || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const isPair = (value: unknown): value is [unknown, unknown] => Array.isArray(value) && value.length === 2;

function Changes({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes || Object.keys(changes).length === 0) return <p className="text-xs text-slate-400">No field details.</p>;
  return (
    <table className="w-full text-xs">
      <thead><tr className="text-slate-400"><th className="py-1 pr-2 text-left font-medium">Field</th><th className="py-1 pr-2 text-left font-medium">Before</th><th className="py-1 text-left font-medium">After</th></tr></thead>
      <tbody className="divide-y divide-slate-50">
        {Object.entries(changes).map(([field, value]) => (
          <tr key={field} className="align-top">
            <td className="py-1.5 pr-2 font-mono text-slate-600">{field}</td>
            {isPair(value)
              ? <><td className="py-1.5 pr-2 text-slate-400 line-through break-all">{show(value[0])}</td><td className="py-1.5 text-slate-800 break-all">{show(value[1])}</td></>
              : <td colSpan={2} className="py-1.5 text-slate-800 break-all">{show(value)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ActivityLogPage() {
  const list = useListControls('created_at', 'desc', 25);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('All');
  const [action, setAction] = useState('All');
  const [type, setType] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<ActivityEntry | null>(null);
  const q = useDebounced(search);

  const staff = useApi<{ data: StaffMember[] }>('/admin/staff').data?.data ?? [];
  const params = { page: list.page, per_page: list.perPage, q, user_id: userId, action, subject_type: type, from, to };
  const { items, meta, loading, error, reload } = useApiList<ActivityEntry>('/admin/activity', params);
  // The same endpoint also lists the filter choices (actions and types seen so far).
  const filters = useApi<Paginated<ActivityEntry> & { filters: { actions: string[]; subject_types: string[] } }>('/admin/activity?per_page=1').data?.filters;

  const changed = <T,>(set: (v: T) => void) => (v: T) => { set(v); list.setPage(1); };
  const hasFilters = search || userId !== 'All' || action !== 'All' || type !== 'All' || from || to;
  const clear = () => { setSearch(''); setUserId('All'); setAction('All'); setType('All'); setFrom(''); setTo(''); list.setPage(1); };

  return (
    <div className="space-y-5">
      <PageHeader title="Activity Log" subtitle="Who changed what and when. Kept for one year." />

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={changed(setSearch)} placeholder="Search item or person..." />
          <select value={userId} onChange={e => changed(setUserId)(e.target.value)} className={filterSelectClass} aria-label="Person">
            <option value="All">Everyone</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={action} onChange={e => changed(setAction)(e.target.value)} className={filterSelectClass} aria-label="Action">
            <option value="All">All actions</option>
            {filters?.actions.map(a => <option key={a} value={a}>{label(a)}</option>)}
          </select>
          <select value={type} onChange={e => changed(setType)(e.target.value)} className={filterSelectClass} aria-label="Item type">
            <option value="All">All items</option>
            {filters?.subject_types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">From <input type="date" value={from} onChange={e => changed(setFrom)(e.target.value)} className={filterSelectClass} /></label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">To <input type="date" value={to} onChange={e => changed(setTo)(e.target.value)} className={filterSelectClass} /></label>
          {hasFilters && <button onClick={clear} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100"><X size={12} /> Clear</button>}
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${loading && items.length ? 'opacity-60' : ''}`}>
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                {['When', 'Who', 'What', 'Item', 'IP address'].map(h => <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              <TableBodyState colSpan={5} loading={loading} error={error} empty={items.length === 0} emptyIcon={<History size={22} />}
                emptyTitle={hasFilters ? 'Nothing matches these filters' : 'Nothing logged yet'} onRetry={reload} onClear={hasFilters ? clear : undefined} />
              {!error && items.map(entry => (
                <tr key={entry.id} onClick={() => setSelected(entry)}
                  className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${selected?.id === entry.id ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{dateTime(entry.created_at)}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.user_name}</td>
                  <td className={`px-4 py-3 ${/failed/.test(entry.action) ? 'text-red-600 font-medium' : 'text-slate-700'}`}>{label(entry.action)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {entry.subject_type && <span className="text-xs text-slate-400 mr-1.5">{entry.subject_type}</span>}
                    {entry.subject_label ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{entry.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={meta} onPage={list.setPage} onPageSize={list.setPerPage} />
      </Card>

      {selected && (
        <Drawer open title={label(selected.action)} onClose={() => setSelected(null)} width="w-96">
          <div className="space-y-2 text-xs">
            {([
              ['When', dateTime(selected.created_at)],
              ['Who', selected.user_name],
              ['Item', [selected.subject_type, selected.subject_label].filter(Boolean).join(': ') || '—'],
              ['IP address', selected.ip ?? '—'],
              ['Browser', selected.user_agent ?? '—'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium flex-shrink-0">{k}</span>
                <span className="text-slate-700 text-right break-all">{v}</span>
              </div>
            ))}
          </div>
          <h3 className="mt-5 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Details</h3>
          <Changes changes={selected.changes} />
        </Drawer>
      )}
    </div>
  );
}
