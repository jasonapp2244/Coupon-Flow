import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { ChevronDown, Menu, Search, X } from 'lucide-react';
import { api, withQuery } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { useSite } from '../store/site';
import CouponRevealModal from './CouponRevealModal';
import { StoreLogo } from './States';
import type { Category, SearchResults } from '../lib/types';

function Logo() {
  const { site_name } = useSite();
  return (
    <Link to="/" className="flex items-center gap-2 shrink-0" aria-label={`${site_name} home`}>
      <span className="flex h-8 w-11 overflow-hidden rounded-md ring-2 ring-ink" aria-hidden="true">
        <span className="w-7 bg-marigold" />
        <span className="w-4 border-l-2 border-dashed border-ink bg-white" />
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight">{site_name}</span>
    </Link>
  );
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-semibold ${isActive ? 'text-deal' : 'text-ink-soft hover:text-ink'}`;

/** Closes a popover on outside click and on Escape (returning focus to its trigger). */
function useDismiss(open: boolean, close: () => void, box: RefObject<HTMLElement | null>, trigger?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) close(); };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { close(); trigger?.current?.focus(); } };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open, close, box, trigger]);
}

/** Search box with instant suggestions (stores and coupons); Enter searches all coupons. */
export function SearchBox({ onDone, size = 'md', autoFocus = false }: { onDone?: () => void; size?: 'md' | 'lg'; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [active, setActive] = useState(-1);
  const term = useDebounced(q.trim(), 200);

  useDismiss(open, () => setOpen(false), box);

  useEffect(() => {
    if (term.length < 2) { setResults(null); return; }
    let stale = false;
    api.get<SearchResults>(withQuery('/public/search', { q: term }))
      .then(res => { if (!stale) { setResults(res); setActive(-1); } })
      .catch(() => { if (!stale) setResults(null); });
    return () => { stale = true; };
  }, [term]);

  const options = results
    ? [
        ...results.stores.map(s => ({ key: `s${s.id}`, to: `/stores/${s.slug}`, label: s.name, hint: `${s.coupons_count ?? 0} coupons`, logo: s })),
        ...results.coupons.map(c => ({ key: `c${c.id}`, to: `/stores/${c.store?.slug ?? ''}`, label: c.title, hint: c.store?.name ?? '', logo: null })),
      ]
    : [];

  const go = (to: string) => { navigate(to); setQ(''); setOpen(false); onDone?.(); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (active >= 0 && options[active]) { go(options[active].to); return; }
    if (q.trim()) go(`/coupons?q=${encodeURIComponent(q.trim())}`);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!options.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, options.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, -1)); }
  };

  const large = size === 'lg';
  const showList = open && term.length >= 2 && results !== null;

  return (
    <div ref={box} className="relative w-full">
      <form onSubmit={submit} role="search">
        <Search size={large ? 20 : 16} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ${large ? 'left-4' : 'left-3'}`} aria-hidden="true" />
        <input
          value={q} autoFocus={autoFocus}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder="Search a store or brand" aria-label="Search stores and coupons"
          role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 && options[active] ? `${listId}-${options[active].key}` : undefined}
          className={large
            ? 'w-full rounded-xl bg-card py-4 pl-12 pr-32 text-lg ring-2 ring-ink placeholder:text-muted focus:outline-none focus:ring-deal'
            : 'w-full rounded-lg bg-paper py-2 pl-9 pr-3 text-sm ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-deal'}
        />
        {large && <button type="submit" className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5">Search</button>}
      </form>
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-auto rounded-xl bg-card py-2 text-left shadow-xl ring-1 ring-line">
          {options.length === 0 && <li className="px-4 py-3 text-sm text-muted">No stores or coupons match “{term}”. Press Enter to search all coupons.</li>}
          {options.map((o, i) => (
            <li key={o.key} id={`${listId}-${o.key}`} role="option" aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); go(o.to); }} onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? 'bg-paper' : ''}`}>
              {o.logo ? <StoreLogo name={o.logo.name} url={o.logo.logo_url} size="sm" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marigold-soft text-xs font-bold" aria-hidden="true">%</span>}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{o.label}</span>
                <span className="block truncate text-xs text-muted">{o.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoriesMenu() {
  const { data } = useApi<{ data: Category[] }>('/public/categories?type=store');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  useDismiss(open, () => setOpen(false), box, trigger);
  useEffect(() => { setOpen(false); }, [pathname]);

  const categories = data?.data ?? [];
  if (!categories.length) return null;

  return (
    <div ref={box} className="relative">
      <button ref={trigger} onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
        Categories <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-40 grid w-72 grid-cols-2 gap-1 rounded-xl bg-card p-2 shadow-xl ring-1 ring-line">
          {categories.map(c => (
            <Link key={c.id} to={`/categories/${c.slug}`} className="rounded-lg px-3 py-2 text-sm hover:bg-paper">
              <span className="font-semibold">{c.name}</span>
              {c.items_count !== undefined && <span className="block text-xs text-muted">{c.items_count} stores</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
      <div className="page flex h-16 items-center gap-3">
        <Logo />
        <nav className="hidden lg:flex items-center" aria-label="Main">
          <NavLink to="/coupons" className={navLink}>Coupons</NavLink>
          <NavLink to="/stores" className={navLink}>Stores</NavLink>
          <CategoriesMenu />
          <NavLink to="/blog" className={navLink}>Blog</NavLink>
        </nav>
        {pathname !== '/' && <div className="hidden flex-1 md:block md:max-w-sm md:ml-auto"><SearchBox /></div>}
        <div className={`ml-auto flex items-center gap-1 ${pathname !== '/' ? 'md:ml-0' : ''}`}>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-paper lg:hidden" onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileOpen && <MobileMenu />}
    </header>
  );
}

function MobileMenu() {
  const item = 'block rounded-md px-3 py-2.5 text-base font-semibold hover:bg-paper';
  return (
    <div className="border-t border-line px-4 pb-4 pt-3 lg:hidden">
      <SearchBox />
      <nav className="mt-3 flex flex-col" aria-label="Mobile">
        <Link to="/coupons" className={item}>Coupons</Link>
        <Link to="/stores" className={item}>Stores</Link>
        <Link to="/categories" className={item}>Categories</Link>
        <Link to="/blog" className={item}>Blog</Link>
      </nav>
    </div>
  );
}

function Footer() {
  const { site_name, support_email } = useSite();
  const col = 'flex flex-col gap-2 text-sm';
  const link = 'text-ink-soft hover:text-ink';
  const heading = 'mb-1 text-sm font-semibold text-ink';

  return (
    <footer className="mt-24 border-t border-line bg-card">
      <div className="page grid grid-cols-2 gap-10 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 lg:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-soft">
            Working coupon codes and deals for the stores you already shop.
          </p>
          {support_email && <p className="mt-4 text-sm text-ink-soft">Questions: <a href={`mailto:${support_email}`} className="font-semibold text-ink underline underline-offset-2">{support_email}</a></p>}
        </div>
        <nav className={col} aria-label="Browse">
          <p className={heading}>Browse</p>
          <Link to="/coupons" className={link}>All coupons</Link>
          <Link to="/stores" className={link}>Stores A to Z</Link>
          <Link to="/categories" className={link}>Categories</Link>
          <Link to="/blog" className={link}>Blog</Link>
        </nav>
        <nav className={col} aria-label="Help">
          <p className={heading}>Help</p>
          <Link to="/contact" className={link}>Contact us</Link>
        </nav>
        <nav className={col} aria-label="Legal">
          <p className={heading}>About</p>
          <Link to="/about" className={link}>About {site_name}</Link>
          <Link to="/terms" className={link}>Terms of use</Link>
          <Link to="/privacy" className={link}>Privacy policy</Link>
          <Link to="/affiliate-disclosure" className={link}>Affiliate disclosure</Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="page py-5 text-xs text-muted">
          © {new Date().getFullYear()} {site_name}.
          {' '}Some links earn us a commission at no cost to you.
        </p>
      </div>
    </footer>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <Header />
      <main id="content" className="flex-1">{children}</main>
      <Footer />
      <CouponRevealModal />
    </div>
  );
}
