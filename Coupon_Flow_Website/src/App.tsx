import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import { NotFound } from './components/States';
import { ToastProvider } from './store/toast';
import { SiteProvider } from './store/site';
import HomePage from './pages/HomePage';
import CouponsPage from './pages/CouponsPage';
import StoresPage from './pages/StoresPage';
import StorePage from './pages/StorePage';
import { BlogListPage, BlogPostPage } from './pages/BlogPages';
import { CategoriesPage, CategoryPage } from './pages/CategoryPages';
import { AboutPage, AffiliateDisclosurePage, ContactPage, PrivacyPage, TermsPage } from './pages/StaticPages';

/** Pages of the old shop (cart, sign-in, checkout, account). Old links and bookmarks land on the home page. */
const RETIRED_PATHS = [
  'cart', 'login', 'register', 'forgot-password', 'reset-password', 'verify-email', 'refund-policy',
  'checkout/*', 'account/*',
];

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="coupons" element={<CouponsPage />} />
        <Route path="stores" element={<StoresPage />} />
        <Route path="stores/:slug" element={<StorePage />} />
        <Route path="promotions/at/:slug" element={<StorePage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="categories/:slug" element={<CategoryPage />} />
        <Route path="blog" element={<BlogListPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />

        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="affiliate-disclosure" element={<AffiliateDisclosurePage />} />

        {RETIRED_PATHS.map(path => <Route key={path} path={path} element={<Navigate to="/" replace />} />)}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

/** Everything except the router: the browser wraps it in BrowserRouter, the pre-renderer in StaticRouter. */
export function AppShell() {
  return (
    <SiteProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </SiteProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
