import { useState } from 'react';
import { Check, Clock, AlertCircle, ShoppingCart, DollarSign, Percent, ArrowRight } from 'lucide-react';
import { Card, statusBadge, PageHeader } from '../components/ui';
import { Drawer } from '../components/Modal';
import { Pagination, SearchInput, SortableTh, TableBodyState } from '../components/DataTable';
import { StorePicker } from '../components/StorePicker';
import { useApi, useApiList, useDebounced, useListControls } from '../lib/hooks';
import { dateTime, money, number } from '../lib/format';
import type { Redemption } from '../lib/types';

interface Summary {
  total: number;
  by_status: Record<Redemption['status'], number>;
  order_value_cents: number;
  commission_cents: number;
}

const statusTabs = ['All', 'Clicked', 'Pending', 'Used', 'Failed', 'Expired'];

function RedemptionDrawer({ r, onClose }: { r: Redemption; onClose: () => void }) {
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
          ['Commission', <span className="text-emerald-600 font-medium">{money(r.commission_cents)}</span>],
          ['Status', statusBadge(r.status)],
        ] as [string, React.ReactNode][]).map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-2 py-2 border-b border-slate-50">
            <span className="text-slate-400 font-medium flex-shrink-0">{label}</span>
            <span className="text-slate-700 text-right">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700 font-medium">Click from the public site</p>
        <p className="text-xs text-blue-600 mt-0.5">Recorded when a shopper reveals a code or opens a deal. Order value and commission arrive once a vendor feed is connected. Paid coupon sales are listed under Orders.</p>
      </div>
    </Drawer>
  );
}

export default function RedemptionsPage() {
  const list = useListControls('clicked_at', 'desc');
  const [search, setSearch] = useState('');
  const [storeId, setStoreId] = useState('All');
  const [statusTab, setStatusTab] = useState('All');
  const [selected, setSelected] = useState<Redemption | null>(null);

  const { data: summary } = useApi<Summary>('/admin/redemptions/summary');

  const q = useDebounced(search);
  const { items, meta, loading, error, reload } = useApiList<Redemption>('/admin/redemptions', {
    ...list.params, q, store_id: storeId, status: statusTab,
  });

  const kpis = [
    { label: 'Total Redemptions', value: summary ? number(summary.total) : '—', icon: <ShoppingCart size={18} />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending', value: summary ? number(summary.by_status.Pending) : '—', icon: <Clock size={18} />, color: 'bg-amber-50 text-amber-600' },
    { label: 'Successful', value: summary ? number(summary.by_status.Used) : '—', icon: <Check size={18} />, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Failed', value: summary ? number(summary.by_status.Failed) : '—', icon: <AlertCircle size={18} />, color: 'bg-red-50 text-red-600' },
    { label: 'Order Value (successful)', value: summary ? money(summary.order_value_cents) : '—', icon: <DollarSign size={18} />, color: 'bg-violet-50 text-violet-600' },
    { label: 'Commission Earned', value: summary ? money(summary.commission_cents) : '—', icon: <Percent size={18} />, color: 'bg-sky-50 text-sky-600' },
  ];

  const hasFilters = search || storeId !== 'All';
  const clearFilters = () => { setSearch(''); setStoreId('All'); list.setPage(1); };

  return (
    <div className="space-y-5">
      <PageHeader title="Redemptions" subtitle="Code reveals and deal clicks from the public site" />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${k.color}`}>{k.icon}</div>
            <div className="text-xl font-bold text-slate-900">{k.value}</div>
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
                <SortableTh label="Commission" field="commission_cents" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <SortableTh label="Clicked" field="clicked_at" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              <TableBodyState
                colSpan={9} loading={loading} error={error} empty={items.length === 0}
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
                  <td className="px-4 py-3.5 text-emerald-600 font-medium">{money(r.commission_cents)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{dateTime(r.clicked_at)}</td>
                  <td className="px-4 py-3.5">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3.5 text-slate-300"><ArrowRight size={13} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination meta={meta} onPage={list.setPage} onPageSize={list.setPerPage} />
      </Card>

      {selected && <RedemptionDrawer r={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
