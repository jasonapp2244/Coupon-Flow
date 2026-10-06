import { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { api } from './api';
import { HeadContext, siteOrigin, type HeadTags } from './head';
import { peekPreload } from './preload';
import { useSite } from '../store/site';

/**
 * GET a JSON resource; pass null to skip. Stale responses from superseded requests are ignored.
 * On a pre-rendered page the first render starts from the baked-in response, then refetches.
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null; status: number | null }>(() => {
    const preloaded = path === null ? undefined : peekPreload<T>(path);
    return preloaded === undefined
      ? { data: null, loading: path !== null, error: null, status: null }
      : { data: preloaded, loading: false, error: null, status: 200 };
  });

  useEffect(() => {
    if (path === null) { setState({ data: null, loading: false, error: null, status: null }); return; }
    let stale = false;
    setState(s => ({ ...s, loading: true, error: null, status: null }));

    api.get<T>(path)
      .then(data => { if (!stale) setState({ data, loading: false, error: null, status: 200 }); })
      .catch((e: Error & { status?: number }) => {
        if (!stale) setState({ data: null, loading: false, error: e.message, status: e.status ?? null });
      });

    return () => { stale = true; };
  }, [path, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  return { ...state, reload };
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export interface PageMetaOptions {
  description?: string | null;
  /** Keep private or thin pages (cart, account, sign-in) out of search results. */
  noindex?: boolean;
  /** Absolute image URL for link previews; defaults to the site's share image. */
  image?: string | null;
  type?: 'website' | 'article';
  /** Structured data (schema.org) for rich results. */
  jsonLd?: object | object[] | null;
  /** The page's main address when it is also served under an alias (e.g. /promotions/at/{slug}). */
  canonicalPath?: string;
}

/** The page's head tags; pure, so the browser and the pre-renderer produce the same ones. */
function buildHead(title: string, opts: PageMetaOptions, site: ReturnType<typeof useSite>, pathname: string): HeadTags {
  const origin = siteOrigin();
  return {
    title: title ? `${title} | ${site.site_name}` : (site.meta_title || `${site.site_name}: coupon codes and deals from stores you shop`),
    description: opts.description || site.meta_description,
    canonical: origin + (opts.canonicalPath ?? pathname),
    robots: opts.noindex ? 'noindex, follow' : null,
    siteName: site.site_name,
    ogType: opts.type ?? 'website',
    image: opts.image || `${origin}/og-image.png`,
    jsonLd: opts.jsonLd ? JSON.stringify(opts.jsonLd) : null,
  };
}

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) { tag?.remove(); return; }
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

/**
 * Title, description, canonical URL, robots, Open Graph / Twitter tags and JSON-LD for the page.
 * Pass title null while the page's data is still loading.
 */
export function usePageMeta(title: string | null, options: PageMetaOptions | string | null = null) {
  const site = useSite();
  const { pathname } = useLocation();
  const collector = useContext(HeadContext);
  const opts: PageMetaOptions = typeof options === 'string' ? { description: options } : options ?? {};
  const tags = title === null ? null : buildHead(title, opts, site, pathname);

  // Pre-rendering: effects don't run on the server, so hand the tags to the build during render.
  if (collector && tags) collector.tags = tags;

  const key = JSON.stringify(tags);
  useEffect(() => {
    if (!tags) return;
    document.title = tags.title;
    setMeta('name', 'description', tags.description);
    setMeta('name', 'robots', tags.robots);
    setLink('canonical', tags.canonical);
    setMeta('property', 'og:site_name', tags.siteName);
    setMeta('property', 'og:title', tags.title);
    setMeta('property', 'og:description', tags.description);
    setMeta('property', 'og:url', tags.canonical);
    setMeta('property', 'og:type', tags.ogType);
    setMeta('property', 'og:image', tags.image);
    setMeta('name', 'twitter:card', 'summary_large_image');

    const script = document.getElementById('page-jsonld');
    if (tags.jsonLd) {
      const tag = script ?? Object.assign(document.createElement('script'), { id: 'page-jsonld', type: 'application/ld+json' });
      tag.textContent = tags.jsonLd;
      if (!script) document.head.appendChild(tag);
    } else {
      script?.remove();
    }
    // `key` captures every tag value; `tags` itself is a new object each render.
  }, [key]);
}
