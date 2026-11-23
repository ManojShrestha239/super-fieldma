<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Data\RemoteDbCredentials;
use App\Enums\InstanceStatus;
use App\Http\Resources\DashboardRowResource;
use App\Http\Resources\FieldmaInstanceResource;
use App\Models\FieldmaDailySnapshot;
use App\Models\FieldmaInstance;
use App\Services\MetricsCollector;
use App\Services\RemoteDatabaseConnector;
use App\Services\RemoteSchemaInspector;
use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery;
use PDOException;
use Tests\TestCase;

class SecurityAndHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_classify_status_enforces_degraded_latency_threshold_and_missing_tables(): void
    {
        $collector = app(MetricsCollector::class);

        $this->assertSame(InstanceStatus::Online, $collector->classifyStatus(1499, []));
        $this->assertSame(InstanceStatus::Degraded, $collector->classifyStatus(1500, []));
        $this->assertSame(InstanceStatus::Degraded, $collector->classifyStatus(120, ['site_registration_v2_s']));
    }

    public function test_collector_refreshes_stale_schema_cache_once_on_42s02_missing_table_error(): void
    {
        $instance = FieldmaInstance::factory()->create();

        $staleTables = array_fill_keys(RemoteSchemaInspector::REQUIRED_TABLES, true);
        $freshTables = array_fill_keys(
            array_values(array_diff(RemoteSchemaInspector::REQUIRED_TABLES, ['site_registration_v2_s'])),
            true,
        );

        $mockConn = Mockery::mock(ConnectionInterface::class);
        $pdoMissing = new PDOException("SQLSTATE[42S02]: Base table or view not found: 1146 Table 'demo.site_registration_v2_s' doesn't exist");
        $pdoMissing->errorInfo = ['42S02', 1146, "Table 'demo.site_registration_v2_s' doesn't exist"];

        $mockConn->shouldReceive('selectOne')
            ->once()
            ->andThrow(new QueryException('fieldma_probe', 'SELECT ...', [], $pdoMissing));

        $mockConn->shouldReceive('selectOne')
            ->once()
            ->andReturn((object) [
                'users_count' => 10,
                'login_users_count' => 5,
                'checked_in_users_count' => 4,
                'checked_out_users_count' => 1,
                'orders_count' => 3,
                'online_visits_count' => 2,
                'offline_visits_count' => 1,
                'unlisted_visits_count' => 0,
                'collections_count' => 2,
                'daily_reports_count' => 1,
                'expense_entries_count' => 2,
                'gps_tracked_users_count' => 4,
                'messages_users_count' => 2,
                'scheduled_visits_users_count' => 3,
                'site_registrations_count' => null,
                'notices_count' => 1,
            ]);

        $mockSchema = Mockery::mock(RemoteSchemaInspector::class)->makePartial();
        $mockSchema->shouldReceive('getCachedTables')
            ->once()
            ->with($instance->id, $mockConn)
            ->andReturn($staleTables);
        $mockSchema->shouldReceive('getCachedTables')
            ->once()
            ->with($instance->id, $mockConn, true)
            ->andReturn($freshTables);

        $mockConnector = Mockery::mock(RemoteDatabaseConnector::class)->makePartial();
        $mockConnector->shouldReceive('run')
            ->once()
            ->andReturnUsing(fn (RemoteDbCredentials $creds, Closure $callback) => $callback($mockConn));

        $collector = new MetricsCollector($mockConnector, $mockSchema);
        $result = $collector->collectForInstance($instance, '2026-11-23');

        $this->assertSame(InstanceStatus::Degraded, $result->status);
        $this->assertSame(['v2_site_registrations'], $result->missingTables);
        $this->assertNull($result->metrics['site_registrations_count']);
        $this->assertSame(10, $result->metrics['users_count']);
    }

    public function test_empty_remote_database_returns_degraded_with_all_null_metrics_without_crashing(): void
    {
        $instance = FieldmaInstance::factory()->create();

        config(['database.connections.empty_sqlite_test' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]]);
        $emptyConn = DB::connection('empty_sqlite_test');

        $mockSchema = Mockery::mock(RemoteSchemaInspector::class)->makePartial();
        $mockSchema->shouldReceive('getCachedTables')->once()->andReturn([]);

        $mockConnector = Mockery::mock(RemoteDatabaseConnector::class)->makePartial();
        $mockConnector->shouldReceive('run')
            ->once()
            ->andReturnUsing(fn (RemoteDbCredentials $creds, Closure $callback) => $callback($emptyConn));

        $collector = new MetricsCollector($mockConnector, $mockSchema);
        $result = $collector->collectForInstance($instance, '2026-11-23');

        $this->assertSame(InstanceStatus::Degraded, $result->status);
        $this->assertNull($result->errorCode);
        $this->assertCount(count(RemoteSchemaInspector::REQUIRED_TABLES), $result->missingTables);
        $this->assertSame(FieldmaDailySnapshot::emptyMetrics(), $result->metrics);

        DB::purge('empty_sqlite_test');
    }

    public function test_error_classifier_maps_all_operational_mysql_error_codes_safely(): void
    {
        $connector = app(RemoteDatabaseConnector::class);

        $cases = [
            [1045, "Access denied for user 'secret_user'@'10.1.2.3'", 'AUTH_FAILED'],
            [1049, "Unknown database 'secret_db'", 'UNKNOWN_DB'],
            [2002, 'Connection timed out', 'CONN_TIMEOUT'],
            [2002, 'Connection refused', 'HOST_UNREACHABLE'],
            [1142, "SELECT command denied to user 'secret_user'", 'PERMISSION_DENIED'],
            [1054, "Unknown column 'user_id' in 'field list'", 'SCHEMA_COLUMN_ERROR'],
            [9999, 'Unexpected internal failure with secret_user', 'QUERY_ERROR'],
        ];

        foreach ($cases as [$code, $rawMessage, $expectedCode]) {
            $e = new PDOException($rawMessage);
            $e->errorInfo = ['HY000', $code, $rawMessage];

            $classified = $connector->classifyException($e);
            $this->assertSame($expectedCode, $classified['code']);
            $this->assertStringNotContainsString('secret_user', $classified['message']);
            $this->assertStringNotContainsString('10.1.2.3', $classified['message']);
        }
    }

    public function test_all_resources_strictly_exclude_db_password(): void
    {
        $instance = FieldmaInstance::factory()->create([
            'db_password' => 'never-leak-this-secret-42',
        ]);
        $instance->setRelation('snapshots', collect());

        $instancePayload = json_encode((new FieldmaInstanceResource($instance))->resolve(), JSON_THROW_ON_ERROR);
        $rowPayload = json_encode((new DashboardRowResource($instance))->resolve(), JSON_THROW_ON_ERROR);

        $this->assertStringNotContainsString('never-leak-this-secret-42', $instancePayload);
        $this->assertStringNotContainsString('db_password', $instancePayload);
        $this->assertStringNotContainsString('never-leak-this-secret-42', $rowPayload);
        $this->assertStringNotContainsString('db_password', $rowPayload);
    }
}
