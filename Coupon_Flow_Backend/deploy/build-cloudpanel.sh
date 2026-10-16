#!/usr/bin/env bash
# Builds ONE file for a CloudPanel deploy (DEPLOY-CLOUDPANEL.md):
#   deploy/release/coupon-follow-cloudpanel.tar.gz
#     api.zip admin.zip website.zip   the three apps, built for https://<domain>
#     deploy.sh patch-vhost.py        the server-side installer
#
# Usage (Git Bash, from Coupon_Flow_Backend):
#   DOMAIN=couponhub.example.com bash deploy/build-cloudpanel.sh
#
# The site starts empty: deploy.sh --fresh creates the tables and asks for the admin account.
# To deploy from GitHub instead, see cloudpanel/git-deploy.sh.
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=couponhub.example.com}"
DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%/}"
BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$BACKEND/deploy/release"

API_URL="https://$DOMAIN" SITE_URL="https://$DOMAIN" bash "$BACKEND/deploy/build-release.sh"

cp "$BACKEND/deploy/cloudpanel/deploy.sh" "$BACKEND/deploy/cloudpanel/patch-vhost.py" "$OUT/"
tar -C "$OUT" -czf "$OUT/coupon-follow-cloudpanel.tar.gz" \
  api.zip admin.zip website.zip deploy.sh patch-vhost.py

printf '\nBundle: %s (%s)\n' "$OUT/coupon-follow-cloudpanel.tar.gz" "$(du -h "$OUT/coupon-follow-cloudpanel.tar.gz" | cut -f1)"
cat <<EOF
On the server (as root):
  mkdir -p /root/coupon-follow && cd /root/coupon-follow
  # upload coupon-follow-cloudpanel.tar.gz here (scp or CloudPanel File Manager), then:
  tar xzf coupon-follow-cloudpanel.tar.gz && bash deploy.sh $DOMAIN --fresh
EOF
