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
            //apollo FieldMA instance
            [
                'name' => 'Apollo FieldMA',
                'slug' => 'apollo-fieldma',
                'app_url' => 'https://apollopaints.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'apollopaints_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Apollo FieldMA instance.',
            ],
            //Asiabuddha FieldMA instance
            [
                'name' => 'Asiabuddha FieldMA',
                'slug' => 'asiabuddha-fieldma',
                'app_url' => 'https://asiabuddha.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'asiabuddha_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Asiabuddha FieldMA instance.',
            ],
            //Birajpaints FieldMA instance
            [
                'name' => 'Birajpaints FieldMA',
                'slug' => 'birajpaints-fieldma',
                'app_url' => 'https://birajpaints.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'birajpaints_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Birajpaints FieldMA instance.',
            ],
            //Demo FieldMA instance
            [
                'name' => 'Demo FieldMA',
                'slug' => 'demo-fieldma',
                'app_url' => 'https://demo.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'demo_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Demo FieldMA instance.',
            ],
            //Durbar Traders FieldMA instance
            [
                'name' => 'Durbar Traders FieldMA',
                'slug' => 'durbartraders-fieldma',
                'app_url' => 'https://durbar-traders.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'durbartraders_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Durbar Traders FieldMA instance.',
            ],
            //Digital Paints FieldMA instance
            [
                'name' => 'Digital Paints FieldMA',
                'slug' => 'digitalpaints-fieldma',
                'app_url' => 'digitalpaints.fieldma.com',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'fieldma_digitalpaints',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Digital Paints FieldMA instance.',
            ],

            //euro FieldMA instance
            [
                'name' => 'Euro Fieldma',
                'slug' => 'euro-fieldma',
                'app_url' => 'https://europaints.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'europaints_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Euro FieldMA instance.',
            ],
            //JNC FieldMA instance
            [
                'name' => 'FieldMA JNC',
                'slug' => 'fieldma-jnc',
                'app_url' => 'https://jncglobal.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'fieldma_jnc',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'FieldMA JNC instance.',
            ],
            //Glossy Paints FieldMA instance
            [
                'name' => 'Glossy Paints FieldMA',
                'slug' => 'glossypaints-fieldma',
                'app_url' => 'https://glossy.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'glossypaints_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Glossy Paints FieldMA instance.',
            ],
            //om shivam FieldMA instance
            [
                'name' => 'Omshivam FieldMA',
                'slug' => 'omshivam-fieldma',
                'app_url' => 'https://omshivam.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'omshivam_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Omshivam FieldMA instance.',
            ],
            //rajdootpaints_fieldma
            [
                'name' => 'Rajdootpaints FieldMA',
                'slug' => 'rajdootpaints-fieldma',
                'app_url' => 'https://rajdoot.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'rajdootpaints_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Rajdootpaints FieldMA instance.',
            ],
            //Reliance FieldMA instance
            [
                'name' => 'Reliance FieldMA',
                'slug' => 'reliance-fieldma',
                'app_url' => 'https://reliance.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'reliancesoa',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Reliance FieldMA instance.',
            ],
            //Tata FieldMA instance
            [
                'name' => 'Tata FieldMA',
                'slug' => 'tata-fieldma',
                'app_url' => 'https://tatapaints.fieldma.com/',
                'db_ip' => config('fieldma.default_db_host'),
                'db_port' => 3306,
                'db_database' => 'tata_fieldma',
                'db_user' => config('fieldma.default_db_user'),
                'db_password' => config('fieldma.default_db_password'),
                'is_active' => true,
                'notes' => 'Tata FieldMA instance.',
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
