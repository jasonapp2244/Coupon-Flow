import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuth } from './auth';

interface PurchasesValue {
  /** The paid order holding this coupon's code, or undefined if the shopper hasn't bought it. */
  orderFor: (couponId: number) => number | undefined;
  /** Re-reads the list (after a payment goes through, for example). */
  refresh: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesValue | null>(null);

/**
 * Coupons the signed-in shopper already paid for, so the site shows "Bought" instead of
 * "Add to cart". Display only: checkout refuses repeat purchases on the server either way.
 */
export function PurchasesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Map<number, number>>(() => new Map());
  const customerId = user?.role === 'customer' ? user.id : null;

  const load = useCallback(async (): Promise<Map<number, number> | null> => {
    try {
      const res = await api.get<{ data: { coupon_id: number; order_id: number }[] }>('/purchases');
      return new Map(res.data.map(p => [p.coupon_id, p.order_id]));
    } catch {
      return null; // keep what we had; checkout still refuses repeat purchases
    }
  }, []);

  useEffect(() => {
    setOrders(new Map());
    if (customerId === null) return;
    let stale = false;
    load().then(map => { if (map && !stale) setOrders(map); });
    return () => { stale = true; };
  }, [customerId, load]);

  const refresh = useCallback(async () => {
    if (customerId === null) return;
    const map = await load();
    if (map) setOrders(map);
  }, [customerId, load]);

  const orderFor = useCallback((couponId: number) => orders.get(couponId), [orders]);

  return (
    <PurchasesContext.Provider value={{ orderFor, refresh }}>
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases must be inside PurchasesProvider');
  return ctx;
}
