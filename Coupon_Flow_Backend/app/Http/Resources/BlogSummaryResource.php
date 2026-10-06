<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** Blog list item: everything except the article body. */
class BlogSummaryResource extends BlogResource
{
    public function toArray(Request $request): array
    {
        return collect(parent::toArray($request))->except('body')->all();
    }
}
