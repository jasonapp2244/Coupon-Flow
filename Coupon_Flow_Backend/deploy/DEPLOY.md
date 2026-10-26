# Deploying Urban Goods Guide to SiteGround

Three parts, three addresses (examples):

| Part | Address | SiteGround document root |
|---|---|---|
| API (Laravel) | `https://api.example.com` | `~/www/api.example.com/app/public` (the rest of the app stays outside the web root) |
| Admin dashboard | `https://admin.example.com` | `~/www/admin.example.com/public_html` |
| Public website | `https://example.com` | `~/www/example.com/public_html` |

For urbangoodsguide.com (hosted on SiteGround): `api.urbangoodsguide.com`, `admin.urbangoodsguide.com`
and `urbangoodsguide.com`. Build with
`API_URL=https://api.urbangoodsguide.com SITE_URL=https://urbangoodsguide.com bash deploy/build-release.sh`.

The website must be at a domain root (it uses real paths like `/stores/nike`). The admin works from
any folder or subdomain.

## 0. Before you start
- A mailbox the API sends from, e.g. `noreply@example.com` (Site Tools > Email > Accounts). It sends
  staff invitations, password-reset links and admin alerts. Urban Goods Guide uses
  `info@urbangoodsguide.com`: `MAIL_HOST=urbangoodsguide.com` (not `mail.…`: the certificate only covers the
  bare domain), port 465, `MAIL_SCHEME=smtps`, the mailbox password in `MAIL_PASSWORD` (quoted). Verified
  sending on 2026-10-26.
- PHP 8.2 or newer for the API site (Site Tools > Devs > PHP Manager).

## 1. Build the uploads (on your computer)
```bash
cd F:/React_project/Coupon_Flow_Backend
API_URL=https://api.example.com SITE_URL=https://example.com bash deploy/build-release.sh
```
This writes `deploy/release/api.zip`, `admin.zip` and `website.zip`. Both frontends are built for
those exact addresses, so rebuild whenever an address changes. The admin gets `SITE_URL` too
(`VITE_SITE_URL`): it is the base of the store links admins copy and share (`SITE_URL/promotions/at/{slug}`,
the same page as `/stores/{slug}`, which stays the canonical URL).
Coupon and "Visit store" buttons on the website open `API_URL/api/go/...`, which records the click
and redirects to the merchant, so merchant links never appear on the site.

## 2. Create the sites and database
1. Site Tools > Domain: add `api.` and `admin.` subdomains (or parked domains).
2. Site Tools > Security > SSL Manager: install Let's Encrypt on all three; enable **HTTPS Enforce**.
3. Site Tools > Site > MySQL: create a database and user, give the user all privileges.

## 3. API
1. Upload `api.zip` to `~/www/api.example.com/` and extract it into a folder named `app`.
2. Point the subdomain's document root at `app/public` (Site Tools > Domain > Subdomains > edit).
3. Create `app/.env` from `app/.env.example` (the production template) and fill every `<…>` value.
4. Over SSH (Site Tools > Devs > SSH Keys), in `~/www/api.example.com/app`:
   ```bash
   php artisan key:generate --force
   php artisan migrate --force
   php artisan db:seed --class=AdminSeeder --force
   php artisan storage:link
   php artisan config:cache && php artisan route:cache
   ```
   This only creates the first account, as **super admin**. (A plain `db:seed` does the same in production:
   the demo catalogue is skipped when `APP_ENV=production`.)
   Then create (or update) the staff accounts; without `--password` a strong password is printed once,
   and `--invite` emails a set-password link instead:
   ```bash
   php artisan staff:create faizan@urbangoodsguide.com --name="Faizan" --role=super_admin
   php artisan staff:create kabir@urbangoodsguide.com --name="Kabir" --role=admin
   ```
   Roles: **super_admin** (everything, and the only role that can add or change super admins),
   **admin** (everything else: settings, staff, activity log), **editor** (catalogue), **viewer** (read-only).
   Moving an existing install with demo data to an empty hand-over state:
   `php artisan content:reset --keep-admin=faizan@urbangoodsguide.com --force` (back up the database first;
   it removes every other account too, so run `staff:create` for the others afterwards).
5. Cron (Site Tools > Devs > Cron Jobs), every minute:
   ```
   /usr/local/bin/php /home/<user>/www/api.example.com/app/artisan schedule:run >> /dev/null 2>&1
   ```
   Use the PHP path SiteGround shows in the Cron Jobs page. This sends queued emails every minute,
   runs brand feeds that are due (each feed has
   its own hourly / 6-hourly / daily schedule), and prunes activity-log entries older than a year.
   Coupon deal windows and usage limits need no cron: they are checked on every request.
   Optional but recommended: rebuild and re-upload the website nightly (or after big imports) so the
   pre-rendered pages search engines read don't list coupons whose window has ended. Shoppers always
   see the live list: the page refreshes it on load, and expired or used-up links are refused.
6. Open `https://api.example.com`: it should answer `{"status":"ok",…}`.

## 4. Admin dashboard and website
1. Upload `admin.zip` into the admin site's `public_html` and extract (it includes `.htaccess`).
2. Upload `website.zip` into the main site's `public_html` and extract (includes `.htaccess`,
   `sitemap.xml`, `robots.txt`).
3. Site Tools > Speed > Caching: purge the cache after every upload so the new `index.html` is served.
4. Every page in the sitemap (home, the list pages, the static pages and every store, category and article) is pre-rendered at build
   time from the live API (full HTML and meta tags for search engines and link previews, in
   `_prerender/`). The build prints `prerender: 1 home, 1 stores list, 1 coupons list, 1 blog list, 1 categories list, 5 static, N store, N category, N article
   pages written`; if it says the API wasn't
   reachable (normal on the very first release, before the API is live), rebuild and re-upload
   `website.zip` once the API answers at `API_URL`. The pages are a snapshot: visitors always see live
   data (the app refreshes on load), but rebuild and re-upload the website after adding or renaming
   stores or categories, publishing articles, or changing the site name or support email in Settings,
   so search engines see them too.

## 5. First login and settings
1. Sign in at `https://admin.example.com` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (or the super admin from
   `staff:create`), then under
   Settings > My Account change the password and **turn on two-step login** (authenticator app;
   save the recovery codes somewhere safe).
2. Settings > General: site name, **support email** (shown on the Contact page)
   and timezone (coupon start and end times are entered and shown in this timezone).
3. Settings > SEO: default title and description.
4. Settings > Staff: add editors (catalogue only) and viewers (read-only). Each gets an email to set
   their own password. Then Settings > Security > **Require two-step login** for everyone.
5. Brand Feeds: add each brand that sends coupons (feed URL or CSV uploads; download the CSV
   template there to send them). Imported coupons arrive as Draft unless the feed auto-publishes.
6. Add stores, categories and coupons. A "Coupon Code" coupon needs its code; deals don't.

## 6. Go-live check
- [ ] `.env` has `APP_ENV=production`, `APP_DEBUG=false`, `https://` addresses and a real mailer (not `log`).
- [ ] Add a staff member in Settings > Staff; the set-password email arrives in a real inbox.
- [ ] Reveal a code on the website: the store opens in a new tab, the code pop-up shows here, and
      the click appears in Admin > Redemptions.
- [ ] Old links such as `https://example.com/cart` land on the home page.
- [ ] Submit `https://example.com/sitemap.xml` in Google Search Console.

## Updating later
Rebuild with `build-release.sh`, upload the changed zip, then for the API:
`php artisan migrate --force && php artisan config:cache && php artisan route:cache`.
Purge the SiteGround cache after frontend uploads.
