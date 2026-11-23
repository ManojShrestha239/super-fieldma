<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $today = now()->toDateString();
        $selectedDate = is_string($request->query('date')) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $request->query('date')) === 1
            ? $request->query('date')
            : $today;

        return Inertia::render('Dashboard', [
            'today' => $today,
            'selectedDate' => $selectedDate,
            'canManage' => (bool) $request->user()?->isAdmin(),
        ]);
    }
}
