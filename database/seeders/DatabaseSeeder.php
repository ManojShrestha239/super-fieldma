<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'admin@fieldma.local'],
            [
                'name' => 'FieldMA Ops Admin',
                'password' => Hash::make('password'),
                'role' => UserRole::Admin,
                'email_verified_at' => now(),
            ],
        );

        User::query()->updateOrCreate(
            ['email' => 'viewer@fieldma.local'],
            [
                'name' => 'FieldMA Ops Viewer',
                'password' => Hash::make('password'),
                'role' => UserRole::Viewer,
                'email_verified_at' => now(),
            ],
        );
    }
}
