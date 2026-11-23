<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\Cache;

class RemoteSchemaInspector
{
    /**
     * Hardcoded allowlist of all FieldMA tables backing the 16 metrics.
     *
     * @var list<string>
     */
    public const REQUIRED_TABLES = [
        'mobileusers',
        'device_logs',
        'attendance_statuses',
        'orders',
        'visits',
        'payments',
        'tada_entries',
        'tada_dealer_expenses',
        'tada_other_expenses',
        'locations',
        'messages',
        'schedulevisits',
        'site_registration_v2_s',
        'notices',
    ];

    public const CACHE_TTL_HOURS = 6;

    public function cacheKey(int $instanceId): string
    {
        return "fieldma:tables:{$instanceId}";
    }

    /**
     * Inspect an active remote connection via SHOW TABLES.
     *
     * @return array{tables: array<string, true>, table_count: int, missing_tables: list<string>}
     */
    public function inspectConnection(ConnectionInterface $connection): array
    {
        $rows = $connection->select('SHOW TABLES');
        $tables = [];

        foreach ($rows as $row) {
            $values = array_values((array) $row);
            if (isset($values[0]) && is_string($values[0]) && $values[0] !== '') {
                $tables[strtolower($values[0])] = true;
            }
        }

        return [
            'tables' => $tables,
            'table_count' => count($tables),
            'missing_tables' => $this->findMissingTables($tables),
        ];
    }

    /**
     * Retrieve cached table lookup map for an instance, populating from remote DB on miss.
     *
     * @return array<string, true>
     */
    public function getCachedTables(int $instanceId, ConnectionInterface $connection, bool $forceRefresh = false): array
    {
        $key = $this->cacheKey($instanceId);

        if ($forceRefresh) {
            Cache::forget($key);
        }

        /** @var array<string, true> $tables */
        $tables = Cache::remember(
            $key,
            now()->addHours(self::CACHE_TTL_HOURS),
            fn (): array => $this->inspectConnection($connection)['tables'],
        );

        return $tables;
    }

    /**
     * @param  array<string, true>  $tables
     */
    public function storeCachedTables(int $instanceId, array $tables): void
    {
        Cache::put(
            $this->cacheKey($instanceId),
            $tables,
            now()->addHours(self::CACHE_TTL_HOURS),
        );
    }

    public function forgetCache(int $instanceId): void
    {
        Cache::forget($this->cacheKey($instanceId));
    }

    /**
     * @param  array<string, true>  $existingTables
     * @return list<string>
     */
    public function findMissingTables(array $existingTables): array
    {
        $missing = [];

        foreach (self::REQUIRED_TABLES as $table) {
            if ($table === 'site_registration_v2_s') {
                if (! isset($existingTables['v2_site_registrations']) && ! isset($existingTables['site_registration_v2_s'])) {
                    $missing[] = 'v2_site_registrations';
                }

                continue;
            }

            if (! isset($existingTables[$table])) {
                $missing[] = $table;
            }
        }

        return $missing;
    }
}
