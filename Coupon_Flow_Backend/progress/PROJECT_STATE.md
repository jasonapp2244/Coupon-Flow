# Project State — Coupon Follow

_Last updated: 2026-10-17_

**Repository:** one git repo at `F:\React_project` (backend, admin and website as subfolders, root `README.md` +
`.gitignore`), pushed to https://github.com/jasonapp2244/Coupon-Flow (branch `main`, first commit `976466f`,
2026-10-07; paid-removal + code lists pushed as 9e24f83 on 2026-10-15; redesign, editable hero, article editor and copy
rewrite pushed as 5229d39 on 2026-10-16). No `.env`, `vendor`, `node_modules` or `dist` in it.

## Overall roadmap
| Phase | Scope | Status |
|---|---|---|
| 0 | React admin cleaned + SiteGround-ready static build (`../Coupon_Flow_Dashbaord`) | ✅ Done |
| 1 | Laravel backend + Stripe (this repo) | ✅ Done |
| 2 | React admin wired to this API | ✅ Done |
| 3 | Public website (`../Coupon_Flow_Website`) | ✅ Done — see below |
| 4 | Payments go-live (Stripe) | ❌ Removed 2026-10-15 at the user's request (see below); no payments at all |
| 5 | Audit fixes, public site redesign, full test, SiteGround deploy | 🟡 Code, tests and release packaging done; live upload waits on user inputs (see TODO) |

## Follow-up — hand-over clean: no demo data, admin only (2026-10-17)
Client's final requirement: the live site starts empty, with only the admin account.
- `php artisan content:reset --keep-admin=<email> --force` (`app/Console/Commands/ResetContent.php`): removes every
  store, coupon, code, blog, category, feed, click, rating, sync run, activity entry, notification, setting row,
  token, session and uploaded image, and every account except that admin. Settings fall back to code defaults.
- `deploy.sh --reset-content` / `git-deploy.sh <domain> main --reset-content`: asks the admin to keep + optional
  new password + "RESET", backs up the DB first, then runs the reset and rebuilds the website.
- First installs are always empty now (`--fresh`); the demo catalogue `deploy/content/` was removed from the repo.
- Admin sign-in panel: fake figures (284.1K clicks, NIKE15RUN…) replaced by three plain feature cards.
- Website: brand-free fallback meta description; home hides empty Featured coupons / Top stores; Coupons, Stores and
  Blog say "… yet, check back soon" when empty and unfiltered.
- Local `DemoSeeder` kept for development only (never runs in production).

## Follow-up — pre-deploy browser test, admin + website (2026-10-17)
The user asked for every feature to be tested step by step in Chrome before they deploy. Details are in TEST_STATUS.

**How it ran:**
- The Claude in Chrome extension got "connection refused" on 127.0.0.1, so the tests ran in real Chrome on this PC, driven by Playwright scripts kept in the session scratchpad.
- MySQL had stopped and was restarted.

**Fixed (uncommitted):**
1. **`components/DataTable.tsx` `RowMenu`:** the open menu is now drawn over the page next to its button (portal, fixed position). It opens upward when there's no room below, follows the button on scroll and resize, and closes on Escape or a click elsewhere. Before, `overflow-x-auto` on the tables clipped menus below the last row.
2. **`RedemptionResource`:** new `commission_rate` field, the rate confirming a sale applies: the stored rate, else the coupon's, else the store's. The redemptions list and Confirm sale eager-load `coupon`. The admin's Confirm sale pop-up and the drawer use it, so the profit preview shows before confirming.
3. **`ActivityLogPage`:** labels for `codes_added`, `code_removed` and `sale_confirmed`.

**Result:** 127 backend tests; no other defects found. All E2E data was removed afterwards.

## Follow-up — end-to-end test of every feature, admin + website (2026-10-16)
Client: test every feature of the admin panel and the website.

**How it ran:**
- 5 Playwright suites (144 checks) in headless Chrome against the local API.
- The admin was served as a production build (`vite preview`, :8443). The suites live in the session scratchpad and are not in the repo.
- All test data was named "E2E Test…" and removed afterwards, permanently deleted from Trash too.
- The only test identity was the plus-address `tauseefchoohan0401+e2e@gmail.com`.

**Bugs found and fixed (all uncommitted):**
1. **CSV code upload imported the header row as a code**, and the byte-order mark too. Fixed in `Admin/CouponCodeController@store`; test added in `CodeListAndProfitTest`.
2. **Admin login:** the form's own messages ("Enter a valid email") were never reachable, because the browser's built-in validation blocked them. Added `noValidate` on the login and forgot-password forms.
3. **Website showed the raw "Too Many Attempts."** The website now shows a plain wait message, and the public limit was raised from 120 to 300 a minute, since many shoppers can share one address.
4. **Admin dialogs ignored Escape**, and had no dialog roles or labelled close buttons. Fixed in `Modal.tsx` (ConfirmModal, Modal, Drawer) and the category dialog.
5. **Reset-password link opened in a tab already showing the admin sign-in page stayed on that screen.** Only the hash changed, and the view was chosen once. `LoginPage` now follows the link.
6. **Admin showed the raw "Too Many Attempts."** It now says "Too many tries… Wait N seconds". `Retry-After` was added to the CORS exposed headers; test in `AuthTest`.

**Data afterwards:**
- No E2E records, test feed or test redemptions remain. 28 test click rows were deleted by hand; the API has no delete for them.
- Settings are back to their values from before testing. A `notifications` row now exists, holding the defaults.
- No real coupon was clicked by the tests.
- The test staff account is left switched off, because staff can't be deleted.

## Follow-up — responsive check, every device (2026-10-16)
Audited 15 public pages at 15 sizes: phones 320–430, phone landscape 667×375 and 844×390, tablets 768–1024 in both
orientations, desktops 1280–2560. Before the fixes there was no overflow, clipped text, tiny text or distortion; the
problems were small tap targets and a few visual issues. Fixes:
- **Tap targets of at least 24 px:**
  - new `.link-more` class for "See all" links;
  - padding on breadcrumb and footer links;
  - slider dots are now 24 px buttons.
- **Phones:**
  - Home category tiles stack the icon above the name under 400 px, so names don't break mid-word.
  - The hero slider is taller (4:5) under 420 px, so text no longer runs under the dots and arrows. It's 16:9 from 640 px up to 1024 px, then 4:3 again on desktop.
- **Landscape phones:** new `short:` variant (landscape, at most 500 px tall) shrinks the hero headline, page titles and hero padding.
- **Coupon pop-up:** at most the screen height, and scrolls on screens under 640 px tall. At 667×375 its button used to be cut off.
- **Large screens:** `.page` is wider on 2xl screens (`max-w-7xl`), and the base font is 112.5% from 2200 px.

## Follow-up — full website copy pass (2026-10-16)
Client: all website content written like a professional human copywriter.
- **Database, through the admin API:**
  - 8 stores: intro, an About section (how to use a code, ways to save, a tip), and SEO fields.
  - 10 coupons: sentence-case titles with real descriptions; no more "… Terms apply.".
  - Descriptions for all 13 categories, and "Travil" renamed to "Travel" (slug `travel`).
  - The `seo` settings group is filled; home hero and slide copy tightened.
  - Blog SEO titles no longer repeat the site name.
  - Test stores "Demo Code List Store" and "The Loaded Tea Shop" set to **Inactive** (hidden, not deleted).
- **Website copy:**
  - `StaticPages.tsx` rewritten: About, Contact, Terms, Privacy (matches what is really stored: offer clicks, a one-way visitor code, ratings, emails, server logs, session and local storage) and Affiliate disclosure. Dated October 16, 2026.
  - Home sections, footer and empty/error states reworded.
  - Claims we can't promise removed ("checked this week", "updated every day", reply times).
  - "No code required" in sentence case; the store sidebar reads "Similar stores"; singular "1 store".
  - 5xx errors show a friendly message.
  - `index.html`, the site.tsx fallback and `SiteSettings::DEFAULTS` share the same headline and description.
- **DemoSeeder:** uses the new coupon copy, and creates blogs with `firstOrCreate` so a re-seed can't overwrite written articles.

## Follow-up — blog articles + article editor (2026-10-16)
- All 5 posts now have full articles (about 460 to 720 words), a short description and SEO title/description/keywords,
  saved through the admin API. The Nike post is still a Draft. Content is evergreen shopping advice with no invented prices.
- Admin blog editor: `src/components/ArticleEditor.tsx` has a formatting toolbar (heading, sub-heading, bold, italic,
  link, bullet list, numbered list, quote/tip), shortcuts Ctrl+B/I/K, undo-safe edits, Write/Preview tabs with a
  site-like preview, and a word count with reading time. The short description shows a 300-character guide.
- Formatting is plain text (no HTML stored or rendered): `##`/`###` headings, `- ` bullets, `1. ` steps, `> ` tip,
  `**bold**`, `*italic*`, `[text](/path or https://)`. Website `src/components/RichText.tsx` renders the same rules; links to site pages go
  through the router and external links open in a new tab; any other link target stays plain text.

## Follow-up — editable home hero (2026-10-16)
Client: hero editable, with images. Admin → Settings → **Homepage** (admin only): headline, sub-text, search placeholder,
background image, up to 3 banner slides (image, title, sub-title, button text, link).
- Settings group `homepage` (`SiteSettings::DEFAULTS`); images on the public disk under `homepage/`, uploaded by
  `POST admin/settings/homepage/images` (jpg/png/webp, 4 MB) and referenced by path when the group is saved; paths must
  exist under `homepage/`; links are `/path` or http(s) only. Replaced/removed images are deleted on save. Activity log
  shows slides as a count and the image as set/none. `GET admin/settings` has `meta.homepage_image_urls` for previews.
- Public settings: `homepage` with `hero_image_url` and slide `image_url` (no disk paths).
- Website: background photo under a dark gradient; `HeroSlider` (6 s autoplay, pauses on hover/focus, none with reduced
  motion, arrows + dots, internal links via router, external in new tab); ticket pile when there are no slides; store
  logos in Popular chips and at `sm` size on coupon rows.
- Local content photos (free Unsplash License, set through the admin API): hero background (shopper with bags), slides Beauty week at Sephora / Tech deals / Fashion finds (→ /categories/fashion), and featured images on all 4 blog posts. Swap for the client's own photos in the admin any time.

## Follow-up — website UI upgrade (2026-10-16)
Client: website "more advanced, more attractive, fully professional". User picked: evolve the current coupon-ticket
brand; store page keeps its healthinfolife structure. Presentation only: no API, route, SEO or click-out changes.
Plan: `~/.claude/plans/client-rquiremnt-wesite-side-witty-llama.md`.
- `index.css`: tokens `ink-deep`, `marigold-deep`; `.band-dark` (dot-grid dark band), `.panel`, `.badge`,
  `.btn-marigold`, `.chip-dark`, `.skeleton`, `.stub-edge` (serrated stub), `.perforation-stack` (mobile tear line,
  now opt-in), `.perforation-h` (pop-up); keyframes `settle` (hero tickets) and `tear` (pop-up).
- `CouponTicket`: tear-off stub with the offer figure (`TicketStub`, marigold = code, green = deal), Verified /
  Exclusive badges, "Show coupon code" button with a dashed code "peel".
- Home: dark hero with three real featured tickets dropping in, stats strip (totals from `meta.total` of
  `public/coupons?per_page=1` / `public/stores?per_page=1`), category tiles with icons (`lib/categoryIcon.tsx`,
  keyword → lucide icon), top-store logo wall, how-it-works cards, closing search band.
- Shared `PageHeader`, ticket/card skeletons, new Empty/Error/404; header with marigold active tab + category
  mega-menu; dark footer; mobile menu sheet; store page banner (logo, offers/codes/verified/rating chips, sticky
  sidebar); code pop-up as a ticket with a "Copied" state.
- `stubFigure`: a dollar amount counts only when "off" follows it ("Free Shipping Over $20" → Free shipping).
- `index.html` meta description no longer mentions buying codes by card.
- Blog redesign (same day, client: blog page "not showing" = the menu said Guides): menu label back to **Blog**; list page with topic chips (icons), search, lead story (admin `is_featured` pick, else newest) + Latest articles grid, closing code search; posts without a photo get a generated cover (`BlogCover`: topic colour + icon + ticket shapes); article page with centred header (topic, author, date, reading time), wide cover, sticky sidebar (Find a code, Keep reading), share buttons (copy link, X, Facebook), More guides. `categoryIcon` also knows deals/tips/e-commerce/retail.

## Follow-up — code lists + commission profit (2026-10-15)
Plan: `~/.claude/plans/i-want-to-vistoer-shiny-teacup.md`. Client: each click gets the next code of a list; a visitor
may take several (refresh keeps the same code, "Get another code" takes the next) up to a daily limit; profit =
order amount × commission %, added when the admin confirms the sale.
- **Migration** `2026_10_16_100000_add_code_lists_and_commission`:
  - coupons: `unique_codes`, `max_codes_per_visitor` (default 5, 0 = no limit), `commission_percent`.
  - stores: `commission_percent`.
  - redemptions: `claim_token` (sha256, unique per coupon), `visitor_hash` (HMAC IP+UA), `commission_percent`.
  - new table `coupon_codes` (coupon_id, code, redemption_id unique, assigned_at).
- **Code list = usage limit:** `usage_limit` = number of codes, `uses_count` = handed out (`Coupon::syncCodeCounts`).
  Existing rules (hidden when used up, "X left", 80% alert, sort by %) apply unchanged.
- **`ClickOut::claim(coupon, token, visitor, user)`** replaces `record()`:
  - idempotent per token, so `/go` and `/reveal` can race;
  - the daily limit per visitor_hash is checked over the last 24 h;
  - code assignment is a conditional update (no double hand-out); a unique-token race is caught.
  - `/api/go/{id}?t=` and `public/coupons/{id}/reveal?t=` both call it; reveal returns `code` + `limit_reached`.
  - Shared-code coupons behave as before. Public JSON has `code_list`, never list codes.
- **Admin API:**
  - `admin/coupons/{coupon}/codes`: GET for all staff; POST (paste or CSV) and DELETE of free codes for admin+editor.
  - `PATCH admin/redemptions/{id}` (Confirm sale; admin+editor): {status Used|Failed|Pending, order_value $}. The rate is
    the coupon override, else the store's; it is copied onto the redemption. Logged as `sale_confirmed`.
  - Summary: `conversion_rate`. Dashboard kpis: `sales_30d`, `profit_30d_cents`. Analytics: `profit_by_store`.
    CSV: Date, Coupon uses, Sales, Profit.
  - `reset-uses` is refused for code lists (add codes instead).
- **`redemptions:expire`** (daily 03:15): Clicked older than 30 days → Expired.
- **Admin UI** (helper agent):
  - store Commission %; coupon Code delivery (shared / code list), max per visitor/day, Commission %;
  - Codes card (`components/CouponCodes.tsx`: add, upload, Free/Used list, delete free);
  - Redemptions: Confirm/Edit sale modal, Rate + Profit columns, Profit Earned + Conversion cards;
  - Dashboard: Profit/Sales (30 days) cards. Analytics: Profit by Store table.
- **Website:** `lib/out.ts` tokens (`newClaimToken`, `latestToken`, `rememberToken`, sessionStorage `cf_claim_{id}`);
  each row click is a new token; the pop-up has "Get another code" and the limit message; rows show "N codes left".
- **Local DB:** migrated after a dump (`storage/app/backups/coupon_follow-before-code-lists.sql`).
  - Demo left from the browser test: store "Demo Code List Store" (8%) with coupon #14 (3 codes, all handed out;
    DEMO-0001 confirmed at $150 → $12.00).
  - Coupon #13 (an earlier test run) is in Trash.

## Follow-up — paid coupons removed from backend and admin (2026-10-15)
User: "remove paid from admin and backend". The product is now a free coupon/deal site; only staff sign in.
- **Deleted (backend):** Stripe webhook route/controller/handler, `CheckoutService`, `StockReservation`,
  `OrderFulfillment`, `CouponCodePool`, `stripe:check` + `orders:reconcile` commands (and the schedule entry),
  `Order`/`OrderItem`/`CouponCode`/`StripeEvent` models, `OrderStatus`, `OrderResource`, `OrderPaidMail` + view,
  Admin `OrderController`/`CouponCodeController`, Customer `OrderController`, `OrderFactory`, `FakeStripeHttpClient`,
  tests `CheckoutTest`/`StripeSetupCheckTest`/`UniqueCodesTest`/`ShopSwitchTest`; `stripe/stripe-php` (composer
  remove); `services.stripe` config; `STRIPE_*`/`STORE_CURRENCY` from `.env.example` and the production template.
- **Accounts:** `auth/register`, email verification routes and `MustVerifyEmail` removed; login refuses non-staff
  (same "Incorrect email or password."); forgot-password only mails staff; reset links always open the admin;
  profile email change no longer sends a confirmation link. `Role::Customer` stays so old rows still load.
- **Coupons:** `price_cents`, `stock`, `unique_codes` gone (model, request, admin + public resources, filters, sorts);
  "Coupon Code" type still needs a code. Public JSON no longer has `is_paid`/`price_cents`/`currency`/`in_stock`;
  public settings no longer have `currency`/`shop_enabled`.
- **Dashboard/analytics:** kpis = total_stores, active_coupons, total_coupons, total_redemptions; no sales, top
  stores, recent orders; CSV export = Date, Coupon uses. Trash purges everything (no "kept because of orders").
- **Settings:** `general.shop_enabled` and `notifications.error_alerts` (only payment problems used it) removed;
  settings index has no `meta.currency`.
- **Migration** `2026_10_15_100000_drop_paid_coupons`: drops `coupon_codes`, `order_items`, `orders`,
  `stripe_events`; deletes coupons with `price_cents > 0` (redemptions keep their rows, coupon link nulled); drops the
  three columns; strips the two retired setting keys. down() restores the schema only. Run on the local DB
  2026-10-15 after a dump to `storage/app/backups/coupon_follow-before-drop-paid.sql` (gitignored); local now has
  10 coupons, the two demo paid ones are gone.
- **Admin** (`../Coupon_Flow_Dashbaord`): Orders page + route + sidebar, `CodePool.tsx`, coupon form Pricing and
  Code pool cards, paid column/filter/drawer rows, dashboard sales/orders widgets, analytics Sales view, Settings
  currency block and Problem Alerts toggle, trash "kept" handling, refund/money wording all removed. Support Email
  input no longer warns when the stored value is null.
- **Seed data:** no test customer and no paid demo coupons any more. The test email
  (`tauseefchoohan0401@gmail.com`) is still used by staff fixtures in tests.
- **Website:** store page Offer JSON-LD has no price; `currency` left in `SiteSettings` type + fallback (edit
  blocked by the permission classifier; see TODO).

## Follow-up — cart removed from the website (2026-10-15)
User: "website side not need add to cart, remove this feature".
- **Website** (`../Coupon_Flow_Website`): no cart, checkout, sign-in, account or orders pages any more, and no
  shop branches anywhere. `App.tsx` has no `ShopOnly`/auth/cart/purchases providers; old paths (`/cart`, `/login`,
  `/register`, password pages, `/verify-email`, `/checkout/*`, `/account/*`, `/refund-policy`) redirect home.
  `CouponTicket` has one action (Show coupon code / Get deal); header has no cart icon or account menu; footer,
  home, coupons filters (no free/exclusive chips, no price sort) and info pages carry only the free-site wording;
  Refund policy page dropped (and from sitemap/pre-render). `SiteSettings` no longer has `shop_enabled`/`ready`.
- Shop files deleted at the user's request (Cart, Checkout, Auth, Account, Orders pages; cart/purchases/auth stores;
  OrderCodes). `lib/api.ts` is now public-only (no bearer token, no `put`/`getAbsolute`); `User`/`Order*` types,
  `Coupon.is_paid` and `money()` removed. `price_cents`/`currency`/`in_stock` stay for the store page Offer JSON-LD.
- **Admin**: Settings → General "Sell Exclusive Codes" toggle removed; coupon form warns that paid coupons never show on
  the website. Local DB: `general.shop_enabled` set **off** via the admin API (default is off anyway).
- **Backend unchanged**: Stripe/orders/checkout code and the `shop_enabled` setting stay (tests use `enableShop()`);
  with the setting off, paid coupons are hidden from every public endpoint and `POST checkout` is 403.

## Follow-up — brand feeds, usage limits, deal windows, secure staff admin (2026-10-06)
Plan: `~/.claude/plans/make-sephora-nike-best-lazy-petal.md`. User choices: brand data by feed/CSV (no brand login),
usage limit + % used (hide at 0), exact date+time window, and 2FA + staff roles + activity log + usage dashboard.
- **Staff roles** (`Role`: admin / editor / viewer / customer). `EnsureRole` takes several roles. Admin routes:
  every GET → all staff; catalogue writes, feed run/import, reset uses, trash restore → admin+editor; settings PUT,
  refunds, trash empty/permanent delete, staff, activity log, feed source CRUD → admin. `users.disabled_at`
  (switched-off staff can't sign in; tokens deleted), `last_login_at`. `Admin/StaffController`: add (emails a
  set-password link via the reset flow), change role, switch off/on, resend link, reset 2FA; can't demote or switch
  off yourself or the last admin. Reset links + AdminActivity alerts go to staff (alerts: admin + editor).
- **Two-step login** (`pragmarx/google2fa` + `bacon/bacon-qr-code`, `App\Services\TwoFactor`): encrypted secret,
  10 hashed one-use recovery codes, `two_factor_last_step` stops replays (verifyKeyNewer with 0, not null, so a
  first code also records its step). Login returns `{two_factor, challenge}` (cache, 5 min, 5 wrong codes burn it)
  → `POST auth/two-factor`. Setup/confirm/recovery-codes/disable under `auth/two-factor`. Settings → Security
  `require_two_factor` (default off) + middleware `two_factor` → 403 `two_factor_setup_required` → admin shows a
  setup-only screen.
- **Activity log** (`activity_logs`, `App\Services\Audit`, `LogsActivity` trait on Store/Coupon/Blog/Category/
  FeedSource): create/update diff/delete/restore/permanent delete by staff or System; explicit entries for sign-in,
  failed sign-in, logout, 2FA events, profile, staff changes, settings (diff), refunds, ratings, uses reset, feed runs
  (one summary per run). Secrets masked. Shopper side effects not logged. Pruned after 365 days (`model:prune` daily).
  Admin page Settings → Activity Log (filters + diff drawer).
- **Deal window**: `coupons.starts_at/expires_at` are DATETIME (UTC). Mutators read a bare date as the whole day and
  "YYYY-MM-DD HH:mm" as store-local time (Settings → General timezone). Migration converted old dates (start 00:00,
  end 23:59:59 local). `Coupon::live()` / `publiclyVisible()` use `now()`; `state()` = draft/inactive/scheduled/ended/
  used_up/live. Admin form: datetime-local inputs + quick picks; resource sends `*_local`.
- **Usage limit**: `usage_limit` (null = unlimited) + `uses_count` (back-filled from redemptions). `ClickOut::record`
  increments atomically only while under the limit; else no click and `/go` goes back to the store page. Used-up
  coupons are hidden, but `reveal` ignores the limit so the shopper who took the last use still gets the code
  (found in the browser test). One alert at 80% and one at 100% (`redemption_alerts`). Admin: limit field, usage bar,
  sort by % used, "80% or more" filter, Reset uses. Website: "Used N times · X left" + bar; "Ends in 5h 20m" in the
  last 24 h; times shown in the store timezone (public settings expose `timezone`).
- **Brand feeds** (`feed_sources`, `FeedImporter`, `feeds:sync` every 15 min): json_url / csv_url / csv_upload,
  optional Bearer API key (encrypted), default store, frequency, auto-publish (else Draft), switch off coupons that
  leave a URL feed (never on an empty feed). Feed format v1 (ours; downloadable CSV template). Upsert by
  (source, external_id); admin-edited coupons are kept (`imported_hash`); deleted ones are not re-created; unknown
  stores created Draft when `store_url` is given. https only, no private IPs, no redirects, 5 MB / 5,000 rows. Runs
  in `sync_runs` with per-row errors. The old single "vendor" settings group was removed.
- **Admin UI**: role-aware sidebar + route guards (viewer: no create/edit/bulk; editor: no settings/staff/log), only
  401 signs out (403 = toast), Login code step + recovery code, My Account 2FA card, Security/Staff/Activity Log
  pages, Brand Feeds page (IntegrationsPage.tsx), Sync History with source filter + skipped rows, Coupons list with
  state badges / usage bars / deal window / source filter / "Imported · review", Dashboard rebuilt around usage
  (uses KPIs + chart, most-used, nearly used up, ending soon, starting soon, feed health, activity; sales only when
  the shop is on), Analytics with a Coupon uses / Sales switch and uses in the CSV export.
- Fixed on the way: creating a store or blog without `status` returned 500 (DB default not read back).
- Demo data: fake sync runs removed; "Demo Brand (CSV upload)" feed; Amazon 20% has a 500-use limit; the CSV
  template's "The Loaded Tea Shop" store + 2 coupons were imported in the browser test and left live as demo.
- Demo paid coupons (2026-10-07, `DemoSeeder::seedPaidCoupons`): Nike "Exclusive: Extra 25% Off Nike Members Sale"
  $2.99 and Sephora "Exclusive: $20 Off $75 at Sephora" $1.99, unique-code pools `NIKEX25-0001..0010` /
  `SEPH20-0001..0010`. Re-running the seeder keeps stock and skips existing codes. They only show on the site while
  "Sell Exclusive Codes" is on (the seeder leaves that setting alone; default off).
- Local DB: #11/#12 above were first created via the admin API (2026-10-06) with 10 random codes each; the seeder
  hasn't been re-run there, so a re-seed would add the 10 numbered codes on top. Shop switch off since 2026-10-15.

## Follow-up — simple coupon site: shop switch, one row layout, #coupon_code pop-up (2026-10-05)
Client: no cart / checkout / sign-in anywhere; every coupon is "Show coupon code" or "Get deal" → store opens in a new
tab → this page shows the pop-up (reference URL `…/promotions/at/{store}#coupon_code-{id}`).
- **Shop switch:** Settings → General → "Sell Exclusive Codes" (`general.shop_enabled`, default **off**). Off:
  `Coupon::scopePubliclyVisible` excludes paid coupons, so every public list, count, search, sitemap, reveal and
  `/go` hides them; `POST checkout` returns 403. Public settings expose `shop_enabled`. On: the earlier shop works
  unchanged. Stripe/orders/admin code all kept; nothing deleted.
- **Website with the shop off:** no cart icon, account menu or sign-in; `/cart`, `/login`, `/register`, password
  pages, `/checkout/*`, `/account*` redirect home (`ShopOnly` in `App.tsx`, waits for settings via `useSite().ready`).
  Footer, home hero/strip/"How it works", coupons filters (no free/exclusive chips or price sort) and the About,
  Contact, Terms, Privacy and Affiliate pages drop all paid wording; Refund policy is hidden from the footer.
- **One row layout everywhere** (`components/CouponTicket.tsx`, default export): store logo, store name as plain text
  (not a link), title, description, "Expires …", Verified, "Used N times", and SHOW COUPON CODE / GET DEAL. Logo, title
  and button all click out. Used on home, coupons, category and store pages (store page's own row removed).
  `used_count` now also on the coupons list and category page.
- **Pop-up URL:** `#coupon_code-{id}` (row `id` too), helpers in `lib/out.ts`; old `?c={id}` links still open it.
- Admin coupon form warns when a paid coupon is saved while the shop is off.

## Follow-up — store page in the healthinfolife.com layout (2026-10-05)
- Client sent a screenshot of healthinfolife.com/promotions/at/the-loaded-tea-shop. Store page (`src/pages/StorePage.tsx`)
  now matches it: logo + VIEW STORE (`/api/go/store/{slug}`) on the left, H1 "{Store} Coupons & Promo Codes" + intro
  (store description, then heading), coupon rows (small logo, title, description, "Expires Mon D, YYYY", "Used N times",
  SHOW COUPON CODE / GET DEAL), and a "Top Stores" logo grid (same-category stores). Logo, title and button in a row all
  open the store via `/api/go/{id}` in a new tab and add `?c={id}` here (shared `useClickOut` in CouponTicket.tsx).
- Pop-up: store name, logo, title, the code as a big click-to-copy button with "Click To Copy and Paste Code At Checkout",
  or "No Code Required" for deals.
- **Decision:** store pages show free codes and deals only, no cart or checkout (client: "not need checkout"). Paid
  coupons are still sold from /coupons, home and category pages. Stores with only paid coupons show the empty state.
- API: `Coupon::redemptions()`; `GET public/stores/{slug}` adds `used_count` (all clicks/redemptions for the coupon);
  other lists leave it out.
- **Star rating (same day):** "Rate {Store}" box above Top Stores: five clickable stars, then "Average rating: X of 5"
  with filled stars and "(N votes)". No sign-in. `POST public/stores/{slug}/rating {rating:1-5}` (throttle `ratings`,
  10/min/IP), table `store_ratings` (unique store_id + voter). Voter = HMAC(app key) of the user id, or of IP + user
  agent for guests; raw IP never stored. Voting again changes the vote (upsert). `GET public/stores/{slug}` carries
  `data.rating {average|null, count}`; lists don't. The browser remembers "You rated N" in localStorage (`cf_rated_{slug}`).
  **Admin (same day):** stores list has a sortable Rating column (`ratings_avg_rating`), the View drawer a Visitor
  Rating row, and the store edit page a "Visitor Rating" card (`src/components/StoreRatings.tsx`): average, per-star
  bars (click to filter), votes table (signed-in voters by name + email, guests as "Guest", "(changed)" for re-votes),
  remove one vote, and "Reset rating" (confirm modal; bell notification to admins). API under
  `admin/stores/{store}/ratings`: GET (paginated, `?rating=`), GET `summary`, DELETE (reset), DELETE `{rating}`
  (scoped to the store). `store_ratings.user_id` (nullable) records signed-in voters.
  Not done: no AggregateRating JSON-LD (Google ignores self-hosted ratings for
  stores and can treat them as spammy markup).

## Follow-up — /promotions/at/{slug} store alias (2026-10-03)
- Same store page as `/stores/{slug}` (route in `src/App.tsx`), matching the reference site's URL shape.
  Canonical and `og:url` always point at `/stores/{slug}` (`usePageMeta` `canonicalPath`), and the sitemap
  lists only `/stores/...`, so search engines see one page.
- `public/.htaccess` serves `_prerender/stores/{slug}.html` for `/promotions/at/{slug}` (trailing slash and
  `?c=` fine); unknown slugs fall to the app's "not found".
- The admin's copied/opened share link is now `VITE_SITE_URL/promotions/at/{slug}`.

## Follow-up — shareable store links and the click-out code pop-up (2026-10-03)
Client request, modelled on healthinfolife.com/promotions/at/{store}. Plan:
`~/.claude/plans/client-rquirment-as-per-breezy-galaxy.md`.
- **Store link:** each store's public URL is `/stores/{slug}` (kept; already pre-rendered and in the sitemap).
  The admin store form shows the full link live as the slug/name is typed, with Copy and Open. The stores list
  has "Copy link" and "View on site", and the slug under the name copies the link. The admin needs
  `VITE_SITE_URL` (production build refuses to run without it; `build-release.sh` passes `SITE_URL`).
  Duplicate now uses the CopyPlus icon.
- **Click-out:** "Show code" / "Get deal" opens `API/api/go/{id}` in a new tab (records a Clicked redemption,
  302 to coupon tracking → store tracking → store direct URL, `no-store` + `noindex`), and the current tab adds
  `?c={id}`, which opens the code pop-up (`CouponRevealModal`, mounted in `Layout`, native `<dialog>`). The code
  is fetched from `GET public/coupons/{id}/reveal` (free code only, no click logged). `?c=` survives refresh
  and can be shared; Esc/backdrop/X close it and drop the param; dead ids show a toast. "Visit store" uses
  `api/go/store/{slug}`. Dead `/go` links redirect back to the site (store page, `/stores` or home).
- **No merchant links on the site:** public JSON no longer has store `direct_url`/`tracking_url` (admin
  routes still do) or coupon `tracking_url`/`code` (new `has_code` flag). Verified: zero merchant hosts or
  codes in `dist/_prerender`, zero external hrefs on the store page.
- `ClickOut` service holds URL resolution + click logging; the old `POST public/coupons/{id}/click` reuses it
  and stays one release for cached bundles (delete after the next deploy). Removed from the website:
  `clickOut()` blank-tab trick, inline code reveal, `cf_revealed` sessionStorage, the merchant `<a href>`.
- Store H1 now reads "{Store} Coupons & Promo Codes".

## Follow-up — pre-rendered categories list and static pages (2026-10-01)
- `/categories` and the six static pages (about, contact, refund-policy, terms, privacy, affiliate-disclosure) added to
  `FIXED`. Every URL in the sitemap (29 locally) is now pre-rendered. Cart, sign-in and account pages stay app-only
  (per-visitor, noindex). No new .htaccess rule needed (these pages ignore query strings).

## Follow-up — pre-rendered coupons and blog lists (2026-10-01)
- `/coupons` and `/blog` added to `FIXED` in `scripts/prerender.mjs`; the `.htaccess` query-string guard now covers
  `/(stores|coupons|blog)`, so filtered views (`?kind=`, `?category=`, `?page=`) go to the app.

## Follow-up — pre-rendered home and stores list (2026-10-01)
- `/` and `/stores` are pre-rendered too (`dist/_prerender/index.html`, `stores.html`). The script no longer lists
  API paths: `peekPreload` records requests a server render couldn't answer (`recordMisses`), the script fetches
  them (one fetch per path per build) and renders again until nothing is missing. So every page now also embeds
  the header's category list, which earlier snapshots left empty.
- `.htaccess`: `RewriteRule ^# Project State — Coupon Follow

_Last updated: 2026-10-01_

## Overall roadmap
| Phase | Scope | Status |
|---|---|---|
| 0 | React admin cleaned + SiteGround-ready static build (`../Coupon_Flow_Dashbaord`) | ✅ Done |
| 1 | Laravel backend + Stripe (this repo) | ✅ Done |
| 2 | React admin wired to this API | ✅ Done |
| 3 | Public website (`../Coupon_Flow_Website`) | ✅ Done — see below |
| 4 | Payments go-live (Stripe test keys → real card test, live keys, go-live checklist) | ✅ Test mode fully verified incl. webhooks + 3DS; live keys at go-live (Phase 5) |
| 5 | Audit fixes, public site redesign, full test, SiteGround deploy | 🟡 Code, tests and release packaging done; live upload waits on user inputs (see TODO) |

 serves the home snapshot; `/stores` uses its snapshot only without a query string
  (`?letter=`, `?sort=` etc. go to the app, which fetches that view). Query strings on other pages (e.g. utm) are fine.

## Follow-up — pre-rendered category and article pages (2026-10-01)
- `scripts/prerender.mjs` now works from a `ROUTES` table: stores, categories (`/categories/{slug}`) and articles
  (`/blog/{slug}`), every slug listed by `GET /public/sitemap`, written to `dist/_prerender/{stores,categories,blog}/`.
  The existing `.htaccess` rule serves them unchanged. Articles get `og:type=article` and Article JSON-LD.

## Follow-up — pre-rendered store pages (2026-10-01)
- Website build now also runs `vite build --ssr src/entry-server.tsx` and `scripts/prerender.mjs`: every active
  store from the live API becomes `dist/_prerender/stores/{slug}.html` with the full page markup, its own
  title/description/canonical/Open Graph/JSON-LD, and the API data it was rendered from.
- `public/.htaccess` serves that file at `/stores/{slug}` (the raw `/_prerender/...` path is a 404, so no
  duplicate URLs). Everything else is unchanged SPA routing.
- In the browser the app mounts over it (not hydration: cart, sign-in and purchases are browser-only and could
  never match the build's HTML). `useApi`/`SiteProvider` start from the embedded data, so there is no spinner,
  then refetch, so a stale snapshot corrects itself. `usePageMeta` builds tags once (`src/lib/head.ts`) for both
  the browser and the build; `siteOrigin()` replaces render-time `window.location` so pages render on the server.
- API down at build time: build still succeeds, store pages render in the browser only (warned in the output).
- Operational: snapshots are build-time; rebuild + re-upload the website after adding/renaming stores and once the
  API is live on the first release (DEPLOY.md step 5.4).

## Follow-up — unique code per buyer (2026-10-01)
- A paid coupon can now be sold as **"Same code for every buyer"** (as before) or **"Unique code per buyer"**
  (`coupons.unique_codes`, new `coupon_codes` table). Pool coupons have no shared code.
- Stock for a pool coupon always equals unsold codes minus codes held by open checkouts, so checkout's
  reservation, expiry and release are unchanged. `CouponCodePool::assign` picks the specific code during
  fulfilment (webhook or reconcile), and `code_snapshot` stores it, so orders, email and the website work unchanged.
- Pool ran dry (only when a payment lands after its checkout expired and the last code sold meanwhile): the order is
  still marked paid, admins get an error alert, the shopper sees "your code is on its way" (`code_pending`), and
  the next codes added go to waiting orders first and are emailed.
- Admin API: `GET/POST admin/coupons/{coupon}/codes` (list with sold/unsold filter + search; add up to 5,000 per
  request, blank and duplicate codes skipped case-insensitively), `DELETE .../codes/{code}` (unsold only; refused
  while every unsold code is held by a checkout). Switching delivery mode is refused while a checkout is open.
  Admin coupon search also matches pool codes. Duplicating a pool coupon starts with an empty pool.
- Admin UI: "Code delivery" choice under Pricing, "Available to buy" count, Code pool card (paste or import .txt/.csv,
  sold/unsold list linking to the order, remove unsold). Orders drawer flags a paid line waiting for a code.
- Decisions: a sold code is never reused, even after a refund (the buyer has seen it). One purchase per shopper per
  coupon still applies to pool coupons.
- Fixed on the way: creating a coupon without `status` returned 500 (DB default wasn't read back).
- Demo data: Best Buy "$50 Off $250+" is a pool coupon with codes BBY50-0001..0010.

## Follow-up — already-bought coupons (2026-10-01)
- API: `GET /api/v1/purchases` (customer) → `[{coupon_id, order_id}]` for the shopper's **paid** orders only
  (refunded/pending don't count, matching the checkout's already-bought rule).
- Website: `src/store/purchases.tsx` loads it for signed-in shoppers and refreshes after a payment is confirmed.
  Paid tickets show "Bought · view code" (links to the order) instead of "Add to cart", even when sold out;
  the cart marks bought lines "Already yours" and blocks checkout until they're removed. Display only: the
  server still refuses repeat purchases.

## Phase 5 — delivered (2026-09-30)
Full audit of all three apps, then:
- **Backend fixes:** paid coupons require a code (partial updates too); no buying an already-bought coupon;
  retrying checkout expires the old Stripe session and returns its stock; max 2 open checkouts per shopper;
  checkout needs a confirmed email (signed link opens the website `/verify-email`, which calls the API);
  email change re-requires confirmation; password change signs out other devices; Sanctum tokens expire
  after 7 days; trusted proxies + `Storage::url` for https image links; scheduler locks expire (10/5 min);
  reconcile skips when Stripe isn't configured; amount mismatch alerts admins; settings survive a rotated
  APP_KEY; public routes throttled (120/min, clicks 30/min); LIKE wildcards escaped, `q` capped at 100;
  Stripe idempotency keys include the order's creation time (a DB reset reused `checkout-order-1` and
  Stripe rejected it: found in the browser run); admin sees stock held by open checkouts.
- **Saved settings now used:** `SiteSettings` service; `GET public/settings` (site name, support email,
  SEO); timezone drives coupon expiry; notification switches send admin emails (`AdminAlertMail`, queued);
  store currency shown read-only (it comes from `STORE_CURRENCY`).
- **Seeding:** `AdminSeeder` (production-safe, `ADMIN_EMAIL`/`ADMIN_PASSWORD` via config) + `DemoSeeder`
  (local only). Plain `db:seed` in production creates only the admin.
- **New public API:** search suggestions, category page, sitemap feed, related stores/posts, store letter
  filter, coupon `order`/`verified`, lighter blog list, `POST public/coupons/{id}/click` (records a
  redemption, new `redemptions.coupon_id` column). Redemptions page now shows real clicks.
- **Admin:** searchable store picker (no 100-store cap), error boundary for lazy pages, bulk actions report
  partial failures, image size check + remove saved image, clearing a blog date publishes now, support email
  setting, 403 on admin routes signs out, build refuses to run without `VITE_API_URL`, no SPA rewrite
  (hash routing), labels linked to inputs, Figma leftovers removed.
- **Public site redesign:** search with live suggestions, categories menu and pages, trust strip, category
  tiles, exclusive-codes band, stores A to Z with letter index and sort, store page with breadcrumbs, sidebar
  and similar stores, coupon filters (type radios, category, sort, verified), numbered pagination,
  tracked free-code reveal (kept revealed per session), cart re-checks availability and handles email
  confirmation, account page (profile, password, email status), receipt-style order page, blog search,
  headings/lists in posts, related posts, About/Contact/Refund/Terms/Privacy/Affiliate pages, per-page
  canonical/OG/Twitter/noindex/JSON-LD, sitemap.xml + robots.txt at build, share image + icons + manifest,
  WCAG AA grey, HTTPS/HSTS `.htaccess`.
- **Deploy kit:** `deploy/build-release.sh` (api/admin/website zips), `deploy/env.production.example`,
  `deploy/DEPLOY.md` (step-by-step SiteGround + go-live checklist). Trial build verified: no `.env`, no dev
  packages, correct API URL baked in.

## Phase 4 — delivered (payments go-live)
- `php artisan stripe:check`: go-live checklist. Checks key type/mode (refuses live keys locally and test keys in production), webhook secret, currency, and a real API call; lists webhook endpoints and flags missing events; in production also requires HTTPS URLs, `APP_DEBUG=false` and a real mailer. Exits 1 on problems.
- Webhook now handles `charge.dispute.created`: alerts admins in the bell with the order number.
- Dedicated Stripe sandbox created with the Stripe CLI (profile `coupon-follow`, account `acct_1UKyOGL0q2MmqIR2`, testing email). Expires 2026-10-06 unless claimed.
- Writing the key into `.env` was blocked by the agent permission classifier, so the user pastes the keys in (README → Stripe (test mode)).
- 2026-09-30 real test-mode run with the user's own test key (`sk_test_…`, account `acct_…UL6Zc`, pasted into `.env`): 4242 purchase → Stripe Checkout → success page → codes; email; real refund; declined card; cancel → session expired → stock released. Webhook delivery itself not exercised (no `whsec_`): fulfilment/expiry went through `orders:reconcile`, which reads the same session from Stripe.
- Fix found by the real run: a refund that Stripe reports `succeeded` now marks the order refunded immediately (`OrderFulfillment::refunded`), so a missed `charge.refunded` webhook can no longer leave a refunded order showing "paid"; the webhook is then a no-op.
- Webhook run (same day): `stripe listen --api-key … --events <six>` (CLI now requires `--events`), `whsec_` in `.env`, `stripe:check` → "Payments are ready." 4242 purchase fulfilled by `checkout.session.completed` alone (codes ~2s after redirect); refund → `charge.refunded` delivered and recorded as a no-op; 3-D Secure card 4000 0027 6000 3184 → challenge approved → fulfilled.
- README: test runbook (test cards incl. 3DS / decline / dispute) and a "Going live" checklist.

## Phase 3 — delivered (public website)
- New app `../Coupon_Flow_Website`: React 19 + Vite 8 + Tailwind 4 + React Router 7 with real paths.
- Pages: home, coupons (search / free vs exclusive / category, URL-driven), stores, store page,
  blog + article, cart, checkout success (polls until webhook marks paid) and cancel, My orders,
  order detail, sign in / create account / forgot + reset password, 404.
- Coupons drawn as tickets (stub + perforation); free codes reveal + copy + open the store's
  tracking link; paid codes go to a cart kept in the browser; server re-checks at checkout.
- Backend additions: `POST /orders/{id}/cancel` (expires the Stripe session so reserved stock is
  released immediately), with tests; cancel works without Stripe keys for closed orders.

## Decisions / assumptions
- Paid coupons: one shared code with an optional stock limit, or a unique code per buyer from a pool (stock = unsold codes).
- Buying requires a shopper account; admin accounts are refused on the public site.
- SPA with real paths; every sitemap URL is pre-rendered at build time (full HTML + meta). Filtered list
  views and the per-visitor pages (cart, sign-in, account, checkout) stay client-rendered.
- API is snake_case; both frontends use the API types directly.
