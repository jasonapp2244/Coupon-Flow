# Coupon Follow — Backend API

Laravel 12 REST API for the Coupon Follow admin dashboard (`../Coupon_Flow_Dashbaord`) and the
upcoming public coupon website. Customers buy **paid coupons** with credit/debit cards through
**Stripe Checkout**; free coupons show their code publicly.

## Local setup

Requirements: PHP 8.2+, Composer, MySQL/MariaDB (XAMPP works).

```bash
composer install
cp .env.example .env && php artisan key:generate
# .env: DB_DATABASE=coupon_follow, ADMIN_PASSWORD=<choose one>
php artisan migrate --seed
php artisan storage:link
php artisan serve                      # http://127.0.0.1:8000
```

Seeded accounts: `admin@couponfollow.com` / `ADMIN_PASSWORD`; local only: customer
`tauseefchoohan0401@gmail.com` / `Customer1234`.

Tests (in-memory SQLite, Stripe faked at the HTTP layer — no keys needed): `php artisan test`

## Stripe (test mode)

A dedicated Stripe sandbox for this project exists in the Stripe CLI profile `coupon-follow`
(created 2026-09-30, **expires 2026-10-06 unless claimed**:
`npx @stripe/cli sandbox claim --project-name coupon-follow` adds it to your Stripe account).

1. `STRIPE_SECRET`: that sandbox's test key (Dashboard → Developers → API keys after claiming it),
   or your own restricted key (`rk_test_…`) with write access to Checkout Sessions and Refunds.
   Read access to Webhook Endpoints lets `stripe:check` verify the subscribed events.
2. In a second terminal:
   `npx @stripe/cli listen --api-key <STRIPE_SECRET> --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded,charge.dispute.created --forward-to 127.0.0.1:8000/api/stripe/webhook`
   (the CLI now requires `--events`)
   → copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`, then `php artisan config:clear`.
3. `php artisan stripe:check`: it must end with "Payments are ready."
4. On the public site, buy a paid coupon with `4242 4242 4242 4242`, any future date, any CVC.
   Also worth trying: `4000 0027 6000 3184` (3-D Secure), `4000 0000 0000 9995` (declined),
   `4000 0000 0000 0259` (paid, then disputed → alert in the admin bell).
5. `php artisan queue:work --stop-when-empty` sends the order email (written to the log locally).

Webhook events used: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`,
`charge.dispute.created`.

## Going live

1. Confirm the business country is supported by Stripe and activate the account (bank, identity).
2. Create a **live** restricted key with the same permissions → `STRIPE_SECRET` on the server.
3. Dashboard → Developers → Webhooks → add `https://<api-domain>/api/stripe/webhook` with the six
   events above; its signing secret → `STRIPE_WEBHOOK_SECRET`.
4. Real SMTP in `MAIL_*` (a SiteGround mailbox works), `APP_DEBUG=false`, HTTPS URLs.
5. `php artisan config:cache && php artisan stripe:check` on the server. In production it refuses
   test keys, `http://` URLs, the log mailer and debug mode, and checks the webhook's events.
6. Make one real purchase of a low-priced coupon, then refund it from the admin Orders page.

### How a purchase works

1. `POST /api/v1/checkout` — locks the coupons, checks they are live, paid and in stock, **reserves
   stock**, creates a `pending` order and a Stripe Checkout Session (prices from the DB only).
2. Customer pays on Stripe's hosted page → redirected to `FRONTEND_URL/checkout/success?session_id=…`.
3. Webhook (signature-verified, idempotent via `stripe_events`) marks the order `paid`, copies the codes
   onto the order and queues the "your coupon codes" email. Expired/failed sessions release the stock.
4. `orders:reconcile` (every 15 min) settles pending orders whose webhook was missed.
5. Admin refund → Stripe refund → `charge.refunded` webhook marks the order `refunded` and hides the codes.

## API overview (`/api/v1`, JSON, `Authorization: Bearer <token>`)

| Area | Endpoints |
|---|---|
| Auth | `POST auth/login`, `POST auth/register`, `POST auth/logout`, `GET auth/me`, `PUT auth/profile`, `POST auth/forgot-password`, `POST auth/reset-password`, `GET auth/email/verify/{id}/{hash}` (signed link), `POST auth/email/resend` |
| Public (120/min per IP) | `GET public/settings`, `public/search?q=`, `public/sitemap`, `public/categories?type=store\|blog`, `public/categories/{slug}`, `public/stores` (`letter`, `category`, `sort`), `public/stores/{slug}` (+ `related`), `public/coupons` (`order=ending_soon\|newest\|price`, `verified`, `paid`), `public/coupons/{id}`, `POST public/coupons/{id}/click` (records a redemption, returns the store link), `public/blogs` (no body), `public/blogs/{slug}` (+ `related`) |
| Customer | `POST checkout` `{coupon_ids: []}` (needs a confirmed email; refuses already-bought coupons; max 2 open checkouts), `GET orders`, `GET orders/{id}`, `GET orders/session/{sessionId}`, `POST orders/{id}/cancel` |
| Admin | `stores`, `coupons`, `blogs` (CRUD + `PATCH …/{id}/status`, `POST …/{id}/duplicate`), `categories`, `trash` (list / restore / purge / empty), `orders` (+ `POST orders/{id}/refund`), `dashboard`, `analytics`, `analytics/export` (CSV), `redemptions`, `sync-runs`, `notifications`, `settings/{general\|seo\|notifications\|vendor}` |
| Stripe | `POST /api/stripe/webhook` |

List endpoints accept `q`, filters, `sort`, `dir`, `per_page` (max 100). Money is integer cents.
Full list: `php artisan route:list --path=api`.

## Production (SiteGround)

Step-by-step guide: [`deploy/DEPLOY.md`](deploy/DEPLOY.md). Build all three uploads with
`API_URL=https://api.example.com SITE_URL=https://example.com bash deploy/build-release.sh`.
Production `.env` template: `deploy/env.production.example`.

### Notes

- Upload the project **outside** `public_html`; point the API (sub)domain's document root to `public/`.
- `.env`: `APP_ENV=production`, `APP_DEBUG=false`, live DB, `FRONTEND_URL`, `ADMIN_URL`, live Stripe keys.
- `php artisan migrate --force && php artisan config:cache && php artisan route:cache`
- Cron (Site Tools → Devs → Cron Jobs): `* * * * * php /home/<user>/<app>/artisan schedule:run`
  — this also drains the mail queue (no long-running worker needed).
- Register the webhook endpoint `https://<api-domain>/api/stripe/webhook` in the Stripe Dashboard.
