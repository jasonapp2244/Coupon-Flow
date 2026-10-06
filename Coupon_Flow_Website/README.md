# Coupon Follow — public website

The shopper-facing site: browse stores and coupons, copy free codes, buy exclusive codes by card
(Stripe Checkout), and keep purchased codes under **My orders**. It talks only to the Laravel API in
`../Coupon_Flow_Backend` (`/api/v1/public/*`, auth and customer endpoints).

Stack: React 19, Vite 8, Tailwind CSS 4, React Router 7 (real paths such as `/stores/nike`).

## Local development

```bash
npx pnpm@10.34.3 install
cp .env.example .env          # VITE_API_URL=http://127.0.0.1:8000/api/v1
npx pnpm@10.34.3 dev          # http://127.0.0.1:5173  (must match the API's FRONTEND_URL for CORS)
npx pnpm@10.34.3 build        # type-check + production build into dist/
```

Test shopper (local seed only): `tauseefchoohan0401@gmail.com` / `Customer1234`.

## Pages

| Path | Purpose |
|---|---|
| `/` | Search, featured coupons, top stores, how exclusive codes work, latest articles |
| `/coupons` | All live coupons; `?q=`, `?kind=free\|paid`, `?category=`, `?order=`, `?verified=1`, `?page=` |
| `/stores`, `/stores/:slug` | Stores A to Z (letter index, category, sort) and a store page (free + exclusive codes, about, similar stores) |
| `/categories`, `/categories/:slug` | Store categories with their stores and latest coupons |
| `/blog`, `/blog/:slug` | Shopping guides with search; plain text with `## headings` and `- lists`, never rendered as HTML |
| `/cart` | Exclusive codes waiting for checkout (kept in the browser; server re-checks price and stock) |
| `/checkout/success`, `/checkout/cancel` | Stripe return pages (success polls until the webhook marks the order paid) |
| `/account`, `/account/orders`, `/account/orders/:id` | Account overview, profile and password, purchased codes with receipt |
| `/verify-email` | Opens the emailed confirmation link (only links to our own API are followed) |
| `/about`, `/contact`, `/refund-policy`, `/terms`, `/privacy`, `/affiliate-disclosure` | Info and legal pages (template wording: have it reviewed before launch) |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Shopper accounts (admins are refused) |

## Deploying to SiteGround

Follow `../Coupon_Flow_Backend/deploy/DEPLOY.md`; its `build-release.sh` builds this site too.
To build it alone:

```bash
VITE_API_URL=https://api.example.com/api/v1 VITE_SITE_URL=https://example.com npx pnpm@10.34.3 build
```

Both variables are required for production builds. The build also writes `dist/sitemap.xml` (store,
category and article URLs from the live API, when it can be reached) and `dist/robots.txt`.

Every page in the sitemap is pre-rendered for SEO (home; the stores, coupons, blog and categories lists;
the static pages; every store, category and article; not cart, sign-in or account pages):
`src/entry-server.tsx` is built with `vite build --ssr`, then `scripts/prerender.mjs` renders each one
into `dist/_prerender{path}.html` (home: `dist/_prerender/index.html`) with its markup,
title/description/canonical/Open Graph/JSON-LD, and the API data it used. The data is discovered by
rendering: the render reports the API paths it couldn't answer, the script fetches them and renders
again. `.htaccess` serves the file at the page's clean URL (`/stores`, `/coupons` and `/blog` only without a
query string, since their filters live there); the app then mounts over it (no hydration: cart and sign-in are browser-only),
starting from the embedded data and refreshing it. To pre-render another page, add it to `FIXED` or
`BY_SLUG` in the script. If the API can't be reached the build still succeeds and every page renders in
the browser. Rebuild after catalogue changes so the snapshots stay current.
Upload the **contents** of `dist/` to the domain's `public_html/` (including `.htaccess`, which forces
HTTPS and serves `index.html` for app paths such as `/stores/nike`). The site must be at the domain root.
In the API `.env`, `FRONTEND_URL` must equal this site's origin.
