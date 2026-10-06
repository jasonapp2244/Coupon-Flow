import { Link, useParams, useSearchParams } from 'react-router';
import { OrderCodes } from '../components/OrderCodes';
import { EmptyState, ErrorState, NotFound, Pager, Spinner } from '../components/States';
import { useApi, usePageMeta } from '../lib/hooks';
import { date, money, pageParam } from '../lib/format';
import { useSite } from '../store/site';
import type { Order, OrderStatus, Paginated } from '../lib/types';

const statusText: Record<OrderStatus, { label: string; tone: string }> = {
  paid: { label: 'Paid', tone: 'bg-deal-soft text-deal-dark' },
  pending: { label: 'Awaiting payment', tone: 'bg-marigold-soft text-ink' },
  failed: { label: 'Payment failed', tone: 'bg-raspberry/10 text-raspberry' },
  expired: { label: 'Not completed', tone: 'bg-line text-ink-soft' },
  refunded: { label: 'Refunded', tone: 'bg-line text-ink-soft' },
};

function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusText[status].tone}`}>{statusText[status].label}</span>;
}

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = pageParam(params.get('page'));
  const { data, loading, error, reload } = useApi<Paginated<Order>>(`/orders?page=${page}`);
  usePageMeta('My orders', { noindex: true });

  const orders = data?.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">My orders</h1>
      <p className="mt-2 text-ink-soft">Every code you've bought, kept here for you.</p>

      <div className="mt-8">
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <Spinner />}
        {data && orders.length === 0 && (
          <EmptyState title="No orders yet">
            When you buy an exclusive code it shows up here. <Link to="/coupons?kind=paid" className="font-semibold text-deal underline">Browse exclusive codes</Link>
          </EmptyState>
        )}
        <ul className="flex flex-col gap-3">
          {orders.map(o => (
            <li key={o.id}>
              <Link to={`/account/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-card p-5 ring-1 ring-line hover:ring-deal">
                <span className="font-display text-lg font-semibold">Order #{o.id}</span>
                <StatusPill status={o.status} />
                <span className="text-sm text-muted">{date(o.created_at)}</span>
                <span className="ml-auto font-semibold">{money(o.total_cents, o.currency)}</span>
                <span className="w-full truncate text-sm text-ink-soft">{o.items?.map(i => i.title).join(', ')}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Pager meta={data?.meta ?? null} onPage={p => setParams(p > 1 ? { page: String(p) } : {})} />
      </div>
    </div>
  );
}

export function OrderPage() {
  const { id } = useParams();
  const { data, loading, error, status, reload } = useApi<{ data: Order }>(`/orders/${id}`);
  const order = data?.data;
  const { support_email } = useSite();
  usePageMeta(order ? `Order #${order.id}` : null, { noindex: true });

  if (status === 404) return <NotFound what="order" />;
  if (!order) return <div className="mx-auto max-w-3xl px-4 py-14">{loading ? <Spinner /> : error && <ErrorState message={error} onRetry={reload} />}</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <Link to="/account/orders" className="text-sm font-semibold text-deal hover:underline">All orders</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Order #{order.id}</h1>
        <StatusPill status={order.status} />
      </div>
      <p className="mt-2 text-ink-soft">
        Placed {date(order.created_at)}. Total {money(order.total_cents, order.currency)}.
        {order.refunded_at && ` Refunded ${date(order.refunded_at)}.`}
      </p>
      {order.status === 'pending' && (
        <p className="mt-4 rounded-lg bg-marigold-soft px-4 py-3 text-sm">We're waiting for the payment to be confirmed. <button onClick={reload} className="font-semibold underline">Check again</button></p>
      )}
      <OrderCodes order={order} />

      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl bg-card p-5 text-sm ring-1 ring-line">
        <dt className="text-muted">Order</dt><dd>#{order.id}</dd>
        <dt className="text-muted">Placed</dt><dd>{date(order.created_at)}</dd>
        {order.paid_at && <><dt className="text-muted">Paid</dt><dd>{date(order.paid_at)} by card</dd></>}
        <dt className="text-muted">Codes sent to</dt><dd className="break-all">{order.email}</dd>
        <dt className="text-muted">Total</dt><dd className="font-semibold">{money(order.total_cents, order.currency)}</dd>
      </dl>
      <p className="mt-4 text-sm text-ink-soft">
        A code didn't work? See the <Link to="/refund-policy" className="underline">refund policy</Link>
        {support_email && <> or email <a href={`mailto:${support_email}`} className="underline">{support_email}</a> with your order number</>}.
      </p>
    </div>
  );
}
