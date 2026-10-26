# Deploy on CloudPanel — one site, one domain

## Deploy with `git push live main` (no GitHub access needed on the server)

Your PC pushes straight to a git repo on the server. The hook `deploy/cloudpanel/post-receive`
deploys every push to `main` with `git-deploy.sh` and shows its output in your terminal.

**1. On the server, as root (once):**

```bash
git init -q --bare --initial-branch=main /root/couponhub.git
```

Then create the hook: paste the contents of `deploy/cloudpanel/post-receive` into
`/root/couponhub.git/hooks/post-receive`, and run `chmod +x /root/couponhub.git/hooks/post-receive`.

**2. On the PC, in Git Bash, in `F:\React_project` (once):**

```bash
git remote add live ssh://root@<server-ip>/root/couponhub.git
```

**3. First install.**
1. On the PC: `git push live main`.
2. On the server, run the command the push prints: `bash /root/coupon-follow-src/Coupon_Flow_Backend/deploy/cloudpanel/git-deploy.sh <domain>`. It asks for the database, SMTP and the first admin.

**Every update after that:** `git push live main`. Nothing else is needed.

## One-go deploy from GitHub (does steps 2–8 for you)

The server pulls the repo, builds the API, admin and website itself, and installs or updates them.
`deploy/cloudpanel/git-deploy.sh` does it, calling `deploy/cloudpanel/deploy.sh`.

**Before you start, in CloudPanel:**
1. Create the PHP site (step 1), with PHP 8.2 or newer.
2. Issue its Let's Encrypt certificate.

**1. Let the server read the private repo (once).** On the server, as root:

```bash
ssh-keygen -q -t ed25519 -N "" -C "coupon-follow-deploy" -f /root/.ssh/coupon_follow_deploy && cat /root/.ssh/coupon_follow_deploy.pub
```

Then add the printed line on GitHub: the repo → **Settings → Deploy keys → Add deploy key**. Leave write access off.

**2. Deploy (first install and every update): one command on the server, as root.**

```bash
export GIT_SSH_COMMAND="ssh -i /root/.ssh/coupon_follow_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"; [ -d /root/coupon-follow-src ] || git clone -q git@github.com:jasonapp2244/Coupon-Flow.git /root/coupon-follow-src; bash /root/coupon-follow-src/Coupon_Flow_Backend/deploy/cloudpanel/git-deploy.sh couponhub.devonlinetestserver.com
```

**The first run asks for:**
- the database (name, user, password; it can create them with `clpctl`);
- optional SMTP settings;
- the first admin's email and password.

**It then:**
- installs Composer and Node.js if they are missing;
- builds everything;
- backs up the site folder;
- unpacks the API, `/admin` and the website;
- writes `.env`;
- creates empty tables and asks for the admin account (the site starts with no stores, coupons or blogs);
- migrates, links storage, builds the caches and adds the cron job;
- patches the Nginx Vhost (step 6, checked with `nginx -t`, with the old one put back on failure);
- checks the site;
- builds the website again against the live API, so every page is pre-rendered.

**Later runs update:**
- maintenance mode on;
- database and code backup;
- new code, keeping `.env`, uploads and the database;
- migrations and caches;
- back online.

**3. Optional: deploy on every `git push`.** `.github/workflows/deploy.yml` runs the same script over SSH when `main` changes. On the server, as root:

```bash
ssh-keygen -q -t ed25519 -N "" -C "github-actions" -f /root/.ssh/github_actions && cat /root/.ssh/github_actions.pub >> /root/.ssh/authorized_keys && cat /root/.ssh/github_actions
```

Then on GitHub: the repo → **Settings → Secrets and variables → Actions** → add two secrets:
- `DEPLOY_HOST`: the server's IP;
- `DEPLOY_SSH_KEY`: the whole private key the command printed, including the BEGIN and END lines.

Delete `/root/.ssh/github_actions` from the server afterwards. Only its `.pub` half in `authorized_keys` is needed there.

**Content:** a new install starts empty; the admin adds stores, coupons and blogs in the live admin.

**Hand-over reset (remove all content, keep one admin):** on the server, as root:

```bash
cd /root/coupon-follow-src && git fetch -q origin main && git reset -q --hard origin/main && bash Coupon_Flow_Backend/deploy/cloudpanel/git-deploy.sh <domain> main --reset-content
```

It updates the code, backs up the database, then asks for the admin email to keep (Enter = the
current one) and an optional new password (12+ characters), and asks you to type `RESET`. It then
removes every store, coupon, code, blog, category, feed, click, rating, activity entry, site
setting and uploaded image, and every other account, and rebuilds the website. Undo: import
`/root/coupon-follow-backups/<time>/database.sql.gz`.

**Without GitHub:** `DOMAIN=<domain> bash deploy/build-cloudpanel.sh` on the PC builds one bundle. Upload it, then on the server run `tar xzf coupon-follow-cloudpanel.tar.gz && bash deploy.sh <domain> --fresh`.

**CloudPanel's Vhost editor:** the Vhost change is written to Nginx's file directly. If you later save the Vhost in CloudPanel's editor, paste in `vhost-applied.conf` from the backup folder (`/root/coupon-follow-backups/<time>/`), or the change is lost.

The manual steps below describe the same work one by one.

**Is it possible? Yes.** The API, the admin panel and the public website can all run as a single
CloudPanel **PHP Site (Laravel)** on one domain. Nothing in the code has to change:

- every API address already starts with `/api/` (including the `/api/go/...` click-outs);
- uploaded images are served from `/storage/`;
- the admin is built with a relative base, so it runs from the `/admin/` subfolder;
- everything else is the public website.

| Address | Served by | Folder on the server |
|---|---|---|
| `https://example.com/api/...`, `/storage/...` | Laravel | `htdocs/example.com/` (web root `public/`) |
| `https://example.com/admin/` | Admin build | `htdocs/example.com/public/admin/` |
| `https://example.com/` and every other path | Website build | `htdocs/example.com/website/` |

`example.com` stands for your domain and `<user>` for the CloudPanel site user throughout.

Because all three share one origin, the browser never makes a cross-site request, so CORS
settings don't matter.

> The rest of `deploy/DEPLOY.md` (SiteGround, three domains) does not apply to this layout.
> CloudPanel runs Nginx, which ignores `.htaccess` files. Step 6 replaces them.

---

## 1. Create the site

1. CloudPanel → **Sites → Add Site → Create a PHP Site**.
2. Application: **Laravel**. PHP version: **8.3** (the project needs 8.2 or newer).
3. Domain: `example.com`. Note the site user and password CloudPanel shows.
4. The site → **SSL/TLS → Actions → New Let's Encrypt Certificate** (point the domain's DNS A
   record at the server first).
5. **Databases → Add Database**: note the name, user and password.

## 2. Build the release on your PC

From `Coupon_Flow_Backend` in Git Bash, with the same URL for both values:

```bash
API_URL=https://example.com SITE_URL=https://example.com bash deploy/build-release.sh
```

This creates `deploy/release/api.zip`, `admin.zip` and `website.zip`. The admin and website are
built against `https://example.com/api/v1`.

> The website build pulls its pre-rendered pages and sitemap from the live API. On the first run
> the API isn't live yet, so it warns "API not reachable" and still builds. Step 8 rebuilds it
> once the API and data are online.

## 3. Upload the API (Laravel)

1. CloudPanel's Laravel template puts a fresh Laravel app in `htdocs/example.com/`. Delete its
   contents (File Manager or SSH as the site user).
2. Upload `api.zip` there and extract it, so `htdocs/example.com/artisan` and
   `htdocs/example.com/public/index.php` exist.
3. Create `.env`: copy `.env.example` (the production template) to `.env` and fill in:

   ```ini
   APP_URL=https://example.com
   FRONTEND_URL=https://example.com
   ADMIN_URL=https://example.com/admin
   DB_HOST=127.0.0.1
   DB_DATABASE=<db-name>
   DB_USERNAME=<db-user>
   DB_PASSWORD=<db-password>
   MAIL_*=<your mailbox / SMTP settings>
   ADMIN_EMAIL=<admin-email>
   ADMIN_PASSWORD=<strong-password>
   ```

   `ADMIN_URL` must include `/admin`: password-reset and alert emails link to `ADMIN_URL/#/...`.
4. Over SSH, as the site user, in `htdocs/example.com`:

   ```bash
   php artisan key:generate --force
   php artisan migrate --force
   php artisan db:seed --class=AdminSeeder --force   # first admin (skip if you import the DB in step 4)
   php artisan storage:link
   php artisan config:cache && php artisan route:cache && php artisan view:cache
   ```

## 4. Optional: bring local content over (stores, coupons, categories, blogs, settings)

Skip this for a site that starts empty. The local database holds demo content; to copy it instead:

1. On your PC, export it:
   `F:\xampp\mysql\bin\mysqldump.exe -u root coupon_follow > coupon_follow.sql`
2. CloudPanel → **Databases → Import** (or `mysql` over SSH) into the new database.
3. Upload the images in `Coupon_Flow_Backend/storage/app/public/` to
   `htdocs/example.com/storage/app/public/`.
4. Sign in with the local admin password, then change it in My Account.

## 5. Upload the admin and the website

- `admin.zip` → extract into `htdocs/example.com/public/admin/` (so `public/admin/index.html` exists).
- `website.zip` → extract into `htdocs/example.com/website/` (so `website/index.html` exists).

## 6. Nginx Vhost (replaces the `.htaccess` rules)

The site → **Vhost**. Inside the `server { listen 443 ... }` block:

1. **Delete** CloudPanel's static-file block `location ~* ^.+\.(css|js|jpg|jpeg|gif|png|ico|...)$ { ... }`.
   Regex locations win over plain ones, so it would look for the website's `favicon.svg`,
   `og-image.png` etc. in Laravel's `public/` folder and return 404.
2. **Replace** CloudPanel's `location / { try_files $uri $uri/ /index.php?$args; }` with the
   block below. **Keep** the `location ~ \.php$ { ... fastcgi_pass ... }` block: it runs Laravel.

```nginx
# --- Coupon Follow: one domain, three apps ---

# Laravel: the API and uploaded images (web root = public/)
location ^~ /api/     { try_files $uri /index.php?$query_string; }
location ^~ /storage/ { try_files $uri =404; expires 30d; }

# Admin panel: static build in public/admin. Never indexed.
location ^~ /admin/ {
    try_files $uri $uri/ /admin/index.html;
    add_header X-Robots-Tag "noindex, nofollow" always;
}

# Public website: static build in ../website
set $site /home/<user>/htdocs/example.com/website;

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
```

What each website rule does (same as the website's `.htaccess`):

- Search engines and link previews get the pre-built page with full content and meta tags
  (`/stores/nike` → `_prerender/stores/nike.html`). The app takes over in the browser.
- `/promotions/at/{slug}` share links show the store page.
- List pages with filters (`/stores?letter=B`, `/blog?page=2`) go to the app, because the
  pre-built copies are unfiltered.
- `/_prerender/...` can't be opened directly, so there are no duplicate URLs.
- Anything else falls back to the app (`index.html`).

Save. CloudPanel tests the config and reloads Nginx; if it reports an error, nothing is applied.

## 7. Cron (scheduled jobs)

The site → **Cron Jobs → Add Cron Job**, every minute:

```
* * * * * php8.3 /home/<user>/htdocs/example.com/artisan schedule:run >> /dev/null 2>&1
```

This runs brand-feed sync (every 15 min), expiring redemptions, log pruning and the email queue.

## 8. Rebuild the website against the live API

Now that the API and content are online, build again on your PC so every store, category and
article page is pre-rendered and listed in the sitemap:

```bash
API_URL=https://example.com SITE_URL=https://example.com bash deploy/build-release.sh
```

Upload the new `website.zip` to `htdocs/example.com/website/`, replacing the old files. Repeat
this after adding stores or articles if you want them pre-rendered and in the sitemap straight
away. (The live site shows new content immediately either way, because the app loads it from
the API.)

## 9. Check it

| Open | Expected |
|---|---|
| `https://example.com/` | Home page with the hero and coupons |
| `https://example.com/stores/<a-store-slug>` then reload | Store page, no 404 |
| `view-source:https://example.com/stores/<a-store-slug>` | Real store text in the HTML (pre-rendered) |
| `https://example.com/_prerender/index.html` | 404 |
| `https://example.com/api/v1/public/settings` | JSON |
| `https://example.com/admin/` | Admin sign-in; sign in works |
| A coupon's "Show coupon code" | Store opens in a new tab, code pop-up shows |
| `https://example.com/sitemap.xml`, `/robots.txt` | The website's files (not Laravel's) |
| Admin → forgot password | Email link opens `https://example.com/admin/#/...` |

Then, in the admin, turn on two-step login and **Settings → Security → Require two-step login**.

## Updating later

- **Code changes:** run step 2. Upload `api.zip` over the app folder **without** touching `.env`
  or `storage/`, then run `php artisan migrate --force` and the three `cache` commands. Replace
  `public/admin/` and `website/` with the new builds.
- **Rollback:** keep the previous zips and a database export taken before `migrate`. Upload the old
  zips and import the export.

## Not verified yet

This layout and the Vhost block were written from the website's `.htaccess` and CloudPanel's
standard Laravel template, but haven't been run on a CloudPanel server. The step 9 checks confirm
it. If CloudPanel rejects the Vhost, the error message names the line.

## One command, no questions (a second site on the same server)

Every first-install question can be answered up front with `CF_*` variables (see the header of
`deploy/cloudpanel/deploy.sh`). `CF_STAFF` creates the staff accounts at the end. `SRC` gives the site its own
checkout, so another site on the same server (and its `/root/coupon-follow-src`) is never touched.
Run as root, with the CloudPanel site and an empty database already created:

```bash
export SRC=/root/urbangoodsguide-src GIT_SSH_COMMAND="ssh -i /root/.ssh/coupon_follow_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
CF_DB_NAME='<db>' CF_DB_USER='<user>' CF_DB_PASS='<db password>' CF_DB_CREATE=n \
CF_MAIL_HOST=giowm1084.siteground.biz CF_MAIL_PORT=465 CF_MAIL_USER=info@urbangoodsguide.com CF_MAIL_PASS='<mailbox password>' CF_MAIL_FROM=info@urbangoodsguide.com \
CF_ADMIN_MAIL=faizan@urbangoodsguide.com CF_ADMIN_PASS='<password>' \
CF_STAFF='faizan@urbangoodsguide.com|Faizan|super_admin|<password>;kabir@urbangoodsguide.com|Kabir|admin|<password>' \
bash -c '[ -d "$SRC/.git" ] || git clone -q git@github.com:jasonapp2244/Coupon-Flow.git "$SRC"; bash "$SRC/Coupon_Flow_Backend/deploy/cloudpanel/git-deploy.sh" urbangoodsguide.com'
```

Later updates: the same `export` line, then `bash "$SRC/Coupon_Flow_Backend/deploy/cloudpanel/git-deploy.sh" urbangoodsguide.com`.
The admin logo and icons are Git LFS files: `git-deploy.sh` installs `git-lfs` and pulls them.
Until the domain's DNS points at this server, the live checks and the pre-rendered pages use the old host:
after switching DNS (and issuing the Let's Encrypt certificate in CloudPanel) run the update once more.
