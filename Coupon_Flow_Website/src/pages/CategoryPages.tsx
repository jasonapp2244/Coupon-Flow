import { Link, useParams } from 'react-router';
import CouponTicket from '../components/CouponTicket';
import { Breadcrumbs, EmptyState, ErrorState, NotFound, Spinner, StoreCard, breadcrumbJsonLd, type Crumb } from '../components/States';
import { useApi, usePageMeta } from '../lib/hooks';
import type { Category, CategoryPageData } from '../lib/types';

export function CategoriesPage() {
  const { data, loading, error, reload } = useApi<{ data: Category[] }>('/public/categories?type=store');
  const categories = data?.data ?? [];

  usePageMeta('Shop by category', 'Coupon codes and deals grouped by what you shop for.');

  return (
    <div className="page py-10">
      <h1 className="page-title">Shop by category</h1>
      <p className="mt-2 text-ink-soft">Every store, grouped by what you shop for.</p>
      <div className="mt-8">
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <Spinner />}
        {data && categories.length === 0 && <EmptyState title="No categories yet" />}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(c => (
            <li key={c.id}>
              <Link to={`/categories/${c.slug}`} className="flex h-full flex-col rounded-xl bg-card p-5 ring-1 ring-line hover:ring-ink">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-display text-xl font-semibold">{c.name}</span>
                  <span className="rounded-full bg-marigold-soft px-2.5 py-0.5 text-xs font-semibold">{c.items_count ?? 0} stores</span>
                </span>
                {c.description && <span className="mt-2 text-sm text-ink-soft line-clamp-2">{c.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CategoryPage() {
  const { slug } = useParams();
  const { data, loading, error, status, reload } = useApi<CategoryPageData>(`/public/categories/${slug}`);
  const category = data?.data;
  const crumbs: Crumb[] = [{ label: 'Home', to: '/' }, { label: 'Categories', to: '/categories' }, { label: category?.name ?? '' }];

  usePageMeta(category ? `${category.name} coupons and deals` : null, {
    description: category?.description || (category ? `Live ${category.name.toLowerCase()} coupon codes and deals from every store we list.` : null),
    jsonLd: category ? breadcrumbJsonLd(crumbs) : null,
  });

  if (status === 404) return <NotFound what="category" />;
  if (!category || !data) return <div className="page py-10">{loading ? <Spinner /> : error && <ErrorState message={error} onRetry={reload} />}</div>;

  return (
    <div className="page py-8">
      <Breadcrumbs items={crumbs} />
      <h1 className="page-title mt-6">{category.name} coupons</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">{category.description || `${data.stores.length} ${data.stores.length === 1 ? 'store' : 'stores'} with live codes and deals.`}</p>

      {data.stores.length > 0 && (
        <section className="mt-10" aria-labelledby="stores-heading">
          <h2 id="stores-heading" className="section-title">Stores</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.stores.map(s => <li key={s.id}><StoreCard store={s} /></li>)}
          </ul>
        </section>
      )}

      <section className="mt-12" aria-labelledby="coupons-heading">
        <div className="flex items-end justify-between gap-4">
          <h2 id="coupons-heading" className="section-title">Latest {category.name.toLowerCase()} coupons</h2>
          <Link to={`/coupons?category=${category.slug}`} className="shrink-0 text-sm font-semibold text-deal hover:underline">See all</Link>
        </div>
        {data.coupons.length === 0
          ? <div className="mt-5"><EmptyState title="No live coupons in this category right now">New codes are added regularly.</EmptyState></div>
          : <div className="mt-5 flex flex-col gap-4">{data.coupons.map(c => <CouponTicket key={c.id} coupon={c} />)}</div>}
      </section>
    </div>
  );
}
