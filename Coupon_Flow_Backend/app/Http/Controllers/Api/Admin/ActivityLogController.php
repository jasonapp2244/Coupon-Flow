<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin-only: the activity log, newest first, with filters. */
class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => ['nullable', 'integer'],
            'action' => ['nullable', 'string', 'max:40'],
            'subject_type' => ['nullable', 'string', 'max:40'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $logs = ActivityLog::query()
            ->when($request->query('user_id'), fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->query('action'), fn ($q, $action) => $q->where('action', $action))
            ->when($request->query('subject_type'), fn ($q, $type) => $q->where('subject_type', $type))
            ->when($request->query('from'), fn ($q, $from) => $q->where('created_at', '>=', $from))
            ->when($request->query('to'), fn ($q, $to) => $q->where('created_at', '<', date('Y-m-d', strtotime($to.' +1 day'))))
            ->when($request->query('q'), fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('subject_label', 'like', '%'.addcslashes($term, '%_\\').'%')
                ->orWhere('user_name', 'like', '%'.addcslashes($term, '%_\\').'%')))
            ->latest('created_at')->orderByDesc('id')
            ->paginate($this->perPage($request, 25));

        return response()->json([
            'data' => collect($logs->items())->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'user_name' => $log->user_name,
                'action' => $log->action,
                'subject_type' => $log->subject_type,
                'subject_id' => $log->subject_id,
                'subject_label' => $log->subject_label,
                'changes' => $log->changes,
                'ip' => $log->ip,
                'user_agent' => $log->user_agent,
                'created_at' => $log->created_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'from' => $logs->firstItem(),
                'to' => $logs->lastItem(),
            ],
            'filters' => [
                'actions' => ActivityLog::query()->distinct()->orderBy('action')->pluck('action'),
                'subject_types' => ActivityLog::query()->whereNotNull('subject_type')->distinct()->orderBy('subject_type')->pluck('subject_type'),
            ],
        ]);
    }
}
