#!/usr/bin/env bash
# Deploys Urban Goods Guide on a CloudPanel server straight from GitHub: pull → build → install/update.
# API, admin (/admin) and website (/) on one domain, as in deploy/DEPLOY-CLOUDPANEL.md.
#
# Run as root:  bash git-deploy.sh <domain> [branch] [--reset-content]
#   First run   installs with an empty database (asks for the database, optional SMTP and the admin).
#   Later runs  update the code only (backup first; .env, uploads and the database are kept).
#   --reset-content  also removes ALL content (stores, coupons, blogs, categories, clicks, settings,
#                    images) and every account except one admin, after the backup. For hand-over.
#
# Optional: SRC=/root/<name>-src keeps a separate checkout per site (two sites on one server never share one).
#           CF_STAFF="email|Name|role|password;email|Name|role|password" creates or updates staff accounts
#           at the end (php artisan staff:create). Unattended install answers: see deploy.sh (CF_DB_NAME …).
#
# The repo is private, so the server reads it with a deploy key: /root/.ssh/coupon_follow_deploy.
# If the key is missing or not yet added on GitHub, this script creates/prints it and stops.
set -euo pipefail

# This file lives in the checkout it updates, and bash reads scripts as it runs them: run a copy.
if [[ -z "${CF_DEPLOY_COPY:-}" ]]; then
  copy="$(mktemp /tmp/git-deploy.XXXXXX.sh)"; cp "$0" "$copy"
  CF_DEPLOY_COPY=1 exec bash "$copy" "$@"
fi

RESET=""; ARGS=()
for arg in "$@"; do [[ "$arg" == --reset-content ]] && RESET=--reset-content || ARGS+=("$arg"); done
DOMAIN="${ARGS[0]:?Usage: bash git-deploy.sh <domain> [branch] [--reset-content]}"
BRANCH="${ARGS[1]:-main}"
SRC="${SRC:-/root/coupon-follow-src}"
# An existing checkout keeps the address it was cloned with (SSH deploy key, or HTTPS with a token).
REPO="${REPO:-$(git -C "$SRC" remote get-url origin 2>/dev/null || echo git@github.com:jasonapp2244/Coupon-Flow.git)}"
KEY=/root/.ssh/coupon_follow_deploy
NODE_MAJOR=20

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mxx  %s\033[0m\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "Run as root."

# ── GitHub access ────────────────────────────────────────────────────────────
command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git; }
# The admin's logo and icons are stored with Git LFS; without it they would be text pointer files.
git lfs version >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq git-lfs; }
git lfs install --skip-repo >/dev/null
if [[ "$REPO" == /* ]]; then
  # A repo on this server (git push from the PC, see post-receive): no GitHub access needed.
  [[ -d "$REPO" ]] || die "$REPO not found."
elif [[ "$REPO" == https://* ]]; then
  git ls-remote --heads "$REPO" "$BRANCH" >/dev/null 2>&1 || die "GitHub refused the HTTPS address (token expired or without access to the repo?)."
else
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
fi

say "Getting $BRANCH from GitHub"
if [[ -d "$SRC/.git" ]]; then
  git -C "$SRC" fetch -q origin "$BRANCH"
  git -C "$SRC" reset -q --hard "origin/$BRANCH"
  git -C "$SRC" clean -qfdx -e node_modules
else
  git clone -q --branch "$BRANCH" "$REPO" "$SRC"
fi
git -C "$SRC" lfs pull
if grep -rlsI --include='*.png' '^version https://git-lfs' "$SRC/Coupon_Flow_Dashbaord/public" "$SRC/Coupon_Flow_Website/public" >/dev/null; then
  die "Some images are still Git LFS pointers (git lfs pull failed). Check the deploy key can read LFS objects."
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
[[ $FIRST == 0 || -z "$RESET" ]] || die "--reset-content is for an installed site; a first install starts empty anyway."

say "Building the API, admin and website for https://$DOMAIN"
API_URL="https://$DOMAIN" SITE_URL="https://$DOMAIN" bash "$BACKEND/deploy/build-release.sh"
cp "$BACKEND/deploy/cloudpanel/deploy.sh" "$BACKEND/deploy/cloudpanel/patch-vhost.py" "$RELEASE/"

# A first install starts with an empty database: the admin adds the stores and coupons.
if [[ $FIRST == 1 ]]; then
  bash "$RELEASE/deploy.sh" "$DOMAIN" --fresh
else
  bash "$RELEASE/deploy.sh" "$DOMAIN" $RESET
fi

# The website is pre-rendered from the live API at build time. On a first install the API wasn't
# live yet, and after a reset the build still holds the removed pages: build it once more.
if [[ $FIRST == 1 || -n "$RESET" ]]; then
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

if [[ -n "${CF_STAFF:-}" ]]; then
  say "Staff accounts"
  SITE_USER="$(stat -c %U "$SITE_DIR")"
  IFS=';' read -ra people <<< "$CF_STAFF"
  for p in "${people[@]}"; do
    IFS='|' read -r s_mail s_name s_role s_pass <<< "$p"
    [[ -n "$s_mail" ]] || continue
    args=(staff:create "$s_mail" --name="$s_name" --role="${s_role:-admin}")
    [[ -n "$s_pass" ]] && args+=(--password="$s_pass")
    sudo -u "$SITE_USER" -H "$PHP" "$SITE_DIR/artisan" "${args[@]}"
  done
fi

say "Deployed $(git -C "$SRC" log -1 --format='%h') to https://$DOMAIN"
