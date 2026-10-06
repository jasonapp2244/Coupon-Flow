<?php

use Illuminate\Support\Facades\Route;

// This app is an API; its root only confirms it is up. Shoppers use the website, admins the dashboard.
Route::get('/', fn () => response()->json(['status' => 'ok', 'service' => config('app.name').' API']));
