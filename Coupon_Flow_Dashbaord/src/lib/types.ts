// Shapes returned by the Laravel API (see Coupon_Flow_Backend/app/Http/Resources).

export type StoreStatus = 'Active' | 'Inactive' | 'Draft';
export type CouponStatus = 'Active' | 'Inactive' | 'Expired' | 'Scheduled' | 'Draft';
export type CouponType = 'Coupon Code' | 'Deal' | 'No Code Required';
export type BlogStatus = 'Published' | 'Draft' | 'Archived';
export type CategoryType = 'store' | 'blog';
export type TrashType = 'store' | 'coupon' | 'blog';

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

export type StaffRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  /** Two-step login is on. */
  two_factor?: boolean;
  created_at: string | null;
}

export interface StaffMember {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  disabled: boolean;
  two_factor: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

export interface ActivityEntry {
  id: number;
  user_id: number | null;
  user_name: string;
  action: string;
  subject_type: string | null;
  subject_id: number | null;
  subject_label: string | null;
  /** Updates: {field: [old, new]}; creates and others: {field: value}. */
  changes: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export type CouponState = 'live' | 'scheduled' | 'ended' | 'used_up' | 'draft' | 'inactive';

export interface FeedSource {
  id: number;
  name: string;
  type: 'json_url' | 'csv_url' | 'csv_upload';
  url: string | null;
  has_api_key: boolean;
  /** Masked: "••••1234". */
  api_key: string;
  default_store_id: number | null;
  default_store: string | null;
  frequency: 'hourly' | 'every_6_hours' | 'daily' | 'manual';
  auto_publish: boolean;
  deactivate_missing: boolean;
  is_active: boolean;
  last_run_at: string | null;
  last_status: SyncRun['status'] | null;
  coupons_count: number;
}

export interface Category {
  id: number;
  type: CategoryType;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  items_count?: number;
  updated_at: string | null;
}

export interface Store {
  id: number;
  name: string;
  slug: string;
  category_id: number | null;
  category?: string | null;
  heading: string | null;
  description: string | null;
  content: string | null;
  direct_url: string;
  tracking_url: string | null;
  logo_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  is_top: boolean;
  is_editor_choice: boolean;
  /** What the store pays on a confirmed sale, 0-100 (2 decimals); null = not set. */
  commission_percent: number | null;
  status: StoreStatus;
  coupons_count?: number;
  /** Visitor star rating from the public store page. */
  rating?: { average: number | null; count: number };
  updated_at: string | null;
}

export interface StoreRatingSummary {
  average: number | null;
  count: number;
  /** Votes per star level, keyed "5" down to "1". */
  breakdown: Record<string, number>;
}

export interface StoreRatingVote {
  id: number;
  rating: number;
  /** Signed-in voter; null for a guest. */
  voter: { name: string; email: string } | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Coupon {
  id: number;
  store_id: number;
  store?: string | null;
  title: string;
  type: CouponType;
  code: string | null;
  description: string | null;
  tracking_url: string | null;
  /** Exact moments, ISO 8601 (UTC). */
  starts_at: string | null;
  expires_at: string | null;
  /** The same in the store's timezone, "YYYY-MM-DDTHH:mm", for datetime-local inputs. */
  starts_at_local: string | null;
  expires_at_local: string | null;
  status: CouponStatus;
  state: CouponState;
  /** null = unlimited. */
  usage_limit: number | null;
  uses_count: number;
  uses_left: number | null;
  /** 0-100; null when unlimited. */
  used_percent: number | null;
  feed_source_id: number | null;
  feed_source?: string | null;
  external_id: string | null;
  is_featured: boolean;
  is_verified: boolean;
  is_exclusive: boolean;
  /**
   * Code list: each click gets the next unused code from the coupon's list. Then `uses_left` is
   * the codes left, `used_percent` the share used, and `usage_limit` is ignored.
   */
  unique_codes: boolean;
  codes_total: number;
  codes_left: number;
  /** Codes one visitor may take per day; 0 = no limit. */
  max_codes_per_visitor: number;
  /** Overrides the store's commission rate for this coupon; null = use the store's. */
  commission_percent: number | null;
  updated_at: string | null;
}

/** One code of a code-list coupon. */
export interface CouponCodeEntry {
  id: number;
  code: string;
  used: boolean;
  assigned_at: string | null;
  redemption_reference: string | null;
}

export interface CouponCodeList {
  data: CouponCodeEntry[];
  meta: Pick<PageMeta, 'current_page' | 'last_page' | 'per_page' | 'total'>;
  counts: { total: number; left: number };
}

export interface CouponCodesAdded {
  added: number;
  skipped: number;
  total: number;
  left: number;
}

export interface Blog {
  id: number;
  title: string;
  slug: string;
  category_id: number | null;
  category?: string | null;
  author?: string | null;
  excerpt: string | null;
  body: string | null;
  featured_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  is_featured: boolean;
  status: BlogStatus;
  published_at: string | null;
  updated_at: string | null;
}

export interface Redemption {
  id: number;
  reference: string;
  user: string;
  coupon: string;
  store_id: number | null;
  store?: string | null;
  order_value_cents: number;
  commission_cents: number;
  clicked_at: string | null;
  redeemed_at: string | null;
  status: 'Clicked' | 'Pending' | 'Used' | 'Failed' | 'Expired';
  tracking_id: string | null;
  coupon_id: number | null;
  /** The rate the profit was worked out with (coupon override, else the store's); null = none set. */
  commission_percent: number | null;
}

export interface RedemptionSummary {
  total: number;
  by_status: Record<Redemption['status'], number>;
  order_value_cents: number;
  /** The profit: commission on confirmed sales. */
  commission_cents: number;
  /** Confirmed sales per click, 0-100, one decimal. */
  conversion_rate: number;
}

export interface StoreProfit {
  store_id: number;
  store: string;
  sales: number;
  order_value_cents: number;
  profit_cents: number;
}

export interface SyncRun {
  id: number;
  feed_source_id: number | null;
  feed_source?: string | null;
  reference: string;
  type: string;
  started_at: string;
  completed_at: string | null;
  stores_added: number;
  coupons_added: number;
  coupons_updated: number;
  /** Left alone: edited by an admin since the last import, or deleted. */
  coupons_kept: number;
  coupons_deactivated: number;
  failed: number;
  errors: { row: number | null; external_id: string | null; message: string }[];
  status: 'Completed' | 'Running' | 'Partial' | 'Failed';
}

export interface TrashItem {
  id: number;
  type: TrashType;
  name: string;
  original_status: string;
  deleted_at: string;
}

export interface AppNotification {
  id: string;
  text: string;
  read: boolean;
  created_at: string;
}

export interface UsesPoint {
  date: string;
  uses: number;
}

/** A coupon row on the dashboard's lists. */
export interface CouponUsage {
  id: number;
  title: string;
  store: string | null;
  state: CouponState | 'deleted' | null;
  uses_count: number;
  usage_limit: number | null;
  used_percent: number | null;
  starts_at: string | null;
  expires_at: string | null;
  uses_in_period?: number;
}

export interface FeedHealth {
  id: number;
  name: string;
  type: FeedSource['type'];
  last_run_at: string | null;
  last_status: SyncRun['status'] | null;
  problem_runs_7d: number;
}

export interface DashboardData {
  usage: {
    uses_today: number;
    uses_7d: number;
    uses_30d: number;
    live: number;
    scheduled: number;
    ended: number;
    used_up: number;
    near_limit: number;
    ending_48h: number;
    feeds_total: number;
    feeds_failing: number;
  };
  uses: UsesPoint[];
  top_coupons: CouponUsage[];
  watch: { near_limit: CouponUsage[]; ending_soon: CouponUsage[]; starting_soon: CouponUsage[] };
  feeds: FeedHealth[];
  /** Admins only. */
  recent_activity: Pick<ActivityEntry, 'id' | 'user_name' | 'action' | 'subject_type' | 'subject_label' | 'created_at'>[] | null;
  two_factor_missing: boolean;
  kpis: {
    total_stores: number;
    active_coupons: number;
    total_coupons: number;
    total_redemptions: number;
    /** Commission on sales confirmed in the last 30 days. */
    profit_30d_cents: number;
    sales_30d: number;
  };
  recent_redemptions: Redemption[];
}

export interface AnalyticsData {
  days: number;
  store_id: number | null;
  uses: UsesPoint[];
  top_coupons: CouponUsage[];
  /** Confirmed sales and profit per store in the period. */
  profit_by_store: StoreProfit[];
}

export interface Settings {
  general: { site_name: string; support_email: string; timezone: string };
  seo: { meta_title: string; meta_description: string; meta_keywords: string };
  notifications: { email: boolean; sync_alerts: boolean; redemption_alerts: boolean };
  security: { require_two_factor: boolean };
}
