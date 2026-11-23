<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\InstanceStatus;
use App\Events\FieldmaMetricsUpdated;
use App\Models\FieldmaDailySnapshot;
use App\Models\FieldmaInstance;
use App\Services\MetricsCollector;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class PollFieldmaInstanceJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 15;

    public int $maxExceptions = 1;

    public function __construct(
        public readonly int $instanceId,
        public readonly ?string $snapshotDate = null,
    ) {
        $this->onQueue('polling');
    }

    public function handle(MetricsCollector $collector): void
    {
        $instance = FieldmaInstance::query()->find($this->instanceId);

        if ($instance === null) {
            return;
        }

        $date = $this->snapshotDate ?? now()->toDateString();
        $collected = $collector->collectForInstance($instance, $date);
        $polledAt = now();

        $snapshot = FieldmaDailySnapshot::query()->updateOrCreate(
            [
                'fieldma_instance_id' => $instance->id,
                'snapshot_date' => $date,
            ],
            [
                'status' => $collected->status,
                'latency_ms' => $collected->latencyMs,
                'error_code' => $collected->errorCode,
                'error_message' => $collected->errorMessage,
                ...$collected->metrics,
                'missing_tables' => $collected->missingTables,
                'polled_at' => $polledAt,
            ],
        );

        $instance->forceFill([
            'last_tested_at' => $polledAt,
            'last_test_ok' => $collected->status !== InstanceStatus::Offline,
            'last_latency_ms' => $collected->latencyMs,
        ])->save();

        FieldmaMetricsUpdated::dispatch($snapshot);
    }
}
