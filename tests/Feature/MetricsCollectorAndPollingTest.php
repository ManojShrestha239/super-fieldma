<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Data\RemoteDbCredentials;
use App\Enums\InstanceStatus;
use App\Jobs\PollFieldmaInstanceJob;
use App\Models\FieldmaDailySnapshot;
use App\Models\FieldmaInstance;
use App\Models\User;
use App\Services\MetricsCollector;
use App\Services\RemoteDatabaseConnector;
use App\Services\RemoteSchemaInspector;
use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Mockery;
use PDOException;
use Tests\TestCase;

class MetricsCollectorAndPollingTest extends TestCase
{
    use RefreshDatabase;

    public function test_compile_query_for_full_schema_uses_single_select_and_matching_bindings(): void
    {
        $collector = app(MetricsCollector::class);
        $allTables = array_fill_keys(RemoteSchemaInspector::REQUIRED_TABLES, true);

        $compiled = $collector->compileQuery($allTables, '2026-11-23 00:00:00', '2026-11-24 00:00:00');

        $this->assertStringStartsWith('SELECT /*+ MAX_EXECUTION_TIME(5000) */ ', $compiled['sql']);
        $this->assertStringContainsString('COUNT(DISTINCT `from`) FROM messages', $compiled['sql']);
        $this->assertStringContainsString('COUNT(DISTINCT mobileuser_id) FROM device_logs WHERE created_at >= ? AND created_at < ?', $compiled['sql']);
        $this->assertStringContainsString('FROM tada_entries WHERE deleted_at IS NULL', $compiled['sql']);
        $this->assertStringContainsString("LOWER(status) = 'online'", $compiled['sql']);
        $this->assertSame([], $compiled['missing_tables']);
        $this->assertSame(substr_count($compiled['sql'], '?'), count($compiled['bindings']));
    }

    public function test_compile_query_handles_legacy_schema_fallbacks_gracefully(): void
    {
        $collector = app(MetricsCollector::class);
        $legacyTables = array_fill_keys(
            array_values(array_diff(
                RemoteSchemaInspector::REQUIRED_TABLES,
                ['device_logs', 'site_registration_v2_s', 'tada_other_expenses'],
            )),
            true,
        );

        $compiled = $collector->compileQuery($legacyTables, '2026-11-23 00:00:00', '2026-11-24 00:00:00');

        $this->assertStringContainsString("fcm_id IS NOT NULL AND fcm_id <> ''", $compiled['sql']);
        $this->assertStringContainsString('NULL AS site_registrations_count', $compiled['sql']);
        $this->assertStringContainsString('FROM tada_dealer_expenses WHERE created_at >= ? AND created_at < ?) AS expense_entries_count', $compiled['sql']);
        $this->assertStringNotContainsString('tada_other_expenses', $compiled['sql']);
        $this->assertSame(
            ['device_logs', 'tada_other_expenses', 'v2_site_registrations'],
            $compiled['missing_tables'],
        );
        $this->assertSame(substr_count($compiled['sql'], '?'), count($compiled['bindings']));
    }

    public function test_compile_query_returns_null_for_expenses_only_when_both_expense_tables_missing(): void
    {
        $collector = app(MetricsCollector::class);
        $tables = array_fill_keys(
            array_values(array_diff(
                RemoteSchemaInspector::REQUIRED_TABLES,
                ['tada_dealer_expenses', 'tada_other_expenses'],
            )),
            true,
        );

        $compiled = $collector->compileQuery($tables, '2026-11-23 00:00:00', '2026-11-24 00:00:00');

        $this->assertStringContainsString('NULL AS expense_entries_count', $compiled['sql']);
    }

    public function test_poll_job_executes_single_query_and_upserts_all_16_metrics(): void
    {
        $instance = FieldmaInstance::factory()->create();
        $date = '2026-11-23';

        $remoteConn = $this->createSeededRemoteSqliteConnection(includeLegacyMissingTables: true);
        $allTables = array_fill_keys(RemoteSchemaInspector::REQUIRED_TABLES, true);

        $mockSchema = Mockery::mock(RemoteSchemaInspector::class)->makePartial();
        $mockSchema->shouldReceive('getCachedTables')->andReturn($allTables);

        $mockConnector = Mockery::mock(RemoteDatabaseConnector::class)->makePartial();
        $mockConnector->shouldReceive('run')
            ->twice()
            ->andReturnUsing(fn (RemoteDbCredentials $creds, Closure $callback) => $callback($remoteConn));

        $collector = new MetricsCollector($mockConnector, $mockSchema);

        $job = new PollFieldmaInstanceJob($instance->id, $date);
        $job->handle($collector);

        $snapshot = FieldmaDailySnapshot::query()
            ->where('fieldma_instance_id', $instance->id)
            ->whereDate('snapshot_date', $date)
            ->firstOrFail();

        $this->assertSame(InstanceStatus::Online, $snapshot->status);
        $this->assertNull($snapshot->error_code);
        $this->assertSame([], $snapshot->missing_tables);
        $this->assertSame([
            'users_count' => 4,
            'login_users_count' => 3,
            'checked_in_users_count' => 2,
            'checked_out_users_count' => 1,
            'orders_count' => 3,
            'online_visits_count' => 2,
            'offline_visits_count' => 1,
            'unlisted_visits_count' => 1,
            'collections_count' => 2,
            'daily_reports_count' => 2,
            'expense_entries_count' => 3,
            'gps_tracked_users_count' => 2,
            'messages_users_count' => 2,
            'scheduled_visits_users_count' => 3,
            'site_registrations_count' => 2,
            'notices_count' => 1,
        ], $snapshot->metricsArray());

        // Second poll for same date upserts without creating duplicate row
        $job->handle($collector);
        $this->assertSame(1, FieldmaDailySnapshot::query()->where('fieldma_instance_id', $instance->id)->count());

        DB::purge('remote_sqlite_test');
    }

    public function test_poll_job_marks_legacy_clone_degraded_with_null_missing_metrics(): void
    {
        $instance = FieldmaInstance::factory()->create();
        $date = '2026-11-23';

        $remoteConn = $this->createSeededRemoteSqliteConnection(includeLegacyMissingTables: false);
        $legacyTables = array_fill_keys(
            array_values(array_diff(
                RemoteSchemaInspector::REQUIRED_TABLES,
                ['device_logs', 'site_registration_v2_s', 'tada_other_expenses'],
            )),
            true,
        );

        $mockSchema = Mockery::mock(RemoteSchemaInspector::class)->makePartial();
        $mockSchema->shouldReceive('getCachedTables')->andReturn($legacyTables);

        $mockConnector = Mockery::mock(RemoteDatabaseConnector::class)->makePartial();
        $mockConnector->shouldReceive('run')
            ->once()
            ->andReturnUsing(fn (RemoteDbCredentials $creds, Closure $callback) => $callback($remoteConn));

        $collector = new MetricsCollector($mockConnector, $mockSchema);
        (new PollFieldmaInstanceJob($instance->id, $date))->handle($collector);

        $snapshot = FieldmaDailySnapshot::query()->where('fieldma_instance_id', $instance->id)->firstOrFail();

        $this->assertSame(InstanceStatus::Degraded, $snapshot->status);
        $this->assertNull($snapshot->site_registrations_count);
        $this->assertSame(3, $snapshot->login_users_count); // fallback to mobileusers.fcm_id IS NOT NULL
        $this->assertSame(2, $snapshot->expense_entries_count); // tada_dealer_expenses only
        $this->assertSame(
            ['device_logs', 'tada_other_expenses', 'v2_site_registrations'],
            $snapshot->missing_tables,
        );

        DB::purge('remote_sqlite_test');
    }

    public function test_poll_job_records_offline_snapshot_on_connection_timeout(): void
    {
        $instance = FieldmaInstance::factory()->create();
        $date = '2026-11-23';

        $mockConnector = Mockery::mock(RemoteDatabaseConnector::class)->makePartial();
        $mockConnector->shouldReceive('run')
            ->once()
            ->andThrow(new PDOException('SQLSTATE[HY000] [2002] Connection timed out'));

        $collector = new MetricsCollector($mockConnector, app(RemoteSchemaInspector::class));
        (new PollFieldmaInstanceJob($instance->id, $date))->handle($collector);

        $snapshot = FieldmaDailySnapshot::query()->where('fieldma_instance_id', $instance->id)->firstOrFail();
        $instance->refresh();

        $this->assertSame(InstanceStatus::Offline, $snapshot->status);
        $this->assertSame('CONN_TIMEOUT', $snapshot->error_code);
        $this->assertNull($snapshot->users_count);
        $this->assertFalse($instance->last_test_ok);
    }

    public function test_artisan_poll_command_dispatches_only_active_instances_to_polling_queue(): void
    {
        Queue::fake();

        $activeA = FieldmaInstance::factory()->create(['is_active' => true]);
        $activeB = FieldmaInstance::factory()->create(['is_active' => true]);
        FieldmaInstance::factory()->inactive()->create();

        $this->artisan('fieldma:poll --date=2026-11-23')->assertExitCode(0);

        Queue::assertPushed(PollFieldmaInstanceJob::class, 2);
        Queue::assertPushedOn('polling', PollFieldmaInstanceJob::class);
        Queue::assertPushed(PollFieldmaInstanceJob::class, fn (PollFieldmaInstanceJob $job): bool => $job->instanceId === $activeA->id && $job->snapshotDate === '2026-11-23');
        Queue::assertPushed(PollFieldmaInstanceJob::class, fn (PollFieldmaInstanceJob $job): bool => $job->instanceId === $activeB->id && $job->snapshotDate === '2026-11-23');
    }

    public function test_manual_poll_endpoints_require_admin_role_and_dispatch_jobs(): void
    {
        Queue::fake();

        $admin = User::factory()->admin()->create();
        $viewer = User::factory()->create();
        $instance = FieldmaInstance::factory()->create(['is_active' => true]);

        $this->actingAs($viewer)->postJson("/instances/{$instance->id}/poll")->assertForbidden();
        $this->actingAs($viewer)->postJson('/dashboard/poll-all')->assertForbidden();

        $this->actingAs($admin)
            ->postJson("/instances/{$instance->id}/poll", ['date' => '2026-11-23'])
            ->assertOk()
            ->assertJson(['queued' => true, 'instance_id' => $instance->id, 'snapshot_date' => '2026-11-23']);

        $this->actingAs($admin)
            ->postJson('/dashboard/poll-all', ['date' => '2026-11-23'])
            ->assertOk()
            ->assertJson(['queued' => true, 'dispatched_count' => 1, 'snapshot_date' => '2026-11-23']);

        Queue::assertPushed(PollFieldmaInstanceJob::class, 2);
        Queue::assertPushedOn('polling', PollFieldmaInstanceJob::class);
    }

    private function createSeededRemoteSqliteConnection(bool $includeLegacyMissingTables): ConnectionInterface
    {
        config(['database.connections.remote_sqlite_test' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]]);

        $conn = DB::connection('remote_sqlite_test');
        $ts = '2026-11-23 10:15:00';
        $yesterday = '2026-11-22 23:55:00';

        $conn->statement('CREATE TABLE mobileusers (id INTEGER PRIMARY KEY, name TEXT, fcm_id TEXT NULL, created_at TEXT)');
        $conn->statement('CREATE TABLE attendance_statuses (id INTEGER PRIMARY KEY, mobileuser_id INTEGER, status TEXT, created_at TEXT)');
        $conn->statement('CREATE TABLE orders (id INTEGER PRIMARY KEY, created_at TEXT)');
        $conn->statement('CREATE TABLE visits (id INTEGER PRIMARY KEY, status TEXT, created_at TEXT)');
        $conn->statement('CREATE TABLE payments (id INTEGER PRIMARY KEY, created_at TEXT)');
        $conn->statement('CREATE TABLE tada_entries (id INTEGER PRIMARY KEY, deleted_at TEXT NULL, created_at TEXT)');
        $conn->statement('CREATE TABLE tada_dealer_expenses (id INTEGER PRIMARY KEY, created_at TEXT)');
        $conn->statement('CREATE TABLE locations (id INTEGER PRIMARY KEY, user_id INTEGER, created_at TEXT)');
        $conn->statement('CREATE TABLE messages (id INTEGER PRIMARY KEY, `from` INTEGER, created_at TEXT)');
        $conn->statement('CREATE TABLE schedulevisits (id INTEGER PRIMARY KEY, user_id INTEGER, created_at TEXT)');
        $conn->statement('CREATE TABLE notices (id INTEGER PRIMARY KEY, created_at TEXT)');

        if ($includeLegacyMissingTables) {
            $conn->statement('CREATE TABLE device_logs (id INTEGER PRIMARY KEY, mobileuser_id INTEGER, created_at TEXT)');
            $conn->statement('CREATE TABLE tada_other_expenses (id INTEGER PRIMARY KEY, created_at TEXT)');
            $conn->statement('CREATE TABLE site_registration_v2_s (id INTEGER PRIMARY KEY, created_at TEXT)');

            $conn->insert("INSERT INTO device_logs (mobileuser_id, created_at) VALUES (1, '{$ts}'), (2, '{$ts}'), (2, '{$ts}'), (4, '{$ts}'), (9, '{$yesterday}')");
            $conn->insert("INSERT INTO tada_other_expenses (created_at) VALUES ('{$ts}'), ('{$yesterday}')");
            $conn->insert("INSERT INTO site_registration_v2_s (created_at) VALUES ('{$ts}'), ('{$ts}'), ('{$yesterday}')");
        }

        $conn->insert("INSERT INTO mobileusers (name, fcm_id, created_at) VALUES ('U1', 'f1', '{$ts}'), ('U2', 'f2', '{$ts}'), ('U3', NULL, '{$ts}'), ('U4', 'f4', '{$yesterday}')");
        $conn->insert("INSERT INTO attendance_statuses (mobileuser_id, status, created_at) VALUES (1, 'checkin', '{$ts}'), (1, 'checkin', '{$ts}'), (2, 'checkin', '{$ts}'), (1, 'checkout', '{$ts}'), (3, 'checkin', '{$yesterday}')");
        $conn->insert("INSERT INTO orders (created_at) VALUES ('{$ts}'), ('{$ts}'), ('{$ts}'), ('{$yesterday}')");
        $conn->insert("INSERT INTO visits (status, created_at) VALUES ('online', '{$ts}'), ('Online', '{$ts}'), ('offline', '{$ts}'), ('UNLISTED', '{$ts}'), ('online', '{$yesterday}')");
        $conn->insert("INSERT INTO payments (created_at) VALUES ('{$ts}'), ('{$ts}'), ('{$yesterday}')");
        $conn->insert("INSERT INTO tada_entries (deleted_at, created_at) VALUES (NULL, '{$ts}'), (NULL, '{$ts}'), ('{$ts}', '{$ts}'), (NULL, '{$yesterday}')");
        $conn->insert("INSERT INTO tada_dealer_expenses (created_at) VALUES ('{$ts}'), ('{$ts}'), ('{$yesterday}')");
        $conn->insert("INSERT INTO locations (user_id, created_at) VALUES (1, '{$ts}'), (1, '{$ts}'), (2, '{$ts}'), (3, '{$yesterday}')");
        $conn->insert("INSERT INTO messages (`from`, created_at) VALUES (1, '{$ts}'), (1, '{$ts}'), (2, '{$ts}'), (3, '{$yesterday}')");
        $conn->insert("INSERT INTO schedulevisits (user_id, created_at) VALUES (1, '{$ts}'), (2, '{$ts}'), (4, '{$ts}'), (5, '{$yesterday}')");
        $conn->insert("INSERT INTO notices (created_at) VALUES ('{$ts}'), ('{$yesterday}')");

        return $conn;
    }
}
