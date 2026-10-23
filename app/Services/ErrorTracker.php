<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Throwable;

class ErrorTracker
{
    /**
     * Drivers already reported as unconnected during this process.
     *
     * @var array<string, true>
     */
    private array $unconnected = [];

    public function capture(Throwable $exception): void
    {
        $driver = config('observability.error_tracking.driver');
        $driver = is_string($driver) ? $driver : 'log';

        if ($driver === '' || $driver === 'log') {
            return;
        }

        if (isset($this->unconnected[$driver])) {
            return;
        }

        $this->unconnected[$driver] = true;

        Log::warning('Configured error tracker is not connected. The exception remains in the application log.', [
            'tracker' => $driver,
            'exception_class' => $exception::class,
        ]);
    }
}
