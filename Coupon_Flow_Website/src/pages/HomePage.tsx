import { Link } from 'react-router';
import { BadgeCheck, Copy, Gift } from 'lucide-react';
import CouponTicket from '../components/CouponTicket';
import { SearchBox } from '../components/Layout';
import { ErrorState, Spinner, StoreCard } from '../components/States';
import { siteOrigin } from '../lib/head';
import { useApi, usePageMeta } from '../lib/hooks';
import { stubFigure } from '../lib/format';
import { useSite } from '../store/site';
import { BlogCard } from './BlogPages';
import type { Blog, Category, Coupon, Paginated, Store } from '../lib/types';

/** Two real featured coupons, overlapping like tickets torn from a book. Decorative: the same coupons are listed below. */
function HeroTickets({ coupons }: { coupons: Coupon[] }) {
  if (coupons.length === 0) return null;
  return (
    <div className="relative hidden lg:block h-80" aria-hidden="true">
      {coupons.slice(0, 2).map((c, i) => {
        const { figure, caption } = stubFigure(c.title);
        return (
          <div key={c.id}
            className={`absolute flex w-[26rem] overflow-hidden rounded-xl bg-card shadow-xl ring-1 ring-line ${i === 0 ? 'left-0 top-6 -rotate-3' : 'left-14 top-40 rotate-2'}`}>
            <div className="flex w-32 flex-col items-center justify-center bg-marigold py-7 text-ink">
              <span className="font-display text-4xl font-extrabold leading-none">{figure}</span>
              <span className="text-sm">{caption}</span>
            </div>
            <div className="perforation flex-1 p-5">
              <p className="text-sm font-semibold">{c.store?.name}</p>
              <p className="mt-1 font-display text-lg font-semibold leading-snug line-clamp-2">{c.title}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHead({ id, title, link, linkText }: { id: string; title: string; link: string; linkText: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="section-title">{title}</h2>
      <Link to={link} className="shrink-0 text-sm font-semibold text-deal hover:underline">{linkText}</Link>
    </div>
  );
}

const steps = [
  ['Find your store', 'Search for a store or browse a category to see its live coupon codes and deals.'],
  ['Click "Show coupon code"', 'The store opens in a new tab, and the code waits for you here in a pop-up. Deals need no code.'],
  ['Copy and save', 'Click the code to copy it, then paste it at the store\'s checkout. No sign-up, no payment, nothing to install.'],
];

export default function HomePage() {
  const site = useSite();
  const featured = useApi<Paginated<Coupon>>('/public/coupons?featured=1&per_page=6');
  const stores = useApi<Paginated<Store>>('/public/stores?top=1&per_page=8');
  const categories = useApi<{ data: Category[] }>('/public/categories?type=store');
  const blogs = useApi<Paginated<Blog>>('/public/blogs?per_page=3');

  usePageMeta('', {
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.site_name,
      url: siteOrigin(),
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteOrigin()}/coupons?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  });

  const featuredCoupons = featured.data?.data ?? [];
  const topStores = stores.data?.data ?? [];
  const categoryList = (categories.data?.data ?? []).filter(c => (c.items_count ?? 0) > 0);

  return (
    <>
      <section className="border-b border-line bg-card">
        <div className="page grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Codes that still work, for the stores you already shop.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-soft">
              Click "Show coupon code", shop in the new tab, and paste the code at checkout. Always free, no sign-up.
            </p>
            <div className="mt-8 max-w-xl"><SearchBox size="lg" /></div>
            {topStores.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Popular:</span>
                {topStores.slice(0, 5).map(s => (
                  <Link key={s.id} to={`/stores/${s.slug}`} className="chip">{s.name}</Link>
                ))}
              </div>
            )}
          </div>
          <HeroTickets coupons={featuredCoupons} />
        </div>
      </section>

      <section className="border-b border-line bg-paper" aria-label="Why shop with us">
        <ul className="page grid gap-4 py-6 text-sm sm:grid-cols-3">
          <li className="flex items-center gap-3"><BadgeCheck className="shrink-0 text-deal" size={22} aria-hidden="true" /><span><span className="font-semibold">Verified codes.</span> The badge means our team has tested the code.</span></li>
          <li className="flex items-center gap-3"><Copy className="shrink-0 text-deal" size={22} aria-hidden="true" /><span><span className="font-semibold">One click to copy.</span> The code waits for you when you come back.</span></li>
          <li className="flex items-center gap-3"><Gift className="shrink-0 text-deal" size={22} aria-hidden="true" /><span><span className="font-semibold">Always free.</span> No sign-up, no payment, nothing to install.</span></li>
        </ul>
      </section>

      {categoryList.length > 0 && (
        <section className="page pt-14" aria-labelledby="categories-heading">
          <SectionHead id="categories-heading" title="Shop by category" link="/categories" linkText="All categories" />
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categoryList.slice(0, 8).map(c => (
              <li key={c.id}>
                <Link to={`/categories/${c.slug}`} className="flex h-full items-center justify-between gap-3 rounded-xl bg-card px-5 py-4 ring-1 ring-line hover:ring-ink">
                  <span className="font-display text-lg font-semibold">{c.name}</span>
                  <span className="rounded-full bg-marigold-soft px-2.5 py-0.5 text-xs font-semibold">{c.items_count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="page pt-14" aria-labelledby="featured-heading">
        <SectionHead id="featured-heading" title="Featured coupons" link="/coupons" linkText="See all coupons" />
        <div className="mt-6">
          {featured.loading && <Spinner />}
          {featured.error && <ErrorState message={featured.error} onRetry={featured.reload} />}
          <div className="flex flex-col gap-4">
            {featuredCoupons.map(c => <CouponTicket key={c.id} coupon={c} />)}
          </div>
        </div>
      </section>

      {topStores.length > 0 && (
        <section className="page pt-16" aria-labelledby="stores-heading">
          <SectionHead id="stores-heading" title="Top stores" link="/stores" linkText="Stores A to Z" />
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topStores.map(s => <li key={s.id}><StoreCard store={s} /></li>)}
          </ul>
        </section>
      )}

      <section className="page pt-16" aria-labelledby="how-heading">
        <div className="rounded-2xl bg-ink px-6 py-10 text-white sm:px-10">
          <div>
            <h2 id="how-heading" className="font-display text-3xl font-extrabold tracking-tight">How it works</h2>
            <p className="mt-3 max-w-md text-white/75">
              Three steps from finding a code to saving at the checkout.
            </p>
            <ol className="mt-8 flex flex-col gap-6">
              {steps.map(([title, text], i) => (
                <li key={title} className="flex gap-4">
                  <span className="font-display text-4xl font-extrabold leading-none text-marigold" aria-hidden="true">{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="mt-1 block text-sm text-white/70">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Link to="/stores" className="mt-8 inline-flex items-center rounded-lg bg-marigold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-white">
              Find your store
            </Link>
          </div>
        </div>
      </section>

      {(blogs.data?.data.length ?? 0) > 0 && (
        <section className="page pt-16" aria-labelledby="blog-heading">
          <SectionHead id="blog-heading" title="Shopping guides" link="/blog" linkText="All articles" />
          <ul className="mt-6 grid gap-5 sm:grid-cols-3">
            {blogs.data!.data.map(b => <li key={b.id}><BlogCard blog={b} /></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
