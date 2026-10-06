<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Writes the admin activity log. Model changes arrive through the LogsActivity trait; sign-ins,
 * refunds, imports and other actions call log() directly.
 */
class Audit
{
    private static bool $paused = false;

    /** Field names whose values are never written to the log. */
    private const SECRET = '/password|secret|api_key|token|recovery/i';

    /**
     * @param  array<string, mixed>  $changes
     */
    public static function log(string $action, ?Model $subject = null, array $changes = [], ?string $label = null, ?User $actor = null): void
    {
        if (self::$paused) {
            return;
        }

        $actor ??= self::actor();
        $request = app()->runningInConsole() && ! app()->runningUnitTests() ? null : request();

        ActivityLog::create([
            'user_id' => $actor?->id,
            'user_name' => $actor?->name ?? 'System',
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
            'subject_label' => Str::limit($label ?? self::labelFor($subject), 187),
            'changes' => $changes ? self::mask($changes) : null,
            'ip' => $request?->ip(),
            'user_agent' => $request ? Str::limit((string) $request->userAgent(), 252) : null,
        ]);
    }

    /** Runs $work without logging (bulk imports log one summary entry instead). */
    public static function withoutLogging(callable $work): mixed
    {
        $before = self::$paused;
        self::$paused = true;

        try {
            return $work();
        } finally {
            self::$paused = $before;
        }
    }

    /** The signed-in user making the change, if any (null for scheduled jobs). */
    public static function actor(): ?User
    {
        $user = auth('sanctum')->user() ?? auth()->user();

        return $user instanceof User ? $user : null;
    }

    /**
     * @param  array<string, mixed>  $changes
     * @return array<string, mixed>
     */
    public static function mask(array $changes): array
    {
        foreach ($changes as $field => $value) {
            if (preg_match(self::SECRET, (string) $field)) {
                $changes[$field] = is_array($value) && array_is_list($value) && count($value) === 2 ? ['••••', '••••'] : '••••';
            }
        }

        return $changes;
    }

    private static function labelFor(?Model $subject): ?string
    {
        if (! $subject) {
            return null;
        }

        foreach (['title', 'name', 'reference', 'email'] as $field) {
            if (filled($subject->getAttribute($field))) {
                return (string) $subject->getAttribute($field);
            }
        }

        return class_basename($subject).' #'.$subject->getKey();
    }
}
