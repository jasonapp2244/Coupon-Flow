<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Production-safe: creates (or resets the password of) the first account only, as super admin.
 * Run on the server with: php artisan db:seed --class=AdminSeeder --force
 */
class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('services.admin.email');
        $password = config('services.admin.password');

        if (blank($email) || blank($password)) {
            throw new \RuntimeException('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding.');
        }

        $admin = User::firstOrNew(['email' => $email]);
        $admin->forceFill(['name' => 'Admin', 'password' => $password, 'role' => Role::SuperAdmin, 'email_verified_at' => now()])->save();
    }
}
