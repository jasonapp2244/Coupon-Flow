<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\StoreRating;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** "Rate this store" stars on the public store page. */
class StoreRatingTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_new_store_has_no_rating_yet(): void
    {
        Store::factory()->create(['slug' => 'tea-shop']);

        $this->getJson('/api/v1/public/stores/tea-shop')->assertOk()
            ->assertJsonPath('data.rating', ['average' => null, 'count' => 0]);
    }

    public function test_visitors_rate_a_store_and_see_the_average(): void
    {
        Store::factory()->create(['slug' => 'tea-shop']);

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])
            ->postJson('/api/v1/public/stores/tea-shop/rating', ['rating' => 5])
            ->assertOk()->assertExactJson(['rating' => 5, 'average' => 5, 'count' => 1]);

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])
            ->postJson('/api/v1/public/stores/tea-shop/rating', ['rating' => 4])
            ->assertOk()->assertJsonPath('average', 4.5)->assertJsonPath('count', 2);

        $this->getJson('/api/v1/public/stores/tea-shop')
            ->assertJsonPath('data.rating', ['average' => 4.5, 'count' => 2]);
    }

    public function test_voting_again_changes_the_vote_instead_of_adding_one(): void
    {
        Store::factory()->create(['slug' => 'tea-shop']);

        $this->postJson('/api/v1/public/stores/tea-shop/rating', ['rating' => 1]);
        $this->postJson('/api/v1/public/stores/tea-shop/rating', ['rating' => 3])
            ->assertJsonPath('count', 1)->assertJsonPath('average', 3);

        $this->assertSame(1, StoreRating::count());
        // The raw IP is never stored.
        $this->assertStringNotContainsString('127.0.0.1', StoreRating::first()->voter);
    }

    public function test_a_signed_in_shopper_gets_one_vote_wherever_they_vote_from(): void
    {
        Store::factory()->create(['slug' => 'tea-shop']);
        Sanctum::actingAs(User::factory()->create());

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])->postJson('/api/v1/public/stores/tea-shop/rating', ['rating' => 2]);
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.9'])->postJson('/api/v1/public/stores/tea-shop/rating', ['rating' => 5])
            ->assertJsonPath('count', 1)->assertJsonPath('average', 5);
    }

    public function test_bad_ratings_and_hidden_stores_are_refused(): void
    {
        Store::factory()->create(['slug' => 'tea-shop']);
        Store::factory()->inactive()->create(['slug' => 'hidden']);

        foreach ([0, 6, 'five', null] as $bad) {
            $this->postJson('/api/v1/public/stores/tea-shop/rating', ['rating' => $bad])->assertUnprocessable();
        }
        $this->postJson('/api/v1/public/stores/hidden/rating', ['rating' => 5])->assertNotFound();
        $this->postJson('/api/v1/public/stores/missing/rating', ['rating' => 5])->assertNotFound();

        $this->assertSame(0, StoreRating::count());
    }

    public function test_admin_sees_ratings_in_the_store_list_and_can_sort_by_them(): void
    {
        $good = Store::factory()->create(['name' => 'Good']);
        $poor = Store::factory()->create(['name' => 'Poor']);
        Store::factory()->create(['name' => 'Unrated']);
        $this->vote($good, 5, 'a');
        $this->vote($good, 4, 'b');
        $this->vote($poor, 1, 'c');
        $this->actingAsAdmin();

        $this->getJson('/api/v1/admin/stores?sort=ratings_avg_rating&dir=desc')->assertOk()
            ->assertJsonPath('data.0.name', 'Good')
            ->assertJsonPath('data.0.rating', ['average' => 4.5, 'count' => 2])
            ->assertJsonPath('data.1.name', 'Poor');
        $this->getJson("/api/v1/admin/stores/{$good->id}")->assertJsonPath('data.rating.count', 2);
    }

    public function test_admin_lists_votes_with_a_breakdown_and_shows_who_signed_in(): void
    {
        $store = Store::factory()->create();
        $shopper = User::factory()->create(['name' => 'Test Shopper', 'email' => 'tauseefchoohan0401@gmail.com']);
        $this->vote($store, 5, 'guest');
        StoreRating::create(['store_id' => $store->id, 'rating' => 3, 'user_id' => $shopper->id, 'voter' => str_repeat('u', 64)]);
        $this->vote(Store::factory()->create(), 1, 'other-store');
        $this->actingAsAdmin();

        $this->getJson("/api/v1/admin/stores/{$store->id}/ratings/summary")->assertOk()
            ->assertExactJson(['average' => 4, 'count' => 2, 'breakdown' => ['5' => 1, '4' => 0, '3' => 1, '2' => 0, '1' => 0]]);

        $votes = $this->getJson("/api/v1/admin/stores/{$store->id}/ratings")->assertOk()->assertJsonPath('meta.total', 2)->json('data');
        $this->assertEqualsCanonicalizing([null, ['name' => 'Test Shopper', 'email' => 'tauseefchoohan0401@gmail.com']], array_column($votes, 'voter'));

        $this->getJson("/api/v1/admin/stores/{$store->id}/ratings?rating=3")->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.rating', 3);
    }

    public function test_admin_removes_one_vote_or_resets_the_store(): void
    {
        $store = Store::factory()->create();
        $other = Store::factory()->create();
        $spam = $this->vote($store, 1, 'spam');
        $this->vote($store, 5, 'a');
        $this->vote($store, 4, 'b');
        $foreign = $this->vote($other, 2, 'c');
        $this->actingAsAdmin();

        // A vote of another store can't be removed through this store's URL.
        $this->deleteJson("/api/v1/admin/stores/{$store->id}/ratings/{$foreign->id}")->assertNotFound();

        $this->deleteJson("/api/v1/admin/stores/{$store->id}/ratings/{$spam->id}")->assertOk()
            ->assertJsonPath('count', 2)->assertJsonPath('average', 4.5);

        $this->deleteJson("/api/v1/admin/stores/{$store->id}/ratings")->assertOk()
            ->assertJsonPath('removed', 2)->assertJsonPath('count', 0)->assertJsonPath('average', null);

        $this->assertSame(0, $store->ratings()->count());
        $this->assertSame(1, $other->ratings()->count());
    }

    public function test_only_admins_manage_ratings(): void
    {
        $store = Store::factory()->create();
        $this->getJson("/api/v1/admin/stores/{$store->id}/ratings")->assertUnauthorized();

        $this->actingAsCustomer();
        $this->getJson("/api/v1/admin/stores/{$store->id}/ratings")->assertForbidden();
        $this->deleteJson("/api/v1/admin/stores/{$store->id}/ratings")->assertForbidden();
    }

    public function test_signed_in_votes_record_the_shopper(): void
    {
        Store::factory()->create(['slug' => 'tea-shop']);
        $shopper = $this->actingAsCustomer();

        $this->postJson('/api/v1/public/stores/tea-shop/rating', ['rating' => 4])->assertOk();

        $this->assertSame($shopper->id, StoreRating::first()->user_id);
    }

    private function vote(Store $store, int $rating, string $voter): StoreRating
    {
        return StoreRating::create(['store_id' => $store->id, 'rating' => $rating, 'voter' => hash('sha256', $voter)]);
    }

    public function test_store_lists_do_not_carry_the_rating(): void
    {
        Store::factory()->create(['slug' => 'tea-shop']);

        $this->getJson('/api/v1/public/stores')->assertOk()->assertJsonMissingPath('data.0.rating');
    }
}
