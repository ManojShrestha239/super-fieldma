<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('fieldma.dashboard', function (User $user): bool {
    return $user->exists;
});
