import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Lock } from 'lucide-react';
import { AppProvider, useApp, useCan } from './store/AppContext';
import { TwoFactorSetup } from './components/TwoFactorSetup';
import { isStaff, type Permission } from './lib/permissions';
import Layout from './components/Layout';
import ToastContainer from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import StoresPage from './pages/StoresPage';
import CreateStorePage from './pages/CreateStorePage';
import CouponsPage from './pages/CouponsPage';
import CreateCouponPage from './pages/CreateCouponPage';
import OrdersPage from './pages/OrdersPage';
import RedemptionsPage from './pages/RedemptionsPage';
import BrandFeedsPage from './pages/IntegrationsPage';
import SyncHistoryPage from './pages/SyncHistoryPage';
import BlogsPage from './pages/BlogsPage';
import CreateBlogPage from './pages/CreateBlogPage';
import CategoriesPage from './pages/CategoriesPage';
import TrashPage from './pages/TrashPage';
import SettingsPage from './pages/SettingsPage';
import StaffPage from './pages/StaffPage';
import ActivityLogPage from './pages/ActivityLogPage';
import { api, clearToken, getToken, onTwoFactorRequired, onUnauthorized } from './lib/api';
import type { User } from './lib/types';

// The chart pages pull in Recharts; loading them on demand keeps the login bundle small.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

function Spinner({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen bg-slate-50' : 'py-24'}`}>
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** A page the signed-in role can't use: say so instead of showing buttons that would fail. */
function Need({ permission, children }: { permission: Permission; children: ReactNode }) {
  if (useCan(permission)) return children;
  return (
    <div className="max-w-md mx-auto py-24 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center"><Lock size={20} className="text-slate-400" /></div>
      <h1 className="text-lg font-semibold text-slate-800">{permission === 'admin' ? 'Admins only' : 'Read-only access'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {permission === 'admin' ? 'Only an admin can open this page.' : 'Your role can view the dashboard and lists but not change them.'} Ask an admin if you need access.
      </p>
    </div>
  );
}

/** Settings → Security requires two-step login and this account has none: set it up first. */
function TwoFactorGate({ onDone }: { onDone: () => void }) {
  const { logout } = useApp();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h1 className="text-lg font-semibold text-slate-800">Set up two-step login to continue</h1>
        <p className="mt-1 mb-5 text-sm text-slate-500">An admin has made two-step login required for every staff account.</p>
        <TwoFactorSetup onEnabled={onDone} />
        <button onClick={logout} className="mt-6 text-sm text-slate-500 hover:text-slate-700">Sign out</button>
      </div>
    </div>
  );
}

function AdminRoutes() {
  const { pathname } = useLocation();

  return (
    // Keyed by path so moving to another page clears an earlier failure.
    <ErrorBoundary key={pathname}>
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route index element={<Dashboard />} />

        <Route path="stores" element={<StoresPage />} />
        <Route path="stores/new" element={<Need permission="write"><CreateStorePage /></Need>} />
        <Route path="stores/:id/edit" element={<Need permission="write"><CreateStorePage /></Need>} />
        <Route path="store-categories" element={<CategoriesPage type="store" />} />

        <Route path="coupons" element={<CouponsPage key={pathname} />} />
        <Route path="coupons/expired" element={<CouponsPage key={pathname} expiredOnly />} />
        <Route path="coupons/new" element={<Need permission="write"><CreateCouponPage /></Need>} />
        <Route path="coupons/:id/edit" element={<Need permission="write"><CreateCouponPage /></Need>} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="redemptions" element={<RedemptionsPage />} />

        <Route path="blogs" element={<BlogsPage />} />
        <Route path="blogs/new" element={<Need permission="write"><CreateBlogPage /></Need>} />
        <Route path="blogs/:id/edit" element={<Need permission="write"><CreateBlogPage /></Need>} />
        <Route path="blog-categories" element={<CategoriesPage type="blog" />} />

        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="feeds" element={<BrandFeedsPage />} />
        <Route path="integrations" element={<Navigate to="/feeds" replace />} />
        <Route path="sync-history" element={<SyncHistoryPage />} />
        <Route path="staff" element={<Need permission="admin"><StaffPage /></Need>} />
        <Route path="activity" element={<Need permission="admin"><ActivityLogPage /></Need>} />
        <Route path="settings" element={<Navigate to="/settings/account" replace />} />
        <Route path="settings/:section" element={<SettingsPage />} />
        <Route path="trash" element={<TrashPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

function Root() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => getToken() !== null);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);

  useEffect(() => onUnauthorized(() => { setUser(null); setNeedsTwoFactor(false); }), []);
  useEffect(() => { onTwoFactorRequired(() => setNeedsTwoFactor(true)); return () => onTwoFactorRequired(null); }, []);

  // Resume a stored session: the token is only trusted once /auth/me confirms it.
  useEffect(() => {
    if (!getToken()) return;
    api.get<{ data: User }>('/auth/me')
      .then(res => {
        if (isStaff(res.data)) setUser(res.data);
        else clearToken();
      })
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <Spinner fullScreen />;
  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <AppProvider user={user} onSignedOut={() => { setUser(null); setNeedsTwoFactor(false); }}>
      {needsTwoFactor
        ? <TwoFactorGate onDone={() => { setNeedsTwoFactor(false); setUser({ ...user, two_factor: true }); }} />
        : <Layout><AdminRoutes /></Layout>}
      <ToastContainer />
    </AppProvider>
  );
}

// Hash routing: works from any SiteGround folder without server rewrites.
export default function App() {
  return (
    <HashRouter>
      <Root />
    </HashRouter>
  );
}
