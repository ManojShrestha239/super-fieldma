<?php

declare(strict_types=1);

namespace App\Services;

use App\Data\CollectedMetrics;
use App\Data\RemoteDbCredentials;
use App\Enums\InstanceStatus;
use App\Models\FieldmaDailySnapshot;
use App\Models\FieldmaInstance;
use Carbon\CarbonImmutable;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Throwable;

class MetricsCollector
{
    public const DEGRADED_LATENCY_MS = 1500;

    public const MAX_EXECUTION_TIME_MS = 5000;

    public function __construct(
        private readonly RemoteDatabaseConnector $connector,
        private readonly RemoteSchemaInspector $schemaInspector,
    ) {}

    /**
     * Collect all 16 metrics for a FieldMA instance on a given date in a single SQL round-trip.
     */
    public function collectForInstance(FieldmaInstance $instance, string $snapshotDate): CollectedMetrics
    {
        $dayStart = CarbonImmutable::parse($snapshotDate)->startOfDay()->format('Y-m-d H:i:s');
        $dayEnd = CarbonImmutable::parse($snapshotDate)->addDay()->startOfDay()->format('Y-m-d H:i:s');
        $startedAt = hrtime(true);

        try {
            return $this->connector->run(
                RemoteDbCredentials::fromInstance($instance),
                function (ConnectionInterface $connection) use ($instance, $dayStart, $dayEnd, $startedAt): CollectedMetrics {
                    $tables = $this->schemaInspector->getCachedTables($instance->id, $connection);

                    try {
                        $result = $this->executeSingleQuery($connection, $tables, $dayStart, $dayEnd);
                    } catch (QueryException $queryException) {
                        if (! $this->isMissingTableException($queryException)) {
                            throw $queryException;
                        }

                        // Cached SHOW TABLES is stale; refresh once and retry.
                        $tables = $this->schemaInspector->getCachedTables($instance->id, $connection, forceRefresh: true);
                        $result = $this->executeSingleQuery($connection, $tables, $dayStart, $dayEnd);
                    }

                    $latencyMs = (int) round((hrtime(true) - $startedAt) / 1_000_000);
                    $status = $this->classifyStatus($latencyMs, $result['missing_tables']);

                    return new CollectedMetrics(
                        status: $status,
                        latencyMs: $latencyMs,
                        errorCode: null,
                        errorMessage: null,
                        metrics: $result['metrics'],
                        missingTables: $result['missing_tables'],
                    );
                },
            );
        } catch (Throwable $exception) {
            $latencyMs = (int) round((hrtime(true) - $startedAt) / 1_000_000);
            $classified = $this->connector->classifyException($exception);

            return new CollectedMetrics(
                status: InstanceStatus::Offline,
                latencyMs: $latencyMs,
                errorCode: $classified['code'],
                errorMessage: $classified['message'],
                metrics: FieldmaDailySnapshot::emptyMetrics(),
                missingTables: [],
            );
        }
    }

    /**
     * Classify instance health based on latency threshold and missing tables.
     *
     * @param  list<string>  $missingTables
     */
    public function classifyStatus(int $latencyMs, array $missingTables): InstanceStatus
    {
        if ($latencyMs >= self::DEGRADED_LATENCY_MS || count($missingTables) > 0) {
            return InstanceStatus::Degraded;
        }

        return InstanceStatus::Online;
    }

    /**
     * Compile the single-round-trip SQL query for all 16 metrics based on discovered tables.
     * Uses positional `?` bindings so native MySQL prepared statements (ATTR_EMULATE_PREPARES=false)
     * never fail on repeated named parameters.
     *
     * @param  array<string, true>  $existingTables
     * @return array{sql: string, bindings: list<string>, missing_tables: list<string>}
     */
    public function compileQuery(
        array $existingTables,
        string $dayStart,
        string $dayEnd,
        bool $includeExecutionHint = true,
    ): array {
        $expressions = [];
        $bindings = [];
        $has = static fn (string $table): bool => isset($existingTables[$table]);

        // 1. No. of Users (mobileusers)
        if ($has('mobileusers')) {
            $expressions[] = '(SELECT COUNT(*) FROM mobileusers) AS users_count';
        } else {
            $expressions[] = 'NULL AS users_count';
        }

        // 2. Login Users Count (device_logs distinct mobileuser_id, fallback to mobileusers.fcm_id)
        if ($has('device_logs')) {
            $expressions[] = '(SELECT COUNT(DISTINCT mobileuser_id) FROM device_logs WHERE created_at >= ? AND created_at < ?) AS login_users_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } elseif ($has('mobileusers')) {
            $expressions[] = "(SELECT COUNT(*) FROM mobileusers WHERE fcm_id IS NOT NULL AND fcm_id <> '') AS login_users_count";
        } else {
            $expressions[] = 'NULL AS login_users_count';
        }

        // 3. Checked-In Users (attendance_statuses, distinct mobileuser_id, status = 'checkin')
        if ($has('attendance_statuses')) {
            $expressions[] = "(SELECT COUNT(DISTINCT mobileuser_id) FROM attendance_statuses WHERE status = 'checkin' AND created_at >= ? AND created_at < ?) AS checked_in_users_count";
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS checked_in_users_count';
        }

        // 4. Checked-Out Users (attendance_statuses, distinct mobileuser_id, status = 'checkout')
        if ($has('attendance_statuses')) {
            $expressions[] = "(SELECT COUNT(DISTINCT mobileuser_id) FROM attendance_statuses WHERE status = 'checkout' AND created_at >= ? AND created_at < ?) AS checked_out_users_count";
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS checked_out_users_count';
        }

        // 5. Total Orders (orders)
        if ($has('orders')) {
            $expressions[] = '(SELECT COUNT(*) FROM orders WHERE created_at >= ? AND created_at < ?) AS orders_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS orders_count';
        }

        // 6. Total Online Visits (visits, LOWER(status) = 'online')
        if ($has('visits')) {
            $expressions[] = "(SELECT COUNT(*) FROM visits WHERE LOWER(status) = 'online' AND created_at >= ? AND created_at < ?) AS online_visits_count";
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS online_visits_count';
        }

        // 7. Total Offline Visits (visits, LOWER(status) = 'offline')
        if ($has('visits')) {
            $expressions[] = "(SELECT COUNT(*) FROM visits WHERE LOWER(status) = 'offline' AND created_at >= ? AND created_at < ?) AS offline_visits_count";
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS offline_visits_count';
        }

        // 8. Total Unlisted Visits (visits, LOWER(status) = 'unlisted')
        if ($has('visits')) {
            $expressions[] = "(SELECT COUNT(*) FROM visits WHERE LOWER(status) = 'unlisted' AND created_at >= ? AND created_at < ?) AS unlisted_visits_count";
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS unlisted_visits_count';
        }

        // 9. Total Collections (payments)
        if ($has('payments')) {
            $expressions[] = '(SELECT COUNT(*) FROM payments WHERE created_at >= ? AND created_at < ?) AS collections_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS collections_count';
        }

        // 10. Total Daily Reports (tada_entries, deleted_at IS NULL)
        if ($has('tada_entries')) {
            $expressions[] = '(SELECT COUNT(*) FROM tada_entries WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?) AS daily_reports_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS daily_reports_count';
        }

        // 11. Total Expense Entries (tada_dealer_expenses + tada_other_expenses)
        $hasDealer = $has('tada_dealer_expenses');
        $hasOther = $has('tada_other_expenses');
        if ($hasDealer && $hasOther) {
            $expressions[] = '(COALESCE((SELECT COUNT(*) FROM tada_dealer_expenses WHERE created_at >= ? AND created_at < ?), 0) + COALESCE((SELECT COUNT(*) FROM tada_other_expenses WHERE created_at >= ? AND created_at < ?), 0)) AS expense_entries_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } elseif ($hasDealer) {
            $expressions[] = '(SELECT COUNT(*) FROM tada_dealer_expenses WHERE created_at >= ? AND created_at < ?) AS expense_entries_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } elseif ($hasOther) {
            $expressions[] = '(SELECT COUNT(*) FROM tada_other_expenses WHERE created_at >= ? AND created_at < ?) AS expense_entries_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS expense_entries_count';
        }

        // 12. Total GPS Tracked — 1 per user (locations, distinct user_id)
        if ($has('locations')) {
            $expressions[] = '(SELECT COUNT(DISTINCT user_id) FROM locations WHERE created_at >= ? AND created_at < ?) AS gps_tracked_users_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS gps_tracked_users_count';
        }

        // 13. Total Messages — 1 per user (messages, distinct `from`)
        if ($has('messages')) {
            $expressions[] = '(SELECT COUNT(DISTINCT `from`) FROM messages WHERE created_at >= ? AND created_at < ?) AS messages_users_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS messages_users_count';
        }

        // 14. Total Scheduled Visits — 1 per user (schedulevisits, distinct user_id)
        if ($has('schedulevisits')) {
            $expressions[] = '(SELECT COUNT(DISTINCT user_id) FROM schedulevisits WHERE created_at >= ? AND created_at < ?) AS scheduled_visits_users_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS scheduled_visits_users_count';
        }

        // 15. Total Site Registrations (v2_site_registrations or legacy site_registration_v2_s)
        if ($has('v2_site_registrations')) {
            $expressions[] = '(SELECT COUNT(*) FROM v2_site_registrations WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?) AS site_registrations_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } elseif ($has('site_registration_v2_s')) {
            $expressions[] = '(SELECT COUNT(*) FROM site_registration_v2_s WHERE created_at >= ? AND created_at < ?) AS site_registrations_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS site_registrations_count';
        }

        // 16. Total Notices (notices)
        if ($has('notices')) {
            $expressions[] = '(SELECT COUNT(*) FROM notices WHERE created_at >= ? AND created_at < ?) AS notices_count';
            $bindings[] = $dayStart;
            $bindings[] = $dayEnd;
        } else {
            $expressions[] = 'NULL AS notices_count';
        }

        $hint = $includeExecutionHint
            ? sprintf('/*+ MAX_EXECUTION_TIME(%d) */ ', self::MAX_EXECUTION_TIME_MS)
            : '';

        return [
            'sql' => 'SELECT '.$hint.implode(', ', $expressions),
            'bindings' => $bindings,
            'missing_tables' => $this->schemaInspector->findMissingTables($existingTables),
        ];
    }

    /**
     * @param  array<string, true>  $existingTables
     * @return array{metrics: array<string, int|null>, missing_tables: list<string>}
     */
    private function executeSingleQuery(
        ConnectionInterface $connection,
        array $existingTables,
        string $dayStart,
        string $dayEnd,
    ): array {
        $compiled = $this->compileQuery($existingTables, $dayStart, $dayEnd);
        $row = (array) $connection->selectOne($compiled['sql'], $compiled['bindings']);

        $metrics = [];
        foreach (FieldmaDailySnapshot::METRIC_COLUMNS as $column) {
            $metrics[$column] = isset($row[$column]) && $row[$column] !== null
                ? (int) $row[$column]
                : null;
        }

        return [
            'metrics' => $metrics,
            'missing_tables' => $compiled['missing_tables'],
        ];
    }

    private function isMissingTableException(QueryException $exception): bool
    {
        $sqlState = $exception->errorInfo[0] ?? null;
        $driverCode = isset($exception->errorInfo[1]) ? (int) $exception->errorInfo[1] : null;

        return $sqlState === '42S02' || $driverCode === 1146;
    }
}
