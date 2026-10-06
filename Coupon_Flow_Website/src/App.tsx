import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import Layout from './components/Layout';
import { NotFound, Spinner } from './components/States';
import { AuthProvider, useAuth } from './store/auth';
import { CartProvider } from './store/cart';
import { PurchasesProvider } from './store/purchases';
import { ToastProvider } from './store/toast';
import { SiteProvider, useSite } from './store/site';
import HomePage from './pages/HomePage';
import CouponsPage from './pages/CouponsPage';
import StoresPage from './pages/StoresPage';
import StorePage from './pages/StorePage';
import { BlogListPage, BlogPostPage } from './pages/BlogPages';
import CartPage from './pages/CartPage';
import { CheckoutCancelPage, CheckoutSuccessPage } from './pages/CheckoutPages';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages';
import { OrderPage, OrdersPage } from './pages/OrdersPages';
import { CategoriesPage, CategoryPage } from './pages/CategoryPages';
import { AccountPage, VerifyEmailPage } from './pages/AccountPages';
import { AboutPage, AffiliateDisclosurePage, ContactPage, PrivacyPage, RefundPolicyPage, TermsPage } from './pages/StaticPages';

/** Account pages need a signed-in shopper; everyone else is sent to sign in and brought back. */
function RequireCustomer({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) return <Spinner />;
  if (!user || user.role !== 'customer') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return children;
}

/** Cart, sign-in, checkout and account exist only while the admin sells exclusive codes. */
function ShopOnly({ children }: { children: ReactNode }) {
  const { ready, shop_enabled } = useSite();
  if (!ready) return <Spinner />;
  return shop_enabled ? children : <Navigate to="/" replace />;
}

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
        <Route path="cart" element={<ShopOnly><CartPage /></ShopOnly>} />

        <Route path="login" element={<ShopOnly><LoginPage /></ShopOnly>} />
        <Route path="register" element={<ShopOnly><RegisterPage /></ShopOnly>} />
        <Route path="forgot-password" element={<ShopOnly><ForgotPasswordPage /></ShopOnly>} />
        <Route path="reset-password" element={<ShopOnly><ResetPasswordPage /></ShopOnly>} />
        <Route path="verify-email" element={<ShopOnly><VerifyEmailPage /></ShopOnly>} />

        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="refund-policy" element={<RefundPolicyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="affiliate-disclosure" element={<AffiliateDisclosurePage />} />

        <Route path="checkout/success" element={<ShopOnly><RequireCustomer><CheckoutSuccessPage /></RequireCustomer></ShopOnly>} />
        <Route path="checkout/cancel" element={<ShopOnly><RequireCustomer><CheckoutCancelPage /></RequireCustomer></ShopOnly>} />
        <Route path="account" element={<ShopOnly><RequireCustomer><AccountPage /></RequireCustomer></ShopOnly>} />
        <Route path="account/orders" element={<ShopOnly><RequireCustomer><OrdersPage /></RequireCustomer></ShopOnly>} />
        <Route path="account/orders/:id" element={<ShopOnly><RequireCustomer><OrderPage /></RequireCustomer></ShopOnly>} />

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
        <AuthProvider>
          <PurchasesProvider>
            <CartProvider>
              <AppRoutes />
            </CartProvider>
          </PurchasesProvider>
        </AuthProvider>
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
