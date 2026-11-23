<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Data\CollectedMetrics;
use App\Enums\InstanceStatus;
use App\Events\FieldmaMetricsUpdated;
use App\Jobs\PollFieldmaInstanceJob;
use App\Models\FieldmaDailySnapshot;
use App\Models\FieldmaInstance;
use App\Models\User;
use App\Services\MetricsCollector;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class ReverbBroadcastAndDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_poll_job_broadcasts_reverb_event_on_private_channel_without_credentials(): void
    {
        Event::fake([FieldmaMetricsUpdated::class]);

        $instance = FieldmaInstance::factory()->create([
            'db_ip' => '10.99.88.77',
            'db_user' => 'secret_ro_user',
            'db_password' => 'ultra-secret-password-xyz',
        ]);

        $metrics = [
            'users_count' => 120,
            'login_users_count' => 98,
            'checked_in_users_count' => 84,
            'checked_out_users_count' => 12,
            'orders_count' => 45,
            'online_visits_count' => 130,
            'offline_visits_count' => 15,
            'unlisted_visits_count' => 4,
            'collections_count' => 22,
            'daily_reports_count' => 19,
            'expense_entries_count' => 31,
            'gps_tracked_users_count' => 80,
            'messages_users_count' => 28,
            'scheduled_visits_users_count' => 75,
            'site_registrations_count' => 6,
            'notices_count' => 2,
        ];

        $mockCollector = Mockery::mock(MetricsCollector::class);
        $mockCollector->shouldReceive('collectForInstance')
            ->once()
            ->andReturn(new CollectedMetrics(
                status: InstanceStatus::Online,
                latencyMs: 118,
                errorCode: null,
                errorMessage: null,
                metrics: $metrics,
                missingTables: [],
            ));

        (new PollFieldmaInstanceJob($instance->id, '2026-11-23'))->handle($mockCollector);

        Event::assertDispatched(FieldmaMetricsUpdated::class, function (FieldmaMetricsUpdated $event) use ($instance, $metrics): bool {
            $channels = $event->broadcastOn();
            $this->assertCount(1, $channels);
            $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
            $this->assertSame('private-fieldma.dashboard', $channels[0]->name);
            $this->assertSame('metrics.updated', $event->broadcastAs());

            $payload = $event->broadcastWith();
            $this->assertSame($instance->id, $payload['instance_id']);
            $this->assertSame('2026-11-23', $payload['snapshot_date']);
            $this->assertSame('online', $payload['status']);
            $this->assertSame(118, $payload['latency_ms']);
            $this->assertSame($metrics, $payload['metrics']);

            // Zero credentials in broadcast payload
            $serialized = json_encode($payload, JSON_THROW_ON_ERROR);
            $this->assertStringNotContainsString('ultra-secret-password-xyz', $serialized);
            $this->assertStringNotContainsString('secret_ro_user', $serialized);
            $this->assertStringNotContainsString('10.99.88.77', $serialized);
            $this->assertArrayNotHasKey('db_password', $payload);
            $this->assertArrayNotHasKey('db_ip', $payload);

            return true;
        });
    }

    public function test_dashboard_isolates_historical_snapshots_by_date_and_never_leaks_password(): void
    {
        $admin = User::factory()->admin()->create();
        $instance = FieldmaInstance::factory()->create([
            'name' => 'Alpha Pharma',
            'db_password' => 'do-not-expose-me',
        ]);

        $today = now()->toDateString();
        $yesterday = now()->subDay()->toDateString();

        FieldmaDailySnapshot::query()->create([
            'fieldma_instance_id' => $instance->id,
            'snapshot_date' => $today,
            'status' => InstanceStatus::Online,
            'latency_ms' => 95,
            'users_count' => 250,
            'orders_count' => 60,
            'missing_tables' => [],
            'polled_at' => now(),
        ]);

        FieldmaDailySnapshot::query()->create([
            'fieldma_instance_id' => $instance->id,
            'snapshot_date' => $yesterday,
            'status' => InstanceStatus::Degraded,
            'latency_ms' => 1820,
            'users_count' => 240,
            'orders_count' => 42,
            'missing_tables' => ['site_registration_v2_s'],
            'polled_at' => now()->subDay(),
        ]);

        // Default (today) response
        $todayResponse = $this->actingAs($admin)->get('/');
        $todayResponse
            ->assertOk()
            ->assertInertia(fn (Assert $page): Assert => $page
                ->component('Dashboard')
                ->where('selectedDate', $today)
                ->has('rows', 1)
                ->where('rows.0.status', 'online')
                ->where('rows.0.metrics.orders_count', 60)
                ->missing('rows.0.db_password')
            );
        $this->assertStringNotContainsString('do-not-expose-me', $todayResponse->getContent() ?: '');

        // Historical (yesterday) response
        $historicalResponse = $this->actingAs($admin)->get("/?date={$yesterday}");
        $historicalResponse
            ->assertOk()
            ->assertInertia(fn (Assert $page): Assert => $page
                ->component('Dashboard')
                ->where('selectedDate', $yesterday)
                ->has('rows', 1)
                ->where('rows.0.status', 'degraded')
                ->where('rows.0.metrics.orders_count', 42)
                ->where('rows.0.missing_tables', ['site_registration_v2_s'])
                ->missing('rows.0.db_password')
            );
        $this->assertStringNotContainsString('do-not-expose-me', $historicalResponse->getContent() ?: '');
    }
}
