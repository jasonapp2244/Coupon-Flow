# Coupon Follow Backend — agent notes

Laravel 12 API (PHP 8.2) for `../Coupon_Flow_Dashbaord` (React admin) and the planned public site.
Read `progress/PROJECT_STATE.md` first; update the `progress/` files at the end of every session.

## Facts
- DB: MariaDB via XAMPP, database `coupon_follow`. Start MySQL: `F:\xampp\mysql\bin\mysqld.exe --defaults-file=F:\xampp\mysql\bin\my.ini --standalone`
- Tests use in-memory SQLite (`phpunit.xml`).
- Enum string values (`Active`, `Coupon Code`, …) intentionally match the React dashboard's labels.
- Free coupons and deals only: selling exclusive codes (Stripe, orders, code pools, shopper accounts) was removed
  on 2026-10-15 (migration `2026_10_15_100000_drop_paid_coupons`). Only staff sign in.
- Public JSON never carries a code or merchant link: codes come from `reveal` after the click-out through `/api/go`.
- Test account for any browser/manual testing: `tauseefchoohan0401@gmail.com` only.

## Verify before reporting done
`php artisan test` · `vendor/bin/pint --test app database routes tests config` · `php artisan route:list --path=api` when routes change.

## Rules
- No commits/pushes unless the user asks in that message. No live deploys.
- Never weaken: code and merchant-link hiding in public JSON, atomic usage-limit counting in `ClickOut::record`.
