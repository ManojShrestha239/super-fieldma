<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Resources\DashboardRowResource;
use App\Models\FieldmaInstance;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
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

        return Inertia::render('Dashboard', [
            'today' => $today,
            'selectedDate' => $selectedDate,
            'canManage' => (bool) $request->user()?->isAdmin(),
            'rows' => DashboardRowResource::collection($instances)->resolve(),
        ]);
    }
}
