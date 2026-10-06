// Server entry used only at build time by scripts/prerender.mjs (vite build --ssr). Never shipped to browsers.
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppShell } from './App';
import { HeadContext, headHtml, type HeadTags } from './lib/head';
import { recordMisses, seedPreload } from './lib/preload';

/**
 * Renders one URL with the given API responses already available. Returns the page markup, its
 * <head> tags, and `missing`: API paths the page requested that `preload` didn't have. The caller
 * fetches those and renders again until nothing is missing.
 */
export function render(url: string, preload: Record<string, unknown>): { html: string; head: string; missing: string[] } {
  seedPreload(preload);
  const collector: { tags: HeadTags | null } = { tags: null };
  const stop = recordMisses();

  const html = renderToString(
    <HeadContext.Provider value={collector}>
      <StaticRouter location={url}>
        <AppShell />
      </StaticRouter>
    </HeadContext.Provider>,
  );

  return { html, head: collector.tags ? headHtml(collector.tags) : '', missing: stop() };
}
