import { Link, useParams } from 'react-router';
import CouponTicket from '../components/CouponTicket';
import { CardSkeletons, EmptyState, ErrorState, NotFound, PageHeader, StoreCard, TicketSkeletons, breadcrumbJsonLd, type Crumb } from '../components/States';
import { categoryIcon } from '../lib/categoryIcon';
import { useApi, usePageMeta } from '../lib/hooks';
import type { Category, CategoryPageData } from '../lib/types';

export function CategoriesPage() {
  const { data, loading, error, reload } = useApi<{ data: Category[] }>('/public/categories?type=store');
  const categories = data?.data ?? [];

  usePageMeta('Shop by category', 'Browse promo codes and deals by category, from fashion and beauty to electronics and travel.');

  return (
    <>
      <PageHeader title="Shop by category" intro="Pick a category to see every store and offer in it." />
      <div className="page py-10">
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <CardSkeletons />}
        {data && categories.length === 0 && <EmptyState title="Categories are on their way">Search for a store in the meantime.</EmptyState>}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(c => {
            const Icon = categoryIcon(c.name, c.slug);
            return (
              <li key={c.id}>
                <Link to={`/categories/${c.slug}`} className="group flex h-full gap-4 rounded-2xl bg-card p-5 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-marigold-soft transition-colors group-hover:bg-marigold"><Icon size={22} aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block font-display text-xl font-semibold">{c.name}</span>
                    <span className="block text-sm text-muted">{c.items_count ?? 0} {c.items_count === 1 ? 'store' : 'stores'}</span>
                    {c.description && <span className="mt-2 block text-sm text-ink-soft line-clamp-2">{c.description}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
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
  if (!category || !data) return <div className="page py-10">{loading ? <TicketSkeletons /> : error && <ErrorState message={error} onRetry={reload} />}</div>;
  const Icon = categoryIcon(category.name, category.slug);

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title={<span className="flex items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-marigold" aria-hidden="true"><Icon size={28} /></span>{category.name} coupons</span>}
        intro={category.description || `${data.stores.length} ${data.stores.length === 1 ? 'store' : 'stores'} with live codes and deals.`}
      />
      <div className="page py-2">
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
            <Link to={`/coupons?category=${category.slug}`} className="shrink-0 text-sm font-semibold text-deal-dark underline decoration-marigold decoration-2 underline-offset-4 hover:decoration-deal">See all</Link>
          </div>
          {data.coupons.length === 0
            ? <div className="mt-5"><EmptyState title="No offers in this category right now">We add new codes as stores release them, so check back soon.</EmptyState></div>
            : <div className="mt-5 flex flex-col gap-4">{data.coupons.map(c => <CouponTicket key={c.id} coupon={c} />)}</div>}
        </section>
      </div>
    </>
  );
}
