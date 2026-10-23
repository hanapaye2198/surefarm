<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class ReadinessProbe
{
    /**
     * @return array{status: string, checks: array{database: string, storage: string, queue: string}}
     */
    public function report(): array
    {
        $checks = [
            'database' => $this->database(),
            'storage' => $this->storage(),
            'queue' => $this->queue(),
        ];

        return [
            'status' => in_array('failed', $checks, true) ? 'unavailable' : 'ok',
            'checks' => $checks,
        ];
    }

    private function database(): string
    {
        try {
            DB::select('select 1 as ready');

            return 'ok';
        } catch (Throwable $exception) {
            return $this->failed('database', $exception);
        }
    }

    private function storage(): string
    {
        $disk = config('filesystems.default');

        if (! is_string($disk) || $disk === '') {
            return $this->failed('storage', new RuntimeException('storage disk is not configured'));
        }

        $driver = config("filesystems.disks.{$disk}.driver");

        try {
            if ($driver === 'local') {
                $root = config("filesystems.disks.{$disk}.root");

                if (! is_string($root) || ! is_dir($root) || ! is_writable($root)) {
                    return $this->failed('storage', new RuntimeException('storage directory is not writable'));
                }

                return 'ok';
            }

            Storage::disk($disk)->exists('surefarm-readiness');

            return 'ok';
        } catch (Throwable $exception) {
            return $this->failed('storage', $exception);
        }
    }

    private function queue(): string
    {
        $connection = config('queue.default');

        if (! is_string($connection) || $connection === '') {
            return $this->failed('queue', new RuntimeException('queue connection is not configured'));
        }

        if (in_array($connection, ['sync', 'deferred', 'background', 'null'], true)) {
            return 'ok';
        }

        if ($connection !== 'database') {
            return $this->failed('queue', new RuntimeException('queue connection has no readiness probe'));
        }

        $table = config('queue.connections.database.table');

        if (! is_string($table) || preg_match('/^[A-Za-z0-9_]+$/', $table) !== 1) {
            return $this->failed('queue', new RuntimeException('queue table is not configured'));
        }

        $connection = config('queue.connections.database.connection');

        try {
            $query = is_string($connection) && $connection !== ''
                ? DB::connection($connection)->table($table)
                : DB::table($table);
            $query->limit(1)->count();

            return 'ok';
        } catch (Throwable $exception) {
            return $this->failed('queue', $exception);
        }
    }

    private function failed(string $check, Throwable $exception): string
    {
        try {
            Log::warning('Readiness check failed.', [
                'check' => $check,
                'exception_class' => $exception::class,
            ]);
        } catch (Throwable) {
            // The readiness response is still returned when logging itself fails.
        }

        return 'failed';
    }
}
