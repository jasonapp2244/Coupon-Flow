<?php

namespace App\Http\Controllers;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

abstract class Controller
{
    protected function perPage(Request $request, int $default = 10): int
    {
        return max(1, min(100, (int) $request->integer('per_page', $default)));
    }

    /**
     * Apply ?sort=field&dir=asc|desc, restricted to a whitelist so arbitrary columns cannot be injected.
     *
     * @param  list<string>  $allowed
     */
    protected function applySort(Builder $query, Request $request, array $allowed, string $default = 'updated_at'): Builder
    {
        $sort = in_array($request->query('sort'), $allowed, true) ? $request->query('sort') : $default;
        $dir = $request->query('dir') === 'asc' ? 'asc' : 'desc';

        return $query->orderBy($sort, $dir)->orderBy('id', $dir);
    }
}
