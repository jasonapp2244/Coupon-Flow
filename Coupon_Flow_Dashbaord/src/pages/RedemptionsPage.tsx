import { useState } from 'react';
import { Check, Clock, AlertCircle, ShoppingCart, DollarSign, Percent, ArrowRight, BadgeCheck, TrendingUp, Info } from 'lucide-react';
import { Card, statusBadge, PageHeader, Button, Input } from '../components/ui';
import { Drawer, Modal } from '../components/Modal';
import { FieldError } from '../components/FormParts';
import { Pagination, SearchInput, SortableTh, TableBodyState } from '../components/DataTable';
import { StorePicker } from '../components/StorePicker';
import { api, ApiError } from '../lib/api';
import { useApi, useApiList, useDebounced, useListControls } from '../lib/hooks';
import { dateTime, money, number } from '../lib/format';
import { useApp, useCan } from '../store/AppContext';
import type { Redemption, RedemptionSummary } from '../lib/types';

const statusTabs = ['All', 'Clicked', 'Pending', 'Used', 'Failed', 'Expired'];

type SaleStatus = 'Used' | 'Failed' | 'Pending';
const SALE_STATUSES: { value: SaleStatus; label: string; hint: string }[] = [
  { value: 'Used', label: 'Used (sale made)', hint: 'Adds the profit from this order.' },
  { value: 'Pending', label: 'Pending', hint: 'Waiting on the store; no profit yet.' },
  { value: 'Failed', label: 'Failed', hint: 'No sale (returned, cancelled or code rejected); no profit.' },
];

const rateLabel = (rate: number | null | undefined) => (rate == null ? 'Not set' : `${rate}%`);

/** Confirms (or rejects) the sale behind a click, with the order amount the store reported. */
function ConfirmSaleModal({ r, onClose, onSaved }: { r: Redemption; onClose: () => void; onSaved: (updated: Redemption) => void }) {
  const { showToast } = useApp();
  const [status, setStatus] = useState<SaleStatus>(r.status === 'Failed' || r.status === 'Pending' ? r.status : 'Used');
  const [amount, setAmount] = useState(r.order_value_cents ? (r.order_value_cents / 100).toFixed(2) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const value = Number(amount);
  const amountOk = amount.trim() !== '' && Number.isFinite(value) && value > 0;
  // Preview only: the API works out the stored profit (order × rate) itself.
  const profitCents = amountOk && r.commission_percent != null ? Math.round(value * r.commission_percent) : null;

  const save = async () => {
    if (status === 'Used' && !amountOk) { setError('Enter the order amount, more than $0'); return; }
    setSaving(true);
    try {
      const res = await api.patch<{ data: Redemption }>(`/admin/redemptions/${r.id}`, {
        status,
        ...(status === 'Used' ? { order_value: Math.round(value * 100) / 100 } : {}),
      });
      const saved = res.data;
      showToast('success', status === 'Used'
        ? `Sale confirmed: ${money(saved.order_value_cents)} order, ${money(saved.commission_cents)} profit`
        : `Marked ${status.toLowerCase()}`);
      onSaved(saved);
    } catch (e) {
      const message = e instanceof ApiError ? (e.field('order_value') ?? e.field('status') ?? e.message) : (e as Error).message;
      setError(message);
      showToast('error', message);
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Confirm sale" footer={<>
      <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
      <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </>}>
      <div className="space-y-4">
        <div className="text-xs text-slate-500 space-y-0.5">
          <p><code className="font-mono text-blue-600">{r.reference}</code> · {r.store ?? '—'}</p>
          <p className="truncate">{r.coupon} · clicked {dateTime(r.clicked_at)}</p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700 mb-2">Status</legend>
          <div className="space-y-2">
            {SALE_STATUSES.map(s => (
              <label key={s.value} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer ${status === s.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="sale-status" value={s.value} checked={status === s.value} onChange={() => { setStatus(s.value); setError(''); }} className="mt-0.5 accent-blue-600" />
                <span><span className="block text-sm font-medium text-slate-700">{s.label}</span><span className="block text-xs text-slate-400">{s.hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        {status === 'Used' && (
          <div>
            <Input label="Order amount ($)" type="number" placeholder="e.g. 84.50" value={amount} required
              onChange={v => { setAmount(v); setError(''); }} helperText="The order total the store reported for this sale, in US dollars." />
            <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800">
              Commission {rateLabel(r.commission_percent)}
              {profitCents != null
                ? <> · profit <span className="font-semibold">{money(profitCents)}</span></>
                : r.commission_percent == null ? ' · set a commission % on the store or coupon to earn profit' : ''}
            </div>
          </div>
        )}
        <FieldError message={error} />
      </div>
    </Modal>
  );
}

function RedemptionDrawer({ r, onClose, onConfirm }: { r: Redemption; onClose: () => void; onConfirm?: () => void }) {
  return (
    <Drawer open title="Transaction Detail" onClose={onClose} width="w-80">
      <div className="space-y-2 text-xs">
        {([
          ['Transaction ID', <code className="font-mono text-blue-600">{r.reference}</code>],
          ['User', r.user],
          ['Store', r.store ?? '—'],
          ['Coupon Code', <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{r.coupon}</code>],
          ['Tracking ID', <code className="font-mono text-slate-600">{r.tracking_id ?? '—'}</code>],
          ['Clicked At', dateTime(r.clicked_at)],
          ['Redeemed At', dateTime(r.redeemed_at)],
          ['Order Value', <span className="font-semibold text-slate-800">{money(r.order_value_cents)}</span>],
          ['Commission %', rateLabel(r.commission_percent)],
          ['Profit', <span className="text-emerald-600 font-medium">{money(r.commission_cents)}</span>],
          ['Status', statusBadge(r.status)],
        ] as [string, React.ReactNode][]).map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-2 py-2 border-b border-slate-50">
            <span className="text-slate-400 font-medium flex-shrink-0">{label}</span>
            <span className="text-slate-700 text-right">{value}</span>
          </div>
        ))}
      </div>
      {onConfirm && (
        <div className="mt-4">
          <Button onClick={onConfirm} className="w-full justify-center"><BadgeCheck size={14} /> {r.status === 'Used' ? 'Edit sale' : 'Confirm sale'}</Button>
        </div>
      )}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700 font-medium">Click from the public site</p>
        <p className="text-xs text-blue-600 mt-0.5">Recorded when a shopper reveals a code or opens a deal. Confirm the sale with its order amount to add profit; clicks with no confirmed sale expire after 30 days.</p>
      </div>
    </Drawer>
  );
}

export default function RedemptionsPage() {
  const canWrite = useCan('write');
  const list = useListControls('clicked_at', 'desc');
  const [search, setSearch] = useState('');
  const [storeId, setStoreId] = useState('All');
  const [statusTab, setStatusTab] = useState('All');
  const [selected, setSelected] = useState<Redemption | null>(null);
  const [confirming, setConfirming] = useState<Redemption | null>(null);

  const { data: summary, reload: reloadSummary } = useApi<RedemptionSummary>('/admin/redemptions/summary');

  const q = useDebounced(search);
  const { items, meta, loading, error, reload } = useApiList<Redemption>('/admin/redemptions', {
    ...list.params, q, store_id: storeId, status: statusTab,
  });

  const saleSaved = (updated: Redemption) => {
    setConfirming(null);
    setSelected(s => (s && s.id === updated.id ? updated : s));
    reload();
    reloadSummary();
  };

  const kpis = [
    { label: 'Total Redemptions', value: summary ? number(summary.total) : '—', icon: <ShoppingCart size={18} />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending', value: summary ? number(summary.by_status.Pending) : '—', icon: <Clock size={18} />, color: 'bg-amber-50 text-amber-600' },
    { label: 'Successful', value: summary ? number(summary.by_status.Used) : '—', icon: <Check size={18} />, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Failed', value: summary ? number(summary.by_status.Failed) : '—', icon: <AlertCircle size={18} />, color: 'bg-red-50 text-red-600' },
    { label: 'Conversion', value: summary?.conversion_rate != null ? `${summary.conversion_rate}%` : '—', icon: <TrendingUp size={18} />, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Order Value (successful)', value: summary ? money(summary.order_value_cents) : '—', icon: <DollarSign size={18} />, color: 'bg-violet-50 text-violet-600' },
    { label: 'Profit Earned', value: summary ? money(summary.commission_cents) : '—', icon: <Percent size={18} />, color: 'bg-sky-50 text-sky-600' },
  ];

  const hasFilters = search || storeId !== 'All';
  const clearFilters = () => { setSearch(''); setStoreId('All'); list.setPage(1); };

  return (
    <div className="space-y-5">
      <PageHeader title="Redemptions" subtitle="Code reveals and deal clicks from the public site" />

      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <p>
          Clicks are recorded automatically. Confirm a sale with its order amount to add profit (order amount × the coupon's or store's commission %).
          Clicks with no confirmed sale expire after 30 days.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${k.color}`}>{k.icon}</div>
            <div className="text-xl font-bold text-slate-900 truncate">{k.value}</div>
            <div className="text-xs text-slate-500 mt-1">{k.label}</div>
          </Card>
        ))}
      </div>

      <Card padding={false}>
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {statusTabs.map(tab => (
            <button key={tab} onClick={() => { setStatusTab(tab); list.setPage(1); }}
              className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${statusTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab}
              {summary && tab !== 'All' && <span className="ml-1.5 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{summary.by_status[tab as Redemption['status']]}</span>}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={v => { setSearch(v); list.setPage(1); }} placeholder="Search user, code or transaction…" />
          <StorePicker compact allLabel="All stores" value={storeId === 'All' ? '' : storeId} onChange={id => { setStoreId(id || 'All'); list.setPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-sm transition-opacity ${loading && items.length ? 'opacity-60' : ''}`}>
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                <th className="px-4 py-3 text-left">Transaction</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Coupon</th>
                <th className="px-4 py-3 text-left">Store</th>
                <SortableTh label="Order Value" field="order_value_cents" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Rate</th>
                <SortableTh label="Profit" field="commission_cents" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <SortableTh label="Clicked" field="clicked_at" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              <TableBodyState
                colSpan={10} loading={loading} error={error} empty={items.length === 0}
                emptyIcon={<ShoppingCart size={22} />} emptyTitle="No redemptions found" onRetry={reload}
                onClear={hasFilters ? clearFilters : undefined}
              />
              {!error && items.map(r => (
                <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3.5"><code className="text-xs font-mono text-blue-600">{r.reference}</code></td>
                  <td className="px-4 py-3.5 font-medium text-slate-800 whitespace-nowrap">{r.user}</td>
                  <td className="px-4 py-3.5"><code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">{r.coupon}</code></td>
                  <td className="px-4 py-3.5 text-slate-600 text-xs">{r.store ?? '—'}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800">{money(r.order_value_cents)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{r.commission_percent != null ? `${r.commission_percent}%` : '—'}</td>
                  <td className="px-4 py-3.5 text-emerald-600 font-medium">{money(r.commission_cents)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{dateTime(r.clicked_at)}</td>
                  <td className="px-4 py-3.5">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {canWrite && (
                        <button type="button" onClick={e => { e.stopPropagation(); setConfirming(r); }}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700">
                          <BadgeCheck size={12} /> {r.status === 'Used' ? 'Edit sale' : 'Confirm sale'}
                        </button>
                      )}
                      <ArrowRight size={13} className="text-slate-300" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination meta={meta} onPage={list.setPage} onPageSize={list.setPerPage} />
      </Card>

      {selected && <RedemptionDrawer r={selected} onClose={() => setSelected(null)} onConfirm={canWrite ? () => setConfirming(selected) : undefined} />}
      {confirming && <ConfirmSaleModal key={confirming.id} r={confirming} onClose={() => setConfirming(null)} onSaved={saleSaved} />}
    </div>
  );
}
