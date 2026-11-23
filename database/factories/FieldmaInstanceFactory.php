<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\FieldmaInstance;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<FieldmaInstance>
 */
class FieldmaInstanceFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(10, 999),
            'app_url' => 'https://'.Str::slug($name).'.fieldma.local',
            'db_ip' => fake()->ipv4(),
            'db_port' => 3306,
            'db_database' => 'fieldma_'.Str::slug(Str::words($name, 1, ''), '_'),
            'db_user' => 'fieldma_ro',
            'db_password' => 'readonly_secret',
            'is_active' => true,
            'notes' => null,
            'last_tested_at' => null,
            'last_test_ok' => null,
            'last_latency_ms' => null,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => [
            'is_active' => false,
        ]);
    }
}
