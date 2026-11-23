<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Jobs\PollFieldmaInstanceJob;
use App\Models\FieldmaInstance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PollController extends Controller
{
    public function pollInstance(Request $request, FieldmaInstance $instance): JsonResponse
    {
        abort_unless((bool) $request->user()?->isAdmin(), 403);

        $snapshotDate = $this->resolveSnapshotDate($request);
        PollFieldmaInstanceJob::dispatch($instance->id, $snapshotDate);

        return response()->json([
            'queued' => true,
            'instance_id' => $instance->id,
            'snapshot_date' => $snapshotDate,
        ]);
    }

    public function pollAll(Request $request): JsonResponse
    {
        abort_unless((bool) $request->user()?->isAdmin(), 403);

        $snapshotDate = $this->resolveSnapshotDate($request);
        $ids = FieldmaInstance::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->pluck('id');

        foreach ($ids as $id) {
            PollFieldmaInstanceJob::dispatch((int) $id, $snapshotDate);
        }

        return response()->json([
            'queued' => true,
            'dispatched_count' => $ids->count(),
            'snapshot_date' => $snapshotDate,
        ]);
    }

    private function resolveSnapshotDate(Request $request): string
    {
        $raw = $request->input('date', $request->query('date'));

        return is_string($raw) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw) === 1
            ? $raw
            : now()->toDateString();
    }
}
