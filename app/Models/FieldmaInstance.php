<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\FieldmaInstanceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FieldmaInstance extends Model
{
    /** @use HasFactory<FieldmaInstanceFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
        'app_url',
        'db_ip',
        'db_port',
        'db_database',
        'db_user',
        'db_password',
        'is_active',
        'notes',
        'last_tested_at',
        'last_test_ok',
        'last_latency_ms',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'db_password',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'db_port' => 'integer',
            'db_password' => 'encrypted',
            'is_active' => 'boolean',
            'last_tested_at' => 'datetime',
            'last_test_ok' => 'boolean',
            'last_latency_ms' => 'integer',
        ];
    }

    /**
     * @return HasMany<FieldmaDailySnapshot, $this>
     */
    public function snapshots(): HasMany
    {
        return $this->hasMany(FieldmaDailySnapshot::class, 'fieldma_instance_id');
    }
}
