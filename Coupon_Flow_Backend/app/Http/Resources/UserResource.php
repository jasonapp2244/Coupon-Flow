<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'email_verified' => $this->hasVerifiedEmail(),
            'two_factor' => $this->when($this->isStaff(), fn () => $this->hasTwoFactor()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
