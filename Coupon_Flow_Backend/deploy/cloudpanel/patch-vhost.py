#!/usr/bin/env python3
"""Applies step 6 of DEPLOY-CLOUDPANEL.md to a CloudPanel Nginx Vhost.

Usage: patch-vhost.py <vhost.conf> <site-dir> <write-block-to>

Handles CloudPanel's two PHP-site layouts:
  * one server block that runs PHP itself (`location / { try_files ... }` + fastcgi_pass);
  * a front server block that proxies `location /` to a PHP backend block on port 8080
    (the Varnish-ready template).
In both it points every absolute `root` at <site-dir>/public (Laravel), removes the front
block's static-file block `location ~* ^.+\\.(css|js|...)$ { ... }` and replaces its
`location / { ... }` with the Coupon Follow locations: the API to Laravel, /storage and /admin
from public/, everything else from the website build. In the proxy layout the API location
keeps CloudPanel's proxy settings.

It changes nothing and exits 1 when the Vhost doesn't match, so the caller can fall back to the
manual step. The Coupon Follow block is always written to <write-block-to>. Running it twice
is safe.
"""
import re
import sys

MARK = "# --- Coupon Follow: one domain, three apps ---"
END = "# --- end Coupon Follow ---"

STATIC = """
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
  """ + END

API_DIRECT = "location ^~ /api/ { try_files $uri /index.php?$query_string; }"

STATIC_FILES = re.compile(r"\n[ \t]*location ~\* \^\.\+\\\.\([^)]*\)\$ \{[^{}]*\}")
LOCATION_ROOT = re.compile(r"\n([ \t]*)location / \{([^{}]*)\}")
SERVER_ROOT = re.compile(r"(?m)^([ \t]*root[ \t]+)/\S*;")


def block_text(site, api):
    return (MARK + "\n  # Laravel: the API (web root = public/)\n  " + api + "\n" + STATIC).replace("{site}", site)


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
    conf = open(path).read()
    blocks = server_blocks(conf)
    if not blocks:
        print("  No server blocks found.")
        return 1

    if MARK in conf:
        # Already patched: only make sure every root still points at public/.
        conf = SERVER_ROOT.sub(lambda m: f"{m.group(1)}{site}/public;", conf)
        with open(path, "w") as f:
            f.write(conf)
        print("  Coupon Follow locations already present; roots set to public/.")
        return 0

    # The block that answers visitors: the one with `location / { proxy_pass ... }`, else the
    # one that runs PHP itself.
    front = None
    for s, e in blocks:
        loc = LOCATION_ROOT.search(conf[s:e])
        if loc and "proxy_pass" in loc.group(2):
            front = (s, e, "proxy", loc.group(2))
    if front is None:
        php = [(s, e) for s, e in blocks if "fastcgi_pass" in conf[s:e]]
        if len(php) != 1:
            print(f"  Expected one server block with fastcgi_pass, found {len(php)}.")
            return 1
        front = (php[0][0], php[0][1], "direct", None)
    fs, fe, layout, proxy_body = front

    if layout == "proxy":
        body = "\n".join("    " + line.strip() for line in proxy_body.strip().splitlines() if line.strip())
        api = "location ^~ /api/ {\n" + body + "\n  }"
    else:
        api = API_DIRECT
    block = block_text(site, api)
    with open(block_out, "w") as f:
        f.write(block + "\n")

    out, pos = [], 0
    for s, e in blocks:
        server = conf[s:e]
        roots = SERVER_ROOT.findall(server)
        if len(roots) > 1:
            print(f"  Expected at most one root line per server block, found {len(roots)}.")
            return 1
        server = SERVER_ROOT.sub(lambda m: f"{m.group(1)}{site}/public;", server)
        if (s, e) == (fs, fe) and MARK not in server:
            server = STATIC_FILES.sub("", server)
            loc = list(LOCATION_ROOT.finditer(server))
            if len(loc) != 1:
                print(f"  Expected one `location / {{ ... }}` block, found {len(loc)}.")
                return 1
            m = loc[0]
            server = server[: m.start()] + "\n  " + block + server[m.end():]
        out.append(conf[pos:s] + server)
        pos = e
    out.append(conf[pos:])

    with open(path, "w") as f:
        f.write("".join(out))
    print(f"  Layout: {layout}. Roots set to public/, static-file block removed, Coupon Follow locations in place.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
