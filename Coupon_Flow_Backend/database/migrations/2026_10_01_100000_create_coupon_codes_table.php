<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            // Off: every buyer receives `code`. On: each buyer receives their own code from coupon_codes.
            $table->boolean('unique_codes')->default(false)->after('stock');
        });

        Schema::create('coupon_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->string('code', 100);
            // Set when the code is handed to a paid order; never reused after that, even on refund.
            $table->foreignId('order_item_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamps();

            $table->unique(['coupon_id', 'code']);
            $table->index(['coupon_id', 'order_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupon_codes');

        Schema::table('coupons', function (Blueprint $table) {
            $table->dropColumn('unique_codes');
        });
    }
};
