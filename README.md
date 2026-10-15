# Coupon-Flow

Coupon Follow: a coupon and deals site with an admin dashboard and a Laravel API.

| Folder | What it is | Stack |
|---|---|---|
| `Coupon_Flow_Backend/` | REST API (`/api/v1`), click-outs, brand feeds, staff roles + two-step login | Laravel 12, MySQL/MariaDB, Sanctum |
| `Coupon_Flow_Dashbaord/` | Admin dashboard | React 19, Vite, Tailwind CSS 4 |
| `Coupon_Flow_Website/` | Public coupon site (pre-rendered for SEO) | React 19, Vite, Tailwind CSS 4, React Router |

Project status, open items and test notes live in `Coupon_Flow_Backend/progress/`. Deployment steps are in
`Coupon_Flow_Backend/deploy/DEPLOY.md`.

## Local setup

Requirements: PHP 8.2+, Composer, MySQL or MariaDB, Node.js 22 (pnpm via `npx pnpm@10.34.3`).

1. **API** (`Coupon_Flow_Backend`, port 8000)

   ```bash
   cp .env.example .env        # set DB_*, ADMIN_EMAIL, ADMIN_PASSWORD
   composer install
   php artisan key:generate
   php artisan migrate --seed
   php artisan serve --port=8000
   ```

2. **Admin** (`Coupon_Flow_Dashbaord`, port 8443; must match `ADMIN_URL` in the API `.env`)

   ```bash
   cp .env.example .env
   npx pnpm@10.34.3 install
   npx vite --host 127.0.0.1 --port 8443
   ```

3. **Website** (`Coupon_Flow_Website`, port 5173; must match `FRONTEND_URL` in the API `.env`)

   ```bash
   cp .env.example .env
   npx pnpm@10.34.3 install
   npx pnpm@10.34.3 dev
   ```

Tests: `php artisan test` in `Coupon_Flow_Backend`.

Never commit `.env` files: they hold the database and mail passwords and `APP_KEY`.
