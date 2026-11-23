<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Resources\DashboardRowResource;
use App\Jobs\PollFieldmaInstanceJob;
use App\Models\FieldmaInstance;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $today = now()->toDateString();
        $rawDate = $request->query('date');
        $selectedDate = is_string($rawDate) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawDate) === 1
            ? $rawDate
            : $today;

        $instances = FieldmaInstance::query()
            ->with([
                'snapshots' => function (HasMany $query) use ($selectedDate): void {
                    $query->whereDate('snapshot_date', $selectedDate);
                },
            ])
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        $backfillingCount = 0;

        // Auto-fetch ONLY the selected past date for active instances not yet saved locally.
        // Once persisted in fieldma_daily_snapshots, future visits never query remote DBs again.
        if ($selectedDate < $today) {
            foreach ($instances as $instance) {
                if (! $instance->is_active || $instance->snapshots->isNotEmpty()) {
                    continue;
                }

                $lockKey = "fieldma:backfill:{$instance->id}:{$selectedDate}";
                if (Cache::add($lockKey, true, now()->addSeconds(30))) {
                    PollFieldmaInstanceJob::dispatch($instance->id, $selectedDate);
                    $backfillingCount++;
                }
            }
        }

        return Inertia::render('Dashboard', [
            'today' => $today,
            'selectedDate' => $selectedDate,
            'canManage' => (bool) $request->user()?->isAdmin(),
            'backfillingCount' => $backfillingCount,
            'rows' => DashboardRowResource::collection($instances)->resolve(),
        ]);
    }
}
