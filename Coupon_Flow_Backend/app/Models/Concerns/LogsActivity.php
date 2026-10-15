<?php

namespace App\Models\Concerns;

use App\Services\Audit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Logs create / update / delete / restore of a catalogue model to the activity log when staff
 * (or the system) makes the change. Shoppers' side effects (e.g. click counts) are not logged.
 * A model can list fields to leave out in `$auditIgnore`.
 */
trait LogsActivity
{
    public static function bootLogsActivity(): void
    {
        static::created(fn (Model $model) => $model->audit('created', $model->auditable($model->getAttributes())));

        static::updated(function (Model $model) {
            $changes = [];
            foreach ($model->auditable($model->getChanges()) as $field => $new) {
                $changes[$field] = [$model->getOriginal($field), $new];
            }
            if ($changes) {
                $model->audit('updated', $changes);
            }
        });

        static::deleted(function (Model $model) {
            $soft = in_array(SoftDeletes::class, class_uses_recursive($model), true) && ! $model->isForceDeleting();
            $model->audit($soft ? 'deleted' : 'deleted_permanently');
        });

        if (in_array(SoftDeletes::class, class_uses_recursive(static::class), true)) {
            static::restored(fn (Model $model) => $model->audit('restored'));
        }
    }

    /** @param array<string, mixed> $changes */
    protected function audit(string $action, array $changes = []): void
    {
        $actor = Audit::actor();
        if ($actor && ! $actor->isStaff()) {
            return;
        }

        Audit::log($action, $this, $changes, actor: $actor);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    protected function auditable(array $attributes): array
    {
        $ignore = array_merge(['id', 'created_at', 'updated_at', 'deleted_at'], $this->auditIgnore ?? []);

        return array_diff_key($attributes, array_flip($ignore));
    }
}
