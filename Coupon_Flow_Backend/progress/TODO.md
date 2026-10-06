# TODO

## Blocked on user
- [x] Test key in `STRIPE_SECRET` (user's own test account).
- [x] `STRIPE_WEBHOOK_SECRET` from `stripe listen` in `.env` (restart the listener for local webhooks; same secret per key/device).
- [ ] Roll the test secret key that was pasted into chat; prefer a restricted `rk_test_` key.
- [ ] Optional: the `coupon-follow` CLI sandbox is unused now; let it expire 2026-10-06 or claim it.
- [ ] Stripe account has Adaptive Pricing on (Checkout offers PKR). Fine (settles in USD), or turn off in Dashboard → Settings → Adaptive Pricing.
- [ ] Confirm the business entity's country is supported by Stripe before going live.
- [x] Brand feed importer built with our own feed format v1 (JSON/CSV URL or CSV upload) — 2026-10-06.
- [ ] If a brand has its own API format instead of ours: their docs, to add a mapping for that source.
- [ ] Client to confirm: a "use" = a "Show coupon code" / "Get deal" click (we can't see purchases at the brand's checkout).
- [ ] Production domains for API, admin and public site (needed for `.env` and builds).
- [ ] SiteGround access (SSH or SFTP) or the user uploads the zips; MySQL DB name/user/password.
- [ ] Mailbox + SMTP password for order emails; support email to show on the site.
- [ ] Live restricted Stripe key + live webhook secret; final admin password; brand name decision ("Coupon Follow" matches an existing site; the name is a setting).
- [ ] Have the legal pages (Refund, Terms, Privacy, Affiliate) reviewed; they are sensible templates, not legal advice.

## Phase 4/5 — go-live
- [x] `stripe:check` go-live command + dispute alerts.
- [x] Real test-mode purchase: 4242 pay, codes, email, refund, decline, cancel (via reconcile).
- [x] Same run with the webhook live, plus the 3-D Secure card.
- [x] Deploy kit: `deploy/build-release.sh`, `deploy/env.production.example`, `deploy/DEPLOY.md`.
- [ ] Live upload and go-live checklist in `deploy/DEPLOY.md` (needs the inputs above + explicit go-ahead).

## Later
- [x] Pre-render every sitemap page for SEO: home, list pages, static pages, stores, categories, articles (2026-10-01).
- [x] Unique code pools per paid coupon (one code per buyer). Done 2026-10-01.
- [ ] Order value / commission on redemptions (needs the affiliate network's conversion data).
- [x] Staff roles, two-step login, activity log, usage dashboard, usage limits, exact deal windows, brand feeds (2026-10-06).
- [ ] Go-live: admin turns on two-step login, then Settings → Security → Require two-step login.
- [x] Hide "Add to cart" for coupons the signed-in shopper already bought (2026-10-01: `GET purchases`, "Bought · view code" on tickets, cart flags and blocks them).
- [ ] Stripe Tax (requires a tax registration).
- [x] Shareable store links in the admin + click-out to the store with the code pop-up on return; no merchant links on the site (2026-10-03).
- [ ] After the first deploy with the pop-up flow: delete `POST public/coupons/{id}/click` (kept only for cached old bundles) and its two tests.
- [x] Store page layout like healthinfolife.com (rows, Used N times, Top Stores, copy pop-up); no checkout on store pages (2026-10-05).
- [x] Store star rating like the reference site (2026-10-05).
- [x] Simple coupon site: "Sell Exclusive Codes" switch (default off), one row layout everywhere, `#coupon_code-{id}` pop-up (2026-10-05).
- [ ] Client to confirm: keep selling exclusive codes later (switch on) or not at all. If never, the live Stripe keys are no longer a go-live blocker.
- [x] Admin view/reset of store ratings: list column + sort, drawer row, edit-page card with remove-one and reset (2026-10-05).
- [x] `/promotions/at/{slug}` alias like the reference site, canonical to `/stores/{slug}`; admin share links use it (2026-10-03).
