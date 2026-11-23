<?php

declare(strict_types=1);

namespace App\Services;

use App\Data\ConnectionTestResult;
use App\Data\RemoteDbCredentials;
use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PDO;
use Pdo\Mysql;
use PDOException;
use Throwable;

class RemoteDatabaseConnector
{
    public const CONNECT_TIMEOUT_SECONDS = 3;

    public function __construct(
        private readonly RemoteSchemaInspector $schemaInspector,
    ) {}

    /**
     * Execute a read-only callback against an ephemeral runtime MySQL connection.
     * Always purges the connection and unsets runtime config in finally.
     *
     * @template T
     *
     * @param  Closure(ConnectionInterface): T  $callback
     * @return T
     */
    public function run(RemoteDbCredentials $credentials, Closure $callback): mixed
    {
        $suffix = $credentials->instanceId !== null ? (string) $credentials->instanceId : 'draft';
        $connectionName = sprintf('fieldma_probe_%s_%s', $suffix, bin2hex(random_bytes(6)));

        config(["database.connections.{$connectionName}" => $this->buildConfig($credentials)]);

        try {
            $connection = DB::connection($connectionName);

            return $callback($connection);
        } finally {
            DB::purge($connectionName);

            /** @var array<string, mixed> $connections */
            $connections = config('database.connections', []);
            unset($connections[$connectionName]);
            config(['database.connections' => $connections]);
        }
    }

    /**
     * Test connectivity, read MySQL version, inspect tables, and measure latency.
     */
    public function testConnection(RemoteDbCredentials $credentials): ConnectionTestResult
    {
        $startedAt = hrtime(true);

        try {
            return $this->run($credentials, function (ConnectionInterface $connection) use ($credentials, $startedAt): ConnectionTestResult {
                $versionRow = $connection->selectOne('SELECT VERSION() AS version');
                $mysqlVersion = is_object($versionRow) && isset($versionRow->version) && is_string($versionRow->version)
                    ? $versionRow->version
                    : null;

                $inspection = $this->schemaInspector->inspectConnection($connection);

                if ($credentials->instanceId !== null) {
                    $this->schemaInspector->storeCachedTables($credentials->instanceId, $inspection['tables']);
                }

                $latencyMs = (int) round((hrtime(true) - $startedAt) / 1_000_000);

                return new ConnectionTestResult(
                    ok: true,
                    latencyMs: $latencyMs,
                    mysqlVersion: $mysqlVersion,
                    tablesFound: $inspection['table_count'],
                    missingTables: $inspection['missing_tables'],
                    errorCode: null,
                    errorMessage: null,
                );
            });
        } catch (Throwable $exception) {
            $latencyMs = (int) round((hrtime(true) - $startedAt) / 1_000_000);
            $classified = $this->classifyException($exception);

            return new ConnectionTestResult(
                ok: false,
                latencyMs: $latencyMs,
                mysqlVersion: null,
                tablesFound: 0,
                missingTables: [],
                errorCode: $classified['code'],
                errorMessage: $classified['message'],
            );
        }
    }

    /**
     * Sanitize database exceptions so credentials, hostnames, and SQL never leak.
     *
     * @return array{code: string, message: string}
     */
    public function classifyException(Throwable $exception): array
    {
        $previous = $exception instanceof QueryException && $exception->getPrevious() !== null
            ? $exception->getPrevious()
            : $exception;

        $rawMessage = strtolower($previous->getMessage());
        $driverCode = null;

        if ($previous instanceof PDOException && is_array($previous->errorInfo) && isset($previous->errorInfo[1])) {
            $driverCode = (int) $previous->errorInfo[1];
        }

        if ($driverCode === 1045 || str_contains($rawMessage, 'access denied')) {
            return [
                'code' => 'AUTH_FAILED',
                'message' => 'Authentication failed for the configured database user.',
            ];
        }

        if ($driverCode === 1049 || str_contains($rawMessage, 'unknown database')) {
            return [
                'code' => 'UNKNOWN_DB',
                'message' => 'Target database schema was not found on the remote server.',
            ];
        }

        if (
            $driverCode === 2002
            || str_contains($rawMessage, 'timed out')
            || str_contains($rawMessage, 'timeout')
            || str_contains($rawMessage, 'connection refused')
            || str_contains($rawMessage, 'name or service not known')
            || str_contains($rawMessage, 'nodename nor servname')
        ) {
            $isTimeout = str_contains($rawMessage, 'timed out') || str_contains($rawMessage, 'timeout');

            return [
                'code' => $isTimeout ? 'CONN_TIMEOUT' : 'HOST_UNREACHABLE',
                'message' => $isTimeout
                    ? 'Connection timed out after '.self::CONNECT_TIMEOUT_SECONDS.' seconds.'
                    : 'Remote MySQL host is unreachable or refused the connection.',
            ];
        }

        if ($driverCode === 1142 || str_contains($rawMessage, 'command denied')) {
            return [
                'code' => 'PERMISSION_DENIED',
                'message' => 'Remote user lacks SELECT privilege on one or more tables.',
            ];
        }

        if ($driverCode === 1054 || str_contains($rawMessage, 'unknown column')) {
            return [
                'code' => 'SCHEMA_COLUMN_ERROR',
                'message' => 'Remote table is missing an expected column for one of the metrics.',
            ];
        }

        return [
            'code' => 'QUERY_ERROR',
            'message' => 'Remote database probe failed due to a connection or query error.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildConfig(RemoteDbCredentials $credentials): array
    {
        $options = [
            PDO::ATTR_TIMEOUT => self::CONNECT_TIMEOUT_SECONDS,
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        if (defined('Pdo\\Mysql::ATTR_INIT_COMMAND')) {
            $options[Mysql::ATTR_INIT_COMMAND] = 'SET SESSION TRANSACTION READ ONLY';
        } elseif (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
            $options[PDO::MYSQL_ATTR_INIT_COMMAND] = 'SET SESSION TRANSACTION READ ONLY';
        }

        return [
            'driver' => 'mysql',
            'host' => $credentials->dbIp,
            'port' => $credentials->dbPort,
            'database' => $credentials->dbDatabase,
            'username' => $credentials->dbUser,
            'password' => $credentials->dbPassword,
            'unix_socket' => '',
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => false,
            'engine' => null,
            'options' => $options,
        ];
    }
}
