<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Data\ConnectionTestResult;
use App\Data\RemoteDbCredentials;
use App\Http\Resources\FieldmaInstanceResource;
use App\Models\FieldmaInstance;
use App\Models\User;
use App\Services\RemoteDatabaseConnector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery;
use PDOException;
use RuntimeException;
use Tests\TestCase;

class FieldmaInstanceCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_instance_with_encrypted_password_never_leaked(): void
    {
        $admin = User::factory()->admin()->create();
        $secretPassword = 'super-secret-ro-password-99';

        $response = $this->actingAs($admin)->post('/instances', [
            'name' => 'Alpha Pharma Nepal',
            'slug' => 'alpha-pharma-nepal',
            'app_url' => 'https://alpha.fieldma.local',
            'db_ip' => '10.0.0.12',
            'db_port' => 3306,
            'db_database' => 'fieldma_alpha',
            'db_user' => 'fieldma_ro',
            'db_password' => $secretPassword,
            'is_active' => true,
            'notes' => 'Primary pharma tenant',
        ]);

        $response->assertRedirect(route('dashboard'));

        $instance = FieldmaInstance::query()->where('slug', 'alpha-pharma-nepal')->firstOrFail();

        // Decrypted via Eloquent cast
        $this->assertSame($secretPassword, $instance->db_password);

        // Encrypted at rest in raw DB column
        $rawPassword = DB::table('fieldma_instances')->where('id', $instance->id)->value('db_password');
        $this->assertNotSame($secretPassword, $rawPassword);
        $this->assertIsString($rawPassword);

        // Never serialized in Resource or Model JSON or Inertia dashboard response
        $resourceArray = (new FieldmaInstanceResource($instance))->resolve();
        $this->assertArrayNotHasKey('db_password', $resourceArray);
        $this->assertArrayNotHasKey('db_password', $instance->toArray());

        $dashboard = $this->actingAs($admin)->get('/');
        $dashboard->assertOk();
        $this->assertStringNotContainsString($secretPassword, $dashboard->getContent() ?: '');
    }

    public function test_admin_update_preserves_password_when_blank_and_updates_when_provided(): void
    {
        $admin = User::factory()->admin()->create();
        $instance = FieldmaInstance::factory()->create([
            'db_password' => 'initial-secret',
        ]);

        // Blank password preserves existing secret
        $this->actingAs($admin)->put("/instances/{$instance->id}", [
            'name' => 'Updated Tenant Name',
            'slug' => $instance->slug,
            'app_url' => $instance->app_url,
            'db_ip' => $instance->db_ip,
            'db_port' => $instance->db_port,
            'db_database' => $instance->db_database,
            'db_user' => $instance->db_user,
            'db_password' => '',
            'is_active' => false,
            'notes' => 'Updated note',
        ])->assertRedirect(route('dashboard'));

        $instance->refresh();
        $this->assertSame('Updated Tenant Name', $instance->name);
        $this->assertFalse($instance->is_active);
        $this->assertSame('initial-secret', $instance->db_password);

        // Providing a new password rotates it
        $this->actingAs($admin)->put("/instances/{$instance->id}", [
            'name' => 'Updated Tenant Name',
            'slug' => $instance->slug,
            'app_url' => $instance->app_url,
            'db_ip' => $instance->db_ip,
            'db_port' => $instance->db_port,
            'db_database' => $instance->db_database,
            'db_user' => $instance->db_user,
            'db_password' => 'rotated-secret-2026',
            'is_active' => true,
            'notes' => null,
        ])->assertRedirect(route('dashboard'));

        $instance->refresh();
        $this->assertSame('rotated-secret-2026', $instance->db_password);
    }

    public function test_admin_can_delete_instance(): void
    {
        $admin = User::factory()->admin()->create();
        $instance = FieldmaInstance::factory()->create();

        $this->actingAs($admin)
            ->delete("/instances/{$instance->id}")
            ->assertRedirect(route('dashboard'));

        $this->assertDatabaseMissing('fieldma_instances', ['id' => $instance->id]);
    }

    public function test_viewer_cannot_create_update_delete_or_test_instances(): void
    {
        $viewer = User::factory()->create();
        $instance = FieldmaInstance::factory()->create();

        $this->actingAs($viewer)->post('/instances', [
            'name' => 'Unauthorized',
            'slug' => 'unauthorized',
            'app_url' => 'https://unauth.fieldma.local',
            'db_ip' => '10.0.0.1',
            'db_port' => 3306,
            'db_database' => 'fieldma_unauth',
            'db_user' => 'ro',
            'db_password' => 'secret',
            'is_active' => true,
        ])->assertForbidden();

        $this->actingAs($viewer)->put("/instances/{$instance->id}", [
            'name' => 'Nope',
            'slug' => $instance->slug,
            'app_url' => $instance->app_url,
            'db_ip' => $instance->db_ip,
            'db_port' => 3306,
            'db_database' => $instance->db_database,
            'db_user' => $instance->db_user,
            'is_active' => true,
        ])->assertForbidden();

        $this->actingAs($viewer)->delete("/instances/{$instance->id}")->assertForbidden();

        $this->actingAs($viewer)->postJson('/instances/test-connection', [
            'db_ip' => '10.0.0.1',
            'db_port' => 3306,
            'db_database' => 'fieldma_alpha',
            'db_user' => 'fieldma_ro',
            'db_password' => 'secret',
        ])->assertForbidden();
    }

    public function test_test_connection_endpoint_returns_result_and_updates_persisted_instance(): void
    {
        $admin = User::factory()->admin()->create();
        $instance = FieldmaInstance::factory()->create();

        $mockConnector = Mockery::mock(RemoteDatabaseConnector::class);
        $mockConnector->shouldReceive('testConnection')
            ->once()
            ->andReturn(new ConnectionTestResult(
                ok: true,
                latencyMs: 64,
                mysqlVersion: '8.4.0',
                tablesFound: 14,
                missingTables: [],
                errorCode: null,
                errorMessage: null,
            ));

        $this->app->instance(RemoteDatabaseConnector::class, $mockConnector);

        $response = $this->actingAs($admin)
            ->postJson("/instances/{$instance->id}/test-connection", []);

        $response->assertOk()
            ->assertJson([
                'ok' => true,
                'latency_ms' => 64,
                'mysql_version' => '8.4.0',
                'tables_found' => 14,
                'missing_tables' => [],
            ]);

        $instance->refresh();
        $this->assertTrue($instance->last_test_ok);
        $this->assertSame(64, $instance->last_latency_ms);
        $this->assertNotNull($instance->last_tested_at);
    }

    public function test_remote_connector_always_purges_runtime_config_even_on_exception(): void
    {
        $connector = app(RemoteDatabaseConnector::class);
        $credentials = new RemoteDbCredentials(
            dbIp: '127.0.0.1',
            dbPort: 3306,
            dbDatabase: 'fieldma_test',
            dbUser: 'fieldma_ro',
            dbPassword: 'leaked-password-check',
            instanceId: 77,
        );

        // Verify debugInfo redacts password
        $this->assertSame('[REDACTED]', $credentials->__debugInfo()['dbPassword']);

        $beforeKeys = array_keys(config('database.connections', []));

        try {
            $connector->run($credentials, function (): never {
                throw new RuntimeException('Simulated probe failure');
            });
            $this->fail('Expected RuntimeException was not thrown.');
        } catch (RuntimeException $e) {
            $this->assertSame('Simulated probe failure', $e->getMessage());
        }

        $afterKeys = array_keys(config('database.connections', []));
        $this->assertSame($beforeKeys, $afterKeys);
    }

    public function test_exception_classifier_sanitizes_pdo_errors_without_leaking_credentials(): void
    {
        $connector = app(RemoteDatabaseConnector::class);

        $authError = new PDOException("SQLSTATE[HY000] [1045] Access denied for user 'fieldma_ro'@'10.0.0.9' (using password: YES)");
        $authError->errorInfo = ['HY000', 1045, 'Access denied'];
        $classified = $connector->classifyException($authError);

        $this->assertSame('AUTH_FAILED', $classified['code']);
        $this->assertStringNotContainsString('10.0.0.9', $classified['message']);
        $this->assertStringNotContainsString('fieldma_ro', $classified['message']);

        $timeoutError = new PDOException('SQLSTATE[HY000] [2002] Connection timed out');
        $timeoutError->errorInfo = ['HY000', 2002, 'Connection timed out'];
        $classifiedTimeout = $connector->classifyException($timeoutError);

        $this->assertSame('CONN_TIMEOUT', $classifiedTimeout['code']);
    }
}
