<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

/**
 * Forgiving input for admin forms: a slug typed as "Nike.com" or "Nike Running" becomes
 * "nike-com" / "nike-running", and a link typed without a scheme ("www.nike.com") gets https://.
 *
 * @mixin FormRequest
 */
trait NormalizesAdminInput
{
    /** @param list<string> $urlFields */
    protected function normalizeSlugAndUrls(array $urlFields = []): void
    {
        $merge = [];

        $slug = $this->input('slug');
        if (is_string($slug) && trim($slug) !== '') {
            $slug = preg_replace('#^[a-z][a-z0-9+.-]*://#i', '', trim($slug));
            $merge['slug'] = Str::slug(str_replace(['.', '/', '_'], '-', $slug));
        }

        foreach ($urlFields as $field) {
            $url = $this->input($field);
            // Only a bare domain ("nike.com", "www.nike.com/sale") gets https://; anything else is
            // left for the url rule to reject.
            if (is_string($url) && ($url = trim($url)) !== '' && preg_match('#^[a-z0-9-]+(\.[a-z0-9-]+)+(/\S*)?$#i', $url)) {
                $merge[$field] = 'https://'.$url;
            }
        }

        $this->merge($merge);
    }
}
