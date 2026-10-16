<?php

use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\Inventory;
use App\Models\TraceabilityLot;
use App\Models\User;
use App\UserRole;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\Hash;

test('demo seeder fills a walkthrough and can run twice', function () {
    $this->seed(DemoSeeder::class);
    $this->seed(DemoSeeder::class);

    expect(User::query()->where('email', 'operations@surefarm.io')->count())->toBe(1)
        ->and(User::query()->where('email', 'verifier@surefarm.io')->count())->toBe(1)
        ->and(User::query()->where('email', 'juan.delacruz@surefarm.io')->count())->toBe(1)
        ->and(Farmer::query()->count())->toBe(6)
        ->and(Farm::query()->count())->toBe(7);

    $farmer = User::query()->where('email', 'juan.delacruz@surefarm.io')->first();
    $verifier = User::query()->where('email', 'verifier@surefarm.io')->first();

    expect($farmer)->not->toBeNull()
        ->and($farmer->role)->toBe(UserRole::Farmer)
        ->and(Hash::check('password!', $farmer->password))->toBeTrue()
        ->and($farmer->farmer?->farmer_id)->toBe('SF-999-000-000-001')
        ->and($verifier->role)->toBe(UserRole::FieldVerifier);

    $farm = Farm::query()->where('farm_id', 'FARM-900001')->first();
    $open = Farm::query()->where('farm_id', 'FARM-900005')->first();

    expect($farm)->not->toBeNull()
        ->and($farm->verification_status)->toBe(FarmVerificationStatus::Verified)
        ->and($farm->boundary)->not->toBeNull()
        ->and($farm->harvests)->toHaveCount(2)
        ->and($farm->insurances)->toHaveCount(1)
        ->and($open->verification_status)->toBe(FarmVerificationStatus::InProgress)
        ->and($open->assigned_verifier_id)->toBe($verifier->id);

    $lot = TraceabilityLot::query()->where('lot_code', 'SF-DEMO-000001')->first();
    $green = Inventory::query()
        ->where('harvest_id', $lot?->harvest_id)
        ->whereHas('stage', fn ($query) => $query->where('code', 'GREEN_BEANS'))
        ->first();

    expect($lot)->not->toBeNull()
        ->and((float) $lot->quantity)->toBe(40.0)
        ->and($lot->events)->not->toBeEmpty()
        ->and($green)->not->toBeNull()
        ->and((float) $green->quantity)->toBe(86.0)
        ->and(TraceabilityLot::query()->count())->toBe(1)
        ->and(Inventory::query()->count())->toBe(4);
});

test('a production database seed does not create demo accounts', function () {
    $this->app->detectEnvironment(fn (): string => 'production');

    $this->app->make(DatabaseSeeder::class)->run();

    expect(User::query()->where('email', 'juan.delacruz@surefarm.io')->exists())->toBeFalse()
        ->and(User::query()->where('email', 'operations@surefarm.io')->exists())->toBeFalse()
        ->and(User::query()->where('email', 'test@example.com')->exists())->toBeFalse()
        ->and(User::query()->where('email', 'admin@surefarm.io')->exists())->toBeTrue();
});
