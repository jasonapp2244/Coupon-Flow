<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // "Rate this store" stars on the public store page. No sign-in needed: one vote per visitor.
    public function up(): void
    {
        Schema::create('store_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            // Signed-in voter, so the admin can see who rated; null for guests.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // Keyed hash of the signed-in user, or of IP + browser for guests; never the raw IP.
            $table->char('voter', 64);
            $table->timestamps();

            $table->unique(['store_id', 'voter']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_ratings');
    }
};
