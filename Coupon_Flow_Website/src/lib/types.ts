// Shapes returned by the public + customer endpoints of the Laravel API.

export interface PageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  email_verified: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  /** Live stores in a store category (category lists only). */
  items_count?: number;
}

export interface Store {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
  category_slug?: string | null;
  heading: string | null;
  description: string | null;
  content: string | null;
  logo_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_top: boolean;
  is_editor_choice: boolean;
  coupons_count?: number;
  /** Visitor star rating. Only the store page sends it. */
  rating?: StoreRatingSummary;
}

export interface StoreRatingSummary {
  /** 1 to 5, one decimal; null until the first vote. */
  average: number | null;
  count: number;
}

export interface CouponStoreRef {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
}

export interface Coupon {
  id: number;
  title: string;
  type: 'Coupon Code' | 'Deal' | 'No Code Required';
  /** Whether there is a code to show (free) or to buy (paid). The code itself never comes with listings. */
  has_code: boolean;
  description: string | null;
  starts_at: string | null;
  expires_at: string | null;
  is_featured: boolean;
  is_verified: boolean;
  is_exclusive: boolean;
  is_paid: boolean;
  price_cents: number;
  currency: string;
  in_stock: boolean;
  /** Times shoppers used it ("Show coupon code" / "Get deal" clicks). */
  uses_count: number;
  /** null = unlimited. */
  usage_limit: number | null;
  uses_left: number | null;
  /** 0-100; null when unlimited. */
  used_percent: number | null;
  store?: CouponStoreRef;
}

export interface Blog {
  id: number;
  title: string;
  slug: string;
  category?: string | null;
  author?: string | null;
  excerpt: string | null;
  /** Only on a single post; lists leave it out. */
  body?: string | null;
  featured_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
}

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export interface OrderItem {
  coupon_id: number;
  title: string;
  unit_price_cents: number;
  quantity: number;
  code: string | null;
  /** Paid, but this coupon's own code is still to come (emailed as soon as it is). */
  code_pending: boolean;
}

export interface Order {
  id: number;
  status: OrderStatus;
  email: string;
  total_cents: number;
  currency: string;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string | null;
  items?: OrderItem[];
}

/** Site identity and SEO defaults, edited by the admin under Settings. */
export interface SiteSettings {
  site_name: string;
  support_email: string;
  currency: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  /** Admin switch: sell exclusive codes (cart, sign-in, card checkout). Off = a plain coupon site. */
  shop_enabled: boolean;
  /** The store's timezone: deal start and end times are shown in it. */
  timezone: string;
}

export interface SearchResults {
  stores: Store[];
  coupons: Coupon[];
}

/** A coupon as the code pop-up gets it, after the shopper clicked out. Null code: a deal, or a paid coupon. */
export interface RevealedCoupon extends Coupon {
  code: string | null;
}

export interface StorePageData {
  data: Store;
  coupons: Coupon[];
  related: Store[];
}

export interface CategoryPageData {
  data: Category;
  stores: Store[];
  coupons: Coupon[];
}

export interface BlogPostData {
  data: Blog;
  related: Blog[];
}