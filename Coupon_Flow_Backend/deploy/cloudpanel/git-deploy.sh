#!/usr/bin/env bash
# Deploys Coupon Follow on a CloudPanel server straight from GitHub: pull → build → install/update.
# API, admin (/admin) and website (/) on one domain, as in deploy/DEPLOY-CLOUDPANEL.md.
#
# Run as root:  bash git-deploy.sh <domain> [branch]
#   First run   installs (asks for the database, optional SMTP and the first admin).
#   Later runs  update the code only (backup first; .env, uploads and the database are kept).
#
# The repo is private, so the server reads it with a deploy key: /root/.ssh/coupon_follow_deploy.
# If the key is missing or not yet added on GitHub, this script creates/prints it and stops.
set -euo pipefail

# This file lives in the checkout it updates, and bash reads scripts as it runs them: run a copy.
if [[ -z "${CF_DEPLOY_COPY:-}" ]]; then
  copy="$(mktemp /tmp/git-deploy.XXXXXX.sh)"; cp "$0" "$copy"
  CF_DEPLOY_COPY=1 exec bash "$copy" "$@"
fi

DOMAIN="${1:?Usage: bash git-deploy.sh <domain> [branch]}"
BRANCH="${2:-main}"
REPO="${REPO:-git@github.com:jasonapp2244/Coupon-Flow.git}"
SRC="${SRC:-/root/coupon-follow-src}"
KEY=/root/.ssh/coupon_follow_deploy
NODE_MAJOR=20

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mxx  %s\033[0m\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "Run as root."

# ── GitHub access ────────────────────────────────────────────────────────────
command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git; }
if [[ ! -f "$KEY" ]]; then
  mkdir -p /root/.ssh && chmod 700 /root/.ssh
  ssh-keygen -q -t ed25519 -N "" -C "coupon-follow-deploy@$(hostname)" -f "$KEY"
fi
export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
if ! git ls-remote --heads "$REPO" "$BRANCH" >/dev/null 2>&1; then
  cat <<EOF

This server can't read $REPO yet. Add its deploy key on GitHub (once):
  GitHub → the repo → Settings → Deploy keys → Add deploy key
  Title: $(hostname)   Key (copy the whole line):

$(cat "$KEY.pub")

  Leave "Allow write access" OFF, save, then run this script again.
EOF
  exit 1
fi

say "Getting $BRANCH from GitHub"
if [[ -d "$SRC/.git" ]]; then
  git -C "$SRC" fetch -q origin "$BRANCH"
  git -C "$SRC" reset -q --hard "origin/$BRANCH"
  git -C "$SRC" clean -qfdx -e node_modules
else
  git clone -q --branch "$BRANCH" "$REPO" "$SRC"
fi
echo "  $(git -C "$SRC" log -1 --format='%h %s')"

BACKEND="$SRC/Coupon_Flow_Backend"
RELEASE="$BACKEND/deploy/release"

# ── Build tools ──────────────────────────────────────────────────────────────
PHP="$(command -v php8.3 || command -v php8.2 || command -v php || true)"
[[ -n "$PHP" ]] || die "PHP not found."
# Builds use `php` and `composer`: make sure they run the same PHP as the site.
mkdir -p /root/.coupon-follow-bin && ln -sf "$PHP" /root/.coupon-follow-bin/php
export PATH="/root/.coupon-follow-bin:$PATH"
if ! command -v composer >/dev/null; then
  say "Installing Composer"
  curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer --quiet
fi
export COMPOSER_ALLOW_SUPERUSER=1
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]]; then
  say "Installing Node.js $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_$NODE_MAJOR.x" | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
command -v python3 >/dev/null || apt-get install -y -qq python3
PNPM="npx --yes pnpm@10.34.3"

say "Installing front-end packages"
(cd "$SRC/Coupon_Flow_Dashbaord" && $PNPM install --frozen-lockfile --silent)
(cd "$SRC/Coupon_Flow_Website" && $PNPM install --frozen-lockfile --silent)

# ── Build and deploy ─────────────────────────────────────────────────────────
SITE_DIR="$(ls -d /home/*/htdocs/"$DOMAIN" 2>/dev/null | head -1 || true)"
[[ -n "$SITE_DIR" ]] || die "No /home/*/htdocs/$DOMAIN. Create the PHP site in CloudPanel first."
FIRST=1; [[ -f "$SITE_DIR/.env" ]] && FIRST=0

say "Building the API, admin and website for https://$DOMAIN"
API_URL="https://$DOMAIN" SITE_URL="https://$DOMAIN" bash "$BACKEND/deploy/build-release.sh"
cp "$BACKEND/deploy/cloudpanel/deploy.sh" "$BACKEND/deploy/cloudpanel/patch-vhost.py" "$RELEASE/"
mkdir -p "$BACKEND/deploy/content/storage"
php "$BACKEND/deploy/zip.php" "$BACKEND/deploy/content/storage" "$RELEASE/storage.zip"
if [[ $FIRST == 1 ]]; then
  [[ -f "$BACKEND/deploy/content/catalog.sql" ]] || die "deploy/content/catalog.sql is not in the repo (run deploy/export-content.sh on the PC and push)."
  cp "$BACKEND/deploy/content/catalog.sql" "$RELEASE/content.sql"
fi

bash "$RELEASE/deploy.sh" "$DOMAIN"

# On a first install the API wasn't live while the website was built, so its pages weren't
# pre-rendered and the sitemap only had fixed pages. Build it once more against the live API.
if [[ $FIRST == 1 ]]; then
  say "Pre-rendering the website against the live API"
  rm -rf "$SRC/Coupon_Flow_Website/dist"
  (cd "$SRC/Coupon_Flow_Website" && VITE_API_URL="https://$DOMAIN/api/v1" VITE_SITE_URL="https://$DOMAIN" $PNPM build 2>&1 | grep -E "sitemap|prerender|rror" || true)
  if [[ -f "$SRC/Coupon_Flow_Website/dist/index.html" ]]; then
    SITE_USER="$(stat -c %U "$SITE_DIR")"
    rm -rf "$SITE_DIR/website.new" && cp -a "$SRC/Coupon_Flow_Website/dist" "$SITE_DIR/website.new"
    chown -R "$SITE_USER:$SITE_USER" "$SITE_DIR/website.new"
    rm -rf "$SITE_DIR/website.old" && mv "$SITE_DIR/website" "$SITE_DIR/website.old" && mv "$SITE_DIR/website.new" "$SITE_DIR/website" && rm -rf "$SITE_DIR/website.old"
    echo "  Website replaced with the pre-rendered build."
  else
    warn "Website rebuild failed; the site still works (pages render in the browser). Run this script again later."
  fi
fi

say "Deployed $(git -C "$SRC" log -1 --format='%h') to https://$DOMAIN"
