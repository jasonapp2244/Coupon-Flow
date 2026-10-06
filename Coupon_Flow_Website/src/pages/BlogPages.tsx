import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { RichText } from '../components/RichText';
import { Breadcrumbs, EmptyState, ErrorState, NotFound, Pager, Spinner, breadcrumbJsonLd, type Crumb } from '../components/States';
import { withQuery } from '../lib/api';
import { useApi, useDebounced, usePageMeta } from '../lib/hooks';
import { date, pageParam } from '../lib/format';
import { useSite } from '../store/site';
import type { Blog, BlogPostData, Category, Paginated } from '../lib/types';

export function BlogCard({ blog }: { blog: Blog }) {
  return (
    <Link to={`/blog/${blog.slug}`} className="group flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-line hover:ring-ink">
      {blog.featured_image_url
        ? <img src={blog.featured_image_url} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
        : <span className="block h-2 w-full bg-marigold" aria-hidden="true" />}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm text-muted">{blog.category ?? 'Guide'}, {date(blog.published_at)}</p>
        <p className="mt-2 font-display text-xl font-semibold leading-snug group-hover:text-deal">{blog.title}</p>
        {blog.excerpt && <p className="mt-2 text-sm text-ink-soft line-clamp-3">{blog.excerpt}</p>}
      </div>
    </Link>
  );
}

export function BlogListPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const page = pageParam(params.get('page'));

  const [text, setText] = useState(q);
  const debounced = useDebounced(text);
  useEffect(() => { setText(q); }, [q]);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(paramsRef.current);
    for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debounced.trim() !== (paramsRef.current.get('q') ?? '')) update({ q: debounced.trim() });
  }, [debounced]);

  usePageMeta('Shopping guides', 'Deal round-ups, store guides and ways to pay less at the stores you use.');

  const categories = useApi<{ data: Category[] }>('/public/categories?type=blog');
  const { data, loading, error, reload } = useApi<Paginated<Blog>>(withQuery('/public/blogs', { category, q, page, per_page: 9 }));
  const posts = data?.data ?? [];

  return (
    <div className="page py-10">
      <h1 className="page-title">Shopping guides</h1>
      <p className="mt-2 text-ink-soft">Deal round-ups and ways to pay less at the stores you use.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Search articles" aria-label="Search articles" className="field sm:max-w-xs" />
        <div className="flex flex-wrap gap-2">
          {[{ slug: '', name: 'All' }, ...(categories.data?.data ?? [])].map(c => (
            <button key={c.slug} onClick={() => update({ category: c.slug })} aria-pressed={category === c.slug}
              className={`chip ${category === c.slug ? 'chip-active' : ''}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-8" aria-label="Articles">
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <Spinner />}
        {data && posts.length === 0 && <EmptyState title="No articles match that">Try another word, or pick a different topic.</EmptyState>}
        <ul className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
          {posts.map(b => <li key={b.id}><BlogCard blog={b} /></li>)}
        </ul>
        <Pager meta={data?.meta ?? null} onPage={p => { update({ page: String(p) }); window.scrollTo(0, 0); }} />
      </section>
    </div>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const site = useSite();
  const { data, loading, error, status, reload } = useApi<BlogPostData>(`/public/blogs/${slug}`);
  const post = data?.data;

  const crumbs: Crumb[] = [{ label: 'Home', to: '/' }, { label: 'Guides', to: '/blog' }, { label: post?.title ?? '' }];

  usePageMeta(post ? (post.meta_title || post.title) : null, {
    description: post?.meta_description || post?.excerpt,
    type: 'article',
    image: post?.featured_image_url,
    jsonLd: post ? [breadcrumbJsonLd(crumbs), {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      ...(post.featured_image_url ? { image: post.featured_image_url } : {}),
      ...(post.published_at ? { datePublished: post.published_at } : {}),
      author: { '@type': post.author ? 'Person' : 'Organization', name: post.author ?? site.site_name },
      publisher: { '@type': 'Organization', name: site.site_name },
    }] : null,
  });

  if (status === 404) return <NotFound what="article" />;
  if (!post || !data) return <div className="page py-10">{loading ? <Spinner /> : error && <ErrorState message={error} onRetry={reload} />}</div>;

  return (
    <div className="page py-8">
      <Breadcrumbs items={crumbs} />
      <article className="mx-auto mt-6 max-w-2xl">
        <p className="text-sm text-muted">{post.category ?? 'Guide'}, {date(post.published_at)}{post.author ? `, by ${post.author}` : ''}</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-xl text-ink-soft">{post.excerpt}</p>}
        {post.featured_image_url && <img src={post.featured_image_url} alt="" className="mt-8 w-full rounded-xl" />}
        <div className="mt-6 text-lg">
          <RichText text={post.body ?? ''} />
        </div>
        <div className="mt-12 rounded-xl bg-marigold-soft p-6">
          <p className="font-display text-xl font-semibold">Looking for a code?</p>
          <p className="mt-1 text-ink-soft">Browse every live coupon, or search for the store you're about to shop.</p>
          <Link to="/coupons" className="btn-primary mt-4">Browse coupons</Link>
        </div>
      </article>

      {data.related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-heading">
          <h2 id="related-heading" className="section-title">More guides</h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-3">
            {data.related.map(b => <li key={b.id}><BlogCard blog={b} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
