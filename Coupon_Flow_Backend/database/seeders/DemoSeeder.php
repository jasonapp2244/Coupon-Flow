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
        $admin = User::whereIn('role', Role::admins())->firstOrFail();
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

        // [store, title, type, code, expiry, status, featured, verified, exclusive, description]
        $coupons = [
            ['Amazon', '20% off your order', 'Coupon Code', 'SAVE20FALL', 'Oct 31, 2026', 'Active', true, true, false, 'Take 20% off eligible items sitewide with this code. Some products and third-party sellers may be excluded, so check the discount in your cart before you pay.'],
            ['Walmart', 'Free shipping on orders of $50 or more', 'No Code Required', null, 'Dec 31, 2026', 'Active', false, true, false, 'No code needed. Spend $50 or more on eligible items and standard shipping is free. The discount is applied automatically at checkout.'],
            ['Nike', '15% off running shoes', 'Coupon Code', 'NIKE15RUN', 'Oct 15, 2026', 'Active', true, true, true, 'Save 15% on selected Nike running shoes. Paste the code at checkout; new releases and limited editions may not be included.'],
            ['Target', '$25 off orders of $100 or more', 'Coupon Code', 'TARGET25', 'Sep 30, 2026', 'Expired', false, false, false, 'Get $25 off when you spend $100 or more on eligible items. Gift cards and some brands may be excluded.'],
            ['eBay', 'Extra 10% off electronics', 'Deal', null, 'Nov 15, 2026', 'Active', true, true, false, 'An extra 10% off selected electronics from participating sellers. The offer page on eBay lists the eligible items and any spending cap.'],
            ['Sephora', '30% off during the beauty sale', 'Coupon Code', 'BEAUTY30', 'Nov 5, 2026', 'Active', false, true, true, 'Take 30% off selected makeup, skincare and fragrance while the sale runs. Exclusions may apply to some brands.'],
            ['Best Buy', '$50 off orders of $250 or more', 'Coupon Code', 'BBY50OFF', 'Nov 30, 2026', 'Active', true, true, true, 'Save $50 when you spend $250 or more on eligible products. Some brands may be excluded; your cart will show the final price.'],
            ['Adidas', 'Buy 2, get 1 free', 'Deal', null, 'Oct 20, 2026', 'Active', true, false, false, 'Add three eligible items to your bag and the lowest-priced one is free. No code needed; the discount appears at checkout.'],
        ];

        foreach ($coupons as [$store, $title, $type, $code, $expiry, $status, $featured, $verified, $exclusive, $description]) {
            Coupon::updateOrCreate(['store_id' => $stores[$store]->id, 'title' => $title], [
                'type' => $type,
                'code' => $code,
                'expires_at' => Carbon::parse($expiry)->toDateString(),
                'status' => $status,
                'is_featured' => $featured,
                'is_verified' => $verified,
                'is_exclusive' => $exclusive,
                'description' => $description,
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
            // firstOrCreate: re-seeding never overwrites an article someone has since written.
            Blog::firstOrCreate(['slug' => Str::slug($title)], [
                'title' => $title,
                'category_id' => $blogCategories[$category],
                'author_id' => $admin->id,
                'excerpt' => 'A short summary of this guide. Edit it in Admin → Blogs.',
                'body' => "## {$title}\n\nWrite the article in Admin → Blogs.",
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
