# Coupon Follow Backend — agent notes

Laravel 12 API (PHP 8.2) for `../Coupon_Flow_Dashbaord` (React admin) and the planned public site.
Read `progress/PROJECT_STATE.md` first; update the `progress/` files at the end of every session.

## Facts
- DB: MariaDB via XAMPP, database `coupon_follow`. Start MySQL: `F:\xampp\mysql\bin\mysqld.exe --defaults-file=F:\xampp\mysql\bin\my.ini --standalone`
- Tests use in-memory SQLite (`phpunit.xml`); Stripe is faked with `tests/Support/FakeStripeHttpClient.php` — never hit real Stripe in tests.
- Enum string values (`Active`, `Coupon Code`, …) intentionally match the React dashboard's labels.
- Money = integer cents. `price_cents = 0` → free coupon (code public); `> 0` → paid (code only on paid orders).
- Fulfilment happens **only** in the webhook (`StripeWebhookHandler`/`OrderFulfillment`), never on the success page.
- Stripe: `StripeClient` singleton from `AppServiceProvider`; no `payment_method_types`; API version pinned in config.
- Test account for any browser/manual testing: `tauseefchoohan0401@gmail.com` only.

## Verify before reporting done
`php artisan test` · `vendor/bin/pint --test app database routes tests config` · `php artisan route:list --path=api` when routes change.

## Rules
- No commits/pushes unless the user asks in that message. No live deploys.
- Never weaken: code hiding for paid coupons, webhook signature check, stock reservation, idempotency.
