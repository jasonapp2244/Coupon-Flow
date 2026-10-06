#!/usr/bin/env bash
# Builds the three SiteGround uploads into deploy/release/:
#   api.zip     Laravel API (production dependencies only, no .env, no tests)
#   admin.zip   admin dashboard static build
#   website.zip public website static build (+ sitemap.xml, robots.txt)
#
# Usage (from the backend folder, in Git Bash):
#   API_URL=https://api.example.com SITE_URL=https://example.com bash deploy/build-release.sh
set -euo pipefail

: "${API_URL:?Set API_URL, e.g. https://api.example.com}"
: "${SITE_URL:?Set SITE_URL, e.g. https://example.com}"
API_URL="${API_URL%/}"; SITE_URL="${SITE_URL%/}"

BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN="$BACKEND/../Coupon_Flow_Dashbaord"
WEBSITE="$BACKEND/../Coupon_Flow_Website"
OUT="$BACKEND/deploy/release"
STAGE="$OUT/.stage-api"
PNPM="npx --yes pnpm@10.34.3"

rm -rf "$OUT" && mkdir -p "$STAGE"

echo "API: copying sources"
tar -C "$BACKEND" -cf - \
  --exclude=./vendor --exclude=./node_modules --exclude=./tests --exclude=./deploy \
  --exclude=./.env --exclude=./.env.backup --exclude=./.phpunit.result.cache \
  --exclude=./public/storage --exclude='./storage/logs/*.log' --exclude='./storage/framework/sessions/*' \
  --exclude='./storage/framework/views/*' --exclude='./storage/framework/cache/data/*' \
  --exclude='./storage/app/public/*' --exclude='./database/*.sqlite' . | tar -C "$STAGE" -xf -

echo "API: installing production dependencies"
(cd "$STAGE" && composer install --no-dev --optimize-autoloader --no-interaction --quiet)
cp "$BACKEND/deploy/env.production.example" "$STAGE/.env.example"

echo "Admin: building for $API_URL/api/v1"
(cd "$ADMIN" && VITE_API_URL="$API_URL/api/v1" VITE_SITE_URL="$SITE_URL" $PNPM build >/dev/null)

echo "Website: building for $SITE_URL"
(cd "$WEBSITE" && VITE_API_URL="$API_URL/api/v1" VITE_SITE_URL="$SITE_URL" $PNPM build | grep -E "sitemap|prerender" || true)

echo "Packing"
php "$BACKEND/deploy/zip.php" "$STAGE" "$OUT/api.zip"
php "$BACKEND/deploy/zip.php" "$ADMIN/dist" "$OUT/admin.zip"
php "$BACKEND/deploy/zip.php" "$WEBSITE/dist" "$OUT/website.zip"
rm -rf "$STAGE"

echo "Done. Upload the zips as described in deploy/DEPLOY.md"
