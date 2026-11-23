<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\FieldmaInstance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FieldmaInstance
 */
class FieldmaInstanceResource extends JsonResource
{
    /**
     * Explicitly serialize safe registry fields; db_password is never exposed.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'app_url' => $this->app_url,
            'db_ip' => $this->db_ip,
            'db_port' => $this->db_port,
            'db_database' => $this->db_database,
            'db_user' => $this->db_user,
            'is_active' => $this->is_active,
            'notes' => $this->notes,
            'last_tested_at' => $this->last_tested_at?->toIso8601String(),
            'last_test_ok' => $this->last_test_ok,
            'last_latency_ms' => $this->last_latency_ms,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
