<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Creates (or updates) a staff account from the server shell, e.g. the first super admin on a fresh
 * install. Without --password a strong one is generated and printed once; --invite emails a
 * set-password link instead, so nobody else ever sees the password.
 */
class CreateStaff extends Command
{
    protected $signature = 'staff:create
        {email : Sign-in email}
        {--name= : Display name (defaults to the part before the @)}
        {--role=admin : super_admin, admin, editor or viewer}
        {--password= : Password to set (min 12 characters); generated when left out}
        {--invite : Email a set-password link instead of setting a password}';

    protected $description = 'Create or update a staff account (super admin, admin, editor or viewer)';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error("{$email} is not a valid email address.");

            return self::FAILURE;
        }

        $role = Role::tryFrom((string) $this->option('role'));
        if (! $role || ! $role->isStaff()) {
            $this->error('--role must be one of: '.implode(', ', array_map(fn (Role $r) => $r->value, Role::staff())).'.');

            return self::FAILURE;
        }

        $password = $this->option('password');
        if ($password !== null && Str::length($password) < 12) {
            $this->error('--password must be at least 12 characters.');

            return self::FAILURE;
        }

        $user = User::firstOrNew(['email' => $email]);
        $created = ! $user->exists;
        $name = trim((string) $this->option('name'));
        if ($name !== '' || $created) {
            $user->name = $name !== '' ? $name : Str::of($email)->before('@')->replace(['.', '_', '-'], ' ')->title()->value();
        }

        $invite = (bool) $this->option('invite');
        $shown = null;
        if (! $invite) {
            $shown = $password ?? Str::password(16, symbols: false);
            $user->password = $shown;
        } elseif ($created) {
            $user->password = Str::password(40);
        }

        $user->forceFill(['role' => $role, 'email_verified_at' => $user->email_verified_at ?? now(), 'disabled_at' => null])->save();
        Audit::log($created ? 'staff_created' : 'staff_updated', $user, ['role' => $role->value], label: $user->email);

        $this->info(($created ? 'Created' : 'Updated')." {$role->label()} {$user->email} ({$user->name}).");

        if ($invite) {
            $sent = Password::sendResetLink(['email' => $user->email]) === Password::RESET_LINK_SENT;
            $sent ? $this->info("A set-password link was emailed to {$user->email}.")
                : $this->warn('The set-password link was not sent (a link went out a moment ago, or mail is not set up).');
        } elseif ($password === null) {
            $this->line("Password: {$shown}");
            $this->warn('Shown once. Pass it on securely; they can change it in My Account.');
        }

        return self::SUCCESS;
    }
}
