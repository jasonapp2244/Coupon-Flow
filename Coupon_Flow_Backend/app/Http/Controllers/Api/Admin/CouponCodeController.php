<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\CouponCode;
use App\Services\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** A coupon's code list: each click on the website takes the next free code. */
class CouponCodeController extends Controller
{
    private const MAX_PER_UPLOAD = 5000;

    public function index(Request $request, Coupon $coupon): JsonResponse
    {
        $request->validate(['state' => ['nullable', Rule::in(['free', 'used'])]]);

        $codes = $coupon->codes()
            ->with('redemption:id,reference')
            ->when($request->query('state') === 'free', fn ($q) => $q->whereNull('redemption_id'))
            ->when($request->query('state') === 'used', fn ($q) => $q->whereNotNull('redemption_id'))
            ->orderByRaw('redemption_id is null')->latest('assigned_at')->orderBy('id')
            ->paginate($this->perPage($request, 50));

        return response()->json([
            'data' => $codes->getCollection()->map(fn (CouponCode $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'used' => $c->redemption_id !== null,
                'assigned_at' => $c->assigned_at?->toIso8601String(),
                'redemption_reference' => $c->redemption?->reference,
            ]),
            'meta' => [
                'current_page' => $codes->currentPage(),
                'last_page' => $codes->lastPage(),
                'per_page' => $codes->perPage(),
                'total' => $codes->total(),
            ],
            'counts' => $this->counts($coupon),
        ]);
    }

    /** Pasted codes (one per line or comma-separated) or a CSV/TXT file (first column). Duplicates are skipped. */
    public function store(Request $request, Coupon $coupon): JsonResponse
    {
        $request->validate([
            'codes' => ['required_without:file', 'nullable', 'string', 'max:500000'],
            'file' => ['required_without:codes', 'nullable', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        if ($request->hasFile('file')) {
            $lines = array_map(fn (string $line) => str_getcsv($line)[0] ?? '', file($request->file('file')->getRealPath(), FILE_IGNORE_NEW_LINES) ?: []);
            if ($lines) {
                // Spreadsheet exports start with a byte-order mark and often a header row ("code"); neither is a code.
                $lines[0] = preg_replace('/^\xEF\xBB\xBF/', '', $lines[0]);
                if (preg_match('/^\s*"?\s*(coupon[\s_-]*)?codes?\s*"?\s*$/i', $lines[0])) {
                    array_shift($lines);
                }
            }
        } else {
            $lines = preg_split('/[\r\n,]+/', (string) $request->input('codes'));
        }

        $codes = collect($lines)
            ->map(fn ($code) => trim((string) $code, " \t\"'"))
            ->filter(fn (string $code) => $code !== '' && mb_strlen($code) <= 100)
            ->unique()->values();

        if ($codes->isEmpty()) {
            throw ValidationException::withMessages(['codes' => 'No codes found. Put one code per line.']);
        }
        if ($codes->count() > self::MAX_PER_UPLOAD) {
            throw ValidationException::withMessages(['codes' => 'Add at most '.number_format(self::MAX_PER_UPLOAD).' codes at a time.']);
        }

        $known = $coupon->codes()->whereIn('code', $codes)->pluck('code');
        $new = $codes->diff($known)->values();
        $now = now();

        foreach ($new->chunk(500) as $chunk) {
            CouponCode::insert($chunk->map(fn (string $code) => [
                'coupon_id' => $coupon->id, 'code' => $code, 'created_at' => $now, 'updated_at' => $now,
            ])->all());
        }

        $coupon->syncCodeCounts();
        if ($new->isNotEmpty()) {
            Audit::log('codes_added', $coupon, ['codes' => $new->count()]);
        }

        return response()->json(['added' => $new->count(), 'skipped' => $codes->count() - $new->count(), ...$this->counts($coupon)], Response::HTTP_CREATED);
    }

    /** Only a free code can be removed: a handed-out one belongs to a visitor's click. */
    public function destroy(Coupon $coupon, CouponCode $code): Response|JsonResponse
    {
        if ($code->redemption_id !== null) {
            return response()->json(['message' => 'This code was already handed out to a visitor and cannot be removed.'], 422);
        }

        $code->delete();
        $coupon->syncCodeCounts();
        Audit::log('code_removed', $coupon, ['code' => $code->code]);

        return response()->noContent();
    }

    /** @return array{total: int, left: int} */
    private function counts(Coupon $coupon): array
    {
        $total = $coupon->codes()->count();

        return ['total' => $total, 'left' => $total - $coupon->codes()->whereNotNull('redemption_id')->count()];
    }
}
