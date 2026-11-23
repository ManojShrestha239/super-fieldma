<?php

declare(strict_types=1);

namespace App\Data;

use App\Models\FieldmaInstance;

readonly class RemoteDbCredentials
{
    public function __construct(
        public string $dbIp,
        public int $dbPort,
        public string $dbDatabase,
        public string $dbUser,
        public string $dbPassword,
        public ?int $instanceId = null,
    ) {}

    public static function fromInstance(FieldmaInstance $instance): self
    {
        return new self(
            dbIp: $instance->db_ip,
            dbPort: $instance->db_port,
            dbDatabase: $instance->db_database,
            dbUser: $instance->db_user,
            dbPassword: (string) $instance->db_password,
            instanceId: $instance->id,
        );
    }

    /**
     * Prevent accidental credential leakage in var_dump or exception traces.
     *
     * @return array<string, mixed>
     */
    public function __debugInfo(): array
    {
        return [
            'instanceId' => $this->instanceId,
            'dbIp' => $this->dbIp,
            'dbPort' => $this->dbPort,
            'dbDatabase' => $this->dbDatabase,
            'dbUser' => $this->dbUser,
            'dbPassword' => '[REDACTED]',
        ];
    }
}
