<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\FieldmaDailySnapshot;
use App\Models\FieldmaInstance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FieldmaInstance
 */
class DashboardRowResource extends JsonResource
{
    /**
     * Serialize an instance with its selected-date snapshot; db_password is never exposed.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var FieldmaDailySnapshot|null $snapshot */
        $snapshot = $this->relationLoaded('snapshots')
            ? $this->snapshots->first()
            : null;

        return [
            'instance_id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'app_url' => $this->app_url,
            'db_ip' => $this->db_ip,
            'db_port' => $this->db_port,
            'db_database' => $this->db_database,
            'db_user' => $this->db_user,
            'is_active' => $this->is_active,
            'notes' => $this->notes,
            'status' => $snapshot?->status->value,
            'latency_ms' => $snapshot?->latency_ms,
            'polled_at' => $snapshot?->polled_at?->toIso8601String(),
            'error_code' => $snapshot?->error_code,
            'error_message' => $snapshot?->error_message,
            'missing_tables' => $snapshot?->missing_tables ?? [],
            'metrics' => $snapshot !== null
                ? $snapshot->metricsArray()
                : FieldmaDailySnapshot::emptyMetrics(),
        ];
    }
}
