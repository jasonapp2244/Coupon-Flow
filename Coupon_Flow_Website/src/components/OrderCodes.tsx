import { money } from '../lib/format';
import { CodeBox } from './CouponTicket';
import type { Order } from '../lib/types';

/** The purchased codes, each in a dashed "cut here" box with a copy button. */
export function OrderCodes({ order }: { order: Order }) {
  return (
    <ul className="mt-8 flex flex-col gap-4">
      {order.items?.map(item => (
        <li key={item.coupon_id} className="rounded-xl bg-card p-5 ring-1 ring-line">
          <div className="flex items-start justify-between gap-4">
            <p className="font-display text-lg font-semibold leading-snug">{item.title}</p>
            <span className="shrink-0 text-sm text-muted">{money(item.unit_price_cents * item.quantity, order.currency)}</span>
          </div>
          {item.code
            ? <div className="mt-4"><CodeBox code={item.code} size="lg" /></div>
            : <p className="mt-3 text-sm text-muted">{order.status === 'refunded'
              ? 'Refunded. This code is no longer available.'
              : item.code_pending
                ? "Your payment went through. Your code is on its way: we'll email it to you and it will appear here."
                : 'The code appears once payment is confirmed.'}</p>}
        </li>
      ))}
    </ul>
  );
}
