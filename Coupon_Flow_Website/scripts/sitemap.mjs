// Writes dist/sitemap.xml and dist/robots.txt after `vite build`.
// Store, category and article URLs come from the live API; if it can't be reached the sitemap
// still lists the fixed pages (and says so), so a build never fails because of it.
import { writeFileSync } from 'node:fs'
import { env, getJson } from './env.mjs'

const site = env('VITE_SITE_URL').replace(/\/$/, '')
if (!site) throw new Error('VITE_SITE_URL is not set')

const pages = ['/', '/coupons', '/stores', '/categories', '/blog', '/about', '/contact', '/refund-policy', '/terms', '/privacy', '/affiliate-disclosure']
  .map(path => ({ path, lastmod: null }))

try {
  const data = await getJson('/public/sitemap')
  pages.push(
    ...data.stores.map(s => ({ path: `/stores/${s.slug}`, lastmod: s.updated_at })),
    ...data.categories.map(c => ({ path: `/categories/${c.slug}`, lastmod: c.updated_at })),
    ...data.blogs.map(b => ({ path: `/blog/${b.slug}`, lastmod: b.updated_at })),
  )
} catch (e) {
  console.warn(`sitemap: could not load the store list (${e.message}); only fixed pages were written.`)
}

const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${escape(site + p.path)}</loc>${p.lastmod ? `<lastmod>${p.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`

writeFileSync('dist/sitemap.xml', xml)
writeFileSync('dist/robots.txt', `User-agent: *
Disallow: /cart
Disallow: /checkout/
Disallow: /account
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email

Sitemap: ${site}/sitemap.xml
`)
console.log(`sitemap: ${pages.length} URLs written to dist/sitemap.xml`)
