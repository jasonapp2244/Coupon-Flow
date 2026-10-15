import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { peekPreload } from '../lib/preload';
import type { SiteSettings } from '../lib/types';

/** Used until the API answers (and if it can't): the site still renders with sensible text. */
const FALLBACK: SiteSettings = {
  site_name: 'Coupon Follow',
  support_email: '',
  meta_title: '',
  meta_description: 'Free promo codes and deals for Amazon, Walmart, Nike, Sephora and more. Reveal a code, shop in a new tab and save at checkout. No sign-up needed.',
  meta_keywords: '',
  timezone: 'America/New_York',
  homepage: {
    headline: 'Save more at the stores you love.',
    subtext: 'Free promo codes and deals from popular brands. Find your store, copy the code, and save at checkout.',
    search_placeholder: 'Search a store or brand',
    hero_image_url: null,
    slides: [],
  },
};

const SiteContext = createContext<SiteSettings>(FALLBACK);

const withFallback = (data: SiteSettings): SiteSettings => ({ ...FALLBACK, ...data, meta_description: data.meta_description || FALLBACK.meta_description });

/** Loads the admin-editable site name, support email, SEO defaults, timezone and home hero once per visit. */
export function SiteProvider({ children }: { children: ReactNode }) {
  // A pre-rendered page carries the settings it was built with, so its first render uses the same name.
  const [settings, setSettings] = useState<SiteSettings>(() => {
    const preloaded = peekPreload<{ data: SiteSettings }>('/public/settings');
    return preloaded ? withFallback(preloaded.data) : FALLBACK;
  });

  useEffect(() => {
    api.get<{ data: SiteSettings }>('/public/settings')
      .then(res => setSettings(withFallback(res.data)))
      // API down: keep the fallback text.
      .catch(() => {});
  }, []);

  return <SiteContext.Provider value={settings}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteSettings {
  return useContext(SiteContext);
}
