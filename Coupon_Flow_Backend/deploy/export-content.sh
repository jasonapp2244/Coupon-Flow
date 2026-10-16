#!/usr/bin/env bash
# Exports the catalogue from the local database into deploy/content/ so a server can import it on
# its first install (git-deploy.sh / deploy.sh):
#   deploy/content/catalog.sql   stores, coupons, codes, categories, blogs, feeds, settings
#   deploy/content/storage/      uploaded images (store logos, hero, blog)
#
# Left out: user accounts (the server asks for its own admin), clicks, ratings, sign-in tokens,
# sessions, notifications, activity log, sync history and queues. Use counts start at 0, code-list
# codes are all unused, and feed API keys are blanked (they are encrypted with this PC's APP_KEY).
#
# Usage (Git Bash, from Coupon_Flow_Backend, local MySQL running):
#   bash deploy/export-content.sh
set -euo pipefail

BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$BACKEND/deploy/content"
MYSQLDUMP="${MYSQLDUMP:-/f/xampp/mysql/bin/mysqldump.exe}"
LOCAL_DB="${LOCAL_DB:-coupon_follow}"
LOCAL_DB_USER="${LOCAL_DB_USER:-root}"

SKIP=(users redemptions store_ratings personal_access_tokens sessions cache cache_locks jobs job_batches
  failed_jobs password_reset_tokens notifications activity_logs sync_runs)
IGNORE=(); for t in "${SKIP[@]}"; do IGNORE+=("--ignore-table=$LOCAL_DB.$t"); done

mkdir -p "$OUT"
{
  "$MYSQLDUMP" -u "$LOCAL_DB_USER" --no-data --skip-comments --no-tablespaces "$LOCAL_DB"
  "$MYSQLDUMP" -u "$LOCAL_DB_USER" --no-create-info --skip-comments --no-tablespaces --skip-triggers \
    --skip-extended-insert "${IGNORE[@]}" "$LOCAL_DB"
  echo "UPDATE coupon_codes SET redemption_id = NULL, assigned_at = NULL;"
  echo "UPDATE coupons SET uses_count = 0;"
  echo "UPDATE feed_sources SET api_key = NULL, last_run_at = NULL, last_status = NULL;"
} > "$OUT/catalog.sql.tmp"
[[ -s "$OUT/catalog.sql.tmp" ]] || { rm -f "$OUT/catalog.sql.tmp"; echo "Export failed (is MySQL running?)"; exit 1; }
mv "$OUT/catalog.sql.tmp" "$OUT/catalog.sql"

rm -rf "$OUT/storage" && mkdir -p "$OUT/storage"
tar -C "$BACKEND/storage/app/public" --exclude=./.gitignore -cf - . | tar -C "$OUT/storage" -xf -

printf 'Exported %s rows into deploy/content/catalog.sql and %s images into deploy/content/storage/\n' \
  "$(grep -c '^INSERT INTO' "$OUT/catalog.sql")" "$(find "$OUT/storage" -type f | wc -l)"
