# Deploying Coupon Follow Admin to SiteGround

The admin is a static React build that talks to the Laravel API in `../Coupon_Flow_Backend`
(deploy that first). The full three-part guide, with a script that builds all uploads, is
`../Coupon_Flow_Backend/deploy/DEPLOY.md`.

The build refuses to run without `VITE_API_URL`: rebuild whenever the API address changes, and purge
the SiteGround cache after uploading so the new `index.html` is served.

## 1. Build (the API URL is baked in at build time)

```bash
npx pnpm@10.34.3 install --frozen-lockfile
# Windows PowerShell: $env:VITE_API_URL="https://api.example.com/api/v1"; npx pnpm@10.34.3 build
VITE_API_URL=https://api.example.com/api/v1 npx pnpm@10.34.3 build
```

Output: `dist/` (`index.html`, `assets/`, `.htaccess`, `favicon.svg`, `robots.txt`).
For local development copy `.env.example` to `.env` (defaults to `http://127.0.0.1:8000/api/v1`).

## 2. Upload

SiteGround → Site Tools → Site → **File Manager** (or SFTP): upload the **contents** of `dist/`
to `public_html/` or any subfolder (e.g. `public_html/admin`). The app uses hash URLs
(`/#/coupons`) and relative asset paths, so no server rewrites or rebuild are needed per folder.
Make sure the hidden `.htaccess` file is uploaded too.

## 3. Connect to the API

In the backend's production `.env`, set `ADMIN_URL` to the exact admin origin
(e.g. `https://admin.example.com`) — the API only accepts browser calls (CORS) from `ADMIN_URL`
and `FRONTEND_URL`, and password-reset emails link back to `ADMIN_URL/#/reset-password`.
Then `php artisan config:cache`.

## 4. After upload

- Site Tools → Security → **SSL Manager**: Let's Encrypt + **HTTPS Enforce** (admin and API).
- Site Tools → Speed → **Caching**: purge the Dynamic Cache after every re-upload.
- Sign in with the admin account created by the backend seeder (`admin@couponfollow.com`,
  password = `ADMIN_PASSWORD` from the backend `.env`). Change it under Settings → Account.
