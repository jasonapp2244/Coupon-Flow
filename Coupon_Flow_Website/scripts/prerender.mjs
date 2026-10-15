// Pre-renders every public page search engines should index (home; the stores, coupons, blog and
// categories lists; the static pages; every store, category and article) after `vite build` +
// `vite build --ssr` (see package.json "build"). Cart, sign-in and account pages are left out: they
// are per-visitor and marked noindex.
//
// Each page becomes dist/_prerender{path}.html (the home page: dist/_prerender/index.html): the built
// index.html with the page's markup inside #root, its own title/description/canonical/Open Graph/
// JSON-LD in <head>, and the API responses it was rendered from (the app starts from those, then
// refreshes). public/.htaccess serves these files for their clean URLs; anything else stays the SPA shell.
//
// Which API data a page needs is discovered by rendering it: the render reports the requests it
// couldn't answer, they are fetched, and it renders again until nothing is missing.
//
// The pages are a snapshot of the catalogue at build time: rebuild after catalogue changes.
// If the API can't be reached the build still succeeds and every page renders in the browser only.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getJson } from './env.mjs'

const OUT = 'dist/_prerender'
const CONCURRENCY = 5
const MAX_PASSES = 4
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/i

// Pages at fixed URLs, then pages for every slug in a GET /public/sitemap list.
const FIXED = [
  { url: '/', label: 'home' },
  { url: '/stores', label: 'stores list' },
  { url: '/coupons', label: 'coupons list' },
  { url: '/blog', label: 'blog list' },
  { url: '/categories', label: 'categories list' },
  ...['/about', '/contact', '/terms', '/privacy', '/affiliate-disclosure'].map(url => ({ url, label: 'static' })),
]
const BY_SLUG = [
  { prefix: '/stores/', list: 'stores', label: 'store' },
  { prefix: '/categories/', list: 'categories', label: 'category' },
  { prefix: '/blog/', list: 'blogs', label: 'article' },
]

const { render } = await import(pathToFileURL('dist-ssr/entry-server.js').href)
const template = readFileSync('dist/index.html', 'utf8')

// Tags the page supplies itself; the template's generic ones are removed so nothing is duplicated.
const GENERIC_HEAD = [
  /\s*<title>[\s\S]*?<\/title>/,
  /\s*<meta name="description"[^>]*>/,
  /\s*<meta property="og:type"[^>]*>/,
  /\s*<meta property="og:image"[^>]*>/,
  /\s*<meta name="twitter:card"[^>]*>/,
]
if (!template.includes('<div id="root"></div>') || !GENERIC_HEAD[0].test(template)) {
  throw new Error('prerender: dist/index.html no longer has <title> and an empty #root; update scripts/prerender.mjs')
}
const shell = GENERIC_HEAD.reduce((html, re) => html.replace(re, ''), template)

// JSON inside <script> must not contain "</script>" or "<!--".
const embed = data => JSON.stringify(data).replace(/</g, '\\u003c')

function page(head, html, preload) {
  return shell
    .replace('</head>', `  ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${html}</div>\n    <script id="preload" type="application/json">${embed(preload)}</script>`)
}

// One request per API path per build (every page's header asks for the same category list).
const responses = new Map()
const fetchOnce = path => {
  if (!responses.has(path)) responses.set(path, getJson(path))
  return responses.get(path)
}

async function renderPage(url) {
  const preload = {}
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const { html, head, missing } = render(url, preload)
    if (missing.length === 0) {
      if (!head) throw new Error('the page rendered without its title (still loading?)')
      return page(head, html, preload)
    }
    for (const path of missing) preload[path] = await fetchOnce(path)
  }
  throw new Error(`still requesting new data after ${MAX_PASSES} renders`)
}

let sitemap
try {
  sitemap = await fetchOnce('/public/sitemap')
} catch (e) {
  console.warn(`prerender: API not reachable (${e.message}); pages will render in the browser only.`)
  rmSync('dist-ssr', { recursive: true, force: true })
  process.exit(0)
}

const queue = FIXED.map(p => ({ ...p }))
const failed = []
for (const route of BY_SLUG) {
  for (const { slug } of sitemap[route.list] ?? []) {
    if (SAFE_SLUG.test(slug)) queue.push({ url: route.prefix + slug, label: route.label })
    else failed.push(`${route.prefix}${slug} (unexpected characters in slug)`)
  }
}

rmSync(OUT, { recursive: true, force: true })
const labels = [...new Set([...FIXED, ...BY_SLUG].map(r => r.label))]
const written = Object.fromEntries(labels.map(l => [l, 0]))

async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    try {
      const file = `${OUT}${job.url === '/' ? '/index' : job.url}.html`
      const html = await renderPage(job.url)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, html)
      written[job.label]++
    } catch (e) {
      failed.push(`${job.url} (${e.message})`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

rmSync('dist-ssr', { recursive: true, force: true })
console.log(`prerender: ${labels.map(l => `${written[l]} ${l}`).join(', ')} pages written to ${OUT}`)
if (failed.length) console.warn(`prerender: skipped ${failed.length}, served by the app instead: ${failed.join(', ')}`)
