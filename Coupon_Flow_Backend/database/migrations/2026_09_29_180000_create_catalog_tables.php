<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('type', 10)->index();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['type', 'slug']);
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('heading')->nullable();
            $table->text('description')->nullable();
            $table->longText('content')->nullable();
            $table->string('direct_url', 2048);
            $table->string('tracking_url', 2048)->nullable();
            $table->string('logo_path')->nullable();
            $table->string('meta_title')->nullable();
            $table->string('meta_description', 500)->nullable();
            $table->string('meta_keywords', 500)->nullable();
            $table->boolean('is_top')->default(false);
            $table->boolean('is_editor_choice')->default(false);
            $table->string('status', 20)->default('Draft')->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('type', 30);
            $table->string('code', 100)->nullable();
            $table->text('description')->nullable();
            $table->string('tracking_url', 2048)->nullable();
            $table->date('starts_at')->nullable();
            $table->date('expires_at')->nullable()->index();
            $table->string('status', 20)->default('Draft')->index();
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->boolean('is_exclusive')->default(false);
            // 0 = free coupon (code public); > 0 = paid coupon (code revealed after purchase).
            $table->unsignedInteger('price_cents')->default(0);
            // null = unlimited; otherwise remaining purchasable quantity.
            $table->unsignedInteger('stock')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('blogs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('excerpt')->nullable();
            $table->longText('body')->nullable();
            $table->string('featured_image')->nullable();
            $table->string('meta_title')->nullable();
            $table->string('meta_description', 500)->nullable();
            $table->string('meta_keywords', 500)->nullable();
            $table->boolean('is_featured')->default(false);
            $table->string('status', 20)->default('Draft')->index();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blogs');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('stores');
        Schema::dropIfExists('categories');
    }
};
