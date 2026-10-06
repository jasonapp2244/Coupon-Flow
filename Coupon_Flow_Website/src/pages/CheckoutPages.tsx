import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { OrderCodes } from '../components/OrderCodes';
import { Spinner } from '../components/States';
import { api, ApiError } from '../lib/api';
import { usePageMeta } from '../lib/hooks';
import { useCart } from '../store/cart';
import { usePurchases } from '../store/purchases';
import type { Order } from '../lib/types';

const POLL_MS = 2000;
const POLL_LIMIT = 30; // ~1 minute; after that the order page keeps checking on reload.

/**
 * Stripe sends people back here straight after paying. The order is only marked paid when
 * Stripe's webhook reaches our server, which can take a few seconds — so we poll until it does.
 */
export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const cart = useCart();
  const purchases = usePurchases();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [gaveUp, setGaveUp] = useState(false);
  const cleared = useRef(false);

  usePageMeta('Payment received', { noindex: true });

  useEffect(() => {
    if (!sessionId) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      try {
        const res = await api.get<{ data: Order }>(`/orders/session/${encodeURIComponent(sessionId)}`);
        if (stopped) return;
        setOrder(res.data);
        if (res.data.status !== 'pending') return;
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && err.status === 404) { setError("We couldn't find this order on your account."); return; }
      }
      if (++attempts >= POLL_LIMIT) { setGaveUp(true); return; }
      timer = setTimeout(poll, POLL_MS);
    };

    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [sessionId]);

  // Once paid, the bought coupons leave the cart (anything else the shopper added stays)
  // and show as bought across the site.
  useEffect(() => {
    if (order?.status === 'paid' && !cleared.current) {
      cleared.current = true;
      cart.removeMany(order.items?.map(i => i.coupon_id) ?? []);
      purchases.refresh();
    }
  }, [order, cart, purchases]);

  if (!sessionId) return <Navigate to="/cart" replace />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      {order?.status === 'paid' ? (
        <>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Your codes are ready</h1>
          <p className="mt-2 text-ink-soft">We've also emailed them to {order.email}. You'll find them in My orders any time.</p>
          <OrderCodes order={order} />
          <Link to={`/account/orders/${order.id}`} className="btn-secondary mt-6">View order #{order.id}</Link>
        </>
      ) : error ? (
        <>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Order not found</h1>
          <p className="mt-2 text-ink-soft">{error} If you were charged, <Link to="/contact" className="underline">contact us</Link> with your Stripe receipt.</p>
        </>
      ) : order && order.status !== 'pending' ? (
        <>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Payment didn't go through</h1>
          <p className="mt-2 text-ink-soft">Order #{order.id} is {order.status}. You haven't been charged, so you can try again from your cart.</p>
          <Link to="/cart" className="btn-primary mt-6">Back to cart</Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Confirming your payment</h1>
          <p className="mt-2 text-ink-soft">
            {gaveUp
              ? "This is taking longer than usual. Your codes will appear in My orders as soon as the payment is confirmed, and we'll email them too."
              : 'This usually takes a few seconds. Please keep this page open.'}
          </p>
          {gaveUp ? <Link to="/account/orders" className="btn-primary mt-6">Go to My orders</Link> : <Spinner label="Confirming payment" />}
        </>
      )}
    </div>
  );
}

/** Stripe's "back" link: release the reserved stock and send the shopper back to their cart. */
export function CheckoutCancelPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const [done, setDone] = useState(false);

  usePageMeta('Checkout cancelled', { noindex: true });

  useEffect(() => {
    if (!orderId || !/^\d+$/.test(orderId)) { setDone(true); return; }
    api.post(`/orders/${orderId}/cancel`).catch(() => undefined).finally(() => setDone(true));
  }, [orderId]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Checkout cancelled</h1>
      <p className="mt-2 text-ink-soft">You haven't been charged. Your cart is just as you left it.</p>
      {done ? <Link to="/cart" className="btn-primary mt-6">Back to cart</Link> : <Spinner />}
    </div>
  );
}
