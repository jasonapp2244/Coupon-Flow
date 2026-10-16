#!/usr/bin/env bash
# One-go CloudPanel deploy for Coupon Follow: API, admin (/admin) and website (/) on one domain.
# Layout and steps: deploy/DEPLOY-CLOUDPANEL.md.
#
# Run as root on the server, in the folder where the bundle was unpacked:
#   tar xzf coupon-follow-cloudpanel.tar.gz && bash deploy.sh couponhub.example.com
#
#   First run   installs: backs up the site folder, unpacks the three apps, asks for the database
#               (and creates it with clpctl if you want), writes .env, imports the content from
#               the PC (or --fresh: empty database + first admin), caches, cron, Nginx Vhost.
#   Later runs  update: maintenance mode, database + code backup, new code (keeps .env, storage
#               and the database), migrations, caches, back online.
#
# Options: --fresh   first install with an empty database and a new admin instead of content.sql
set -euo pipefail

DOMAIN="${1:?Usage: bash deploy.sh <domain> [--fresh]}"
FRESH=0; [[ "${2:-}" == "--fresh" ]] && FRESH=1
HERE="$(cd "$(dirname "$0")" && pwd)"

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mxx  %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root."
SITE_DIR="$(ls -d /home/*/htdocs/"$DOMAIN" 2>/dev/null | head -1 || true)"
[[ -n "$SITE_DIR" ]] || die "No /home/*/htdocs/$DOMAIN. Create the PHP site in CloudPanel first."
SITE_USER="$(stat -c %U "$SITE_DIR")"
PHP="$(command -v php8.3 || command -v php8.2 || command -v php || true)"
[[ -n "$PHP" ]] || die "PHP not found."
"$PHP" -r 'exit(PHP_VERSION_ID >= 80200 ? 0 : 1);' || die "$PHP is older than 8.2."
"$PHP" -m | grep -qi '^zip$' || die "$PHP has no zip extension (apt install ${PHP##*/}-zip)."
for f in api.zip admin.zip website.zip storage.zip; do [[ -f "$HERE/$f" ]] || die "Missing $f next to deploy.sh."; done
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/root/coupon-follow-backups/$STAMP"
VHOST="/etc/nginx/sites-enabled/$DOMAIN.conf"
mkdir -p "$BACKUP_DIR"

as_site() { sudo -u "$SITE_USER" -H bash -c "cd '$SITE_DIR' && $*"; }
artisan() { as_site "'$PHP' artisan $*"; }
unzip_to() {
  mkdir -p "$2"
  "$PHP" -r '$z = new ZipArchive; if ($z->open($argv[1]) !== true || !$z->extractTo($argv[2])) { fwrite(STDERR, "Cannot unpack $argv[1]\n"); exit(1); } $z->close();' "$1" "$2"
}
# DB_* values from .env, for mysql/mysqldump in update mode.
env_get() { "$PHP" -r 'foreach (file($argv[1]) as $l) if (preg_match("/^".$argv[2]."=(.*)$/", trim($l), $m)) { echo trim($m[1], "\"'\''"); break; }' "$SITE_DIR/.env" "$1"; }
ensure_dirs() {
  mkdir -p "$SITE_DIR"/storage/{app/public,framework/{cache/data,sessions,views,testing},logs} "$SITE_DIR/bootstrap/cache"
  # Nginx now serves public/, but CloudPanel's Let's Encrypt renewal writes its challenge files to
  # the site folder's .well-known: link it so certificates keep renewing.
  mkdir -p "$SITE_DIR/.well-known"
  [[ -e "$SITE_DIR/public/.well-known" ]] || ln -s ../.well-known "$SITE_DIR/public/.well-known"
  chown -R "$SITE_USER:$SITE_USER" "$SITE_DIR"
  chmod -R ug+rwX "$SITE_DIR/storage" "$SITE_DIR/bootstrap/cache"
}
caches() { artisan config:cache; artisan route:cache; artisan view:cache; }

health() {
  say "Checking the live site (from this server)"
  local ok=1 path code
  for path in / /stores /admin/ /api/v1/public/settings /robots.txt /_prerender/index.html; do
    code="$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN$path" || echo 000)"
    if [[ "$path" == /_prerender/* ]]; then [[ "$code" == 404 ]] && r=OK || { r="expected 404"; ok=0; }
    else [[ "$code" == 200 ]] && r=OK || { r=CHECK; ok=0; }; fi
    printf '  %-28s %s  %s\n' "$path" "$code" "$r"
  done
  [[ $ok == 1 ]] || warn "Some checks failed. Is the SSL certificate issued and the Vhost applied?"
}

apply_vhost() {
  say "Nginx Vhost"
  [[ -f "$VHOST" ]] || { warn "$VHOST not found: apply step 6 of DEPLOY-CLOUDPANEL.md in Site → Vhost."; return; }
  command -v python3 >/dev/null || { warn "python3 missing: apply step 6 of DEPLOY-CLOUDPANEL.md by hand."; return; }
  cp "$VHOST" "$BACKUP_DIR/vhost-before.conf"
  if python3 "$HERE/patch-vhost.py" "$VHOST" "$SITE_DIR" "$BACKUP_DIR/vhost-block.conf"; then
    if nginx -t 2>/dev/null; then
      systemctl reload nginx
      cp "$VHOST" "$BACKUP_DIR/vhost-applied.conf"
      echo "  Applied. Copy for CloudPanel's editor: $BACKUP_DIR/vhost-applied.conf"
    else
      cp "$BACKUP_DIR/vhost-before.conf" "$VHOST"
      warn "nginx -t failed; the old Vhost was put back. Apply step 6 by hand (block: $BACKUP_DIR/vhost-block.conf)."
    fi
  else
    warn "Vhost left unchanged. Apply step 6 by hand (block: $BACKUP_DIR/vhost-block.conf)."
  fi
}

# ════════════════════════════════════════ UPDATE ════════════════════════════════════════
if [[ -f "$SITE_DIR/.env" ]]; then
  say "Updating $DOMAIN ($SITE_DIR, user $SITE_USER). Backups: $BACKUP_DIR"
  artisan down --retry=30 || true
  DB_NAME="$(env_get DB_DATABASE)"; DB_USER="$(env_get DB_USERNAME)"
  MYSQL_PWD="$(env_get DB_PASSWORD)" mysqldump -h 127.0.0.1 -u "$DB_USER" --single-transaction --no-tablespaces "$DB_NAME" | gzip > "$BACKUP_DIR/database.sql.gz"
  tar czf "$BACKUP_DIR/code.tar.gz" -C "$SITE_DIR" --exclude=./storage --exclude=./public/storage .
  echo "  Database and code backed up."

  NEW="$(mktemp -d)"
  unzip_to "$HERE/api.zip" "$NEW"
  if command -v rsync >/dev/null; then
    # Removes files the new release dropped; .env, uploads and the two front ends are left alone.
    rsync -a --delete \
      --exclude=/.env --exclude=/storage/ --exclude=/public/storage --exclude=/public/admin/ \
      --exclude=/website/ --exclude=/.well-known/ --exclude=/public/.well-known "$NEW/" "$SITE_DIR/"
  else
    rm -rf "$NEW/storage" && cp -a "$NEW/." "$SITE_DIR/"
  fi
  rm -rf "$NEW" "$SITE_DIR/public/admin" "$SITE_DIR/website"
  unzip_to "$HERE/admin.zip" "$SITE_DIR/public/admin"
  unzip_to "$HERE/website.zip" "$SITE_DIR/website"
  ensure_dirs
  artisan migrate --force
  caches
  artisan queue:restart || true
  artisan up
  health
  printf '\nRollback: restore %s/code.tar.gz and import %s/database.sql.gz\n' "$BACKUP_DIR" "$BACKUP_DIR"
  exit 0
fi

# ════════════════════════════════════════ INSTALL ═══════════════════════════════════════
say "First install of $DOMAIN into $SITE_DIR (user $SITE_USER). Backups: $BACKUP_DIR"
[[ $FRESH == 1 || -f "$HERE/content.sql" ]] || die "Missing content.sql (or run with --fresh)."

tar czf "$BACKUP_DIR/site-before.tar.gz" -C "$SITE_DIR" .
other="$(find "$SITE_DIR" -mindepth 1 -maxdepth 1 ! -name index.php ! -name .well-known -printf '%f ' )"
if [[ -n "$other" ]]; then
  warn "$SITE_DIR also contains: $other"
  read -rp "Delete everything there (a backup was saved)? [y/N] " a; [[ "$a" == [yY] ]] || die "Stopped; nothing changed."
fi
find "$SITE_DIR" -mindepth 1 -maxdepth 1 ! -name .well-known -exec rm -rf {} +

say "Unpacking the API, admin and website"
unzip_to "$HERE/api.zip" "$SITE_DIR"
unzip_to "$HERE/admin.zip" "$SITE_DIR/public/admin"
unzip_to "$HERE/website.zip" "$SITE_DIR/website"
unzip_to "$HERE/storage.zip" "$SITE_DIR/storage/app/public"
ensure_dirs

say "Database"
read -rp  "  Database name: " DB_NAME
read -rp  "  Database user: " DB_USER
read -rsp "  Database password: " DB_PASS; echo
read -rp  "  Create this database and user now with clpctl? (No if you already made it in CloudPanel) [y/N] " mk
if [[ "$mk" == [yY] ]]; then
  clpctl db:add --domainName="$DOMAIN" --databaseName="$DB_NAME" --databaseUserName="$DB_USER" --databaseUserPassword="$DB_PASS"
fi
MYSQL_PWD="$DB_PASS" mysql -h 127.0.0.1 -u "$DB_USER" "$DB_NAME" -e 'SELECT 1' >/dev/null || die "Cannot connect to $DB_NAME as $DB_USER."
tables="$(MYSQL_PWD="$DB_PASS" mysql -h 127.0.0.1 -u "$DB_USER" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'")"
[[ "$tables" == 0 ]] || die "Database $DB_NAME already has $tables tables. Use an empty database."

say "Email (staff invites, password resets, alerts)"
read -rp "  SMTP host (leave empty to only log emails for now): " MAIL_HOST
MAIL_PORT=465; MAIL_USER=""; MAIL_PASS=""; MAIL_FROM="noreply@$DOMAIN"
if [[ -n "$MAIL_HOST" ]]; then
  read -rp  "  SMTP port [465]: " p; MAIL_PORT="${p:-465}"
  read -rp  "  SMTP username: " MAIL_USER
  read -rsp "  SMTP password: " MAIL_PASS; echo
  read -rp  "  From address [$MAIL_FROM]: " p; MAIL_FROM="${p:-$MAIL_FROM}"
fi

# Sets KEY=value lines in .env from SET_KEY variables passed in the environment.
write_env() {
  "$PHP" -r '
    $file = $argv[1]; $env = file_get_contents($file);
    foreach (getenv() as $name => $value) {
        if (strncmp($name, "SET_", 4) !== 0) continue;
        $key = substr($name, 4);
        // Plain values as they are; anything else quoted so .env reads it back exactly.
        if (preg_match("/^[A-Za-z0-9_.:\/@+-]*$/", $value)) $out = $value;
        elseif (strpos($value, "\x27") === false) $out = "\x27".$value."\x27";
        else $out = "\"".strtr($value, ["\\" => "\\\\", "\"" => "\\\"", "\$" => "\\\$"])."\"";
        $line = "$key=$out";
        $pattern = "/^".preg_quote($key, "/")."=.*$/m";
        $env = preg_match($pattern, $env) ? preg_replace_callback($pattern, fn () => $line, $env) : rtrim($env)."\n$line\n";
    }
    file_put_contents($file, $env);' "$SITE_DIR/.env"
}

say "Writing .env"
cp "$SITE_DIR/.env.example" "$SITE_DIR/.env"
SET_APP_URL="https://$DOMAIN" SET_FRONTEND_URL="https://$DOMAIN" SET_ADMIN_URL="https://$DOMAIN/admin" \
SET_DB_HOST=127.0.0.1 SET_DB_DATABASE="$DB_NAME" SET_DB_USERNAME="$DB_USER" SET_DB_PASSWORD="$DB_PASS" \
SET_MAIL_MAILER="$([[ -n "$MAIL_HOST" ]] && echo smtp || echo log)" SET_MAIL_SCHEME="$([[ "$MAIL_PORT" == 465 ]] && echo smtps || echo smtp)" \
SET_MAIL_HOST="${MAIL_HOST:-127.0.0.1}" SET_MAIL_PORT="$MAIL_PORT" SET_MAIL_USERNAME="$MAIL_USER" SET_MAIL_PASSWORD="$MAIL_PASS" \
SET_MAIL_FROM_ADDRESS="$MAIL_FROM" SET_ADMIN_EMAIL="" SET_ADMIN_PASSWORD="" write_env
chown "$SITE_USER:$SITE_USER" "$SITE_DIR/.env"; chmod 640 "$SITE_DIR/.env"
artisan key:generate --force

if [[ $FRESH == 1 ]]; then
  say "Creating the tables"
else
  say "Importing the catalogue (stores, coupons, categories, blogs, settings)"
  MYSQL_PWD="$DB_PASS" mysql -h 127.0.0.1 -u "$DB_USER" "$DB_NAME" < "$HERE/content.sql"
fi
artisan migrate --force

users="$(MYSQL_PWD="$DB_PASS" mysql -h 127.0.0.1 -u "$DB_USER" -N "$DB_NAME" -e 'SELECT COUNT(*) FROM users')"
if [[ "$users" == 0 ]]; then
  say "First admin account (signs in at https://$DOMAIN/admin/)"
  read -rp  "  Admin email: " ADMIN_MAIL
  while :; do
    read -rsp "  Admin password (12+ characters): " ADMIN_PASS; echo
    [[ ${#ADMIN_PASS} -ge 12 ]] && break; warn "Use at least 12 characters."
  done
  SET_ADMIN_EMAIL="$ADMIN_MAIL" SET_ADMIN_PASSWORD="$ADMIN_PASS" write_env
  artisan db:seed --class=AdminSeeder --force
  # The account exists now; don't keep its password in plain text.
  SET_ADMIN_PASSWORD="" write_env
fi

say "Storage link, caches, cron"
artisan storage:link
caches
CRON="* * * * * $PHP $SITE_DIR/artisan schedule:run >> /dev/null 2>&1"
( crontab -u "$SITE_USER" -l 2>/dev/null | grep -vF "$SITE_DIR/artisan schedule:run" || true; echo "$CRON" ) | crontab -u "$SITE_USER" -
echo "  Cron: $CRON"

apply_vhost
health

cat <<EOF

Done. Open https://$DOMAIN/ and https://$DOMAIN/admin/
Sign in with the admin account, then turn on two-step login (My Account) and
Settings → Security → Require two-step login.
Backups of this run: $BACKUP_DIR
EOF
