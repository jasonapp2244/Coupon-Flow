import { Link } from 'react-router';
import { BadgeCheck, Copy, MousePointerClick, Search, ShoppingBag } from 'lucide-react';
import CouponTicket, { TicketStub } from '../components/CouponTicket';
import HeroSlider from '../components/HeroSlider';
import { SearchBox } from '../components/Layout';
import { CardSkeletons, ErrorState, StoreLogo, TicketSkeletons } from '../components/States';
import { categoryIcon } from '../lib/categoryIcon';
import { siteOrigin } from '../lib/head';
import { useApi, usePageMeta } from '../lib/hooks';
import { useSite } from '../store/site';
import { BlogCard } from './BlogPages';
import type { Blog, Category, Coupon, Paginated, Store } from '../lib/types';

/** Real featured coupons dropping onto a pile, like tickets torn from a book. Decorative: the same coupons are listed below. */
function HeroTickets({ coupons }: { coupons: Coupon[] }) {
  if (coupons.length === 0) return null;
  const spots = [
    { pos: 'left-4 top-2', tilt: '-6deg' },
    { pos: 'left-20 top-32', tilt: '3deg' },
    { pos: 'left-8 top-[15.5rem]', tilt: '-2deg' },
  ];
  return (
    <div className="relative hidden h-[25rem] lg:block" aria-hidden="true">
      {coupons.slice(0, 3).map((c, i) => (
        <div key={c.id}
          style={{ ['--tilt' as string]: spots[i].tilt, animationDelay: `${0.15 + i * 0.18}s` }}
          className={`absolute ${spots[i].pos} flex w-[25rem] animate-settle overflow-hidden rounded-2xl bg-card text-ink shadow-[0_24px_50px_-20px_rgb(0_0_0/0.6)]`}>
          <TicketStub coupon={c} className="w-32" />
          <div className="perforation flex flex-1 flex-col justify-center p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              {c.store && <StoreLogo name={c.store.name} url={c.store.logo_url} size="xs" />}{c.store?.name}
            </p>
            <p className="mt-1.5 font-display text-lg font-semibold leading-snug line-clamp-2">{c.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHead({ id, title, intro, link, linkText }: { id: string; title: string; intro?: string; link?: string; linkText?: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div>
        <h2 id={id} className="section-title">{title}</h2>
        {intro && <p className="mt-1.5 text-ink-soft">{intro}</p>}
      </div>
      {link && <Link to={link} className="link-more self-start sm:self-auto">{linkText}</Link>}
    </div>
  );
}

/** Live totals under the hero, from the list endpoints' page meta. Hidden until they arrive. */
function StatsStrip({ coupons, stores, categories }: { coupons?: number; stores?: number; categories?: number }) {
  const items = [
    { value: coupons, label: 'live codes and deals' },
    { value: stores, label: 'stores' },
    { value: categories, label: 'categories' },
  ].filter((s): s is { value: number; label: string } => typeof s.value === 'number' && s.value > 0);
  if (!items.length) return null;
  return (
    <section className="border-b border-line bg-card" aria-label="Site totals">
      <dl className="page grid grid-cols-1 divide-line py-5 sm:grid-cols-[repeat(3,auto)_1fr] sm:items-center sm:divide-x">
        {items.map(s => (
          <div key={s.label} className="flex items-baseline gap-2 py-1 sm:px-8 sm:first:pl-0">
            <dt className="sr-only">{s.label}</dt>
            <dd className="font-display text-3xl font-extrabold tracking-tight">{s.value.toLocaleString('en-US')}</dd>
            <span className="text-sm text-ink-soft" aria-hidden="true">{s.label}</span>
          </div>
        ))}
        <p className="flex items-center gap-2 py-1 text-sm font-semibold text-deal-dark sm:justify-end sm:pl-8">
          <BadgeCheck size={18} aria-hidden="true" /> Always free. No account needed.
        </p>
      </dl>
    </section>
  );
}

const steps = [
  { icon: Search, title: 'Find your store', text: 'Search by name or browse a category to see every current code and deal for that store.' },
  { icon: MousePointerClick, title: 'Reveal the code', text: 'Click "Show coupon code". The store opens in a new tab and your code is waiting here, ready to copy.' },
  { icon: Copy, title: 'Save at checkout', text: 'Paste the code into the promo box when you pay. Deals need no code at all: the saving is applied for you.' },
];

export default function HomePage() {
  const site = useSite();
  const hero = site.homepage;
  const featured = useApi<Paginated<Coupon>>('/public/coupons?featured=1&per_page=6');
  const stores = useApi<Paginated<Store>>('/public/stores?top=1&per_page=12');
  const categories = useApi<{ data: Category[] }>('/public/categories?type=store');
  const blogs = useApi<Paginated<Blog>>('/public/blogs?per_page=3');
  const allCoupons = useApi<Paginated<Coupon>>('/public/coupons?per_page=1');
  const allStores = useApi<Paginated<Store>>('/public/stores?per_page=1');

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
      <section className="band-dark relative overflow-hidden">
        {hero.hero_image_url && (
          <>
            <img src={hero.hero_image_url} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
            {/* Keeps the white headline readable on any photo: solid on the text side, lighter on the right. */}
            <div className="absolute inset-0 bg-gradient-to-r from-ink-deep via-ink-deep/85 to-ink-deep/45" aria-hidden="true" />
          </>
        )}
        <div className="page relative grid items-center gap-10 py-16 short:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.98] tracking-tight [text-wrap:balance] sm:text-7xl short:text-5xl">
              {hero.headline}
            </h1>
            {hero.subtext && <p className="mt-6 max-w-lg text-lg text-white/80">{hero.subtext}</p>}
            <div className="mt-8 max-w-xl"><SearchBox size="lg" placeholder={hero.search_placeholder} /></div>
            {topStores.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-white/70">Popular:</span>
                {topStores.slice(0, 5).map(s => (
                  <Link key={s.id} to={`/stores/${s.slug}`} className="chip-dark py-1 pl-1">
                    <StoreLogo name={s.name} url={s.logo_url} size="xs" />{s.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {hero.slides.length > 0 ? <HeroSlider slides={hero.slides} /> : <HeroTickets coupons={featuredCoupons} />}
        </div>
      </section>

      <StatsStrip coupons={allCoupons.data?.meta.total} stores={allStores.data?.meta.total} categories={categoryList.length} />

      {categoryList.length > 0 && (
        <section className="page pt-16" aria-labelledby="categories-heading">
          <SectionHead id="categories-heading" title="Shop by category" intro="Fashion, tech, beauty and more. Start with what you're shopping for." link="/categories" linkText="All categories" />
          <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categoryList.slice(0, 8).map(c => {
              const Icon = categoryIcon(c.name, c.slug);
              return (
                <li key={c.id}>
                  <Link to={`/categories/${c.slug}`} className="group flex h-full flex-col items-start gap-3 rounded-2xl bg-card p-3 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink min-[400px]:flex-row min-[400px]:items-center sm:gap-4 sm:p-4">
                    <span className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-marigold-soft transition-colors group-hover:bg-marigold">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-semibold leading-tight [overflow-wrap:break-word]">{c.name}</span>
                      <span className="block text-sm text-muted">{c.items_count} {c.items_count === 1 ? 'store' : 'stores'}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Hidden while the site has no coupons or stores yet, like the other home sections. */}
      {!(featured.data && !featured.error && featuredCoupons.length === 0) && (
      <section className="page pt-16" aria-labelledby="featured-heading">
        <SectionHead id="featured-heading" title="Featured coupons" intro="Standout savings from popular stores, picked by our team." link="/coupons" linkText="See all coupons" />
        <div className="mt-7">
          {featured.loading && !featured.data && <TicketSkeletons />}
          {featured.error && <ErrorState message={featured.error} onRetry={featured.reload} />}
          <div className="flex flex-col gap-4">
            {featuredCoupons.map(c => <CouponTicket key={c.id} coupon={c} />)}
          </div>
        </div>
      </section>
      )}

      {!(stores.data && !stores.error && topStores.length === 0) && (
      <section className="page pt-16" aria-labelledby="stores-heading">
        <SectionHead id="stores-heading" title="Top stores" intro="Popular brands with codes ready to use." link="/stores" linkText="Stores A to Z" />
        {stores.loading && !stores.data && <div className="mt-7"><CardSkeletons count={6} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" /></div>}
        {topStores.length > 0 && (
          <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {topStores.map(s => (
              <li key={s.id}>
                <Link to={`/stores/${s.slug}`} className="group flex h-full flex-col items-center gap-3 rounded-2xl bg-card px-3 py-5 text-center ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-14px_rgb(0_0_0/0.3)] hover:ring-ink">
                  <StoreLogo name={s.name} url={s.logo_url} size="lg" />
                  <span className="w-full">
                    <span className="block truncate font-semibold">{s.name}</span>
                    <span className="block text-sm text-muted">{s.coupons_count ?? 0} {s.coupons_count === 1 ? 'offer' : 'offers'}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      <section className="page pt-20" aria-labelledby="how-heading">
        <div className="text-center">
          <h2 id="how-heading" className="section-title">How it works</h2>
          <p className="mt-2 text-ink-soft">Saving takes less than a minute. Here's all there is to it.</p>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="panel relative flex flex-col p-6">
              <span className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-marigold"><Icon size={22} aria-hidden="true" /></span>
                <span className="font-display text-5xl font-extrabold leading-none text-line" aria-hidden="true">{i + 1}</span>
              </span>
              <span className="mt-5 font-display text-xl font-semibold">{title}</span>
              <span className="mt-2 text-ink-soft">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      {(blogs.data?.data.length ?? 0) > 0 && (
        <section className="page pt-20" aria-labelledby="blog-heading">
          <SectionHead id="blog-heading" title="From the blog" intro="Deal round-ups, store guides and smart ways to spend less." link="/blog" linkText="All articles" />
          <ul className="mt-7 grid gap-5 sm:grid-cols-3">
            {blogs.data!.data.map(b => <li key={b.id}><BlogCard blog={b} /></li>)}
          </ul>
        </section>
      )}

      <section className="page pt-20" aria-labelledby="closing-heading">
        <div className="band-dark relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12">
          <ShoppingBag className="absolute -right-6 -top-6 h-40 w-40 rotate-12 text-white/5" aria-hidden="true" />
          <h2 id="closing-heading" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">About to check out?</h2>
          <p className="mx-auto mt-3 max-w-md text-white/75">Search the store first. A few seconds could save you more than you'd think.</p>
          <div className="mx-auto mt-7 max-w-xl text-left"><SearchBox size="lg" /></div>
        </div>
      </section>
    </>
  );
}
