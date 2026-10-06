import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Coupon } from '../lib/types';

/** What the cart remembers for display. Prices are re-checked by the server at checkout. */
export interface CartItem {
  id: number;
  title: string;
  store: string;
  storeSlug: string;
  price_cents: number;
  currency: string;
}

interface CartValue {
  items: CartItem[];
  count: number;
  totalCents: number;
  has: (couponId: number) => boolean;
  add: (coupon: Coupon) => void;
  /** Updates a cart line with the coupon's current title and price. */
  refresh: (coupon: Coupon) => void;
  remove: (couponId: number) => void;
  removeMany: (couponIds: number[]) => void;
  clear: () => void;
}

const CART_KEY = 'cf_cart';
const CartContext = createContext<CartValue | null>(null);

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* cart lives in memory only */ }
  }, [items]);

  // Keep several open tabs in step.
  useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key === CART_KEY) setItems(load()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const has = useCallback((id: number) => items.some(i => i.id === id), [items]);

  const add = useCallback((coupon: Coupon) => {
    setItems(list => list.some(i => i.id === coupon.id) ? list : [...list, {
      id: coupon.id,
      title: coupon.title,
      store: coupon.store?.name ?? '',
      storeSlug: coupon.store?.slug ?? '',
      price_cents: coupon.price_cents,
      currency: coupon.currency,
    }]);
  }, []);

  const refresh = useCallback((coupon: Coupon) => {
    setItems(list => list.map(i => i.id === coupon.id && (i.price_cents !== coupon.price_cents || i.title !== coupon.title)
      ? { ...i, title: coupon.title, price_cents: coupon.price_cents, currency: coupon.currency }
      : i));
  }, []);

  const remove = useCallback((id: number) => setItems(list => list.filter(i => i.id !== id)), []);
  const removeMany = useCallback((ids: number[]) => setItems(list => list.filter(i => !ids.includes(i.id))), []);
  const clear = useCallback(() => setItems([]), []);

  return (
    <CartContext.Provider value={{
      items, count: items.length, totalCents: items.reduce((t, i) => t + i.price_cents, 0),
      has, add, refresh, remove, removeMany, clear,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}
