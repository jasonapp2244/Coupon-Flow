import { Link, useParams } from 'react-router';
import { BadgeCheck, ExternalLink, Star, TicketPercent } from 'lucide-react';
import CouponTicket from '../components/CouponTicket';
import { RichText } from '../components/RichText';
import StoreRating from '../components/StoreRating';
import { Breadcrumbs, EmptyState, ErrorState, NotFound, StoreLogo, TicketSkeletons, breadcrumbJsonLd, type Crumb } from '../components/States';
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
      availability: 'https://schema.org/InStock',
    })),
  };
}

export default function StorePage() {
  const { slug } = useParams();
  const site = useSite();
  const { data, loading, error, status, reload } = useApi<StorePageData>(`/public/stores/${slug}`);
  const store = data?.data;
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
      description: store?.meta_description || (store ? `Save at ${store.name} with the latest promo codes and deals on ${site.site_name}. Reveal a code and paste it at checkout.` : null),
      image: store?.logo_url,
      // Also served at /promotions/at/{slug} (share links); search engines index /stores/{slug} only.
      canonicalPath: `/stores/${slug}`,
      jsonLd: store ? [breadcrumbJsonLd(crumbs), storeJsonLd(store, coupons)] : null,
    },
  );

  if (status === 404) return <NotFound what="store" />;
  if (!store || !data) {
    return <div className="page py-10">{loading ? <TicketSkeletons /> : error && <ErrorState message={error} onRetry={reload} />}</div>;
  }

  // The heading often just repeats the H1 ("{store} coupons & promo codes"); then the default line reads better.
  const h1 = `${store.name} coupons & promo codes`.toLowerCase();
  const heading = store.heading && store.heading.trim().toLowerCase() !== h1 ? store.heading : null;
  const intro = store.description || heading || `The latest ${store.name} promo codes and deals, all in one place.`;
  const codes = coupons.filter(c => c.has_code).length;
  const verified = coupons.filter(c => c.is_verified).length;
  const rating = store.rating;

  return (
    <>
      <header className="border-b border-line bg-card">
        <div className="page py-8 sm:py-10">
          <Breadcrumbs items={crumbs} />
          <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex flex-row items-center gap-4 sm:flex-col">
              <StoreLogo name={store.name} url={store.logo_url} size="xl" />
              <button onClick={() => openOut(goStoreUrl(store.slug))} className="btn-primary sm:w-full">
                View store <ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (opens {store.name} in a new tab)</span>
              </button>
            </div>
            <div className="min-w-0">
              <h1 className="page-title">{store.name} coupons &amp; promo codes</h1>
              <p className="mt-3 max-w-2xl text-lg text-ink-soft">{intro}</p>
              <ul className="mt-5 flex flex-wrap gap-2 text-sm" aria-label={`${store.name} at a glance`}>
                <li className="badge bg-paper px-3 py-1.5 text-sm text-ink ring-1 ring-line"><TicketPercent size={15} aria-hidden="true" /> {coupons.length} {coupons.length === 1 ? 'offer' : 'offers'}</li>
                {codes > 0 && <li className="badge bg-marigold-soft px-3 py-1.5 text-sm text-ink">{codes} {codes === 1 ? 'code' : 'codes'}</li>}
                {verified > 0 && <li className="badge bg-deal-soft px-3 py-1.5 text-sm text-deal-dark"><BadgeCheck size={15} aria-hidden="true" /> {verified} verified</li>}
                {rating && rating.average !== null && rating.count > 0 && (
                  <li className="badge bg-paper px-3 py-1.5 text-sm text-ink ring-1 ring-line"><Star size={15} className="text-marigold-deep" fill="currentColor" strokeWidth={0} aria-hidden="true" /> {rating.average} of 5</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </header>

      <div className="page py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_19rem]">
          <div className="min-w-0">
            {coupons.length === 0
              ? <EmptyState title={`No ${store.name} offers right now`}>We add new codes as stores release them, so check back soon.</EmptyState>
              : (
                <ul className="flex flex-col gap-4" aria-label={`${store.name} coupons`}>
                  {coupons.map(c => <li key={c.id}><CouponTicket coupon={c} showStore={false} /></li>)}
                </ul>
              )}

            {store.content && (
              <section className="panel mt-12 p-6 sm:p-8" aria-labelledby="about-heading">
                <h2 id="about-heading" className="section-title">About {store.name}</h2>
                <div className="max-w-2xl"><RichText text={store.content} /></div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-24">
            <StoreRating slug={store.slug} name={store.name} initial={store.rating} />

            {data.related.length > 0 && (
              <section className="panel p-5" aria-labelledby="top-stores-heading">
                <h2 id="top-stores-heading" className="font-display text-xl font-extrabold">Similar stores</h2>
                <ul className="mt-4 grid grid-cols-2 gap-2">
                  {data.related.map(r => (
                    <li key={r.id}>
                      <Link to={`/stores/${r.slug}`} className="flex flex-col items-center gap-2 rounded-xl p-2.5 text-center text-sm font-medium transition-colors hover:bg-paper">
                        <StoreLogo name={r.name} url={r.logo_url} size="md" />
                        <span className="line-clamp-1">{r.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link to="/stores" className="btn-secondary mt-4 w-full">View all stores</Link>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
