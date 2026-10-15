# TODO

## Blocked on user
- [x] Test key in `STRIPE_SECRET` (user's own test account).
- [x] `STRIPE_WEBHOOK_SECRET` from `stripe listen` in `.env` (restart the listener for local webhooks; same secret per key/device).
- [ ] Roll (or delete) the Stripe test key that was pasted into chat. Stripe is no longer used (2026-10-15); `STRIPE_*` lines in the local `.env` can be deleted.
- [x] Brand feed importer built with our own feed format v1 (JSON/CSV URL or CSV upload) — 2026-10-06.
- [ ] If a brand has its own API format instead of ours: their docs, to add a mapping for that source.
- [ ] Client to confirm: a "use" = a "Show coupon code" / "Get deal" click (we can't see purchases at the brand's checkout).
- [ ] Production domains for API, admin and public site (needed for `.env` and builds).
- [ ] SiteGround access (SSH or SFTP) or the user uploads the zips; MySQL DB name/user/password.
- [ ] Mailbox + SMTP password (staff invites, reset links, alerts); support email to show on the site.
- [ ] Final admin password; brand name decision ("Coupon Follow" matches an existing site; the name is a setting).
- [ ] Have the legal pages (Terms, Privacy, Affiliate) reviewed; they are sensible templates, not legal advice.

## Phase 4/5 — go-live
- [x] `stripe:check` go-live command + dispute alerts.
- [x] Real test-mode purchase: 4242 pay, codes, email, refund, decline, cancel (via reconcile).
- [x] Same run with the webhook live, plus the 3-D Secure card.
- [x] Deploy kit: `deploy/build-release.sh`, `deploy/env.production.example`, `deploy/DEPLOY.md`.
- [ ] Live upload and go-live checklist in `deploy/DEPLOY.md` (needs the inputs above + explicit go-ahead).

## Later
- [x] Code lists (next code per click, several per visitor, daily limit) + commission % + Confirm sale profit (2026-10-15).
- [ ] Import affiliate-network sales reports (CSV/API) to confirm sales automatically; needs the network and its format.
- [x] Delete the unused website shop files listed in PROJECT_STATE (2026-10-15 follow-up), then trim `lib/api.ts` token code and `Order*` types.
- [x] Paid coupons, Stripe, orders, code pools and shopper accounts removed from backend + admin (2026-10-15).
- [x] Pre-render every sitemap page for SEO: home, list pages, static pages, stores, categories, articles (2026-10-01).
- [x] Unique code pools per paid coupon (one code per buyer). Done 2026-10-01.
- [ ] Order value / commission on redemptions (affiliate data, not our sales) (needs the affiliate network's conversion data).
- [x] Staff roles, two-step login, activity log, usage dashboard, usage limits, exact deal windows, brand feeds (2026-10-06).
- [ ] Go-live: admin turns on two-step login, then Settings → Security → Require two-step login.
- [x] Hide "Add to cart" for coupons the signed-in shopper already bought (2026-10-01: `GET purchases`, "Bought · view code" on tickets, cart flags and blocks them).
- [x] Shareable store links in the admin + click-out to the store with the code pop-up on return; no merchant links on the site (2026-10-03).
- [ ] After the first deploy with the pop-up flow: delete `POST public/coupons/{id}/click` (kept only for cached old bundles) and its two tests.
- [x] Store page layout like healthinfolife.com (rows, Used N times, Top Stores, copy pop-up); no checkout on store pages (2026-10-05).
- [x] Store star rating like the reference site (2026-10-05).
- [x] Simple coupon site: "Sell Exclusive Codes" switch (default off), one row layout everywhere, `#coupon_code-{id}` pop-up (2026-10-05).
- [x] Website cart removed (2026-10-15); admin switch gone.
- [x] Website leftover: `currency` removed from `src/lib/types.ts` SiteSettings and `src/store/site.tsx` FALLBACK (2026-10-15).
- [x] Admin view/reset of store ratings: list column + sort, drawer row, edit-page card with remove-one and reset (2026-10-05).
- [x] `/promotions/at/{slug}` alias like the reference site, canonical to `/stores/{slug}`; admin share links use it (2026-10-03).
