<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fieldma_instances', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 120)->unique();
            $table->string('app_url', 255);
            $table->string('db_ip', 255);
            $table->unsignedSmallInteger('db_port')->default(3306);
            $table->string('db_database', 128);
            $table->string('db_user', 128);
            $table->text('db_password');
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamp('last_tested_at')->nullable();
            $table->boolean('last_test_ok')->nullable();
            $table->unsignedInteger('last_latency_ms')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'name'], 'idx_instances_active_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fieldma_instances');
    }
};
