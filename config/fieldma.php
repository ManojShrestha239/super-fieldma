<?php

declare(strict_types=1);

return [
    'default_app_url' => env('FIELDMA_DEFAULT_APP_URL', 'https://fieldma.com'),
    'default_db_host' => env('FIELDMA_DEFAULT_DB_HOST', 'mock-remote-db'),
    'default_db_port' => (int) env('FIELDMA_DEFAULT_DB_PORT', 3306),
    'default_db_user' => env('FIELDMA_DEFAULT_DB_USERNAME', 'fieldma_ro'),
    'default_db_password' => env('FIELDMA_DEFAULT_DB_PASSWORD', 'readonly_secret'),
];
