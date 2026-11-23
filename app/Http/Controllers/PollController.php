<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\InstanceStatus;
use App\Jobs\PollFieldmaInstanceJob;
use App\Models\FieldmaDailySnapshot;
use App\Models\FieldmaInstance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PollController extends Controller
{
    public function pollInstance(Request $request, FieldmaInstance $instance): JsonResponse
    {
        abort_unless((bool) $request->user()?->isAdmin(), 403);

        $today = now()->toDateString();
        $snapshotDate = $this->resolveSnapshotDate($request, $today);

        // For past dates, never hit the remote DB again once a valid snapshot is saved locally.
        if ($snapshotDate < $today) {
            $alreadySaved = FieldmaDailySnapshot::query()
                ->where('fieldma_instance_id', $instance->id)
                ->whereDate('snapshot_date', $snapshotDate)
                ->where('status', '!=', InstanceStatus::Offline->value)
                ->exists();

            if ($alreadySaved) {
                return response()->json([
                    'queued' => false,
                    'cached' => true,
                    'instance_id' => $instance->id,
                    'snapshot_date' => $snapshotDate,
                ]);
            }
        }

        PollFieldmaInstanceJob::dispatch($instance->id, $snapshotDate);

        return response()->json([
            'queued' => true,
            'cached' => false,
            'instance_id' => $instance->id,
            'snapshot_date' => $snapshotDate,
        ]);
    }

    public function pollAll(Request $request): JsonResponse
    {
        abort_unless((bool) $request->user()?->isAdmin(), 403);

        $today = now()->toDateString();
        $snapshotDate = $this->resolveSnapshotDate($request, $today);

        if ($snapshotDate < $today) {
            return response()->json([
                'message' => 'Bulk polling is disabled for past dates. Fetch individual instances on demand instead.',
            ], 422);
        }

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

    private function resolveSnapshotDate(Request $request, string $today): string
    {
        $raw = $request->input('date', $request->query('date'));

        return is_string($raw) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw) === 1
            ? $raw
            : $today;
    }
}
