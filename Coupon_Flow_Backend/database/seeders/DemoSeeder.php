<?php

namespace Database\Seeders;

use App\Enums\CategoryType;
use App\Enums\Role;
use App\Models\Blog;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\FeedSource;
use App\Models\Redemption;
use App\Models\Store;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Local/demo data only: sample catalogue ported from the dashboard prototype, demo redemptions
 * and a CSV brand feed source. Never run in production (DatabaseSeeder skips it there).
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('role', Role::Admin)->firstOrFail();
        $storeCategories = $this->categories(CategoryType::Store, ['E-Commerce', 'Fashion', 'Retail', 'Marketplace', 'Electronics', 'Beauty', 'Travel', 'Food']);
        $blogCategories = $this->categories(CategoryType::Blog, ['Deals', 'Fashion', 'Tips', 'Electronics', 'Beauty']);

        $stores = collect([
            ['Amazon', 'E-Commerce', 'amazon.com', true, true, 'Active'],
            ['Nike', 'Fashion', 'nike.com', true, false, 'Active'],
            ['Walmart', 'Retail', 'walmart.com', false, true, 'Active'],
            ['Target', 'Retail', 'target.com', false, false, 'Active'],
            ['eBay', 'Marketplace', 'ebay.com', true, false, 'Active'],
            ['Best Buy', 'Electronics', 'bestbuy.com', false, false, 'Active'],
            ['Adidas', 'Fashion', 'adidas.com', false, false, 'Inactive'],
            ['Sephora', 'Beauty', 'sephora.com', true, true, 'Active'],
        ])->mapWithKeys(fn ($s) => [$s[0] => Store::updateOrCreate(['slug' => Str::slug($s[0])], [
            'name' => $s[0],
            'category_id' => $storeCategories[$s[1]],
            'direct_url' => "https://{$s[2]}",
            'tracking_url' => 'https://track.couponfollow.com/'.Str::slug($s[0]),
            'heading' => "{$s[0]} coupons & promo codes",
            'is_top' => $s[3],
            'is_editor_choice' => $s[4],
            'status' => $s[5],
        ])]);

        // [store, title, type, code, expiry, status, featured, verified, exclusive]
        $coupons = [
            ['Amazon', 'Save 20% on All Orders', 'Coupon Code', 'SAVE20FALL', 'Oct 31, 2026', 'Active', true, true, false],
            ['Walmart', 'Free Shipping on $50+', 'No Code Required', null, 'Dec 31, 2026', 'Active', false, true, false],
            ['Nike', '15% Off Nike Running Shoes', 'Coupon Code', 'NIKE15RUN', 'Oct 15, 2026', 'Active', true, true, true],
            ['Target', '$25 Off $100 Target Order', 'Coupon Code', 'TARGET25', 'Sep 30, 2026', 'Expired', false, false, false],
            ['eBay', 'eBay Extra 10% Off Electronics', 'Deal', null, 'Nov 15, 2026', 'Active', true, true, false],
            ['Sephora', 'Sephora Beauty Sale — 30% Off', 'Coupon Code', 'BEAUTY30', 'Nov 5, 2026', 'Active', false, true, true],
            ['Best Buy', 'Best Buy: $50 Off $250+', 'Coupon Code', 'BBY50OFF', 'Nov 30, 2026', 'Active', true, true, true],
            ['Adidas', 'Adidas: Buy 2 Get 1 Free', 'Deal', null, 'Oct 20, 2026', 'Active', true, false, false],
        ];

        foreach ($coupons as [$store, $title, $type, $code, $expiry, $status, $featured, $verified, $exclusive]) {
            Coupon::updateOrCreate(['store_id' => $stores[$store]->id, 'title' => $title], [
                'type' => $type,
                'code' => $code,
                'expires_at' => Carbon::parse($expiry)->toDateString(),
                'status' => $status,
                'is_featured' => $featured,
                'is_verified' => $verified,
                'is_exclusive' => $exclusive,
                'description' => "{$title} at {$store}. Terms apply.",
            ]);
        }

        $blogs = [
            ['Best Amazon Deals This September 2026', 'Deals', 'Published', 'Sep 20, 2026', true],
            ['Top 10 Nike Running Shoes on Sale', 'Fashion', 'Draft', null, false],
            ['How to Save Big at Walmart', 'Tips', 'Published', 'Sep 15, 2026', true],
            ['Fall Fashion Trends & Discount Codes', 'Fashion', 'Published', 'Sep 10, 2026', false],
            ['Electronics Deals Worth Bookmarking', 'Electronics', 'Draft', null, false],
        ];

        foreach ($blogs as [$title, $category, $status, $date, $featured]) {
            Blog::updateOrCreate(['slug' => Str::slug($title)], [
                'title' => $title,
                'category_id' => $blogCategories[$category],
                'author_id' => $admin->id,
                'excerpt' => "{$title} — our editors' picks.",
                'body' => "Full article for \"{$title}\".",
                'status' => $status,
                'published_at' => $date ? Carbon::parse($date) : null,
                'is_featured' => $featured,
            ]);
        }

        $redemptions = [
            ['TXN-001842', 'Sarah Mitchell', 'SAVE20FALL', 'Amazon', 14250, 855, 'Sep 23 2026 09:14', 'Sep 23 2026 09:18', 'Used', 'AMZ-8821-X'],
            ['TXN-001841', 'James Rodriguez', 'NIKE15RUN', 'Nike', 8999, 540, 'Sep 23 2026 08:52', null, 'Pending', 'NK-7712-Y'],
            ['TXN-001840', 'Emily Chen', 'WALMRT10', 'Walmart', 6720, 403, 'Sep 22 2026 18:31', 'Sep 22 2026 18:35', 'Used', 'WM-6624-Z'],
            ['TXN-001839', 'Michael Thompson', 'EBAY25', 'eBay', 23400, 1404, 'Sep 22 2026 14:22', 'Sep 22 2026 14:29', 'Used', 'EB-5512-A'],
            ['TXN-001838', 'Priya Sharma', 'TARGET25', 'Target', 5280, 317, 'Sep 21 2026 11:08', null, 'Failed', 'TG-4401-B'],
            ['TXN-001837', 'David Park', 'BEAUTY30', 'Sephora', 11840, 710, 'Sep 21 2026 09:45', 'Sep 21 2026 09:52', 'Used', 'SEP-3390-C'],
        ];

        foreach ($redemptions as [$ref, $user, $code, $store, $value, $commission, $clicked, $redeemed, $status, $tracking]) {
            Redemption::updateOrCreate(['reference' => $ref], [
                'user_name' => $user,
                'coupon_code' => $code,
                'store_id' => $stores[$store]->id,
                'order_value_cents' => $value,
                'commission_cents' => $commission,
                'clicked_at' => Carbon::parse($clicked),
                'redeemed_at' => $redeemed ? Carbon::parse($redeemed) : null,
                'status' => $status,
                'tracking_id' => $tracking,
            ]);
        }

        // A brand source ready for the CSV template (Brand Feeds → Import CSV); its runs fill Sync History.
        FeedSource::firstOrCreate(['name' => 'Demo Brand (CSV upload)'], ['type' => 'csv_upload', 'frequency' => 'manual']);

        // A usage limit to show "Used N times · X left" and the % bar.
        Coupon::where('title', 'Save 20% on All Orders')->update(['usage_limit' => 500]);
    }

    /**
     * @param  list<string>  $names
     * @return array<string, int> name => id
     */
    private function categories(CategoryType $type, array $names): array
    {
        return collect($names)->mapWithKeys(fn (string $name) => [
            $name => Category::updateOrCreate(['type' => $type, 'slug' => Str::slug($name)], ['name' => $name])->id,
        ])->all();
    }
}
