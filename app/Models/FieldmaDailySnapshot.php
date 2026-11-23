<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\InstanceStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FieldmaDailySnapshot extends Model
{
    /**
     * Ordered list of all 16 tracked metric column names.
     *
     * @var list<string>
     */
    public const METRIC_COLUMNS = [
        'users_count',
        'login_users_count',
        'checked_in_users_count',
        'checked_out_users_count',
        'orders_count',
        'online_visits_count',
        'offline_visits_count',
        'unlisted_visits_count',
        'collections_count',
        'daily_reports_count',
        'expense_entries_count',
        'gps_tracked_users_count',
        'messages_users_count',
        'scheduled_visits_users_count',
        'site_registrations_count',
        'notices_count',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'fieldma_instance_id',
        'snapshot_date',
        'status',
        'latency_ms',
        'error_code',
        'error_message',
        'users_count',
        'login_users_count',
        'checked_in_users_count',
        'checked_out_users_count',
        'orders_count',
        'online_visits_count',
        'offline_visits_count',
        'unlisted_visits_count',
        'collections_count',
        'daily_reports_count',
        'expense_entries_count',
        'gps_tracked_users_count',
        'messages_users_count',
        'scheduled_visits_users_count',
        'site_registrations_count',
        'notices_count',
        'missing_tables',
        'polled_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'snapshot_date' => 'date:Y-m-d',
            'status' => InstanceStatus::class,
            'latency_ms' => 'integer',
            'users_count' => 'integer',
            'login_users_count' => 'integer',
            'checked_in_users_count' => 'integer',
            'checked_out_users_count' => 'integer',
            'orders_count' => 'integer',
            'online_visits_count' => 'integer',
            'offline_visits_count' => 'integer',
            'unlisted_visits_count' => 'integer',
            'collections_count' => 'integer',
            'daily_reports_count' => 'integer',
            'expense_entries_count' => 'integer',
            'gps_tracked_users_count' => 'integer',
            'messages_users_count' => 'integer',
            'scheduled_visits_users_count' => 'integer',
            'site_registrations_count' => 'integer',
            'notices_count' => 'integer',
            'missing_tables' => 'array',
            'polled_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<FieldmaInstance, $this>
     */
    public function instance(): BelongsTo
    {
        return $this->belongsTo(FieldmaInstance::class, 'fieldma_instance_id');
    }

    /**
     * @return array<string, int|null>
     */
    public function metricsArray(): array
    {
        $metrics = [];

        foreach (self::METRIC_COLUMNS as $column) {
            $value = $this->getAttribute($column);
            $metrics[$column] = $value !== null ? (int) $value : null;
        }

        return $metrics;
    }

    /**
     * @return array<string, null>
     */
    public static function emptyMetrics(): array
    {
        return array_fill_keys(self::METRIC_COLUMNS, null);
    }
}
