<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\FieldmaDailySnapshot;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class FieldmaMetricsUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @var array<string, mixed>
     */
    private readonly array $payload;

    public function __construct(FieldmaDailySnapshot $snapshot)
    {
        $this->payload = [
            'instance_id' => $snapshot->fieldma_instance_id,
            'snapshot_date' => $snapshot->snapshot_date->format('Y-m-d'),
            'status' => $snapshot->status->value,
            'latency_ms' => $snapshot->latency_ms,
            'polled_at' => $snapshot->polled_at->toIso8601String(),
            'error_code' => $snapshot->error_code,
            'error_message' => $snapshot->error_message,
            'missing_tables' => $snapshot->missing_tables ?? [],
            'metrics' => $snapshot->metricsArray(),
        ];
    }

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('fieldma.dashboard'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'metrics.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
