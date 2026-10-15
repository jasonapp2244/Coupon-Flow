<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    protected function actingAsAdmin(): User
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        return $admin;
    }

    /** A signed-in account that is not staff (the old shopper role): it must be kept out of the admin. */
    protected function actingAsCustomer(): User
    {
        $customer = User::factory()->create();
        Sanctum::actingAs($customer);

        return $customer;
    }
}
