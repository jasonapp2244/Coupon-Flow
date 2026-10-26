<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit;
use App\Services\TwoFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Admin-only (super admin accounts are managed by super admins): who can sign in to the admin and what they may do. New staff set their own
 * password from an emailed link; nobody types another person's password.
 */
class StaffController extends Controller
{
    public function index(): JsonResponse
    {
        $staff = User::whereIn('role', Role::staff())->orderByRaw('disabled_at is not null')->orderBy('name')->get();

        return response()->json(['data' => $staff->map($this->present(...))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')],
            'role' => ['required', Rule::in(array_map(fn (Role $r) => $r->value, Role::staff()))],
        ]);
        $this->guardSuperAdmin($request, Role::from($data['role']));

        $user = new User(['name' => $data['name'], 'email' => $data['email'], 'password' => Str::password(40)]);
        // The admin vouches for the address, and the set-password link proves it anyway.
        $user->forceFill(['role' => Role::from($data['role']), 'email_verified_at' => now()])->save();
        Audit::log('staff_created', $user, ['role' => $data['role']], label: $user->email);

        $sent = $this->sendInvite($user);

        return response()->json(['data' => $this->present($user), 'invite_sent' => $sent], Response::HTTP_CREATED);
    }

    public function update(Request $request, User $staff): JsonResponse
    {
        abort_unless($staff->isStaff(), 404);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'role' => ['sometimes', Rule::in(array_map(fn (Role $r) => $r->value, Role::staff()))],
            'disabled' => ['sometimes', 'boolean'],
        ]);
        $this->guardSuperAdmin($request, $staff->role);
        if (isset($data['role'])) {
            $this->guardSuperAdmin($request, Role::from($data['role']));
        }

        $newRole = isset($data['role']) ? Role::from($data['role']) : $staff->role;
        $disabling = (bool) ($data['disabled'] ?? false);
        if ($staff->isAdmin() && (! in_array($newRole, Role::admins(), true) || $disabling)) {
            abort_if($staff->is($request->user()), 422, "You can't remove your own admin access. Ask another admin.");
            $otherAdmins = User::whereIn('role', Role::admins())->whereNull('disabled_at')->whereKeyNot($staff->id)->exists();
            abort_unless($otherAdmins, 422, 'This is the last active admin. Make someone else an admin first.');
        }
        if ($staff->isSuperAdmin() && ($newRole !== Role::SuperAdmin || $disabling)) {
            abort_if($staff->is($request->user()), 422, "You can't remove your own super admin access. Ask another super admin.");
            $others = User::where('role', Role::SuperAdmin)->whereNull('disabled_at')->whereKeyNot($staff->id)->exists();
            abort_unless($others, 422, 'This is the last active super admin. Make someone else a super admin first.');
        }
        abort_if(($data['disabled'] ?? false) && $staff->is($request->user()), 422, "You can't switch off your own account.");

        $before = ['name' => $staff->name, 'role' => $staff->role->value, 'disabled' => $staff->isDisabled()];
        if (isset($data['name'])) {
            $staff->name = $data['name'];
        }
        if (isset($data['role'])) {
            $staff->role = Role::from($data['role']);
        }
        if (array_key_exists('disabled', $data)) {
            $staff->disabled_at = $data['disabled'] ? ($staff->disabled_at ?? now()) : null;
        }
        $staff->save();

        if ($staff->isDisabled()) {
            // Signed out everywhere at once.
            $staff->tokens()->delete();
        }

        $after = ['name' => $staff->name, 'role' => $staff->role->value, 'disabled' => $staff->isDisabled()];
        $changes = [];
        foreach ($after as $field => $value) {
            if ($before[$field] !== $value) {
                $changes[$field] = [$before[$field], $value];
            }
        }
        if ($changes) {
            Audit::log('staff_updated', $staff, $changes, label: $staff->email);
        }

        return response()->json(['data' => $this->present($staff)]);
    }

    public function resendInvite(Request $request, User $staff): JsonResponse
    {
        abort_unless($staff->isStaff(), 404);
        $this->guardSuperAdmin($request, $staff->role);
        abort_if($staff->isDisabled(), 422, 'Turn this account back on before sending a link.');

        $sent = $this->sendInvite($staff);
        abort_unless($sent, 429, 'A link was sent a moment ago. Try again in a minute.');
        Audit::log('staff_invite_sent', $staff, label: $staff->email);

        return response()->json(['message' => "A set-password link was sent to {$staff->email}."]);
    }

    /** For a lost phone: turns the person's two-step login off so they can set it up again. */
    public function resetTwoFactor(Request $request, User $staff, TwoFactor $twoFactor): JsonResponse
    {
        abort_unless($staff->isStaff(), 404);
        $this->guardSuperAdmin($request, $staff->role);

        $twoFactor->disable($staff);
        $staff->tokens()->delete();
        Audit::log('two_factor_reset', $staff, label: $staff->email);

        return response()->json(['data' => $this->present($staff)]);
    }

    /** Only a super admin may create, change or act on a super admin account. */
    private function guardSuperAdmin(Request $request, Role $role): void
    {
        abort_if($role === Role::SuperAdmin && ! $request->user()->isSuperAdmin(), 403, 'Only a super admin can manage super admin accounts.');
    }

    private function sendInvite(User $user): bool
    {
        return Password::sendResetLink(['email' => $user->email]) === Password::RESET_LINK_SENT;
    }

    /** @return array<string, mixed> */
    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'disabled' => $user->isDisabled(),
            'two_factor' => $user->hasTwoFactor(),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
