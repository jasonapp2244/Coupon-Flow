<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Coupon;
use App\Models\Store;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Who changed what and when. */
class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalogue_changes_are_logged_with_the_person_and_a_field_diff(): void
    {
        $editor = User::factory()->editor()->create(['name' => 'Eddie']);
        Sanctum::actingAs($editor);
        $store = Store::factory()->create();

        $id = $this->postJson('/api/v1/admin/coupons', ['store_id' => $store->id, 'title' => 'Save 10%', 'type' => 'Deal', 'status' => 'Active'])
            ->assertCreated()->json('data.id');
        $this->patchJson("/api/v1/admin/coupons/{$id}", ['title' => 'Save 15%'])->assertOk();
        $this->deleteJson("/api/v1/admin/coupons/{$id}")->assertNoContent();

        $logs = ActivityLog::where('subject_type', 'Coupon')->where('subject_id', $id)->orderBy('id')->get();
        $this->assertSame(['created', 'updated', 'deleted'], $logs->pluck('action')->all());
        $this->assertSame('Eddie', $logs[1]->user_name);
        $this->assertSame(['title' => ['Save 10%', 'Save 15%']], $logs[1]->changes);
        $this->assertSame('Save 15%', $logs[1]->subject_label);
        $this->assertNotNull($logs[1]->ip);
    }

    public function test_sign_ins_and_failed_attempts_are_logged_but_not_shoppers(): void
    {
        User::factory()->admin()->create(['email' => 'boss@staff.test']);
        User::factory()->create(['email' => 'shopper@example.test']);

        $this->postJson('/api/v1/auth/login', ['email' => 'boss@staff.test', 'password' => 'nope'])->assertUnprocessable();
        $this->postJson('/api/v1/auth/login', ['email' => 'boss@staff.test', 'password' => 'password'])->assertOk();
        $this->postJson('/api/v1/auth/login', ['email' => 'shopper@example.test', 'password' => 'nope']);
        $this->postJson('/api/v1/auth/login', ['email' => 'nobody@x.test', 'password' => 'nope', 'device_name' => 'admin-dashboard']);

        $this->assertSame(['login_failed', 'login', 'login_failed'], ActivityLog::orderBy('id')->pluck('action')->all());
        $this->assertSame('nobody@x.test', ActivityLog::latest('id')->first()->subject_label);
        $this->assertSame('System', ActivityLog::first()->user_name);
    }

    public function test_secrets_are_masked_and_logging_can_be_paused(): void
    {
        Audit::log('test', changes: ['api_key' => 'sk_live_123', 'password' => ['a', 'b'], 'name' => 'ok']);
        $this->assertSame(['api_key' => '••••', 'password' => ['••••', '••••'], 'name' => 'ok'], ActivityLog::sole()->changes);

        Audit::withoutLogging(fn () => Store::factory()->create());
        $this->assertSame(1, ActivityLog::count());
    }

    public function test_shopper_side_effects_are_not_logged(): void
    {
        $this->actingAsCustomer();
        $coupon = Coupon::factory()->create();
        ActivityLog::query()->delete();

        $coupon->update(['title' => 'Changed by a non-staff request']);
        $this->assertSame(0, ActivityLog::count());
    }

    public function test_only_admins_read_the_log_with_filters(): void
    {
        $admin = $this->actingAsAdmin();
        Store::factory()->create(['name' => 'Tea Shop']);
        Audit::log('login', $admin, label: $admin->email);

        $this->getJson('/api/v1/admin/activity?subject_type=Store')->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.subject_label', 'Tea Shop')
            ->assertJsonPath('filters.actions', ['created', 'login']);
        $this->getJson('/api/v1/admin/activity?q=tea')->assertJsonPath('meta.total', 1);

        Sanctum::actingAs(User::factory()->editor()->create());
        $this->getJson('/api/v1/admin/activity')->assertForbidden();
    }

    public function test_entries_older_than_a_year_are_pruned(): void
    {
        Audit::log('old');
        ActivityLog::query()->update(['created_at' => now()->subDays(ActivityLog::KEEP_DAYS + 1)]);
        Audit::log('new');

        $this->artisan('model:prune', ['--model' => ActivityLog::class])->assertSuccessful();
        $this->assertSame(['new'], ActivityLog::pluck('action')->all());
    }
}
