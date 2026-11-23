<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\InstanceStatus;

readonly class CollectedMetrics
{
    /**
     * @param  array<string, int|null>  $metrics
     * @param  list<string>  $missingTables
     */
    public function __construct(
        public InstanceStatus $status,
        public ?int $latencyMs,
        public ?string $errorCode,
        public ?string $errorMessage,
        public array $metrics,
        public array $missingTables,
    ) {}
}
