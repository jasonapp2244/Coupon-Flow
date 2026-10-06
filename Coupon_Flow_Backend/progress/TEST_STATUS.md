# Test Status

_Last run: 2026-10-06_

## Backend
`php artisan test` (2026-10-06) → **152 passed (872 assertions)**. New suites: `StaffRolesTest` (7), `TwoFactorTest` (8:
setup, challenge, clock drift, replay, 5 wrong codes, recovery once, disable needs password, admin reset, enforcement),
`ActivityLogTest` (6), `DealWindowTest` (4: store-tz input, bare dates, hidden + /go blocked outside window, states +
filters), `UsageLimitTest` (7: 500→499, last use hides + reveal still works, unlimited, alerts once at 80%/100%, admin
limit/%/reset, sort, viewer blocked), `FeedImportTest` (10: JSON + CSV template, Bearer key, Draft vs auto-publish,
updates vs admin edits kept, bad rows listed + alert, deactivate missing (not on empty), deleted not re-created,
SSRF/http refused, broken JSON, scheduler due-only, roles + masked key), `DashboardStatsTest` (2). `route:list` OK
(102 api routes). Local MariaDB migrated after a mysqldump backup (scratchpad `coupon_follow-before-2026-10-06.sql`).
Admin + website `tsc` and production builds clean; pre-rendered store page shows "Expires Nov 4, 2026, 2:55 PM EST".
**Browser E2E (headless Chrome, servers 8000/8443/5173):** admin dashboard (usage KPIs, 2FA banner); 2FA setup with QR
+ key, wrong code refused, right code → 10 recovery codes; new sign-in asks for the code; recovery-code sign-in;
added an editor and a viewer (plus-addresses of the test email); editor: no Staff/General/Activity in menu, /staff
"Admins only"; viewer: no Create Coupon, /coupons/new "Read-only access", no checkboxes, no feed buttons; CSV template
import → 2 new coupons + 1 Draft store (re-import later: "Kept (edited by you) 2"); coupon form set limit 2 → site
shows "Used 0 times · 2 left", two clicks → coupon gone, `/go` → back to the store page, admin state used_up 100%,
dashboard "1 used up"; deal set to end ~2 min ahead showed "Ends in 1 min", then disappeared, admin state "ended";
activity log lists sign-ins, imports, changes. No page errors. Afterwards: admin 2FA turned off, test staff deleted,
demo coupons reset.

Earlier (2026-10-05, shop switch):
`php artisan test` (2026-10-05, shop switch) → **108 passed (545 assertions)**. New `ShopSwitchTest` (4: off by default
hides paid coupons from every public endpoint and `/go`, checkout 403, admin turns it on, admin still lists paid
coupons). Paid-flow suites call `enableShop()` (TestCase helper). Admin + website `tsc` and production builds clean;
pre-rendered home/store pages contain no "Add to cart", "Sign in" or "Exclusive codes".
**Browser (dev servers 8000/8443/5173):** home/coupons/store pages show only rows with SHOW COUPON CODE / GET DEAL, no cart
or sign-in; click → new tab + `/#coupon_code-1` pop-up, click code copies SAVE20FALL, Esc clears the hash;
`/stores/walmart#coupon_code-2` → "No Code Required"; legacy `?c=1` still works; `/cart`, `/login`, `/account/orders` → `/`;
Sephora (paid only) → empty state; admin toggle on → cart, sign-in and Add to cart appear; off again → gone; 390px no
horizontal scroll; no page errors.

`php artisan test` (2026-10-05, admin ratings) → **104 passed (521 assertions)**; `StoreRatingTest` now 11 (admin
list + sort, summary/breakdown, voter names, remove one, reset, store scoping, admin-only). `route:list` shows the four
`admin/stores/{store}/ratings` routes. Admin `tsc` + production build clean. Headless Chrome on the admin (8443, API
8001): 3 guest votes on Walmart → list sorted by Rating shows "3.3 (3)" first; edit page card 3.3/5 with 1/1/0/0/1
bars; 1-star filter → 1 row; remove → 4.5/5, 2 votes; reset → "No votes yet" and the public API returns
`{average:null,count:0}`. The local `store_ratings` migration was rolled back and re-run (table was empty) to add
`user_id`.

Earlier: 99 passed (494 assertions), new: `StoreRatingTest` (6). `route:list`
shows `POST api/v1/public/stores/{slug}/rating`. Migration `2026_10_05_100000_create_store_ratings_table` run on local
`coupon_follow`. Browser: Walmart "No ratings yet" → 4 stars → "Average rating: 4 of 5 (1 vote)" → re-vote 5 + reload
→ "5 of 5 (1 vote)", "You rated 5 of 5"; test vote deleted afterwards. Website build pre-renders the box.

Earlier the same day: 93 passed (471 assertions), new: store page `used_count`.

**Store layout check (2026-10-05, isolated headless Chrome, API on 8001):** `/promotions/at/amazon` H1, no "Add to cart";
SHOW COUPON CODE → new tab to the tracking URL + `?c=1` pop-up, clicking the code copies SAVE20FALL, Esc drops `?c`;
Walmart title click → "No Code Required" pop-up; 390px wide: no horizontal scroll. Website `pnpm build` (tsc + SSR +
prerender) clean, no merchant hosts in `dist/_prerender`.

Earlier (2026-10-03):
`php artisan test` → **92 passed (466 assertions)**. `php artisan route:list` shows `api/go/{id}`,
`api/go/store/{slug}` and `api/v1/public/coupons/{id}/reveal`.

**Click-out / pop-up check (2026-10-03, isolated headless Chrome, local API on 8001):** `/stores/amazon` H1
"Amazon Coupons & Promo Codes", no external hrefs; Show code → new tab via `/api/go/1` (302 to the tracking URL,
no-store + noindex) and `?c=1` pop-up with the code; refresh keeps it; Esc closes and drops `?c=`; Visit store
goes through `/api/go/store/amazon`; `?c=999999` → "no longer available" toast; Walmart "Get deal" → "Deal
activated" pop-up; admin new-store form shows `…/stores/the-loaded-tea-shop` live, list shows `/stores/{slug}`.
Website build: 29 sitemap URLs, all pre-rendered; grep of `dist/_prerender` for every store/coupon merchant host
and coupon code → 0 hits. Admin `tsc` + production build clean.

**Alias check (2026-10-03):** throwaway XAMPP Apache on the built `dist/`: `/promotions/at/amazon`, `…?c=1` and
`…/` → 200 with the snapshot (canonical `/stores/amazon`); unknown slug → app shell; `/_prerender/...` → 404.
Headless Chrome on the dev server: alias shows "Amazon Coupons & Promo Codes", canonical + og:url `/stores/amazon`,
Show code → `?c=1` pop-up on the alias URL; unknown slug → not found. Sitemap has no `/promotions` URLs.
Both apps `tsc` clean; backend 92 passed.

| ClickOutTest (5) | /go redirect precedence + click recorded + headers, direct-URL fallback, dead links back to the site without a click, reveal (free code yes, paid never, expired 404), admin still sees merchant links |

**Browser purchase re-check (2026-10-01, Chrome, Stripe test mode):** signed in as the seeded shopper → Nike
"15% Off" ($2.99, shared code) → cart → Stripe Checkout (USD, 4242) → success page → `orders:reconcile` →
order #4 paid, code `NIKE15RUN` shown, emailed (log mailer), stock 50 → 49, cart emptied, ticket now
"Bought · view code". Already-bought Best Buy pool coupon showed "Bought · view code" before the run.

| Suite | Covers |
|---|---|
| PublicSiteApiTest (12) | public settings without secrets, click-out redemption (free + paid), search suggestions, literal wildcards, category page, related stores, letter filter, ending-soon order + verified, blog list without body + related, sitemap, timezone expiry |
| AccountSecurityTest (9) | registration → emailed website link verifies, forged link rejected, email change re-verifies, password change revokes other tokens, paid coupon needs code (create + partial update), settings survive rotated APP_KEY, admin alert emails follow switches, production seeding = admin only, local seeding = demo data |
| StripeSetupCheckTest (6) | stripe:check: missing keys, working key + full webhook, missing events, rejected key, live key outside production, production HTTPS/mail/debug rules |
| AuthTest (8) | login, bad password, register can't self-assign admin, reset links point to the right frontend (admin uses `/#/`), logout revokes token, 401/403, admin can't checkout, profile password needs current password |
| AdminCatalogTest (16) | slugs + logo upload, validation, filters/counts, status + duplicate, trash restore rules, sold coupons not purgeable, coupon price/code rules, expired + featured filters, blog publish date, category type check + CRUD, masked vendor secrets, redemption summary, sync-runs shape, dashboard + CSV |
| PublicCatalogTest (4) | paid codes hidden, only live coupons of active stores, store page by slug, only published blogs |
| UniqueCodesTest (7) | each buyer gets their own code + stock follows pool, last code sells out and expiry returns it, late payment after sell-out waits then gets the next added code by email, admin add (blank/duplicate/case-insensitive) + list + search + remove rules + scoped binding, codes held by open checkout can't be removed, switching modes (no code needed, typed stock ignored, free coupons refused, duplicate starts empty), no mode switch during a checkout |
| CheckoutTest (22) | purchases list = own paid orders only, idempotency key includes creation time, already-bought refused, retry replaces open checkout, max 2 open checkouts, unverified email refused, immediate card refund marks order (webhook then no-op), dispute alerts admins, cancel expires Stripe session + webhook releases stock, cancel of closed order needs no keys, stock reservation + server prices + idempotency, unbuyable coupons, Stripe failure rollback, 503 without keys, paid webhook once + email, async payment, amount mismatch, expiry releases stock, bad signature, order isolation, refund flow, reconcile |

## Admin dashboard (`../Coupon_Flow_Dashbaord`)
`tsc --noEmit` clean (also with `--noUnusedLocals --noUnusedParameters`); `vite build` succeeds.

Browser end-to-end against the real API + MariaDB (Playwright):
- customer account refused at admin login; admin login; session survives reload; sign-out revokes token (old token → 401)
- dashboard shows live KPIs / chart / recent orders; 0 console errors apart from the expected 503 below
- coupon: client validation, price < 0.50 blocked, create paid ($1.49, stock 5) → list, public API returns `code: null`, server-side "Paid" filter, edit prefills + saves ($1.99 in MySQL), delete → Trash → restore as Draft
- store with logo upload + category → row in MySQL, logo served (200 image/png)
- blog categories create (auto slug) + edit modal re-initialises per category
- orders drawer shows delivered code; refund without Stripe keys → "Payments are not configured yet", order stays paid
- settings SEO saved to MySQL; global search (stores/coupons/blogs); notification bell; analytics CSV download

## Real Stripe test mode (2026-09-30, user's test key, Playwright)
- `stripe:check`: key accepted, can read Checkout Sessions; only failure = no webhook secret.
- Order #1: cart → "Pay $2.99 by card" → real `checkout.stripe.com` session (stock 50→49 reserved) → card 4242 → back on /checkout/success → `orders:reconcile` retrieved the paid session → page flipped to NIKE15RUN, cart emptied → `OrderPaidMail` sent via queue (log) → admin refund: Stripe PI shows refunded 299/299; retry with same idempotency key returned the same refund (1 refund at Stripe) and marked the order refunded.
- Order #2: card 4000 0000 0000 9995 → Stripe shows "declined … insufficient funds" → Back → /checkout/cancel → our cancel endpoint expired the session at Stripe → reconcile → order expired, stock 48→49.
- With `stripe listen` + `whsec_`: order #3 4242 → `checkout.session.completed` [200] → codes on success page ~2s after redirect, no reconcile; admin refund → `charge.refunded` delivered [200], stored in `stripe_events`, order refunded once. Order #4 Sephora with 3-D Secure card 4000 0027 6000 3184 → Stripe test challenge → Complete → BEAUTY30 delivered; emails for #3/#4 sent via queue.

## Public website (`../Coupon_Flow_Website`)
`pnpm build` (tsc strict incl. unused checks + vite build) passes.

Browser end-to-end against the real API + MariaDB (Playwright, desktop 1360px and mobile 390px):
- home renders live featured coupons / top stores / articles; screenshots reviewed desktop + mobile, no horizontal overflow
- store page title/meta set; add exclusive code to cart; cart persists; checkout sends signed-out shopper to login and back
- pay without Stripe keys → clear message, no orphan order, stock untouched
- success page polls a pending order, flips to codes when OrderFulfillment runs, removes bought items from cart; order email rendered with the code (queue worker, log mailer)
- My orders lists the paid order; cancel page; unknown store → 404 page; free code reveal + copy + tracking link

## Categories/static pre-render run (2026-10-01, same setup)
- Build: "... 1 categories list, 6 static, 7 store, 8 category, 3 article pages" = 29 files = all 29 sitemap URLs, exit 0.
  None marked noindex; /categories links all 8 categories; static pages embed settings + header categories only.
- Apache: /categories, all six static pages and /about?ref=x → snapshots; /cart, /login → app shell;
  /_prerender/about.html, /_prerender/categories.html → 404.
- Browser: /categories, /contact, /privacy take over with no heading flash, one of each head tag, 0 console
  warnings/errors; category link from /categories navigates in-app.

## Coupons/blog-list pre-render run (2026-10-01, same setup)
- Build: "1 home, 1 stores list, 1 coupons list, 1 blog list, 7 store, 8 category, 3 article pages" (22), exit 0.
  Discovered data: /coupons = categories + default coupon query; /blog = store + blog categories + first page.
  No paid codes in the coupons list HTML.
- Apache: /coupons, /blog → snapshots; /coupons?kind=paid, ?category=, /blog?page=2, ?category= → app shell;
  /_prerender/coupons.html, /_prerender/blog.html → 404.
- Browser: both take over with no heading flash, one of each head tag, 0 console warnings/errors; "Exclusive"
  filter after takeover → only the 3 paid coupons; direct /coupons?kind=free → only the 3 free ones.

## Home/stores-list pre-render run (2026-10-01, same setup)
- Build: "1 home, 1 stores list, 7 store, 8 category, 3 article pages" (20 files), exit 0. Discovered data: home =
  settings + categories + 4 home queries + blogs; /stores = exact default query; every page includes the header
  categories. No paid codes in home/stores HTML.
- Apache: / and /?utm_source=x → home snapshot; /stores → snapshot; /stores?letter=B, ?sort= → app shell;
  /stores/nike?utm_source=x → snapshot; /_prerender/index.html, /_prerender/stores.html → 404.
- Browser: home and /stores take over with no heading flash, one of each head tag, 0 console warnings/errors;
  clicking letter B after takeover → only Best Buy; direct /stores?letter=W → only Walmart; home with JS off at
  1280px renders every section.

## Category/article pre-render run (2026-10-01, same setup)
- Build: "7 store pages, 8 category pages, 3 article pages" (= the 18 dynamic sitemap URLs), exit 0.
- Article HTML: title, canonical, og:type=article, Article JSON-LD with datePublished, h1 + body; category
  HTML: title/description, h1, its stores and coupons, no paid codes.
- Apache: /blog/{slug} and /categories/{slug} → pre-rendered; /blog, /categories, unknown slugs → SPA;
  /_prerender/blog/... and /_prerender/categories/... → 404.
- Browser: both take over with no heading flash, one of each head tag, 0 console warnings/errors; link
  from a category to a store navigates in-app; article with JavaScript off at 390px renders fully.

## Pre-render run (2026-10-01, real API on :8001 + MariaDB, throwaway XAMPP Apache on :5173 using dist/.htaccess)
- `pnpm build` (tsc strict, client + SSR build, sitemap, prerender): 7 store pages written, dist-ssr removed.
- HTML check: per-store title/description/canonical/OG/JSON-LD, no duplicated generic tags, h1 + tickets in #root,
  no paid codes (NIKE15RUN, BBY50-*) in the HTML or embedded data.
- Apache: /stores/nike and ?query → pre-rendered file; /stores, /stores/, unknown slug, / → SPA shell;
  /_prerender/stores/nike.html → 404; missing asset → 404; sitemap 200.
- Browser: one of each head tag after the app mounts, 0 console warnings/errors; heading never disappears during
  mount (no spinner flash); renamed a coupon in the DB after the build → snapshot title then live title (reverted);
  in-app navigation to a category and Back work; JavaScript off at 390px shows the full styled page, no overflow.
- API down: build exits 0, warns, writes only fixed sitemap URLs and no pre-rendered pages.

## Unique-code run (2026-10-01, Playwright, real API on :8001 + MariaDB + Stripe test mode)
- Admin (`tsc` strict clean, `vite build` ok): Best Buy edit page shows Code delivery = unique, Available to buy 10, pool list.
  Pasted 0010/0011/bby50-0011/blank/0012 → "Added 2 codes, skipped 1 already in the pool", count 12; removed 0012 → 11.
- Website: test customer bought it with 4242 on Stripe Checkout (USD), settled by `orders:reconcile` (no Stripe CLI on
  this machine, so no webhook listener; same fulfilment code path). Success page showed BBY50-0001; email in the log
  carried BBY50-0001; store page then showed "Bought · view code". Admin pool: 10 unsold, 0001 sold → order #3 link
  opens Orders filtered to #3. Order #3 stays in the local DB as a real test-mode purchase.

## Already-bought run (2026-10-01, Playwright, real API on :8001 + MariaDB)
- `tsc --noEmit` clean; `vite build` succeeds.
- Temporary paid order for the test customer (deleted afterwards). Signed out: Nike ticket shows "Add to cart";
  after sign-in it shows "Bought · view code" → `/account/orders/{id}`; cart line shows "Already yours" with a
  link to the code, alert offers removal, Pay disabled; after sign-out it's back to "Add to cart".

## Phase 5 browser run (2026-09-30, Playwright, real API + MariaDB + Stripe test mode)
- Website desktop 1440 and phone 390 screenshots reviewed (home, store, coupons, stores); no horizontal overflow; 0 console errors.
- Register `tauseefchoohan0401@gmail.com` → cart asks to confirm email → link from mail log → Email confirmed → cart unlocked; foreign `link=` refused.
- Free code reveal on Amazon → SAVE20FALL shown, stays revealed after reload, redemption row recorded with the customer's name, visible in admin Redemptions.
- Card 4242 purchase (stripe listen): codes on success page via webhook; buying the same coupon again → "You already bought…"; receipt page; account page; password change.
- Admin: store picker search ("nik" → Nike), settings save support email → `public/settings` returns it, currency read-only, refund from Orders → Refunded.
- Release script trial with example domains: api.zip 8.3 MB (no .env, no phpunit), admin.zip, website.zip (sitemap + robots); bundles contain the example API URL and no 127.0.0.1.

## Full re-test (2026-09-30, all servers running, Playwright)
- Public: 19 routes load with correct h1/title (noindex only on cart/auth/404); 0 console errors besides the expected 404 for a missing store. Filters (type, sort, verified, clear, search), A–Z letters, search suggestions, guest cart → sign in → back to cart → remove all work.
- Admin: 20 routes load, 0 console errors. Store create, coupon create (store picker), paid deal with code + stock, price/code validation, edit prefill + save, duplicate, delete → trash → restore, blog publish (headings/lists render on the public article), category create, bulk deactivate/activate, SEO + notification settings, CSV export, notification bell, sign out (token cleared), customer refused at admin login.
- Fixed during the run: admin toggles were unfocusable divs (now real switches with names); several admin labels weren't linked to their fields; bell and the Notifications settings link shared one name; "1 coupons"-style plurals; article pages showed no related posts when a topic had only one post (now filled with latest posts, +1 test).
