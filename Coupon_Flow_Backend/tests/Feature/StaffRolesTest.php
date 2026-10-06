<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\Coupon;
use App\Models\Store;
use App\Models\User;
use App\Notifications\AdminActivity;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Admin, editor and viewer: who can read, change and manage what. */
class StaffRolesTest extends TestCase
{
    use RefreshDatabase;

    public function test_viewer_reads_everything_but_changes_nothing(): void
    {
        $store = Store::factory()->create();
        $coupon = Coupon::factory()->for($store)->create();
        Sanctum::actingAs(User::factory()->viewer()->create());

        foreach (['dashboard', 'stores', "stores/{$store->id}", 'coupons', "coupons/{$coupon->id}", 'categories?type=store', 'trash', 'orders', 'redemptions', 'settings'] as $path) {
            $this->getJson("/api/v1/admin/{$path}")->assertOk();
        }

        $this->postJson('/api/v1/admin/stores', ['name' => 'X', 'direct_url' => 'https://x.test'])->assertForbidden();
        $this->patchJson("/api/v1/admin/coupons/{$coupon->id}", ['title' => 'Changed'])->assertForbidden();
        $this->deleteJson("/api/v1/admin/coupons/{$coupon->id}")->assertForbidden();
        $this->putJson('/api/v1/admin/settings/general', ['site_name' => 'X'])->assertForbidden();
        $this->getJson('/api/v1/admin/staff')->assertForbidden();
        $this->getJson('/api/v1/admin/activity')->assertForbidden();

        $this->assertNotSame('Changed', $coupon->fresh()->title);
        $this->assertNull($coupon->fresh()->deleted_at);
    }

    public function test_editor_manages_the_catalogue_but_not_settings_money_or_staff(): void
    {
        $store = Store::factory()->create();
        $coupon = Coupon::factory()->for($store)->create();
        Sanctum::actingAs(User::factory()->editor()->create());

        $this->postJson('/api/v1/admin/stores', ['name' => 'New Store', 'direct_url' => 'https://new.test'])->assertCreated();
        $this->patchJson("/api/v1/admin/coupons/{$coupon->id}", ['title' => 'Edited'])->assertOk();
        $this->deleteJson("/api/v1/admin/coupons/{$coupon->id}")->assertNoContent();
        $this->postJson("/api/v1/admin/trash/coupon/{$coupon->id}/restore")->assertOk();

        $this->putJson('/api/v1/admin/settings/general', ['site_name' => 'X'])->assertForbidden();
        $this->deleteJson('/api/v1/admin/trash')->assertForbidden();
        $this->getJson('/api/v1/admin/staff')->assertForbidden();
        $this->getJson('/api/v1/admin/activity')->assertForbidden();
    }

    public function test_customers_and_disabled_staff_are_kept_out(): void
    {
        $this->actingAsCustomer();
        $this->getJson('/api/v1/admin/dashboard')->assertForbidden();

        $disabled = User::factory()->editor()->disabled()->create(['email' => 'off@staff.test']);
        $this->postJson('/api/v1/auth/login', ['email' => 'off@staff.test', 'password' => 'password'])
            ->assertUnprocessable()->assertJsonPath('errors.email.0', 'This account has been switched off. Ask an admin to turn it back on.');
        $this->assertSame(0, $disabled->tokens()->count());
    }

    public function test_admin_adds_staff_who_set_their_own_password(): void
    {
        Notification::fake();
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/staff', ['name' => 'Ed Itor', 'email' => 'ed@staff.test', 'role' => 'editor'])
            ->assertCreated()->assertJsonPath('data.role', 'editor')->assertJsonPath('invite_sent', true);

        $editor = User::where('email', 'ed@staff.test')->sole();
        $this->assertSame(Role::Editor, $editor->role);
        Notification::assertSentTo($editor, ResetPassword::class);
        $this->assertTrue(ActivityLog::where('action', 'staff_created')->where('subject_id', $editor->id)->exists());

        $this->postJson('/api/v1/admin/staff', ['name' => 'Bad', 'email' => 'bad@staff.test', 'role' => 'customer'])->assertUnprocessable();
        $this->getJson('/api/v1/admin/staff')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_switching_staff_off_signs_them_out_and_is_logged(): void
    {
        $this->actingAsAdmin();
        $editor = User::factory()->editor()->create();
        $editor->createToken('admin-dashboard');

        $this->patchJson("/api/v1/admin/staff/{$editor->id}", ['disabled' => true, 'role' => 'viewer'])
            ->assertOk()->assertJsonPath('data.disabled', true)->assertJsonPath('data.role', 'viewer');

        $this->assertSame(0, $editor->tokens()->count());
        $log = ActivityLog::where('action', 'staff_updated')->sole();
        $this->assertSame(['role' => ['editor', 'viewer'], 'disabled' => [false, true]], $log->changes);
    }

    public function test_the_last_admin_cannot_be_demoted_or_switched_off(): void
    {
        $admin = $this->actingAsAdmin();

        $this->patchJson("/api/v1/admin/staff/{$admin->id}", ['role' => 'editor'])->assertUnprocessable();
        $this->patchJson("/api/v1/admin/staff/{$admin->id}", ['disabled' => true])->assertUnprocessable();

        $other = User::factory()->admin()->create();
        $this->patchJson("/api/v1/admin/staff/{$other->id}", ['role' => 'editor'])->assertOk();
        // Now $admin is the only admin again, and still can't demote themselves.
        $this->patchJson("/api/v1/admin/staff/{$admin->id}", ['role' => 'viewer'])->assertUnprocessable();

        $customer = User::factory()->create();
        $this->patchJson("/api/v1/admin/staff/{$customer->id}", ['role' => 'admin'])->assertNotFound();
    }

    public function test_staff_get_admin_reset_links_and_alerts(): void
    {
        Notification::fake();
        $editor = User::factory()->editor()->create();
        $viewer = User::factory()->viewer()->create();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $editor->email]);
        Notification::assertSentTo($editor, ResetPassword::class, function (ResetPassword $n) use ($editor) {
            return str_contains($n->toMail($editor)->actionUrl, config('services.frontend.admin_url').'/#/reset-password');
        });

        $this->actingAsAdmin();
        $this->postJson('/api/v1/admin/stores', ['name' => 'Alert Store', 'direct_url' => 'https://alert.test'])->assertCreated();
        Notification::assertSentTo($editor, AdminActivity::class);
        Notification::assertNotSentTo($viewer, AdminActivity::class);
    }
}
