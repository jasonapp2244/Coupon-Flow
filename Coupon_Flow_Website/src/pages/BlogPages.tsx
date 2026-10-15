import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowUpRight, CalendarDays, Clock, Link2, Search } from 'lucide-react';
import { SearchBox } from '../components/Layout';
import { RichText } from '../components/RichText';
import { Breadcrumbs, CardSkeletons, EmptyState, ErrorState, NotFound, Pager, breadcrumbJsonLd, type Crumb } from '../components/States';
import { withQuery } from '../lib/api';
import { categoryIcon } from '../lib/categoryIcon';
import { siteOrigin } from '../lib/head';
import { useApi, useDebounced, usePageMeta } from '../lib/hooks';
import { date, pageParam } from '../lib/format';
import { useSite } from '../store/site';
import { useToast } from '../store/toast';
import type { Blog, BlogPostData, Category, Paginated } from '../lib/types';

/** Cover colours for posts without a photo, picked by topic so one topic always looks the same. */
const COVER_TONES = [
  { bg: 'bg-ink-deep', fg: 'text-marigold', ticket: 'bg-marigold' },
  { bg: 'bg-deal', fg: 'text-white', ticket: 'bg-marigold' },
  { bg: 'bg-marigold', fg: 'text-ink', ticket: 'bg-ink' },
  { bg: 'bg-deal-soft', fg: 'text-deal-dark', ticket: 'bg-deal' },
];

function toneFor(key: string) {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COVER_TONES[hash % COVER_TONES.length];
}

/** The post's photo, or a generated cover: the topic's icon over a scatter of coupon tickets. */
export function BlogCover({ blog, className = 'aspect-[16/9]', large = false, compact = false }: {
  blog: Blog; className?: string; large?: boolean; /** Thumbnail: icon only, no tickets or label. */ compact?: boolean;
}) {
  if (blog.featured_image_url) {
    return <img src={blog.featured_image_url} alt="" loading={large ? 'eager' : 'lazy'} className={`${className} w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]`} />;
  }
  const topic = blog.category ?? 'Guide';
  const tone = toneFor(topic);
  const Icon = categoryIcon(topic);
  if (compact) {
    return <span className={`${className} flex w-full items-center justify-center ${tone.bg} ${tone.fg}`} aria-hidden="true"><Icon size={22} strokeWidth={1.75} /></span>;
  }
  return (
    <span className={`${className} relative flex w-full items-center justify-center overflow-hidden ${tone.bg}`} aria-hidden="true">
      <span className={`absolute -left-6 top-6 h-14 w-28 -rotate-12 rounded-lg opacity-25 ${tone.ticket}`} />
      <span className={`absolute -right-4 bottom-8 h-16 w-32 rotate-6 rounded-lg opacity-25 ${tone.ticket}`} />
      <span className={`absolute right-10 top-4 h-8 w-16 rotate-12 rounded-md opacity-15 ${tone.ticket}`} />
      <span className={`relative flex flex-col items-center gap-2 ${tone.fg}`}>
        <Icon size={large ? 64 : 44} strokeWidth={1.75} className="transition-transform duration-500 group-hover:scale-110" />
        <span className={`font-display font-extrabold tracking-tight ${large ? 'text-2xl' : 'text-lg'}`}>{topic}</span>
      </span>
    </span>
  );
}

/** "Electronics", "Oct 15, 2026" as one line under a card's cover. */
function PostMeta({ blog, className = '' }: { blog: Blog; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted ${className}`}>
      <span className="badge bg-marigold-soft text-ink">{blog.category ?? 'Guide'}</span>
      {blog.published_at && <span className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden="true" />{date(blog.published_at)}</span>}
    </p>
  );
}

export function BlogCard({ blog }: { blog: Blog }) {
  return (
    <Link to={`/blog/${blog.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-line transition hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgb(27_36_48/0.4)] hover:ring-ink">
      <span className="block overflow-hidden"><BlogCover blog={blog} /></span>
      <div className="flex flex-1 flex-col p-5">
        <PostMeta blog={blog} />
        <p className="mt-3 font-display text-xl font-semibold leading-snug">{blog.title}</p>
        {blog.excerpt && <p className="mt-2 text-sm leading-relaxed text-ink-soft line-clamp-3">{blog.excerpt}</p>}
        <span className="mt-auto flex items-center gap-1 pt-5 text-sm font-semibold text-deal-dark">
          Read the guide <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

/** The lead story at the top of the blog: a wide card with a big cover. */
function FeaturedPost({ blog }: { blog: Blog }) {
  return (
    <Link to={`/blog/${blog.slug}`} className="group grid overflow-hidden rounded-3xl bg-card ring-1 ring-line transition hover:shadow-[0_24px_50px_-24px_rgb(27_36_48/0.45)] hover:ring-ink lg:grid-cols-[1.15fr_1fr]">
      <span className="block overflow-hidden"><BlogCover blog={blog} large className="aspect-[16/10] h-full" /></span>
      <div className="flex flex-col justify-center p-6 sm:p-10">
        <p className="flex items-center gap-2 text-sm font-semibold text-deal-dark">Featured guide</p>
        <h2 className="mt-3 font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl">{blog.title}</h2>
        {blog.excerpt && <p className="mt-4 text-lg leading-relaxed text-ink-soft line-clamp-3">{blog.excerpt}</p>}
        <PostMeta blog={blog} className="mt-6" />
        <span className="btn-primary mt-7 self-start">
          Read the guide <ArrowUpRight size={16} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export function BlogListPage() {
  const { site_name } = useSite();
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

  usePageMeta('Blog', 'Shopping guides, deal round-ups and practical tips to help you spend less at your favourite stores.');

  const categories = useApi<{ data: Category[] }>('/public/categories?type=blog');
  const { data, loading, error, reload } = useApi<Paginated<Blog>>(withQuery('/public/blogs', { category, q, page, per_page: 9 }));
  const posts = data?.data ?? [];

  // The first page without filters leads with one big story: the admin's featured pick, else the newest post.
  const leadStory = !category && !q && page === 1 && posts.length > 1 ? (posts.find(p => p.is_featured) ?? posts[0]) : null;
  const grid = leadStory ? posts.filter(p => p.id !== leadStory.id) : posts;
  const topics = [{ slug: '', name: 'All topics' }, ...(categories.data?.data ?? [])];

  return (
    <>
      <section className="border-b border-line bg-card">
        <div className="page py-10 sm:py-14">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="page-title">The {site_name} blog</h1>
              <p className="mt-3 text-lg text-ink-soft">Shopping guides, deal round-ups and practical tips to help you spend less, written by people who love a bargain.</p>
            </div>
            <label className="relative w-full lg:max-w-xs">
              <span className="sr-only">Search articles</span>
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Search articles" className="field rounded-full pl-10" />
            </label>
          </div>
          <nav className="mt-8 flex gap-2 overflow-x-auto pb-1" aria-label="Topics">
            {topics.map(c => {
              const Icon = c.slug ? categoryIcon(c.name, c.slug) : null;
              return (
                <button key={c.slug} onClick={() => update({ category: c.slug })} aria-pressed={category === c.slug}
                  className={`chip shrink-0 ${category === c.slug ? 'chip-active' : ''}`}>
                  {Icon && <Icon size={15} aria-hidden="true" />}{c.name}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      <div className="page py-10">
        <section aria-label="Articles">
          {error && <ErrorState message={error} onRetry={reload} />}
          {loading && !data && <CardSkeletons />}
          {data && posts.length === 0 && (
            <EmptyState title="No articles found">
              Try a different word, or <button className="font-semibold text-deal-dark underline" onClick={() => { setText(''); setParams(new URLSearchParams(), { replace: true }); }}>see every article</button>.
            </EmptyState>
          )}
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {leadStory && <FeaturedPost blog={leadStory} />}
            {grid.length > 0 && (
              <>
                {leadStory && <h2 className="section-title mt-14">Latest articles</h2>}
                <ul className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${leadStory ? 'mt-6' : ''}`}>
                  {grid.map(b => <li key={b.id}><BlogCard blog={b} /></li>)}
                </ul>
              </>
            )}
          </div>
          <Pager meta={data?.meta ?? null} onPage={p => { update({ page: String(p) }); window.scrollTo(0, 0); }} />
        </section>

        <FindACode />
      </div>
    </>
  );
}

/** Closing band on blog pages: the reader is usually about to shop somewhere. */
function FindACode() {
  return (
    <section className="band-dark relative mt-20 overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12" aria-labelledby="find-code-heading">
      <h2 id="find-code-heading" className="font-display text-3xl font-extrabold tracking-tight">Looking for a code?</h2>
      <p className="mx-auto mt-3 max-w-md text-white/75">Search the store you're shopping at and see every code and deal in seconds.</p>
      <div className="mx-auto mt-7 max-w-xl text-left"><SearchBox size="lg" /></div>
    </section>
  );
}

/** About 200 words a minute, never less than one. */
function readingMinutes(text: string): number {
  return Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 200));
}

function ShareLinks({ title, path }: { title: string; path: string }) {
  const toast = useToast();
  const url = siteOrigin() + path;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast("Couldn't copy the link. Copy it from the address bar.", 'error');
    }
  };
  const btn = 'flex h-9 items-center justify-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-semibold text-ink-soft ring-1 ring-line transition-colors hover:text-ink hover:ring-ink';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={copy} className={btn}><Link2 size={15} aria-hidden="true" /> Copy link</button>
      <a className={btn} href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
        Share on X<span className="sr-only"> (opens in a new tab)</span>
      </a>
      <a className={btn} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
        Facebook<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const site = useSite();
  const { data, loading, error, status, reload } = useApi<BlogPostData>(`/public/blogs/${slug}`);
  const post = data?.data;

  const crumbs: Crumb[] = [{ label: 'Home', to: '/' }, { label: 'Blog', to: '/blog' }, { label: post?.title ?? '' }];

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
  if (!post || !data) {
    return <div className="page py-10">{loading ? <CardSkeletons count={1} className="mx-auto max-w-3xl" /> : error && <ErrorState message={error} onRetry={reload} />}</div>;
  }

  const author = post.author ?? `${site.site_name} team`;
  const minutes = readingMinutes(post.body ?? post.excerpt ?? '');

  return (
    <>
      <header className="border-b border-line bg-card">
        <div className="page py-8 sm:py-12">
          <Breadcrumbs items={crumbs} />
          <div className="mx-auto mt-8 max-w-3xl text-center">
            <span className="badge bg-marigold-soft px-3 py-1 text-sm text-ink">{post.category ?? 'Guide'}</span>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{post.title}</h1>
            {post.excerpt && <p className="mx-auto mt-5 max-w-2xl text-xl leading-relaxed text-ink-soft">{post.excerpt}</p>}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-display text-xs font-extrabold text-marigold" aria-hidden="true">{author.slice(0, 2).toUpperCase()}</span>
                {author}
              </span>
              {post.published_at && <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} aria-hidden="true" />{date(post.published_at)}</span>}
              <span className="inline-flex items-center gap-1.5"><Clock size={15} aria-hidden="true" />{minutes} min read</span>
            </div>
          </div>
        </div>
      </header>

      <div className="page py-10">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl ring-1 ring-line">
          <BlogCover blog={post} large className="aspect-[21/9]" />
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-12 lg:grid-cols-[1fr_17rem]">
          <article className="min-w-0 text-lg">
            <RichText text={post.body ?? ''} />
            <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold">Share this guide</p>
              <ShareLinks title={post.title} path={`/blog/${post.slug}`} />
            </div>
          </article>

          <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-24">
            <section className="panel p-5" aria-labelledby="aside-code-heading">
              <h2 id="aside-code-heading" className="font-display text-lg font-extrabold">Find a code</h2>
              <p className="mt-1 text-sm text-ink-soft">Search the store you're shopping.</p>
              <div className="mt-4"><SearchBox /></div>
            </section>
            {data.related.length > 0 && (
              <section className="panel p-5" aria-labelledby="aside-more-heading">
                <h2 id="aside-more-heading" className="font-display text-lg font-extrabold">Keep reading</h2>
                <ul className="mt-3 flex flex-col divide-y divide-line">
                  {data.related.slice(0, 3).map(b => (
                    <li key={b.id}>
                      <Link to={`/blog/${b.slug}`} className="group flex gap-3 py-3">
                        <span className="block h-14 w-20 shrink-0 overflow-hidden rounded-lg"><BlogCover blog={b} compact className="h-full" /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-snug line-clamp-2 group-hover:text-deal-dark">{b.title}</span>
                          <span className="mt-1 block text-xs text-muted">{date(b.published_at)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        {data.related.length > 0 && (
          <section className="mt-20" aria-labelledby="related-heading">
            <div className="flex items-end justify-between gap-4">
              <h2 id="related-heading" className="section-title">More guides</h2>
              <Link to="/blog" className="shrink-0 text-sm font-semibold text-deal-dark underline decoration-marigold decoration-2 underline-offset-4 hover:decoration-deal">All articles</Link>
            </div>
            <ul className="mt-6 grid gap-6 sm:grid-cols-3">
              {data.related.map(b => <li key={b.id}><BlogCard blog={b} /></li>)}
            </ul>
          </section>
        )}

        <FindACode />
      </div>
    </>
  );
}
