<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\FieldmaInstance;
use Illuminate\Database\Seeder;

class MockFieldmaInstancesSeeder extends Seeder
{
    public function run(): void
    {
        $instances = [
            [
                'name' => 'Alpha Pharma Nepal',
                'slug' => 'alpha-pharma-nepal',
                'app_url' => 'https://alpha.fieldma.local',
                'db_ip' => 'mock-remote-db',
                'db_port' => 3306,
                'db_database' => 'fieldma_alpha',
                'db_user' => 'fieldma_ro',
                'db_password' => 'readonly_secret',
                'is_active' => true,
                'notes' => 'Full modern FieldMA schema (local mock-remote-db).',
            ],
            [
                'name' => 'Beta Distribution Group',
                'slug' => 'beta-distribution-group',
                'app_url' => 'https://beta.fieldma.local',
                'db_ip' => 'mock-remote-db',
                'db_port' => 3306,
                'db_database' => 'fieldma_beta',
                'db_user' => 'fieldma_ro',
                'db_password' => 'readonly_secret',
                'is_active' => true,
                'notes' => 'High-activity modern FieldMA schema (local mock-remote-db).',
            ],
            [
                'name' => 'Legacy Trading Clone',
                'slug' => 'legacy-trading-clone',
                'app_url' => 'https://legacy.fieldma.local',
                'db_ip' => 'mock-remote-db',
                'db_port' => 3306,
                'db_database' => 'fieldma_legacy',
                'db_user' => 'fieldma_ro',
                'db_password' => 'readonly_secret',
                'is_active' => true,
                'notes' => 'Legacy clone missing device_logs and site_registration_v2_s.',
            ],
        ];

        foreach ($instances as $data) {
            FieldmaInstance::query()->updateOrCreate(
                ['slug' => $data['slug']],
                $data,
            );
        }
    }
}
