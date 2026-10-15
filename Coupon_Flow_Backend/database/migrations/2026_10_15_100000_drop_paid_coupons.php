<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Selling exclusive codes was removed (2026-10-15): the site lists free coupons and deals only.
 * Drops orders, code pools and Stripe event records, the paid coupons themselves (their past
 * clicks stay in redemptions, unlinked) and the price/stock columns. down() restores the schema,
 * not the data.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('coupon_codes');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('stripe_events');

        DB::table('coupons')->where('price_cents', '>', 0)->delete();

        Schema::table('coupons', function (Blueprint $table) {
            $table->dropColumn(['price_cents', 'stock', 'unique_codes']);
        });

        // The "Sell Exclusive Codes" switch and the payment "Problem Alerts" email switch are gone.
        foreach (['general' => 'shop_enabled', 'notifications' => 'error_alerts'] as $group => $key) {
            $row = DB::table('settings')->where('key', $group)->first();
            if ($row && $row->value !== null) {
                $value = json_decode($row->value, true);
                unset($value[$key]);
                DB::table('settings')->where('key', $group)->update(['value' => json_encode($value)]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            $table->unsignedInteger('price_cents')->default(0)->after('is_exclusive');
            $table->unsignedInteger('stock')->nullable()->after('price_cents');
            $table->boolean('unique_codes')->default(false)->after('stock');
        });

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
            $table->foreignId('coupon_id')->constrained()->restrictOnDelete();
            $table->string('title_snapshot');
            $table->unsignedInteger('unit_price_cents');
            $table->unsignedInteger('quantity')->default(1);
            $table->string('code_snapshot', 100)->nullable();
            $table->timestamps();
        });

        Schema::create('stripe_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_id')->unique();
            $table->string('type');
            $table->timestamp('processed_at');
        });

        Schema::create('coupon_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->string('code', 100);
            $table->foreignId('order_item_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamps();

            $table->unique(['coupon_id', 'code']);
            $table->index(['coupon_id', 'order_item_id']);
        });
    }
};
