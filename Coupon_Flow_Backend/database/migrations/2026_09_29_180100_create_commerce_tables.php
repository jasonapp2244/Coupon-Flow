<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('email');
            $table->string('status', 20)->default('pending')->index();
            $table->unsignedInteger('total_cents');
            $table->string('currency', 3);
            $table->string('stripe_checkout_session_id')->nullable()->unique();
            $table->string('stripe_payment_intent_id')->nullable()->index();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            // Coupons are soft-deleted, never hard-deleted while orders reference them.
            $table->foreignId('coupon_id')->constrained()->restrictOnDelete();
            $table->string('title_snapshot');
            $table->unsignedInteger('unit_price_cents');
            $table->unsignedInteger('quantity')->default(1);
            // Filled only once the order is paid.
            $table->string('code_snapshot', 100)->nullable();
            $table->timestamps();
        });

        Schema::create('stripe_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_id')->unique();
            $table->string('type');
            $table->timestamp('processed_at');
        });

        Schema::create('redemptions', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->string('user_name');
            $table->string('coupon_code', 100);
            $table->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('order_value_cents')->default(0);
            $table->unsignedInteger('commission_cents')->default(0);
            $table->timestamp('clicked_at')->nullable();
            $table->timestamp('redeemed_at')->nullable();
            $table->string('status', 20)->index();
            $table->string('tracking_id')->nullable();
            $table->timestamps();
        });

        Schema::create('sync_runs', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->string('type');
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('stores_added')->default(0);
            $table->unsignedInteger('coupons_added')->default(0);
            $table->unsignedInteger('coupons_updated')->default(0);
            $table->unsignedInteger('failed')->default(0);
            $table->string('status', 20)->index();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('sync_runs');
        Schema::dropIfExists('redemptions');
        Schema::dropIfExists('stripe_events');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
