<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Data\RemoteDbCredentials;
use App\Http\Requests\StoreFieldmaInstanceRequest;
use App\Http\Requests\TestConnectionRequest;
use App\Http\Requests\UpdateFieldmaInstanceRequest;
use App\Models\FieldmaInstance;
use App\Services\RemoteDatabaseConnector;
use App\Services\RemoteSchemaInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FieldmaInstanceController extends Controller
{
    public function __construct(
        private readonly RemoteDatabaseConnector $connector,
        private readonly RemoteSchemaInspector $schemaInspector,
    ) {}

    public function store(StoreFieldmaInstanceRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        FieldmaInstance::query()->create($validated);

        return redirect()
            ->route('dashboard')
            ->with('success', "Instance '{$validated['name']}' added to registry.");
    }

    public function update(UpdateFieldmaInstanceRequest $request, FieldmaInstance $instance): RedirectResponse
    {
        $validated = $request->validated();

        foreach (['app_url', 'db_ip', 'db_port', 'db_user', 'db_password'] as $field) {
            if (! array_key_exists($field, $validated) || $validated[$field] === null || $validated[$field] === '') {
                unset($validated[$field]);
            }
        }

        $instance->update($validated);
        $this->schemaInspector->forgetCache($instance->id);

        return redirect()
            ->route('dashboard')
            ->with('success', "Instance '{$instance->name}' updated.");
    }

    public function destroy(Request $request, FieldmaInstance $instance): RedirectResponse
    {
        abort_unless((bool) $request->user()?->isAdmin(), 403);

        $name = $instance->name;
        $this->schemaInspector->forgetCache($instance->id);
        $instance->delete();

        return redirect()
            ->route('dashboard')
            ->with('success', "Instance '{$name}' deleted.");
    }

    public function testConnection(TestConnectionRequest $request, ?FieldmaInstance $instance = null): JsonResponse
    {
        $validated = $request->validated();

        if ($instance !== null) {
            $dbPassword = isset($validated['db_password']) && $validated['db_password'] !== ''
                ? (string) $validated['db_password']
                : (string) $instance->db_password;

            $credentials = new RemoteDbCredentials(
                dbIp: $this->nonEmptyString($validated['db_ip'] ?? null, $instance->db_ip),
                dbPort: isset($validated['db_port']) && $validated['db_port'] !== null
                    ? (int) $validated['db_port']
                    : $instance->db_port,
                dbDatabase: $this->nonEmptyString($validated['db_database'] ?? null, $instance->db_database),
                dbUser: $this->nonEmptyString($validated['db_user'] ?? null, $instance->db_user),
                dbPassword: $dbPassword,
                instanceId: $instance->id,
            );
        } else {
            $dbDatabase = isset($validated['db_database']) ? trim((string) $validated['db_database']) : '';
            if ($dbDatabase === '') {
                return response()->json([
                    'message' => 'Database Name is required before testing the connection.',
                ], 422);
            }

            $credentials = new RemoteDbCredentials(
                dbIp: $this->nonEmptyString($validated['db_ip'] ?? null, (string) config('fieldma.default_db_host')),
                dbPort: isset($validated['db_port']) && $validated['db_port'] !== null
                    ? (int) $validated['db_port']
                    : (int) config('fieldma.default_db_port'),
                dbDatabase: $dbDatabase,
                dbUser: $this->nonEmptyString($validated['db_user'] ?? null, (string) config('fieldma.default_db_user')),
                dbPassword: $this->nonEmptyString($validated['db_password'] ?? null, (string) config('fieldma.default_db_password')),
                instanceId: null,
            );
        }

        $result = $this->connector->testConnection($credentials);

        if ($instance !== null) {
            $unchangedConnection = ($credentials->dbIp === $instance->db_ip)
                && ($credentials->dbPort === $instance->db_port)
                && ($credentials->dbDatabase === $instance->db_database)
                && ($credentials->dbUser === $instance->db_user)
                && (! isset($validated['db_password']) || $validated['db_password'] === '' || $validated['db_password'] === null);

            if ($unchangedConnection) {
                $instance->forceFill([
                    'last_tested_at' => now(),
                    'last_test_ok' => $result->ok,
                    'last_latency_ms' => $result->latencyMs,
                ])->save();
            }
        }

        return response()->json($result->toArray());
    }

    private function nonEmptyString(mixed $value, string $fallback): string
    {
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }

        return $fallback;
    }
}
