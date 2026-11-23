<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FieldmaInstanceController;
use App\Http\Controllers\PollController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])->name('login.store');
});

Route::middleware('auth')->group(function (): void {
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    Route::post('/dashboard/poll-all', [PollController::class, 'pollAll'])
        ->middleware('throttle:6,1')
        ->name('dashboard.poll-all');

    Route::prefix('instances')->name('instances.')->group(function (): void {
        Route::post('/', [FieldmaInstanceController::class, 'store'])->name('store');
        Route::post('/test-connection', [FieldmaInstanceController::class, 'testConnection'])->name('test-connection');
        Route::put('/{instance}', [FieldmaInstanceController::class, 'update'])->name('update');
        Route::delete('/{instance}', [FieldmaInstanceController::class, 'destroy'])->name('destroy');
        Route::post('/{instance}/test-connection', [FieldmaInstanceController::class, 'testConnection'])->name('test-existing');
        Route::post('/{instance}/poll', [PollController::class, 'pollInstance'])
            ->middleware('throttle:30,1')
            ->name('poll');
    });
});
