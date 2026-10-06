<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Brands and companies send coupons by feed URL (JSON/CSV) or CSV upload; each source is listed here. */
    public function up(): void
    {
        Schema::create('feed_sources', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('type', 20); // json_url | csv_url | csv_upload
            $table->string('url', 2048)->nullable();
            // Sent as "Authorization: Bearer …" when fetching; stored encrypted.
            $table->text('api_key')->nullable();
            // Rows with no store column go to this store.
            $table->foreignId('default_store_id')->nullable()->constrained('stores')->nullOnDelete();
            $table->string('frequency', 20)->default('manual'); // hourly | every_6_hours | daily | manual
            // Off: imported coupons arrive as Draft for an admin to review.
            $table->boolean('auto_publish')->default(false);
            // URL feeds only: coupons missing from the latest feed are switched off.
            $table->boolean('deactivate_missing')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->string('last_status', 20)->nullable();
            $table->timestamps();
        });

        Schema::table('coupons', function (Blueprint $table) {
            $table->foreignId('feed_source_id')->nullable()->after('store_id')->constrained()->nullOnDelete();
            $table->string('external_id', 190)->nullable()->after('feed_source_id');
            // Hash of the imported fields after the last import: if the coupon no longer matches it,
            // an admin edited it, and later imports leave it alone.
            $table->char('imported_hash', 64)->nullable()->after('external_id');
            $table->unique(['feed_source_id', 'external_id']);
        });

        Schema::table('sync_runs', function (Blueprint $table) {
            $table->foreignId('feed_source_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->unsignedInteger('coupons_kept')->default(0)->after('coupons_updated');
            $table->unsignedInteger('coupons_deactivated')->default(0)->after('coupons_kept');
            // [{row, external_id, message}], first 200.
            $table->json('errors')->nullable()->after('failed');
        });
    }

    public function down(): void
    {
        Schema::table('sync_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('feed_source_id');
            $table->dropColumn(['coupons_kept', 'coupons_deactivated', 'errors']);
        });

        Schema::table('coupons', function (Blueprint $table) {
            $table->dropUnique(['feed_source_id', 'external_id']);
            $table->dropConstrainedForeignId('feed_source_id');
            $table->dropColumn(['external_id', 'imported_hash']);
        });

        Schema::dropIfExists('feed_sources');
    }
};
