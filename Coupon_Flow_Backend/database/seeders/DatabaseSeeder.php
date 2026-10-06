<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(AdminSeeder::class);

        // Demo catalogue, demo activity and the test customer never reach production.
        if (! app()->isProduction()) {
            $this->call(DemoSeeder::class);
        }
    }
}
