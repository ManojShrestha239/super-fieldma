<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\PollFieldmaInstanceJob;
use App\Models\FieldmaInstance;
use Illuminate\Console\Command;

class PollFieldmaInstancesCommand extends Command
{
    protected $signature = 'fieldma:poll
        {--date= : Snapshot date (YYYY-MM-DD), defaults to today}
        {--instance= : Optional single instance ID or slug}
        {--sync : Execute synchronously instead of dispatching to the polling queue}';

    protected $description = 'Dispatch parallel metric polling jobs for active FieldMA instances';

    public function handle(): int
    {
        $rawDate = $this->option('date');
        $snapshotDate = is_string($rawDate) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawDate) === 1
            ? $rawDate
            : now()->toDateString();

        $target = $this->option('instance');
        $runSync = (bool) $this->option('sync');

        $query = FieldmaInstance::query();

        if (is_string($target) && $target !== '') {
            if (ctype_digit($target)) {
                $query->where('id', (int) $target);
            } else {
                $query->where('slug', $target);
            }
        } else {
            $query->where('is_active', true);
        }

        $instanceIds = $query->orderBy('id')->pluck('id');

        if ($instanceIds->isEmpty()) {
            $this->info('No matching FieldMA instances to poll.');

            return self::SUCCESS;
        }

        foreach ($instanceIds as $id) {
            if ($runSync) {
                PollFieldmaInstanceJob::dispatchSync((int) $id, $snapshotDate);
            } else {
                PollFieldmaInstanceJob::dispatch((int) $id, $snapshotDate);
            }
        }

        $mode = $runSync ? 'Polled synchronously' : 'Dispatched to polling queue';
        $this->info("{$mode}: {$instanceIds->count()} instance(s) for {$snapshotDate}.");

        return self::SUCCESS;
    }
}
