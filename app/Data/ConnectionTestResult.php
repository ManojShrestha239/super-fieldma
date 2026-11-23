<?php

declare(strict_types=1);

namespace App\Data;

readonly class ConnectionTestResult
{
    /**
     * @param  list<string>  $missingTables
     */
    public function __construct(
        public bool $ok,
        public ?int $latencyMs,
        public ?string $mysqlVersion,
        public int $tablesFound,
        public array $missingTables,
        public ?string $errorCode,
        public ?string $errorMessage,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'ok' => $this->ok,
            'latency_ms' => $this->latencyMs,
            'mysql_version' => $this->mysqlVersion,
            'tables_found' => $this->tablesFound,
            'missing_tables' => $this->missingTables,
            'error_code' => $this->errorCode,
            'error_message' => $this->errorMessage,
        ];
    }
}
