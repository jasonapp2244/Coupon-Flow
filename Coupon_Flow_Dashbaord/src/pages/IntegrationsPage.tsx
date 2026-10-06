import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Download, Edit, FileUp, Play, Plug, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, Toggle, statusBadge } from '../components/ui';
import { ConfirmModal, Modal } from '../components/Modal';
import { RowMenu, RowMenuItem, TableBodyState } from '../components/DataTable';
import { FieldError } from '../components/FormParts';
import { StorePicker } from '../components/StorePicker';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/hooks';
import { dateTime, number, plural } from '../lib/format';
import { useApp, useCan } from '../store/AppContext';
import type { FeedSource, SyncRun } from '../lib/types';

const TYPE_LABELS: Record<FeedSource['type'], string> = {
  json_url: 'JSON feed URL',
  csv_url: 'CSV feed URL',
  csv_upload: 'CSV upload',
};

const FREQUENCY_LABELS: Record<FeedSource['frequency'], string> = {
  hourly: 'Every hour',
  every_6_hours: 'Every 6 hours',
  daily: 'Once a day',
  manual: 'Only when run by hand',
};

/** The columns of "Coupon Follow feed v1", for the format guide. */
const FORMAT: [string, boolean, string][] = [
  ['external_id', true, "The brand's own id for the coupon. Used to update it next time."],
  ['store', true, 'Store name or slug, e.g. "The Loaded Tea Shop". Optional if the source has a default store.'],
  ['store_url', false, 'Store website. Needed only to create a store we don\'t have yet (it arrives as Draft).'],
  ['title', true, 'Shown on the coupon, e.g. "Sitewide Discount! Get 10% Off".'],
  ['type', true, '"code" (shows a code) or "deal" (no code required).'],
  ['code', false, 'Required when type is code.'],
  ['description', false, 'Short text under the title.'],
  ['tracking_url', false, 'Affiliate link for this coupon; otherwise the store\'s link is used.'],
  ['starts_at / ends_at', false, '"2026-10-25 23:59" in the store\'s timezone, or ISO 8601. A date alone means the whole day.'],
  ['usage_limit', false, 'How many times it can be used. Empty = unlimited.'],
  ['verified / featured', false, 'yes / no'],
];

type Form = Omit<FeedSource, 'id' | 'has_api_key' | 'last_run_at' | 'last_status' | 'coupons_count' | 'default_store'> & { default_store: string | null };

const blank: Form = {
  name: '', type: 'csv_upload', url: '', api_key: '', default_store_id: null, default_store: null,
  frequency: 'daily', auto_publish: false, deactivate_missing: false, is_active: true,
};

function SourceForm({ source, onClose, onSaved }: { source: FeedSource | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useApp();
  const [form, setForm] = useState<Form>(source ? { ...source, api_key: '' } : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => { setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: '' })); };
  const isUrl = form.type !== 'csv_upload';

  const save = async () => {
    setSaving(true);
    const body = {
      name: form.name, type: form.type, url: isUrl ? form.url : null, default_store_id: form.default_store_id,
      frequency: isUrl ? form.frequency : 'manual', auto_publish: form.auto_publish,
      deactivate_missing: isUrl && form.deactivate_missing, is_active: form.is_active,
      ...(isUrl && form.api_key ? { api_key: form.api_key } : {}),
    };
    try {
      if (source) await api.patch(`/admin/feed-sources/${source.id}`, body);
      else await api.post('/admin/feed-sources', body);
      showToast('success', source ? 'Feed source updated' : 'Feed source added');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.fieldErrors());
      else showToast('error', (err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={source ? `Edit ${source.name}` : 'Add a brand feed'} size="lg"
      footer={<><Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : 'Save'}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Input label="Brand or company" value={form.name} onChange={v => set('name', v)} placeholder="e.g. The Loaded Tea Shop" required /><FieldError message={errors.name} /></div>
        <div className="sm:col-span-2">
          <p className="text-sm font-medium text-slate-700 mb-1.5">How they send coupons</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(TYPE_LABELS) as FeedSource['type'][]).map(t => (
              <label key={t} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${form.type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <input type="radio" name="feed-type" value={t} checked={form.type === t} onChange={() => set('type', t)} className="sr-only" />
                {TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        </div>
        {isUrl && (
          <>
            <div className="sm:col-span-2"><Input label="Feed URL" value={form.url ?? ''} onChange={v => set('url', v)} placeholder="https://brand.example/coupons.json" helperText="Must be https. We fetch it on the schedule below." required /><FieldError message={errors.url} /></div>
            <div>
              <Input label="API key (optional)" type="password" value={form.api_key} onChange={v => set('api_key', v)}
                placeholder={source?.has_api_key ? `Saved (${source.api_key}). Leave blank to keep.` : 'Sent as a Bearer token'} />
              <FieldError message={errors.api_key} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="feed-frequency" className="text-sm font-medium text-slate-700">Check for new coupons</label>
              <select id="feed-frequency" value={form.frequency} onChange={e => set('frequency', e.target.value as FeedSource['frequency'])}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
                {(Object.keys(FREQUENCY_LABELS) as FeedSource['frequency'][]).map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <StorePicker label="Default store (optional)" value={form.default_store_id ? String(form.default_store_id) : ''} allLabel="No default store"
            onChange={(id, name) => { set('default_store_id', id ? Number(id) : null); set('default_store', id ? name : null); }} />
          <p className="text-xs text-slate-400 mt-1">Rows without a store column go to this store. Handy when a source only ever sends one brand.</p>
          <FieldError message={errors.default_store_id} />
        </div>
        <div className="sm:col-span-2 space-y-3 pt-2 border-t border-slate-100">
          {[
            { key: 'auto_publish' as const, label: 'Publish new coupons straight away', desc: 'Off: new coupons arrive as Draft so you can check them before they go live.', show: true },
            { key: 'deactivate_missing' as const, label: 'Switch off coupons that leave the feed', desc: 'When a coupon is no longer in the feed, set it to Inactive. URL feeds only.', show: isUrl },
            { key: 'is_active' as const, label: 'Source is on', desc: 'Off: scheduled checks skip this source.', show: true },
          ].filter(r => r.show).map(r => (
            <div key={r.key} className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-medium text-slate-700">{r.label}</p><p className="text-xs text-slate-400">{r.desc}</p></div>
              <Toggle checked={form[r.key]} onChange={v => set(r.key, v)} ariaLabel={r.label} />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function RunResult({ run, onClose }: { run: SyncRun; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal open onClose={onClose} title={`Import ${run.status.toLowerCase()}`}
      footer={<><Button variant="ghost" onClick={() => navigate('/sync-history')}>Sync history</Button><Button onClick={onClose}>Done</Button></>}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">{statusBadge(run.status)}<code className="text-xs text-slate-500">{run.reference}</code></div>
        <ul className="grid grid-cols-2 gap-2">
          {[
            ['New coupons', run.coupons_added], ['Updated', run.coupons_updated], ['Kept (edited by you)', run.coupons_kept],
            ['New stores (Draft)', run.stores_added], ['Switched off', run.coupons_deactivated], ['Bad rows', run.failed],
          ].map(([label, value]) => (
            <li key={label as string} className="rounded-lg bg-slate-50 px-3 py-2">
              <span className="block text-xs text-slate-400">{label}</span>
              <span className={`text-base font-semibold ${label === 'Bad rows' && Number(value) > 0 ? 'text-red-600' : 'text-slate-800'}`}>{number(Number(value))}</span>
            </li>
          ))}
        </ul>
        {run.errors.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Rows that were skipped</p>
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50 divide-y divide-red-100 text-xs">
              {run.errors.map((e, i) => (
                <li key={i} className="px-3 py-2"><span className="font-medium text-red-700">{e.row ? `Row ${e.row}` : 'Feed'}{e.external_id ? ` (${e.external_id})` : ''}:</span> <span className="text-slate-700">{e.message}</span></li>
              ))}
            </ul>
          </div>
        )}
        {run.coupons_added > 0 && <p className="text-xs text-slate-500">New coupons are in All Coupons{run.status !== 'Failed' ? ' (filter by this source)' : ''}.</p>}
      </div>
    </Modal>
  );
}

export default function BrandFeedsPage() {
  const { showToast } = useApp();
  const canWrite = useCan('write');
  const isAdmin = useCan('admin');
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi<{ data: FeedSource[] }>('/admin/feed-sources');
  const [editing, setEditing] = useState<FeedSource | null | 'new'>(null);
  const [deleting, setDeleting] = useState<FeedSource | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [result, setResult] = useState<SyncRun | null>(null);
  const [showFormat, setShowFormat] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importFor, setImportFor] = useState<FeedSource | null>(null);
  const sources = data?.data ?? [];

  const runNow = async (source: FeedSource) => {
    setOpenMenu(null);
    setBusyId(source.id);
    try { setResult((await api.post<{ data: SyncRun }>(`/admin/feed-sources/${source.id}/run`)).data); reload(); }
    catch (err) { showToast('error', (err as Error).message); }
    finally { setBusyId(null); }
  };

  const pickFile = (source: FeedSource) => { setOpenMenu(null); setImportFor(source); fileRef.current?.click(); };

  const upload = async (file: File | undefined) => {
    const source = importFor;
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !source) return;
    if (file.size > 5 * 1024 * 1024) { showToast('error', 'That file is over 5 MB. Split it into smaller files.'); return; }
    setBusyId(source.id);
    const form = new FormData();
    form.append('file', file);
    try { setResult((await api.upload<{ data: SyncRun }>(`/admin/feed-sources/${source.id}/import`, form)).data); reload(); }
    catch (err) { showToast('error', err instanceof ApiError ? (err.field('file') ?? err.message) : (err as Error).message); }
    finally { setBusyId(null); setImportFor(null); }
  };

  const remove = async () => {
    if (!deleting) return;
    try { await api.delete(`/admin/feed-sources/${deleting.id}`); showToast('success', `${deleting.name} removed`); reload(); }
    catch (err) { showToast('error', (err as Error).message); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Brand Feeds"
        subtitle="Brands and companies send their coupons here: a feed URL we check on a schedule, or CSV files you upload."
        actions={<>
          <Button variant="outline" size="sm" onClick={() => api.download('/admin/feed-sources/template', 'coupon-feed-template.csv').catch((e: Error) => showToast('error', e.message))}>
            <Download size={13} /> CSV template
          </Button>
          {isAdmin && <Button size="sm" onClick={() => setEditing('new')}><Plus size={13} /> Add brand feed</Button>}
        </>}
      />

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                {['Brand / company', 'Type', 'Schedule', 'Coupons', 'Last run', 'Status', ''].map(h => <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              <TableBodyState colSpan={7} loading={loading} error={error} empty={sources.length === 0}
                emptyIcon={<Plug size={22} />} emptyTitle="No brand feeds yet"
                emptyText={isAdmin ? 'Add a brand feed, then run it or upload its CSV.' : 'An admin adds brand feeds here.'} onRetry={reload} />
              {!error && sources.map(s => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-800">{s.name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-64">{s.url ?? (s.default_store ? `Default store: ${s.default_store}` : 'Upload CSV files')}</div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">{TYPE_LABELS[s.type]}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                    {s.type === 'csv_upload' ? 'When uploaded' : FREQUENCY_LABELS[s.frequency]}
                    {!s.is_active && <span className="ml-2"><Badge>Off</Badge></span>}
                    {s.auto_publish && <span className="ml-2"><Badge variant="info">Auto-publish</Badge></span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <button onClick={() => navigate(`/coupons?feed_source_id=${s.id}`)} className="text-blue-600 hover:underline font-medium">{number(s.coupons_count)}</button>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{s.last_run_at ? dateTime(s.last_run_at) : 'Never'}</td>
                  <td className="px-4 py-3.5">{s.last_status ? statusBadge(s.last_status) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3.5 text-right">
                    {canWrite && (
                      <div className="flex items-center justify-end gap-2">
                        {s.type === 'csv_upload'
                          ? <Button size="sm" variant="outline" onClick={() => pickFile(s)} disabled={busyId === s.id}><FileUp size={13} /> {busyId === s.id ? 'Importing…' : 'Import CSV'}</Button>
                          : <Button size="sm" variant="outline" onClick={() => runNow(s)} disabled={busyId === s.id}><Play size={13} /> {busyId === s.id ? 'Running…' : 'Run now'}</Button>}
                        {isAdmin && (
                          <RowMenu open={openMenu === s.id} onToggle={() => setOpenMenu(openMenu === s.id ? null : s.id)}>
                            <RowMenuItem icon={<Edit size={13} />} onClick={() => { setEditing(s); setOpenMenu(null); }}>Edit</RowMenuItem>
                            {s.type !== 'csv_upload' && <RowMenuItem icon={<FileUp size={13} />} onClick={() => pickFile(s)}>Import a CSV file</RowMenuItem>}
                            <div className="border-t border-slate-100 mt-1 pt-1">
                              <RowMenuItem danger icon={<Trash2 size={13} />} onClick={() => { setDeleting(s); setOpenMenu(null); }}>Remove</RowMenuItem>
                            </div>
                          </RowMenu>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Feed format</h2>
            <p className="text-xs text-slate-500 mt-0.5">Send this to the brand. A JSON list (or <code>{'{"coupons": [...]}'}</code>) or a CSV with these column names.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowFormat(v => !v)}>{showFormat ? 'Hide' : 'Show columns'}</Button>
        </div>
        {showFormat && (
          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {FORMAT.map(([col, required, text]) => (
                <tr key={col}>
                  <td className="py-2 pr-4 align-top whitespace-nowrap"><code className="text-xs text-slate-800">{col}</code>{required && <span className="ml-1.5 text-[10px] font-semibold uppercase text-red-500">required</span>}</td>
                  <td className="py-2 text-xs text-slate-600">{text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-4 text-xs text-slate-400">
          Coupons are matched by <code>external_id</code>: sending the same id again updates it. If you edit an imported coupon here,
          later imports leave your version alone. Up to {number(5000)} rows and 5 MB per run.
        </p>
      </Card>

      <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" aria-label="CSV file to import" onChange={e => upload(e.target.files?.[0])} />

      {editing && <SourceForm source={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {result && <RunResult run={result} onClose={() => setResult(null)} />}
      <ConfirmModal open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={remove} title="Remove brand feed?" confirmLabel="Remove"
        message={`${deleting?.name ?? ''} stops importing. Its ${plural(deleting?.coupons_count ?? 0, 'coupon')} stay as they are.`} />
    </div>
  );
}
