# Deployment Status

## 2026-10-26 — Urban Goods Guide release ready (not deployed)
- `deploy/release/api.zip` (7.8 MB), `admin.zip`, `website.zip` were built for `API_URL=https://api.urbangoodsguide.com`,
  `SITE_URL=https://urbangoodsguide.com` (SiteGround layout in DEPLOY.md). Rebuild if other addresses are used.
- No new migrations. New command `staff:create`. Live `.env` needs the mail keys from `env.production.example` plus the
  mailbox password, and `APP_NAME="Urban Goods Guide"` (that change signs everyone out once).
- The user deploys; nothing was uploaded or pushed from this session.

| Target | Status |
|---|---|
| Backend API | Local only (`php artisan serve` on 8000, MariaDB `coupon_follow`). Not deployed. |
| React admin | Local dev `npx vite` on 8443 (= `ADMIN_URL`). Not deployed — see `../Coupon_Flow_Dashbaord/DEPLOY-SITEGROUND.md`. |
| Public website | Local dev `pnpm dev` on 5173 (= `FRONTEND_URL`). Not deployed — see `../Coupon_Flow_Website/README.md`. |
| Stripe | Local: user's test key + `stripe listen` webhook secret in `.env`; `stripe:check` passes; full test-mode flow verified. Production: needs live restricted key + Dashboard webhook endpoint (six events). |
| Email | `MAIL_MAILER=log` locally; needs real SMTP for production. |

New since 2026-10-03: the admin build needs `VITE_SITE_URL` (passed from `SITE_URL` by `build-release.sh`), and
the website's coupon buttons depend on the API's `/api/go` routes, so deploy the API before or with the website.

New since 2026-10-06: four migrations (staff security on users, activity_logs, coupon deal window as DATETIME +
usage limit, feed_sources) run by the normal `php artisan migrate --force`; the coupon migration converts existing
dates in the store timezone, so back up the DB first. Two new composer packages (pragmarx/google2fa,
bacon/bacon-qr-code) ship via `build-release.sh`'s `composer install`. The existing `schedule:run` cron now also runs
`feeds:sync` (every 15 min) and `model:prune` (daily). DEPLOY.md §3.5 and §6 updated (2FA, staff, brand feeds,
optional nightly website rebuild).

New since 2026-10-05 (shop switch): the site launches as a free coupon site ("Sell Exclusive Codes" off). With it off,
Stripe keys/webhook are not needed to go live; set them only before switching it on. Rebuild + re-upload the website
after flipping the switch so the pre-rendered pages match.

Also new since 2026-10-05: migration `create_store_ratings_table` (covered by the normal `php artisan migrate --force`
step) and `POST public/stores/{slug}/rating`; the store page's rating box needs that API release too. The admin's
ratings card and Rating column need the `admin/stores/{store}/ratings` routes from the same API release.

Deploy kit ready: `deploy/DEPLOY.md` (step by step), `deploy/build-release.sh` (builds api/admin/website zips), `deploy/env.production.example`. Nothing uploaded yet: waiting for domains, SiteGround access, DB, SMTP, live Stripe keys and the go-ahead.

## 2026-10-16 — CloudPanel option
One-site CloudPanel layout (API /api, admin /admin, website /) documented in `deploy/DEPLOY-CLOUDPANEL.md`. Not yet run on a server.

## 2026-10-17 — CloudPanel one-go deploy kit

**Update 2026-10-17 (hand-over):** live is installed at couponhub.devonlinetestserver.com (with the old demo
catalogue). Clean-up is `git-deploy.sh … main --reset-content` (see DEPLOY-CLOUDPANEL.md, "Hand-over reset");
new installs are empty; `deploy/content/` is no longer in the repo. Certificate still self-signed.
Target: `couponhub.devonlinetestserver.com` (site user `devonlinetestserver-couponhub`; the site folder only had CloudPanel's `index.php`).

**Kit:**
- `deploy/build-cloudpanel.sh` builds one bundle on the PC.
- `deploy/cloudpanel/deploy.sh` installs it on the server (later runs update), and `deploy/cloudpanel/patch-vhost.py` patches the Nginx Vhost.

**Built:** `deploy/release/coupon-follow-cloudpanel.tar.gz` (9.4 MB, git-ignored).

**Checked locally:**
- `content.sql` imports cleanly into an empty database: 22 tables, 10 stores, 12 coupons, 0 uses, 0 clicks, admin only, 16 migrations.
- The Vhost patcher works on CloudPanel's PHP template, and running it twice gives the same file.

**Not yet run on the server.** The website must be rebuilt once the API is live, so its pages are pre-rendered.

**Git-based deploy (2026-10-17, later):**
- **Server:** `deploy/cloudpanel/git-deploy.sh <domain>` pulls the private repo with a read-only deploy key (`/root/.ssh/coupon_follow_deploy`). It installs Composer/Node if missing, builds, runs `deploy.sh`, and on the first install builds the website again against the live API.
- **Content:** the catalogue is in the repo at `deploy/content/` (no user accounts; the first install asks for the admin). Refresh it with `deploy/export-content.sh`.
- **Auto-deploy:** `.github/workflows/deploy.yml` redeploys on every push to `main`. It stays off until the `DEPLOY_HOST` and `DEPLOY_SSH_KEY` secrets are added.
- **Status:** not yet run on the server.
