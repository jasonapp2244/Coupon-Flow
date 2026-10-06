<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Click-outs from the public site record which coupon was used.
    public function up(): void
    {
        Schema::table('redemptions', function (Blueprint $table) {
            $table->foreignId('coupon_id')->nullable()->after('store_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('redemptions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('coupon_id');
        });
    }
};
