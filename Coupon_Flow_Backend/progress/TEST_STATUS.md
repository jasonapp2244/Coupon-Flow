# Test Status

_Last run: 2026-10-27_

## Full re-test + clean (2026-10-27)
- `php artisan test`: 138 passed. Admin and website `tsc --noEmit` are clean.
- Browser (real Chrome, Playwright; scripts in the session scratchpad `e2e/`):
  - **Admin as super admin, 28 steps:**
    - categories: create and rename;
    - store: create with logo/URLs/commission/SEO, edit, view, copy link, duplicate, delete, restore, delete permanently;
    - coupons: code, deal, code list with a per-visitor limit, usage limit, ended window in Ended Coupons, CSV upload (header, BOM and duplicates skipped), disable/enable;
    - blog: with image and article markup; publish, unpublish, publish again;
    - brand feed: CSV source, template import, Sync History;
    - homepage slide: with image, reorder, save;
    - notifications and security settings;
    - dashboard and analytics charts, the bell, and the activity log (all labels readable).
  - **Admin part 2:**
    - Confirm sale with a profit preview ($100 at 10% gives $10.00);
    - add an editor and a viewer (real SMTP invites);
    - change role, switch off/on, resend link (the 429 throttle within a minute is intended);
    - editor: can write the catalogue, but Settings, Staff and Activity are blocked;
    - viewer: read-only;
    - reset link sets a new password, which signs in;
    - My Account: name and password changed, then changed back.
  - **Kabir (admin):** 8/8. **Two-step login:** 4/4.
  - **Website flows:** 16/16:
    - hero slide;
    - an ended coupon is hidden;
    - code reveal with a new tab to /api/go, pop-up and copy;
    - deal click-out;
    - code list: next code, then the daily limit;
    - usage limit: "1 left", then gone;
    - rating;
    - /promotions/at alias;
    - blog article markup;
    - search;
    - stores and categories;
    - contact email button;
    - /cart redirects to /;
    - 404.
  - **Website sweep:** 157/157 (16 pages × desktop and mobile, contrast AA).
  - **After the clean:** the empty admin and website render with no errors, the empty-state texts show, and Staff lists only Faizan (Super Admin) and Kabir (Admin).

## Rebrand + super admin (2026-10-26)
- `php artisan test`: **138 passed (923 assertions)**; new in `StaffRolesTest`: super admin passes every check, only a super
  admin manages super admins, last super admin protected, `staff:create` (password + invite). `route:list`: 96 routes.
- Admin and website `tsc --noEmit` clean; `build-release.sh` built api/admin/website zips for urbangoodsguide.com.
- Browser (real Chrome via Playwright, scripts in the session scratchpad `e2e/`):
  - super admin suite 38/40, and both failures were in the test script: the role label sits in a closed menu, and the coupon list was checked before it loaded (the coupon was saved).
    It covers sign-in, a wrong password, brand colours, General/SEO settings saved, every one of 23 admin pages with no console or HTTP errors,
    creating a store and a coupon, and the staff roles.
  - admin (kabir) suite 8/8: admin pages, no actions on the super admin row, no Super Admin option, API 403 when
    switching off the super admin, real invite email and real reset email through SMTP.
  - two-step login 4/4: turn on, code asked at sign-in, code signs in, turn off.
  - website 157/157 at 1366 and 375 wide: 16 pages, the logo in the header and footer, no old name, no broken images,
    no sideways scroll, **WCAG AA text contrast on every page**, favicons, title, code reveal (new tab + pop-up), rating,
    search suggestions, mobile menu.
- All E2E data was removed afterwards. That covers the store, 2 coupons, 2 clicks, 1 rating, the test viewer account, its reset token, 9 notifications and 4 activity rows.

## Hand-over clean (2026-10-17)
- `php artisan test`: 130 passed (874 assertions), incl. new `ContentResetTest` (3 tests).
- Website `tsc --noEmit` + full build (sitemap/prerender) OK; admin `tsc -b` + build OK; `bash -n` on deploy scripts OK.
- Empty-API browser check (`scratchpad/e2e/30-empty-site.cjs`, empty SQLite API on :8002): 8/8 PASS, 0 console errors
  (home hides empty sections, "No coupons/stores/articles yet", filtered "no match" texts, brand-free description,
  admin sign-in without fake figures).

## Backend
Visible human-style walk-through (2026-10-17), one tab, real Chrome window on this PC (Playwright, headed, slowed, typing like a person):
- **Why not the extension:** the Claude in Chrome extension's browser is not on this PC. It gets "refused" on 127.0.0.1, even for Apache, and times out on the LAN address 192.168.100.85.
- **Ports:** port 8000 is taken by XAMPP Apache, so the API ran on 8001 (`APP_URL=http://127.0.0.1:8001 php artisan serve --port=8001`, and both Vite servers with `VITE_API_URL=http://127.0.0.1:8001/api/v1`).
- **Result:** all 21 steps pass. The one scripted "fail" (Analytics uses card read during the filter reload) shows the correct 6 uses in its screenshot.
- **Steps:**
  - admin sign-in errors and sign-in, dashboard;
  - category; store with logo and 10%, then edit;
  - 4 coupons; list search; last-row menu fully visible and Escape closes it;
  - blog publish; staff add → Viewer → switch off; settings pages, General save;
  - website: home, search → store page, scheduled coupon hidden;
  - Show coupon code → example.com tab → pop-up → Copy → refresh → Escape;
  - 3 uses → hidden; deal "No code required"; code list A1 → A2 → daily limit;
  - rating; blog post; About; 404; 375 px with no sideways scroll;
  - Confirm sale $150 shows "Commission 10% · profit $15.00" and saves; Failed;
  - Analytics for the store: 6 uses, $15.00; Dashboard; Activity log "Confirmed sale";
  - Trash delete → restore → delete permanently.
- **Data afterwards:** DB backup `storage/app/backups/2026-10-17_pre_chrome_test.sql`; all E2E records and the logo file removed afterwards (10 stores, 12 coupons, 1 user, as before).

Pre-deploy full test (2026-10-17), real Chrome on this PC driven by Playwright, because the Claude in Chrome extension could not reach 127.0.0.1:
- **Baseline before browser testing:** `php artisan test` 126 passed; pint passed; admin `vite build` OK; website `tsc` clean.
- **Admin, 25 checks:**
  - login validation (empty, bad email, wrong password), forgot-password form, correct login, logout;
  - 18 pages load with no console errors.
- **Admin create/edit:**
  - store category and blog category: create, edit, Escape closes the dialog, empty name refused;
  - store: validation messages, then create with logo, category and 10% commission (slug auto-generated), list search, edit;
  - coupons: validation messages, plus four coupons (shared code with limit 3, deal, code list with 5 codes and 2 per visitor a day, scheduled), end-before-start refused;
  - code list CSV upload skips the BOM and the header row; delete one code;
  - blog published with ## headings, a list and a link;
  - staff: add an editor (`tauseefchoohan0401+e2e@gmail.com`), change role to Viewer, switch off;
  - settings: General, SEO, Homepage, Notifications and Security saved unchanged; wrong current password refused; 2FA setup opened and cancelled (still off);
  - brand feed: template download, CSV-upload source added, 1 coupon imported, run listed in Sync History;
  - Trash: blog deleted, restored (comes back as Draft), deleted again, deleted permanently;
  - activity log lists every action.
- **Website, 30 checks:**
  - 14 pages: HTTP 200, title, description and canonical present, no console errors;
  - scheduled coupon hidden and its /api/go link returns to the store page; 404 page; retired /cart and /checkout redirect home;
  - header search opens the store;
  - "Show coupon code": the store opens in a new tab, the pop-up shows the code, Copy puts it on the clipboard, the pop-up survives a refresh, Escape closes it;
  - usage limit 3: "Used 1 time, 2 left", the coupon hides after the 3rd use, a 4th /go goes back to the store page and is not counted;
  - deal shows "No code required";
  - code list: A1, then "Get another code" gives A2, a refresh keeps A2, the 3rd claim hits the daily limit, a second visitor gets A3;
  - store rating: one vote kept when the vote is changed;
  - blog post renders headings, lists and links;
  - no sideways scroll at 375, 768 and 1280 px.
- **Admin ↔ website:**
  - Dashboard "Uses Today" matches the click rows for the UTC day;
  - Redemptions store filter shows the 7 E2E clicks;
  - Confirm sale: $150 at 10% gives $15.00; Used without an amount refused; Failed and Pending work;
  - summary cards and Analytics for the store show the profit, CSV export has today's row;
  - Reset uses works, and a coupon title edit shows on the site;
  - admin at 375 px: no overflow, sidebar opens.
- **Bugs found and fixed:**
  1. Row action menus were cut off below a table's last row. Staff (every row), and the bottom rows of Stores, Coupons, Blogs and Feeds, could not reach Delete or Switch off.
  2. The Confirm sale pop-up said "Commission Not set" and showed no profit preview for unconfirmed clicks.
  3. Three activity actions showed raw names.

  All three were re-tested in Chrome. New test `test_an_unconfirmed_click_shows_the_rate_its_sale_will_use`.
- **After the fixes:** `php artisan test` **127 passed (855 assertions)**; pint passed; admin `tsc` clean and `vite build` OK; admin page suite 25/25.
- **Data afterwards:**
  - DB backup taken before testing: `storage/app/backups/2026-10-17_pre_e2e.sql`.
  - All E2E records from this run were deleted: store, logo file, 5 coupons and their codes, 7 clicks, rating, 2 categories, feed and its sync run, staff user and reset token, 8 notifications.
  - Activity log rows were kept (audit trail).
- **Not fixed (minor):** All Coupons reads `?state=` / `?near=` only when the page first opens. Changing only the query while already on All Coupons keeps the old filter. A fresh load and the Dashboard links work.
Responsive check (2026-10-16), headless Chrome with touch and device scale on phones and tablets, 15 pages × 15 sizes from 320 px to 2560 px:
- **After the fixes:** no sideways overflow, no clipped text, no text under 12 px, no distorted images, no touch target under 24 px.
- **Pop-up and mobile menu** checked at 320×568, 667×375, 844×390 and 768×1024: the close button stays reachable, and the pop-up scrolls only on short screens.
- **Errors:** the only console errors were API rate-limit responses (HTTP 429; 120 requests per minute per visitor) caused by the audit's rapid page loads.
- **Build:** website tsc clean; build OK (28 URLs, pre-render OK). Backend unchanged.

Website copy pass (2026-10-16):
- `php artisan test`: **125 passed (828 assertions)**. HomepageSettingsTest now expects the new default headline.
- pint passed. Website tsc clean.
- Build OK: sitemap 28 URLs; pre-render 6 store pages, because the 2 test stores are now hidden.
- Headless Chrome at 1440 and 390 px over 17 pages (home, coupons, stores, 2 store pages, categories, 2 category pages, blog, article, 5 static pages, the hidden demo store, a 404): no console errors, no overflow, no leftover markup or placeholder text ("Terms apply", "Travil", "Demo", example.com, "**", "##"). The full text dump was proofread, and duplicated blog tab titles were found and fixed.

Blog articles + editor (2026-10-16): no backend code changed. Admin + website tsc clean; website build OK (30 URLs, 4 article pages pre-rendered with the new text). Headless Chrome: admin blog edit → Ctrl+B and the Heading button format a line, two undos restore it, Preview shows headings/lists/quote; site article at 1440/390 px renders 5 h2, 4 h3, numbered + bullet lists, a tip box, bold text, no raw markup; an in-article link opens /stores/amazon; no console errors or overflow.

Editable hero (2026-10-16): `php artisan test` -> **125 passed (828 assertions)** (new `HomepageSettingsTest` 5; AccountSecurityTest now checks `meta.currency` absent since settings gained `meta.homepage_image_urls`); pint passed; `route:list --path=settings` shows the upload route. Admin + website tsc clean; website build + pre-render OK. Headless Chrome: admin login → Settings → Homepage, uploaded background + 2 slides, saved; site shows new headline/placeholder, background, slider autoplay 0→1, Next works, slide button → /stores/sephora; 1440/390 px, no console errors or overflow.

Blog redesign (2026-10-16): website tsc clean; full build OK (sitemap 30 URLs, 4 article pages pre-rendered). Headless Chrome 1440/390 px: /blog, /blog?category=deals, an article; no console errors, no overflow; header "Blog" link opens /blog.

Website UI upgrade (2026-10-16, no backend code changes): `php artisan test` -> **120 passed (771 assertions)**.
Website `tsc` clean; `pnpm build` (tsc + vite + SSR + sitemap 30 URLs + pre-render 30 pages) OK. Headless Chrome at
1440 px and 390 px: home, coupons, stores, categories, a category, a store, blog, about, 404 and the code pop-up —
no console errors, no horizontal overflow, "Show coupon code" opens the store tab and the pop-up shows the copy button.

`php artisan test` (2026-10-15, code lists + profit) -> **120 passed (771 assertions)**; pint passed; new suite
`CodeListAndProfitTest` (10). Admin + website tsc clean. Headless Chrome on the dev servers: visitor A code 1, refresh
same code, Get another code -> code 2, third try -> limit message; visitor B (other browser) code 3; coupon then hidden;
admin Codes card 0 of 3 left with the used list; Confirm sale $150 -> 8% -> $12.00, row Used, Profit Earned / Conversion /
Dashboard Profit (30 days) updated; no console errors.

`php artisan test` (2026-10-15, paid coupons removed) -> **110 passed (648 assertions)**; `pint --test` passed;
`route:list --path=api` 86 routes, none for orders/checkout/stripe/register/verify/codes. 4 suites deleted with the
feature (Checkout, StripeSetupCheck, UniqueCodes, ShopSwitch); new/rewritten: no public accounts, staff email change
without link, reset links open the admin, Coupon Code needs a code, retired settings dropped, trash purge, dashboard
+ analytics + CSV shape. Admin + website: tsc clean, builds OK. Headless Chrome: admin dashboard, coupons, create/edit
coupon, analytics, settings general/notifications, trash, redemptions load with no API errors and no console errors,
no Orders link, /orders goes home; website pass unchanged (no shop wording, old paths redirect home).

Website (2026-10-15, after deleting the shop files): `tsc` clean, build + SSR + sitemap (29 URLs) + pre-render OK; same
headless Chrome pass (no shop wording/links, old paths redirect home, no console errors).

`php artisan test` (2026-10-15, cart removed from the website; no backend code changes) → **153 passed (881 assertions)**.
Admin `tsc --noEmit` clean. Website `tsc` + `vite build` + SSR build + sitemap (28 URLs) + pre-render (28 pages) OK.
Headless Chrome on the dev servers: /, /coupons, /stores/nike, /promotions/at/sephora and the 5 info pages show no
cart/sign-in/exclusive wording or links; /cart, /login, /account/orders, /checkout/success, /refund-policy redirect
to /; Nike row has only SHOW COUPON CODE; no console errors.

`php artisan test` (2026-10-14, health check, no code changes) → **153 passed (881 assertions)**; admin `tsc --noEmit` clean, admin `vite build` OK (needs `VITE_API_URL` + `VITE_SITE_URL`).

`php artisan test` (2026-10-08, health check, no code changes) → **153 passed (881 assertions)**; admin `tsc --noEmit` clean.

`php artisan test` (2026-10-07, demo paid coupons) → **153 passed (881 assertions)**. New in `AccountSecurityTest`:
demo seeding adds the two paid pool coupons (10 codes, stock 10 each) and is safe to run twice.

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
