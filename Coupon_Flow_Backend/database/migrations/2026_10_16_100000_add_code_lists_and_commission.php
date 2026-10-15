<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Code lists (each click gets the next unused code; several per visitor up to a daily limit) and
 * commission tracking (store rate, optional coupon override, rate copied onto a confirmed sale).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            $table->boolean('unique_codes')->default(false)->after('is_exclusive');
            // Per visitor (IP + browser), per coupon, per 24 hours. 0 = no limit.
            $table->unsignedSmallInteger('max_codes_per_visitor')->default(5)->after('unique_codes');
            // Overrides the store's rate when set.
            $table->decimal('commission_percent', 5, 2)->nullable()->after('max_codes_per_visitor');
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->decimal('commission_percent', 5, 2)->nullable();
        });

        Schema::table('redemptions', function (Blueprint $table) {
            // sha256 of the token the browser sends with a click: the same token always gets the same code.
            $table->char('claim_token', 64)->nullable();
            // HMAC of IP + user agent, for the per-visitor daily limit. The raw IP is never stored.
            $table->char('visitor_hash', 64)->nullable()->index();
            // The rate used when the sale was confirmed, so later rate changes don't rewrite history.
            $table->decimal('commission_percent', 5, 2)->nullable();

            $table->unique(['coupon_id', 'claim_token']);
        });

        Schema::create('coupon_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->string('code', 100);
            // Set when a click takes the code; it is never handed out again.
            $table->foreignId('redemption_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamps();

            $table->unique(['coupon_id', 'code']);
            $table->index(['coupon_id', 'redemption_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupon_codes');

        Schema::table('redemptions', function (Blueprint $table) {
            $table->dropUnique(['coupon_id', 'claim_token']);
            $table->dropIndex(['visitor_hash']);
            $table->dropColumn(['claim_token', 'visitor_hash', 'commission_percent']);
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('commission_percent');
        });

        Schema::table('coupons', function (Blueprint $table) {
            $table->dropColumn(['unique_codes', 'max_codes_per_visitor', 'commission_percent']);
        });
    }
};
