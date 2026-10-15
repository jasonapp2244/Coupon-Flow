<?php

use App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OutboundController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PublicCatalogController;
use App\Http\Controllers\Api\TwoFactorController;
use Illuminate\Support\Facades\Route;

// Click-outs: the website opens these in a new tab; merchant links never appear on its pages.
Route::prefix('go')->middleware('throttle:clicks')->controller(OutboundController::class)->group(function () {
    Route::get('store/{slug}', 'store');
    Route::get('{id}', 'coupon')->whereNumber('id');
});

Route::prefix('v1')->group(function () {

    // ── Auth ────────────────────────────────────────────────────────────────
    Route::prefix('auth')->group(function () {
        Route::middleware('throttle:auth')->group(function () {
            Route::post('login', [AuthController::class, 'login']);
            Route::post('two-factor', [AuthController::class, 'twoFactorChallenge']);
            Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
            Route::post('reset-password', [AuthController::class, 'resetPassword']);
        });

        Route::middleware('auth:sanctum')->group(function () {
            Route::get('me', [AuthController::class, 'me']);
            Route::post('logout', [AuthController::class, 'logout']);
            Route::put('profile', [ProfileController::class, 'update']);

            // Two-step login (staff only).
            Route::controller(TwoFactorController::class)->prefix('two-factor')->middleware(['role:admin,editor,viewer', 'throttle:auth'])->group(function () {
                Route::get('/', 'status')->withoutMiddleware('throttle:auth');
                Route::post('setup', 'setup');
                Route::post('confirm', 'confirm');
                Route::post('recovery-codes', 'recoveryCodes');
                Route::delete('/', 'disable');
            });
        });
    });

    // ── Public website (read-only, published content only) ─────────────────
    Route::prefix('public')->middleware('throttle:public')->controller(PublicCatalogController::class)->group(function () {
        Route::get('settings', 'settings');
        Route::get('search', 'search');
        Route::get('sitemap', 'sitemap');
        Route::get('categories', 'categories');
        Route::get('categories/{slug}', 'category');
        Route::get('stores', 'stores');
        Route::get('stores/{slug}', 'store');
        Route::post('stores/{slug}/rating', 'rate')->middleware('throttle:ratings');
        Route::get('coupons', 'coupons');
        Route::get('coupons/{id}', 'coupon')->whereNumber('id');
        Route::get('coupons/{id}/reveal', 'reveal')->whereNumber('id');
        Route::post('coupons/{id}/click', 'click')->whereNumber('id')->middleware('throttle:clicks');
        Route::get('blogs', 'blogs');
        Route::get('blogs/{slug}', 'blog');
    });

    // ── Admin dashboard ─────────────────────────────────────────────────────
    // Staff roles: viewer reads everything below; editor also changes the catalogue;
    // admin also manages settings, staff, feeds and the activity log.
    $catalog = ['stores' => Admin\StoreController::class, 'coupons' => Admin\CouponController::class, 'blogs' => Admin\BlogController::class];

    Route::prefix('admin')->middleware(['auth:sanctum', 'role:admin,editor,viewer', 'two_factor'])->group(function () use ($catalog) {
        Route::get('dashboard', [Admin\DashboardController::class, 'index']);
        Route::get('analytics', [Admin\DashboardController::class, 'analytics']);
        Route::get('analytics/export', [Admin\DashboardController::class, 'export']);

        foreach ($catalog as $name => $controller) {
            Route::apiResource($name, $controller)->only(['index', 'show']);
        }
        Route::get('coupons/{coupon}/codes', [Admin\CouponCodeController::class, 'index']);
        Route::controller(Admin\StoreRatingController::class)->prefix('stores/{store}/ratings')->scopeBindings()->group(function () {
            Route::get('/', 'index');
            Route::get('summary', 'summary');
        });
        Route::get('categories', [Admin\CategoryController::class, 'index']);
        Route::get('trash', [Admin\TrashController::class, 'index']);

        Route::controller(Admin\ActivityController::class)->group(function () {
            Route::get('redemptions', 'redemptions');
            Route::get('redemptions/summary', 'redemptionSummary');
            Route::get('sync-runs', 'syncRuns');
            Route::get('notifications', 'notifications');
            Route::post('notifications/read-all', 'markAllNotificationsRead');
            Route::post('notifications/{id}/read', 'markNotificationRead');
        });
        Route::get('settings', [Admin\SettingsController::class, 'index']);
        Route::get('feed-sources', [Admin\FeedSourceController::class, 'index']);
        Route::get('feed-sources/template', [Admin\FeedSourceController::class, 'template']);

        // ── Admin + editor: catalogue changes ──
        Route::middleware('role:admin,editor')->group(function () use ($catalog) {
            foreach ($catalog as $name => $controller) {
                $param = rtrim($name, 's');
                Route::apiResource($name, $controller)->only(['store', 'update', 'destroy']);
                Route::patch("{$name}/{{$param}}/status", [$controller, 'updateStatus']);
                Route::post("{$name}/{{$param}}/duplicate", [$controller, 'duplicate']);
            }
            Route::post('coupons/{coupon}/reset-uses', [Admin\CouponController::class, 'resetUses']);
            Route::controller(Admin\CouponCodeController::class)->prefix('coupons/{coupon}/codes')->scopeBindings()->group(function () {
                Route::post('/', 'store');
                Route::delete('{code}', 'destroy')->whereNumber('code');
            });
            // Confirm (or fail) the sale behind a click: adds the order amount and the commission.
            Route::patch('redemptions/{redemption}', [Admin\ActivityController::class, 'confirmSale'])->whereNumber('redemption');
            Route::controller(Admin\StoreRatingController::class)->prefix('stores/{store}/ratings')->scopeBindings()->group(function () {
                Route::delete('/', 'reset');
                Route::delete('{rating}', 'destroy')->whereNumber('rating');
            });
            Route::apiResource('categories', Admin\CategoryController::class)->only(['store', 'update', 'destroy']);
            Route::post('trash/{type}/{id}/restore', [Admin\TrashController::class, 'restore'])->whereNumber('id');
            Route::post('feed-sources/{feedSource}/run', [Admin\FeedSourceController::class, 'run'])->middleware('throttle:feeds');
            Route::post('feed-sources/{feedSource}/import', [Admin\FeedSourceController::class, 'import'])->middleware('throttle:feeds');
        });

        // ── Admin only: settings, permanent deletes, staff ──
        Route::middleware('role:admin')->group(function () {
            Route::put('settings/{group}', [Admin\SettingsController::class, 'update']);
            Route::delete('trash', [Admin\TrashController::class, 'empty']);
            Route::delete('trash/{type}/{id}', [Admin\TrashController::class, 'destroy'])->whereNumber('id');

            Route::controller(Admin\StaffController::class)->prefix('staff')->group(function () {
                Route::get('/', 'index');
                Route::post('/', 'store');
                Route::patch('{staff}', 'update')->whereNumber('staff');
                Route::post('{staff}/invite', 'resendInvite')->whereNumber('staff');
                Route::delete('{staff}/two-factor', 'resetTwoFactor')->whereNumber('staff');
            });

            Route::get('activity', [Admin\ActivityLogController::class, 'index']);
            Route::apiResource('feed-sources', Admin\FeedSourceController::class)->only(['store', 'update', 'destroy']);
        });
    });
});
