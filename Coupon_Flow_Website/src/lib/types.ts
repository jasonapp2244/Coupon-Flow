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
  /** Whether there is a code to show. The code itself never comes with listings. */
  has_code: boolean;
  description: string | null;
  starts_at: string | null;
  expires_at: string | null;
  is_featured: boolean;
  is_verified: boolean;
  is_exclusive: boolean;
  /** Times shoppers used it ("Show coupon code" / "Get deal" clicks). */
  uses_count: number;
  /** null = unlimited. */
  usage_limit: number | null;
  uses_left: number | null;
  /** 0-100; null when unlimited. */
  used_percent: number | null;
  /**
   * A list of single-use codes: each claim gets the next unused one. Then `uses_left` is the
   * codes left and `usage_limit` the total codes.
   */
  code_list?: boolean;
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
  /** Picked by the admin to lead the blog page. */
  is_featured?: boolean;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
}

/** Site identity and SEO defaults, edited by the admin under Settings. */
export interface SiteSettings {
  site_name: string;
  support_email: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  /** The store's timezone: deal start and end times are shown in it. */
  timezone: string;
  /** Home page hero, edited by the admin under Settings → Homepage. */
  homepage: HomepageHero;
}

export interface HeroSlide {
  image_url: string | null;
  title: string;
  subtitle: string | null;
  button_text: string | null;
  /** A page on this site ("/stores/nike") or a full web address. */
  link: string | null;
}

export interface HomepageHero {
  headline: string;
  subtext: string;
  search_placeholder: string;
  hero_image_url: string | null;
  slides: HeroSlide[];
}

export interface SearchResults {
  stores: Store[];
  coupons: Coupon[];
}

/** A coupon as the code pop-up gets it, after the shopper clicked out. Null code: a deal. */
export interface RevealedCoupon extends Coupon {
  code: string | null;
  /** This visitor took today's maximum of codes for the coupon; `code` is then their latest, or null. */
  limit_reached?: boolean;
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