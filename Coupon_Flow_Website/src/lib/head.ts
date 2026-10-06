import { createContext } from 'react';

/** Everything a page puts in <head>: applied to the document in the browser, written into HTML when pre-rendering. */
export interface HeadTags {
  title: string;
  description: string;
  canonical: string;
  robots: string | null;
  siteName: string;
  ogType: 'website' | 'article';
  image: string;
  jsonLd: string | null;
}

/** Filled while pre-rendering so the build can write the page's tags; null in the browser. */
export const HeadContext = createContext<{ tags: HeadTags | null } | null>(null);

/**
 * The public site's own address. In the browser that is wherever it is served from; while
 * pre-rendering it is the configured VITE_SITE_URL, so canonical links point at the real domain.
 */
export function siteOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : String(import.meta.env.VITE_SITE_URL ?? '').replace(/\/$/, '');
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The tags as HTML, for the pre-renderer. JSON-LD is escaped so it can't close its <script>. */
export function headHtml(t: HeadTags): string {
  const meta = (attr: 'name' | 'property', key: string, content: string) => `<meta ${attr}="${key}" content="${escapeAttr(content)}" />`;
  return [
    `<title>${escapeAttr(t.title)}</title>`,
    meta('name', 'description', t.description),
    t.robots ? meta('name', 'robots', t.robots) : '',
    `<link rel="canonical" href="${escapeAttr(t.canonical)}" />`,
    meta('property', 'og:site_name', t.siteName),
    meta('property', 'og:title', t.title),
    meta('property', 'og:description', t.description),
    meta('property', 'og:url', t.canonical),
    meta('property', 'og:type', t.ogType),
    meta('property', 'og:image', t.image),
    meta('name', 'twitter:card', 'summary_large_image'),
    t.jsonLd ? `<script id="page-jsonld" type="application/ld+json">${t.jsonLd.replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ');
}
