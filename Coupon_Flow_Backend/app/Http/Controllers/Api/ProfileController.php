<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Services\Audit;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\PersonalAccessToken;

class ProfileController extends Controller
{
    public function update(Request $request): UserResource
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['required_with:password,email', 'current_password'],
            'password' => ['sometimes', 'confirmed', Password::min(8)],
        ]);

        $user->fill(collect($data)->except('current_password')->all());
        $emailChanged = $user->isDirty('email');

        if ($user->isStaff() && $user->isDirty(['name', 'email', 'password'])) {
            $changed = array_keys(array_intersect_key($user->getDirty(), array_flip(['name', 'email', 'password'])));
            Audit::log('profile_updated', $user, array_fill_keys($changed, true), label: $user->getOriginal('email'));
        }

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        $user->save();

        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
        }

        if (isset($data['password'])) {
            // Sign out every other device; this session stays signed in.
            $current = $user->currentAccessToken();
            $user->tokens()
                ->when($current instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($current->getKey()))
                ->delete();
        }

        return new UserResource($user);
    }
}
