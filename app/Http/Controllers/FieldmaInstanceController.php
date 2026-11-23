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

        if (! isset($validated['db_password']) || $validated['db_password'] === '') {
            unset($validated['db_password']);
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
                dbIp: (string) ($validated['db_ip'] ?? $instance->db_ip),
                dbPort: (int) ($validated['db_port'] ?? $instance->db_port),
                dbDatabase: (string) ($validated['db_database'] ?? $instance->db_database),
                dbUser: (string) ($validated['db_user'] ?? $instance->db_user),
                dbPassword: $dbPassword,
                instanceId: $instance->id,
            );
        } else {
            $credentials = new RemoteDbCredentials(
                dbIp: (string) $validated['db_ip'],
                dbPort: (int) $validated['db_port'],
                dbDatabase: (string) $validated['db_database'],
                dbUser: (string) $validated['db_user'],
                dbPassword: (string) $validated['db_password'],
                instanceId: null,
            );
        }

        $result = $this->connector->testConnection($credentials);

        if ($instance !== null && $request->keys() === []) {
            $instance->forceFill([
                'last_tested_at' => now(),
                'last_test_ok' => $result->ok,
                'last_latency_ms' => $result->latencyMs,
            ])->save();
        } elseif ($instance !== null) {
            $unchangedConnection = ($credentials->dbIp === $instance->db_ip)
                && ($credentials->dbPort === $instance->db_port)
                && ($credentials->dbDatabase === $instance->db_database)
                && ($credentials->dbUser === $instance->db_user)
                && (! isset($validated['db_password']) || $validated['db_password'] === '');

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
}
