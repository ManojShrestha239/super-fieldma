<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fieldma_daily_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('fieldma_instance_id')
                ->constrained('fieldma_instances')
                ->cascadeOnDelete();
            $table->date('snapshot_date');
            $table->string('status', 16);
            $table->unsignedInteger('latency_ms')->nullable();
            $table->string('error_code', 64)->nullable();
            $table->string('error_message', 255)->nullable();

            // 16 Live Metrics (NULL = missing table / N/A)
            $table->unsignedInteger('users_count')->nullable();
            $table->unsignedInteger('login_users_count')->nullable();
            $table->unsignedInteger('checked_in_users_count')->nullable();
            $table->unsignedInteger('checked_out_users_count')->nullable();
            $table->unsignedInteger('orders_count')->nullable();
            $table->unsignedInteger('online_visits_count')->nullable();
            $table->unsignedInteger('offline_visits_count')->nullable();
            $table->unsignedInteger('unlisted_visits_count')->nullable();
            $table->unsignedInteger('collections_count')->nullable();
            $table->unsignedInteger('daily_reports_count')->nullable();
            $table->unsignedInteger('expense_entries_count')->nullable();
            $table->unsignedInteger('gps_tracked_users_count')->nullable();
            $table->unsignedInteger('messages_users_count')->nullable();
            $table->unsignedInteger('scheduled_visits_users_count')->nullable();
            $table->unsignedInteger('site_registrations_count')->nullable();
            $table->unsignedInteger('notices_count')->nullable();

            $table->json('missing_tables')->nullable();
            $table->timestamp('polled_at');
            $table->timestamps();

            $table->unique(['fieldma_instance_id', 'snapshot_date'], 'uq_instance_snapshot_date');
            $table->index(['snapshot_date', 'status'], 'idx_snapshot_date_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fieldma_daily_snapshots');
    }
};
