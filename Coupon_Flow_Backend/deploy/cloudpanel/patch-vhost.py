#!/usr/bin/env python3
"""Applies step 6 of DEPLOY-CLOUDPANEL.md to a CloudPanel Nginx Vhost.

Usage: patch-vhost.py <vhost.conf> <site-dir> <write-block-to>

In the server block that runs PHP (the one with fastcgi_pass) it:
  1. points `root` at <site-dir>/public (Laravel),
  2. removes the static-file block `location ~* ^.+\\.(css|js|...)$ { ... }`,
  3. replaces `location / { ... }` with the Coupon Follow block (API, /storage, /admin, website).
It changes nothing and exits 1 when the Vhost doesn't look like CloudPanel's template, so the
caller can fall back to the manual step. The Coupon Follow block is always written to
<write-block-to> for that case. Running it twice is safe.
"""
import re
import sys

MARK = "# --- Coupon Follow: one domain, three apps ---"

BLOCK = MARK + """
  # Laravel: the API and uploaded images (web root = public/)
  location ^~ /api/     { try_files $uri /index.php?$query_string; }
  location ^~ /storage/ { try_files $uri =404; expires 30d; }

  # Admin panel: static build in public/admin. Never indexed.
  location ^~ /admin/ {
    try_files $uri $uri/ /admin/index.html;
    add_header X-Robots-Tag "noindex, nofollow" always;
  }

  # Public website: static build in ../website
  set $site {site}/website;

  location ^~ /_prerender/ { internal; root $site; }
  location ^~ /assets/ {
    root $site;
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
  location = / { root $site; try_files /_prerender/index.html /index.html; }
  location ~ ^/promotions/at/([^/]+)/?$ { root $site; try_files /_prerender/stores/$1.html /index.html; }
  location ~ ^/(stores|coupons|blog)$ {
    root $site;
    if ($args) { rewrite ^ /index.html last; }
    try_files /_prerender$uri.html /index.html;
  }
  location / { root $site; try_files $uri /_prerender$uri.html /index.html; }
  # --- end Coupon Follow ---"""


def server_blocks(conf):
    """(start, end) of each top-level `server { ... }` block, by brace counting."""
    blocks, i = [], 0
    for m in re.finditer(r"(?m)^\s*server\s*\{", conf):
        if m.start() < i:
            continue
        depth, j = 0, conf.index("{", m.start())
        while j < len(conf):
            if conf[j] == "{":
                depth += 1
            elif conf[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        blocks.append((m.start(), j + 1))
        i = j + 1
    return blocks


def main():
    path, site, block_out = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
    block = BLOCK.replace("{site}", site)
    with open(block_out, "w") as f:
        f.write(block + "\n")

    conf = open(path).read()
    php_blocks = [(s, e) for s, e in server_blocks(conf) if "fastcgi_pass" in conf[s:e]]
    if len(php_blocks) != 1:
        print(f"  Expected one server block with fastcgi_pass, found {len(php_blocks)}.")
        return 1
    start, end = php_blocks[0]
    server = conf[start:end]

    # The server's own root is an absolute path; the website locations use `root $site;`.
    server_root = r"(?m)^([ \t]*root[ \t]+)/\S*;"
    roots = re.findall(server_root, server)
    if len(roots) != 1:
        print(f"  Expected one root line in the PHP server block, found {len(roots)}.")
        return 1
    server = re.sub(server_root, lambda m: f"{m.group(1)}{site}/public;", server)

    if MARK in server:
        with open(path, "w") as f:
            f.write(conf[:start] + server + conf[end:])
        print("  Coupon Follow block already present; root set to public/.")
        return 0
    else:
        server = re.sub(r"\n[ \t]*location ~\* \^\.\+\\\.\([^)]*\)\$ \{[^{}]*\}", "", server)
        loc = list(re.finditer(r"\n([ \t]*)location / \{[^{}]*\}", server))
        if len(loc) != 1:
            print(f"  Expected one `location / {{ ... }}` block, found {len(loc)}.")
            return 1
        m = loc[0]
        server = server[: m.start()] + "\n  " + block + server[m.end():]

    with open(path, "w") as f:
        f.write(conf[:start] + server + conf[end:])
    print("  Root set to public/, static-file block removed, Coupon Follow locations added.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
