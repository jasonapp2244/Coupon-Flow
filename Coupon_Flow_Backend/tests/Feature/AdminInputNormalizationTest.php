<?php

namespace Tests\Feature;

use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Admin forms accept a slug typed as a domain or with spaces, and links typed without https://. */
class AdminInputNormalizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAsAdmin();
    }

    public function test_store_slug_and_links_are_tidied_instead_of_rejected(): void
    {
        $this->postJson('/api/v1/admin/stores', [
            'name' => 'Nike',
            'slug' => 'https://Nike.com',
            'direct_url' => 'nike.com',
            'tracking_url' => 'www.nike.com/sale?ref=1',
        ])->assertCreated()
            ->assertJsonPath('data.slug', 'nike-com');

        $store = Store::sole();
        $this->assertSame('https://nike.com', $store->direct_url);
        $this->assertSame('https://www.nike.com/sale?ref=1', $store->tracking_url);
    }

    public function test_category_and_blog_slugs_with_spaces_are_tidied(): void
    {
        $this->postJson('/api/v1/admin/categories', ['type' => 'store', 'name' => 'Shoes', 'slug' => 'Running Shoes_2026'])
            ->assertCreated()->assertJsonPath('data.slug', 'running-shoes-2026');

        $this->postJson('/api/v1/admin/blogs', ['title' => 'Guide', 'slug' => 'Best Deals.Today'])
            ->assertCreated()->assertJsonPath('data.slug', 'best-deals-today');
    }

    public function test_text_that_is_not_a_link_is_still_rejected(): void
    {
        $this->postJson('/api/v1/admin/stores', ['name' => 'Nike', 'direct_url' => 'not a url'])
            ->assertJsonValidationErrors(['direct_url']);
    }
}
