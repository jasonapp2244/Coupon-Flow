import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard, Store, Tag, FileText, BarChart2, Plug, Settings, ChevronDown, ChevronRight,
  Bell, HelpCircle, Search, X, Menu, User, LogOut, ShoppingCart, Clock, Trash2,
  ChevronLeft, Ticket, FolderOpen, ShieldCheck, Users, History, House,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { allows, ROLE_LABELS, type Permission } from '../lib/permissions';
import { ConfirmModal } from './Modal';
import { api, withQuery } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import { timeAgo } from '../lib/format';
import type { Blog, Coupon, Paginated, StaffRole, Store as StoreModel, User as UserModel } from '../lib/types';

interface NavLeaf { label: string; path: string; icon: ReactNode; need?: Permission }

interface NavItem {
  label: string;
  path?: string;
  icon: ReactNode;
  need?: Permission;
  children?: NavLeaf[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={16} /> },
  {
    label: 'Stores', icon: <Store size={16} />, children: [
      { label: 'All Stores', path: '/stores', icon: <Store size={14} /> },
      { label: 'Create Store', path: '/stores/new', icon: <Store size={14} />, need: 'write' },
      { label: 'Categories', path: '/store-categories', icon: <FolderOpen size={14} /> },
      { label: 'Trash', path: '/trash', icon: <Trash2 size={14} /> },
    ],
  },
  {
    label: 'Coupons', icon: <Tag size={16} />, children: [
      { label: 'All Coupons', path: '/coupons', icon: <Tag size={14} /> },
      { label: 'Create Coupon', path: '/coupons/new', icon: <Ticket size={14} />, need: 'write' },
      { label: 'Ended Coupons', path: '/coupons/expired', icon: <Clock size={14} /> },
      { label: 'Redemptions', path: '/redemptions', icon: <ShoppingCart size={14} /> },
    ],
  },
  {
    label: 'Blogs', icon: <FileText size={16} />, children: [
      { label: 'All Blogs', path: '/blogs', icon: <FileText size={14} /> },
      { label: 'Create Blog', path: '/blogs/new', icon: <FileText size={14} />, need: 'write' },
      { label: 'Categories', path: '/blog-categories', icon: <FolderOpen size={14} /> },
    ],
  },
  { label: 'Analytics', path: '/analytics', icon: <BarChart2 size={16} /> },
  {
    label: 'Brand Feeds', icon: <Plug size={16} />, children: [
      { label: 'Feeds & Imports', path: '/feeds', icon: <Plug size={14} /> },
      { label: 'Sync History', path: '/sync-history', icon: <Clock size={14} /> },
    ],
  },
  {
    label: 'Settings', icon: <Settings size={16} />, children: [
      { label: 'My Account', path: '/settings/account', icon: <User size={14} /> },
      { label: 'General', path: '/settings/general', icon: <Settings size={14} />, need: 'admin' },
      { label: 'Homepage', path: '/settings/homepage', icon: <House size={14} />, need: 'admin' },
      { label: 'Notifications', path: '/settings/notifications', icon: <Bell size={14} />, need: 'admin' },
      { label: 'SEO', path: '/settings/seo', icon: <BarChart2 size={14} />, need: 'admin' },
      { label: 'Security', path: '/settings/security', icon: <ShieldCheck size={14} />, need: 'admin' },
      { label: 'Staff', path: '/staff', icon: <Users size={14} />, need: 'admin' },
      { label: 'Activity Log', path: '/activity', icon: <History size={14} />, need: 'admin' },
    ],
  },
];

/** The menu without the pages this role can't use. */
function visibleNav(role: UserModel['role']): NavItem[] {
  return navItems
    .filter(item => !item.need || allows(role, item.need))
    .map(item => item.children ? { ...item, children: item.children.filter(c => !c.need || allows(role, c.need)) } : item)
    .filter(item => !item.children || item.children.length > 0);
}

const breadcrumbRules: [RegExp, string[]][] = [
  [/^\/$/, ['Dashboard']],
  [/^\/stores$/, ['Stores', 'All Stores']],
  [/^\/stores\/new$/, ['Stores', 'Create Store']],
  [/^\/stores\/\d+\/edit$/, ['Stores', 'Edit Store']],
  [/^\/store-categories$/, ['Stores', 'Categories']],
  [/^\/trash$/, ['Stores', 'Trash']],
  [/^\/coupons$/, ['Coupons', 'All Coupons']],
  [/^\/coupons\/new$/, ['Coupons', 'Create Coupon']],
  [/^\/coupons\/\d+\/edit$/, ['Coupons', 'Edit Coupon']],
  [/^\/coupons\/expired$/, ['Coupons', 'Ended Coupons']],
  [/^\/redemptions$/, ['Coupons', 'Redemptions']],
  [/^\/blogs$/, ['Blogs', 'All Blogs']],
  [/^\/blogs\/new$/, ['Blogs', 'Create Blog']],
  [/^\/blogs\/\d+\/edit$/, ['Blogs', 'Edit Blog']],
  [/^\/blog-categories$/, ['Blogs', 'Categories']],
  [/^\/analytics$/, ['Analytics']],
  [/^\/feeds$/, ['Brand Feeds', 'Feeds & Imports']],
  [/^\/sync-history$/, ['Brand Feeds', 'Sync History']],
  [/^\/staff$/, ['Settings', 'Staff']],
  [/^\/activity$/, ['Settings', 'Activity Log']],
  [/^\/settings\/security$/, ['Settings', 'Security']],
  [/^\/settings\/general$/, ['Settings', 'General']],
  [/^\/settings\/seo$/, ['Settings', 'SEO']],
  [/^\/settings\/notifications$/, ['Settings', 'Notifications']],
  [/^\/settings\/account$/, ['Settings', 'My Account']],
];

interface SearchResult { type: string; label: string; path: string }

/** Header search: queries stores, coupons and blogs in parallel (first few matches of each). */
function useGlobalSearch(query: string) {
  const term = useDebounced(query.trim(), 250);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!term) { setResults([]); return; }
    let stale = false;
    setLoading(true);

    Promise.all([
      api.get<Paginated<StoreModel>>(withQuery('/admin/stores', { q: term, per_page: 3 })),
      api.get<Paginated<Coupon>>(withQuery('/admin/coupons', { q: term, per_page: 3 })),
      api.get<Paginated<Blog>>(withQuery('/admin/blogs', { q: term, per_page: 2 })),
    ])
      .then(([stores, coupons, blogs]) => {
        if (stale) return;
        setResults([
          ...stores.data.map(s => ({ type: 'Store', label: s.name, path: `/stores/${s.id}/edit` })),
          ...coupons.data.map(c => ({ type: 'Coupon', label: c.title, path: `/coupons/${c.id}/edit` })),
          ...blogs.data.map(b => ({ type: 'Blog', label: b.title, path: `/blogs/${b.id}/edit` })),
        ]);
      })
      .catch(() => { if (!stale) setResults([]); })
      .finally(() => { if (!stale) setLoading(false); });

    return () => { stale = true; };
  }, [term]);

  return { results, loading, term };
}

export default function Layout({ children }: { children: ReactNode }) {
  const {
    user, logout, notifications, unreadCount, markNotificationRead, markAllNotificationsRead,
  } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(['Stores', 'Coupons', 'Blogs', 'Integrations', 'Settings']);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { results: searchResults, loading: searching, term: searchTerm } = useGlobalSearch(searchQuery);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close the mobile drawer after navigating.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const go = (path: string) => navigate(path);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  const isChildActive = (item: NavItem) => item.children?.some(c => c.path === pathname);
  const breadcrumbs = breadcrumbRules.find(([re]) => re.test(pathname))?.[1] ?? ['Dashboard'];
  const initial = user.name.charAt(0).toUpperCase() || 'A';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 h-14 border-b border-white/10 flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/40">
          <Tag size={13} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="font-bold text-white text-sm tracking-tight">Coupon Follow</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visibleNav(user.role).map(item => {
          const hasChildren = !!item.children?.length;
          const isOpen = openMenus.includes(item.label);
          const isActive = item.path === pathname || isChildActive(item);

          if (!hasChildren) {
            return (
              <button
                key={item.label}
                onClick={() => item.path && go(item.path)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5
                  ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white'}
                  ${collapsed ? 'justify-center' : ''}`}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          }

          return (
            <div key={item.label} className="mb-0.5">
              <button
                onClick={() => !collapsed && toggleMenu(item.label)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? 'text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}
                  ${collapsed ? 'justify-center' : ''}`}
              >
                {item.icon}
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </>
                )}
              </button>
              {!collapsed && isOpen && (
                <div className="ml-3 mt-0.5 border-l border-white/10 pl-3 space-y-0.5">
                  {item.children!.map(child => (
                    <button
                      key={child.label}
                      onClick={() => go(child.path)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors
                        ${pathname === child.path ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                    >
                      {child.icon}
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <ChevronLeft size={14} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 transition-all duration-200 bg-[#0D1117] ${collapsed ? 'w-[60px]' : 'w-56'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 bg-[#0D1117] flex flex-col h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center h-14 px-4 lg:px-5 bg-white border-b border-slate-200 flex-shrink-0 gap-4">
          <button className="lg:hidden text-slate-500" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-1 min-w-0">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5 truncate">
                {i > 0 && <ChevronRight size={12} className="flex-shrink-0" />}
                <span className={i === breadcrumbs.length - 1 ? 'text-slate-800 font-medium' : ''}>{crumb}</span>
              </span>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Global Search */}
            <div ref={searchRef} className="relative">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs hover:bg-slate-200 transition-colors cursor-text"
                onClick={() => setSearchOpen(true)}
              >
                <Search size={13} />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search..."
                  className="bg-transparent outline-none w-28 placeholder:text-slate-400"
                />
              </div>
              {searchOpen && searchTerm && (
                <div className="absolute top-9 left-0 w-72 bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-1.5">
                  {searchResults.length > 0 ? (
                    <>
                      <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Results</p>
                      {searchResults.map(r => (
                        <button
                          key={r.path}
                          onClick={() => { go(r.path); setSearchQuery(''); setSearchOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left"
                        >
                          <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{r.type}</span>
                          <span className="text-sm text-slate-700 truncate">{r.label}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <p className="py-3 text-center text-sm text-slate-400">{searching ? 'Searching…' : `No results for "${searchTerm}"`}</p>
                  )}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); setHelpOpen(false); }}
                aria-label="Show notifications"
                className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">Notifications</span>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && <button onClick={markAllNotificationsRead} className="text-xs text-blue-600 hover:underline">Mark all read</button>}
                      <button onClick={() => setNotifOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-400">No notifications yet</p>}
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`px-4 py-3 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 ${!n.read ? 'bg-blue-50/40' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                          <div className={!n.read ? '' : 'ml-3.5'}>
                            <p className="text-xs text-slate-700 font-medium">{n.text}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{timeAgo(n.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Help */}
            <div className="relative">
              <button
                onClick={() => { setHelpOpen(!helpOpen); setNotifOpen(false); setUserMenuOpen(false); }}
                aria-label="Help"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <HelpCircle size={16} />
              </button>
              {helpOpen && (
                <div className="absolute right-0 top-10 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-40 p-4">
                  <h3 className="font-semibold text-slate-800 text-sm mb-2">Need help?</h3>
                  <p className="text-xs text-slate-500 mb-3">Contact support for assistance with the Coupon Follow admin dashboard.</p>
                  <a href="mailto:support@couponfollow.com" className="block text-xs text-blue-600 hover:underline py-1">Contact Support</a>
                  <a href="mailto:support@couponfollow.com?subject=Bug%20report" className="block text-xs text-blue-600 hover:underline py-1">Report a Bug</a>
                  <button onClick={() => setHelpOpen(false)} aria-label="Close" className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X size={14} /></button>
                </div>
              )}
            </div>

            {/* Avatar / user menu */}
            <div className="relative ml-1">
              <button
                onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); setHelpOpen(false); }}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">{initial}</div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-medium text-slate-800 leading-none">{user.name}</p>
                  <p className="text-[10px] text-slate-400 leading-none mt-0.5">{user.email}</p>
                </div>
                <ChevronDown size={12} className="text-slate-400 hidden sm:block" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-10 w-52 bg-white rounded-xl border border-slate-200 shadow-lg z-40 py-1 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>
                    <p className="mt-1.5 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {ROLE_LABELS[user.role as StaffRole]?.label ?? user.role}
                    </p>
                  </div>
                  <button onClick={() => { go('/settings/account'); setUserMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    <User size={14} className="text-slate-400" /> My Profile
                  </button>
                  {allows(user.role, 'admin') && (
                    <button onClick={() => { go('/settings/general'); setUserMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                      <Settings size={14} className="text-slate-400" /> Settings
                    </button>
                  )}
                  <button onClick={() => { setHelpOpen(true); setUserMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    <HelpCircle size={14} className="text-slate-400" /> Help & Support
                  </button>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); setShowLogoutModal(true); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {children}
        </main>
      </div>

      <ConfirmModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={async () => { setSigningOut(true); await logout(); }}
        loading={signingOut}
        title="Sign out?"
        message="Are you sure you want to sign out of Coupon Follow?"
        confirmLabel="Sign Out"
      />
    </div>
  );
}
