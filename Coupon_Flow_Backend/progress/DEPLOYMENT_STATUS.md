# Deployment Status

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
