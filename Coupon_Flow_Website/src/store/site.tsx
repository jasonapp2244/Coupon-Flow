import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { peekPreload } from '../lib/preload';
import type { SiteSettings } from '../lib/types';

/** Used until the API answers (and if it can't): the site still renders with sensible text. */
const FALLBACK: SiteSettings = {
  site_name: 'Coupon Follow',
  support_email: '',
  currency: 'usd',
  meta_title: '',
  meta_description: 'Find working coupon codes and deals for the stores you already shop, updated every day.',
  meta_keywords: '',
  shop_enabled: false,
  timezone: 'America/New_York',
};

/** `ready`: the real settings arrived (from the pre-render or the API), so shop-only pages can decide. */
type SiteState = SiteSettings & { ready: boolean };

const SiteContext = createContext<SiteState>({ ...FALLBACK, ready: false });

const withFallback = (data: SiteSettings): SiteSettings => ({ ...FALLBACK, ...data, meta_description: data.meta_description || FALLBACK.meta_description });

/** Loads the admin-editable site name, support email, SEO defaults and shop switch once per visit. */
export function SiteProvider({ children }: { children: ReactNode }) {
  // A pre-rendered page carries the settings it was built with, so its first render uses the same name.
  const [settings, setSettings] = useState<SiteState>(() => {
    const preloaded = peekPreload<{ data: SiteSettings }>('/public/settings');
    return preloaded ? { ...withFallback(preloaded.data), ready: true } : { ...FALLBACK, ready: false };
  });

  useEffect(() => {
    api.get<{ data: SiteSettings }>('/public/settings')
      .then(res => setSettings({ ...withFallback(res.data), ready: true }))
      // API down: keep the fallback (shop off), but let shop-only pages stop waiting.
      .catch(() => setSettings(s => ({ ...s, ready: true })));
  }, []);

  return <SiteContext.Provider value={settings}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteState {
  return useContext(SiteContext);
}
