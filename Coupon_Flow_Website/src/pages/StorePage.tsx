import { Link, useParams } from 'react-router';
import CouponTicket from '../components/CouponTicket';
import { RichText } from '../components/RichText';
import StoreRating from '../components/StoreRating';
import { Breadcrumbs, EmptyState, ErrorState, NotFound, Spinner, StoreLogo, breadcrumbJsonLd, type Crumb } from '../components/States';
import { siteOrigin } from '../lib/head';
import { useApi, usePageMeta } from '../lib/hooks';
import { goStoreUrl, openOut } from '../lib/out';
import { useSite } from '../store/site';
import type { Coupon, Store, StorePageData } from '../lib/types';

function storeJsonLd(store: Store, coupons: Coupon[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: store.name,
    url: `${siteOrigin()}/stores/${store.slug}`,
    ...(store.logo_url ? { logo: store.logo_url } : {}),
    makesOffer: coupons.map(c => ({
      '@type': 'Offer',
      name: c.title,
      ...(c.expires_at ? { validThrough: c.expires_at } : {}),
      price: (c.price_cents / 100).toFixed(2),
      priceCurrency: c.currency.toUpperCase(),
      availability: c.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
    })),
  };
}

export default function StorePage() {
  const { slug } = useParams();
  const site = useSite();
  const { data, loading, error, status, reload } = useApi<StorePageData>(`/public/stores/${slug}`);
  const store = data?.data;
  // Paid coupons only arrive while the admin sells exclusive codes (Settings → General).
  const coupons = data?.coupons ?? [];

  const crumbs: Crumb[] = [
    { label: 'Home', to: '/' },
    { label: 'Stores', to: '/stores' },
    ...(store?.category && store.category_slug ? [{ label: store.category, to: `/categories/${store.category_slug}` }] : []),
    { label: store?.name ?? '' },
  ];

  usePageMeta(
    store ? (store.meta_title || `${store.name} coupons and promo codes`) : null,
    {
      description: store?.meta_description || (store ? `Live ${store.name} coupon codes and deals, checked by the ${site.site_name} team.` : null),
      image: store?.logo_url,
      // Also served at /promotions/at/{slug} (share links); search engines index /stores/{slug} only.
      canonicalPath: `/stores/${slug}`,
      jsonLd: store ? [breadcrumbJsonLd(crumbs), storeJsonLd(store, coupons)] : null,
    },
  );

  if (status === 404) return <NotFound what="store" />;
  if (!store || !data) {
    return <div className="page py-10">{loading ? <Spinner /> : error && <ErrorState message={error} onRetry={reload} />}</div>;
  }

  const intro = store.description || store.heading || `Live ${store.name} coupon codes and deals, updated regularly.`;

  return (
    <div className="page py-8">
      <Breadcrumbs items={crumbs} />

      <header className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="flex flex-row items-center gap-4 sm:flex-col">
          <StoreLogo name={store.name} url={store.logo_url} size="lg" />
          <button onClick={() => openOut(goStoreUrl(store.slug))} className="btn-primary uppercase">
            View store<span className="sr-only"> (opens {store.name} in a new tab)</span>
          </button>
        </div>
        <div className="min-w-0 border-b border-line pb-6">
          <h1 className="page-title text-deal">{store.name} Coupons &amp; Promo Codes</h1>
          <p className="mt-3 text-ink-soft">{intro}</p>
        </div>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          {coupons.length === 0
            ? <EmptyState title={`No live ${store.name} coupons right now`}>New codes are added regularly. Check back soon.</EmptyState>
            : (
              <ul className="flex flex-col gap-4" aria-label={`${store.name} coupons`}>
                {coupons.map(c => <li key={c.id}><CouponTicket coupon={c} showStore={false} /></li>)}
              </ul>
            )}

          {store.content && (
            <section className="mt-12 max-w-2xl" aria-labelledby="about-heading">
              <h2 id="about-heading" className="section-title">About {store.name}</h2>
              <RichText text={store.content} />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6 self-start">
          <StoreRating slug={store.slug} name={store.name} initial={store.rating} />

          {data.related.length > 0 && (
            <section className="rounded-xl bg-card p-5 ring-1 ring-line" aria-labelledby="top-stores-heading">
              <h2 id="top-stores-heading" className="font-display text-2xl font-extrabold text-deal">Top Stores</h2>
              <ul className="mt-4 grid grid-cols-2 gap-3">
                {data.related.map(r => (
                  <li key={r.id}>
                    <Link to={`/stores/${r.slug}`} className="flex flex-col items-center gap-2 rounded-lg p-2 text-center text-sm font-medium hover:bg-paper">
                      <StoreLogo name={r.name} url={r.logo_url} size="lg" />
                      <span className="line-clamp-1">{r.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to="/stores" className="mt-4 inline-block text-sm font-semibold hover:text-deal">View all stores</Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
