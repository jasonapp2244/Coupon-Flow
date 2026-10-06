import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Receipt, RotateCcw } from 'lucide-react';
import { Card, Button, Badge, PageHeader } from '../components/ui';
import { ConfirmModal, Drawer } from '../components/Modal';
import { Pagination, SearchInput, SortableTh, TableBodyState } from '../components/DataTable';
import { api } from '../lib/api';
import { useAction, useApiList, useDebounced, useListControls } from '../lib/hooks';
import { dateTime, money, plural } from '../lib/format';
import { useCan } from '../store/AppContext';
import type { Order, OrderStatus } from '../lib/types';

const statusStyle: Record<OrderStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  paid: 'success', pending: 'warning', failed: 'danger', expired: 'neutral', refunded: 'info',
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={statusStyle[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

const statusTabs: ('all' | OrderStatus)[] = ['all', 'paid', 'pending', 'refunded', 'failed', 'expired'];

function OrderDrawer({ order, onClose, onRefund }: { order: Order; onClose: () => void; onRefund?: () => void }) {
  return (
    <Drawer open title={`Order #${order.id}`} onClose={onClose} width="w-96">
      <div className="space-y-2 text-xs">
        {([
          ['Status', <OrderStatusBadge status={order.status} />],
          ['Customer', order.customer ?? '—'],
          ['Email', order.email],
          ['Total', <span className="font-semibold text-slate-800">{money(order.total_cents, order.currency)}</span>],
          ['Created', dateTime(order.created_at)],
          ['Paid', dateTime(order.paid_at)],
          ['Refunded', dateTime(order.refunded_at)],
        ] as [string, React.ReactNode][]).map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-2 py-2 border-b border-slate-50">
            <span className="text-slate-400 font-medium">{label}</span>
            <span className="text-slate-700 text-right">{value}</span>
          </div>
        ))}
      </div>

      <p className="text-xs font-semibold text-slate-700 mt-5 mb-2">Items</p>
      <div className="space-y-2">
        {order.items?.map(item => (
          <div key={item.coupon_id} className="p-3 bg-slate-50 rounded-lg">
            <div className="flex justify-between gap-2">
              <p className="text-xs font-medium text-slate-700">{item.title}</p>
              <p className="text-xs font-semibold text-slate-800 whitespace-nowrap">{money(item.unit_price_cents * item.quantity, order.currency)}</p>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Code: {item.code
                ? <code className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded">{item.code}</code>
                : item.code_pending
                  ? <Link to={`/coupons/${item.coupon_id}/edit`} className="font-medium text-amber-700 hover:underline">waiting: the coupon's code pool ran out. Add codes to deliver it</Link>
                  : <span className="text-slate-400">released once paid</span>}
            </p>
          </div>
        ))}
      </div>

      {order.status === 'paid' && onRefund && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <Button variant="danger" className="w-full justify-center" onClick={onRefund}><RotateCcw size={13} /> Refund Order</Button>
          <p className="text-xs text-slate-400 mt-2">Refunds are issued through Stripe. Card refunds usually show as refunded straight away.</p>
        </div>
      )}
    </Drawer>
  );
}

export default function OrdersPage() {
  const isAdmin = useCan('admin');
  const list = useListControls('created_at', 'desc');
  const { run, busy } = useAction();
  // ?q= lets other pages (a sold code in a coupon's pool) open the list on one order.
  const [params] = useSearchParams();
  const [search, setSearch] = useState(() => params.get('q') ?? '');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);

  const q = useDebounced(search);
  const { items, meta, loading, error, reload } = useApiList<Order>('/admin/orders', {
    ...list.params, q, status: status === 'all' ? undefined : status,
  });

  const handleRefund = async () => {
    if (!refundOrder) return;
    const order = refundOrder;
    setRefundOrder(null);
    const ok = await run(() => api.post(`/admin/orders/${order.id}/refund`), `Refund requested for order #${order.id}`);
    if (ok) { setViewOrder(null); reload(); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Orders" subtitle={meta ? `${plural(meta.total, 'order')}: paid coupon purchases made by card` : 'Loading…'} />

      <Card padding={false}>
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {statusTabs.map(tab => (
            <button key={tab} onClick={() => { setStatus(tab); list.setPage(1); }}
              className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 capitalize transition-colors ${status === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <SearchInput value={search} onChange={v => { setSearch(v); list.setPage(1); }} placeholder="Search by email or order number…" />
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-sm transition-opacity ${loading && items.length ? 'opacity-60' : ''}`}>
            <thead>
              <tr className="text-xs text-slate-400 font-medium border-b border-slate-100 bg-slate-50/60">
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Items</th>
                <SortableTh label="Total" field="total_cents" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <th className="px-4 py-3 text-left">Status</th>
                <SortableTh label="Created" field="created_at" sort={list.sort} dir={list.dir} onSort={list.onSort} />
                <SortableTh label="Paid" field="paid_at" sort={list.sort} dir={list.dir} onSort={list.onSort} />
              </tr>
            </thead>
            <tbody>
              <TableBodyState
                colSpan={7} loading={loading} error={error} empty={items.length === 0}
                emptyIcon={<Receipt size={22} />} emptyTitle="No orders yet" emptyText="Orders appear here once customers buy paid coupons." onRetry={reload}
                onClear={search || status !== 'all' ? () => { setSearch(''); setStatus('all'); } : undefined}
              />
              {!error && items.map(order => (
                <tr key={order.id} onClick={() => setViewOrder(order)} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3.5"><code className="text-xs font-mono text-blue-600">#{order.id}</code></td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-slate-800">{order.customer ?? '—'}</p>
                    <p className="text-xs text-slate-400">{order.email}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600 max-w-64 truncate">{order.items?.map(i => i.title).join(', ')}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800">{money(order.total_cents, order.currency)}</td>
                  <td className="px-4 py-3.5"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{dateTime(order.created_at)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{dateTime(order.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination meta={meta} onPage={list.setPage} onPageSize={list.setPerPage} />
      </Card>

      {viewOrder && <OrderDrawer order={viewOrder} onClose={() => setViewOrder(null)} onRefund={isAdmin ? () => setRefundOrder(viewOrder) : undefined} />}

      <ConfirmModal
        open={!!refundOrder}
        onClose={() => setRefundOrder(null)}
        onConfirm={handleRefund}
        loading={busy}
        title={`Refund order #${refundOrder?.id}?`}
        message={`${refundOrder ? money(refundOrder.total_cents, refundOrder.currency) : ''} will be returned to the customer's card and their coupon codes hidden. This cannot be undone.`}
        confirmLabel="Refund"
      />
    </div>
  );
}
