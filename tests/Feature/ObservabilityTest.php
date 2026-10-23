<?php

use App\Models\User;
use App\Services\ErrorTracker;
use App\UserRole;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

test('the liveness endpoint reports up without dependency details', function () {
    $response = $this->getJson('/up');

    $response->assertOk();
    expect($response->json())
        ->toBe(['status' => 'up'])
        ->and($response->headers->get('X-Request-Id'))->toMatch('/^[A-Za-z0-9_-]{8,64}$/');
});

test('readiness reports database storage and queue without secrets', function () {
    $ready = $this->getJson('/ready', ['X-Request-Id' => 'ready-req-1'])
        ->assertOk()
        ->assertHeader('X-Request-Id', 'ready-req-1')
        ->assertExactJson([
            'status' => 'ok',
            'checks' => [
                'database' => 'ok',
                'storage' => 'ok',
                'queue' => 'ok',
            ],
        ]);

    expect($ready->headers->get('Cache-Control'))->toContain('no-store');

    $response = $this->getJson('/ready', ['X-Request-Id' => '../etc/passwd']);

    expect($response->headers->get('X-Request-Id'))
        ->not->toBe('../etc/passwd')
        ->toMatch('/^[A-Za-z0-9_-]{8,64}$/');
});

test('liveness stays up when the database used by readiness is unavailable', function () {
    $path = observabilityLog();
    $original = config('database.default');

    config([
        'database.default' => 'readiness-broken',
        'database.connections.readiness-broken' => [
            'driver' => 'sqlite',
            'database' => 'C:/no/such/surefarm-readiness.sqlite',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ],
    ]);
    DB::purge('readiness-broken');

    try {
        $ready = $this->getJson('/ready');
        $ready->assertStatus(503)
            ->assertJsonPath('checks.database', 'failed')
            ->assertJsonPath('checks.queue', 'ok')
            ->assertJsonPath('status', 'unavailable');

        expect($ready->getContent())
            ->not->toContain('readiness-broken')
            ->not->toContain('sqlite')
            ->not->toContain('SQLSTATE')
            ->not->toContain('C:/no/such');

        $this->getJson('/up')
            ->assertOk()
            ->assertJsonPath('status', 'up');

        $log = (string) file_get_contents($path);

        expect($log)
            ->toContain('Readiness check failed')
            ->not->toContain('C:/no/such')
            ->not->toContain('surefarm-readiness.sqlite');
    } finally {
        config(['database.default' => $original]);
        DB::purge('readiness-broken');

        if (file_exists($path)) {
            unlink($path);
        }
    }
});

test('readiness reports a missing queue table without its name', function () {
    $path = observabilityLog();

    config([
        'queue.default' => 'database',
        'queue.connections.database.connection' => 'readiness-queue',
        'queue.connections.database.table' => 'jobs_missing_for_readiness',
        'database.connections.readiness-queue' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ],
    ]);

    $ready = $this->getJson('/ready');

    $ready->assertStatus(503)
        ->assertJsonPath('checks.database', 'ok')
        ->assertJsonPath('checks.queue', 'failed');

    expect($ready->getContent())->not->toContain('jobs_missing_for_readiness');
    expect((string) file_get_contents($path))->not->toContain('jobs_missing_for_readiness');

    unlink($path);
});

test('readiness reports unavailable storage without the path', function () {
    $path = observabilityLog();

    config(['filesystems.disks.local.root' => 'C:/no/such/surefarm-storage']);
    Storage::forgetDisk('local');

    $ready = $this->getJson('/ready');

    $ready->assertStatus(503)->assertJsonPath('checks.storage', 'failed');

    expect($ready->getContent())->not->toContain('surefarm-storage');
    expect((string) file_get_contents($path))->not->toContain('surefarm-storage');

    unlink($path);
});

test('application logs keep the request id and omit secrets', function () {
    $path = observabilityLog();
    Context::add('request_id', 'corr-ready1');

    $exception = new class('plain failure') extends RuntimeException
    {
        /**
         * @return array<string, mixed>
         */
        public function context(): array
        {
            return [
                'password' => 'super-secret-password',
                'government_id' => 'GOV-SECRET-8844',
                'nested' => ['account_number' => '0011223344'],
            ];
        }
    };

    report($exception);
    report($exception);

    Log::info('farmer update', [
        'password' => 'super-secret-password',
        'farmer_id' => 'SF-100',
    ]);

    $contents = (string) file_get_contents($path);

    expect(substr_count($contents, '.ERROR: plain failure'))->toBe(1)
        ->and($contents)->toContain('corr-ready1')
        ->and($contents)->toContain('SF-100')
        ->and($contents)->toContain('[redacted]')
        ->and($contents)->not->toContain('super-secret-password')
        ->and($contents)->not->toContain('GOV-SECRET-8844')
        ->and($contents)->not->toContain('0011223344');

    unlink($path);
});

test('the log driver does not claim an external tracker is connected', function () {
    $path = observabilityLog();
    config(['observability.error_tracking.driver' => 'log']);

    app(ErrorTracker::class)->capture(new RuntimeException('password=hunter2'));

    expect(file_exists($path))->toBeFalse();
});

test('an unconfigured tracker is recorded once without the exception text', function () {
    $path = observabilityLog();
    config(['observability.error_tracking.driver' => 'unconfigured']);
    app()->forgetInstance(ErrorTracker::class);

    $tracker = app(ErrorTracker::class);
    $tracker->capture(new RuntimeException('SQLSTATE password=hunter2 at /secret/path'));
    $tracker->capture(new RuntimeException('SQLSTATE password=hunter2 at /secret/path'));

    $contents = (string) file_get_contents($path);

    expect(substr_count($contents, 'not connected'))->toBe(1)
        ->and($contents)->toContain('RuntimeException')
        ->and($contents)->not->toContain('hunter2')
        ->and($contents)->not->toContain('/secret/path');

    unlink($path);
});

test('a failed farmer registration does not keep identity or bank fields in the session', function () {
    $this->actingAs(User::factory()->create(['role' => UserRole::Operations]))
        ->from(route('farmers.create'))
        ->post(route('farmers.store'), [
            'first_name' => '',
            'government_id' => 'GOV-SECRET-8844',
            'has_bank_account' => '1',
            'bank_name' => 'Secret Bank',
            'account_number' => '0011223344',
            'account_name' => 'Secret Holder',
            'password' => 'should-not-flash',
        ])
        ->assertSessionHasErrors('first_name');

    $encoded = (string) json_encode(session()->getOldInput());

    expect($encoded)
        ->not->toContain('GOV-SECRET-8844')
        ->not->toContain('0011223344')
        ->not->toContain('Secret Bank')
        ->not->toContain('Secret Holder')
        ->not->toContain('should-not-flash');
});

function observabilityLog(): string
{
    $path = storage_path('logs/observability-test.log');

    if (file_exists($path)) {
        unlink($path);
    }

    config([
        'logging.default' => 'single',
        'logging.channels.single.path' => $path,
        'logging.channels.single.level' => 'debug',
    ]);

    Log::forgetChannel('single');
    Log::forgetChannel('stack');

    return $path;
}
