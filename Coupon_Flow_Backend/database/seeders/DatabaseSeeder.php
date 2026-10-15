<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(AdminSeeder::class);

        // Demo catalogue and demo activity never reach production.
        if (! app()->isProduction()) {
            $this->call(DemoSeeder::class);
        }
    }
}
