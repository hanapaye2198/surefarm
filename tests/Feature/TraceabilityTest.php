<?php

use App\Actions\ProcessCoffeeInventory;
use App\Actions\ReceiveHarvestIntoInventory;
use App\CropType;
use App\HarvestStatus;
use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\FarmerBankAccount;
use App\Models\FarmFinancing;
use App\Models\FarmHarvest;
use App\Models\Inventory;
use App\Models\InventoryProcessingStage;
use App\Models\TraceabilityEvent;
use App\Models\TraceabilityLot;
use App\Models\User;
use App\Services\QrCode;
use App\TraceabilityEventType;
use App\TraceabilityLotStatus;
use App\UserRole;
use Database\Seeders\InventoryProcessingStageSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(InventoryProcessingStageSeeder::class);
});

function traceabilityUser(UserRole $role = UserRole::Operations): User
{
    return User::factory()->create(['role' => $role]);
}

function traceabilityStage(string $code): InventoryProcessingStage
{
    return InventoryProcessingStage::query()->where('code', $code)->firstOrFail();
}

function greenBeanInventory(float $quantity = 40): Inventory
{
    $farm = Farm::factory()->create([
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 2.84,
        'verified_area_hectares' => 2.79,
        'verification_status' => 'verified',
        'municipality' => 'Kadingilan',
        'province' => 'Bukidnon',
    ]);

    return Inventory::factory()->for($farm)->create([
        'farmer_id' => $farm->farmer_id,
        'processing_stage_id' => traceabilityStage('GREEN_BEANS')->id,
        'crop_type' => CropType::Coffee,
        'quantity' => $quantity,
        'unit' => 'kg',
        'status' => InventoryStatus::Available,
    ]);
}

test('a traceability lot uses a unique code and the source inventory balance', function () {
    $inventory = greenBeanInventory(40);
    $user = traceabilityUser();

    $this->actingAs($user)
        ->post(route('traceability.store'), [
            'inventory_id' => $inventory->id,
            'quantity' => 25,
            'unit' => 'kg',
            'notes' => 'First lot',
        ])
        ->assertRedirect();

    $lot = TraceabilityLot::query()->firstOrFail();
    $inventory->refresh();

    expect($lot->lot_code)->toBe('SF-'.now()->year.'-000001')
        ->and($lot->status)->toBe(TraceabilityLotStatus::Active)
        ->and((float) $lot->quantity)->toBe(25.0)
        ->and($lot->farmer_id)->toBe($inventory->farmer_id)
        ->and($lot->farm_id)->toBe($inventory->farm_id)
        ->and($lot->crop_type)->toBe(CropType::Coffee)
        ->and((float) $inventory->quantity)->toBe(15.0)
        ->and(TraceabilityEvent::query()->where('event_type', TraceabilityEventType::TraceabilityCreated)->exists())->toBeTrue();

    $this->actingAs($user)
        ->post(route('traceability.store'), [
            'inventory_id' => $inventory->id,
            'quantity' => 10,
            'unit' => 'kg',
        ])
        ->assertRedirect();

    expect(TraceabilityLot::query()->orderBy('lot_code')->pluck('lot_code')->all())
        ->toBe(['SF-'.now()->year.'-000001', 'SF-'.now()->year.'-000002']);
});

test('lot quantity must be positive and cannot exceed available inventory', function () {
    $inventory = greenBeanInventory(40);
    $user = traceabilityUser();

    $this->actingAs($user)
        ->post(route('traceability.store'), [
            'inventory_id' => $inventory->id,
            'quantity' => 0,
            'unit' => 'kg',
        ])
        ->assertSessionHasErrors('quantity');

    $this->actingAs($user)
        ->post(route('traceability.store'), [
            'inventory_id' => $inventory->id,
            'quantity' => 41,
            'unit' => 'kg',
        ])
        ->assertSessionHasErrors('quantity');

    expect((float) $inventory->refresh()->quantity)->toBe(40.0)
        ->and(TraceabilityLot::query()->count())->toBe(0);
});

test('a lot cannot join a farmer farm and harvest that do not belong together', function () {
    $inventory = greenBeanInventory();
    $other = Farmer::factory()->create();
    $inventory->update(['farmer_id' => $other->id]);

    $this->actingAs(traceabilityUser())
        ->post(route('traceability.store'), [
            'inventory_id' => $inventory->id,
            'quantity' => 10,
            'unit' => 'kg',
        ])
        ->assertSessionHasErrors('inventory_id');

    expect((float) $inventory->refresh()->quantity)->toBe(40.0);
});

test('processing history is read from inventory movements', function () {
    $farm = Farm::factory()->create([
        'crop_type' => CropType::Coffee,
        'verification_status' => 'verified',
        'verified_area_hectares' => 2.79,
        'declared_area_hectares' => 2.84,
    ]);
    $harvest = FarmHarvest::factory()->for($farm)->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
        'harvest_date' => '2026-10-07',
    ]);
    $user = traceabilityUser();
    $cherry = app(ReceiveHarvestIntoInventory::class)->handle($harvest, [
        'quantity' => 80,
        'unit' => 'kg',
        'processing_stage_id' => traceabilityStage('COFFEE_CHERRY')->id,
        'location' => 'Farm Storage',
        'received_date' => '2026-10-07',
    ], $user->id);
    $dried = app(ProcessCoffeeInventory::class)->handle([
        'inventory_id' => $cherry->id,
        'input_quantity' => 50,
        'output_quantity' => 40,
        'destination_stage_id' => traceabilityStage('DRIED_COFFEE')->id,
        'processing_date' => '2026-10-08',
    ], $user->id);
    $parchment = app(ProcessCoffeeInventory::class)->handle([
        'inventory_id' => $dried->id,
        'input_quantity' => 40,
        'output_quantity' => 30,
        'destination_stage_id' => traceabilityStage('PARCHMENT')->id,
        'processing_date' => '2026-10-09',
    ], $user->id);
    $green = app(ProcessCoffeeInventory::class)->handle([
        'inventory_id' => $parchment->id,
        'input_quantity' => 30,
        'output_quantity' => 20,
        'destination_stage_id' => traceabilityStage('GREEN_BEANS')->id,
        'processing_date' => '2026-10-10',
    ], $user->id);

    $this->actingAs($user)
        ->post(route('traceability.store'), [
            'inventory_id' => $green->id,
            'quantity' => 10,
            'unit' => 'kg',
        ])
        ->assertRedirect();

    $lot = TraceabilityLot::query()->firstOrFail();
    $harvest->refresh();

    expect((float) $harvest->quantity)->toBe(100.0)
        ->and((float) $green->refresh()->quantity)->toBe(10.0)
        ->and(Inventory::query()->find($green->id)->movements()->where('movement_type', InventoryMovementType::Release)->exists())->toBeTrue();

    $this->actingAs($user)
        ->get(route('traceability.show', $lot))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('traceability/show')
            ->where('lot.lot_code', $lot->lot_code)
            ->where('journey.0.input_label', '50 kg')
            ->where('journey.0.output_label', '40 kg')
            ->where('journey.2.to_stage', 'Green Beans')
            ->where('lot.farm.verification_status', 'verified')
            ->where('lot.farm.verified_area', '2.79 ha')
            ->where('public_url', route('trace.public', ['lot_code' => $lot->lot_code]))
            ->where('qr_svg', app(QrCode::class)->svg(route('trace.public', ['lot_code' => $lot->lot_code])))
        );
});

test('a failed lot creation rolls back the inventory balance', function () {
    $inventory = greenBeanInventory(40);
    TraceabilityEvent::creating(function (): void {
        throw new RuntimeException('Stop the lot.');
    });

    try {
        expect(fn () => $this->withoutExceptionHandling()->actingAs(traceabilityUser())->post(route('traceability.store'), [
            'inventory_id' => $inventory->id,
            'quantity' => 10,
            'unit' => 'kg',
        ]))->toThrow(RuntimeException::class);
    } finally {
        TraceabilityEvent::flushEventListeners();
    }

    expect((float) $inventory->refresh()->quantity)->toBe(40.0)
        ->and(TraceabilityLot::query()->count())->toBe(0);
});

test('the public page hides private farmer information and rejects unknown codes', function () {
    $inventory = greenBeanInventory(40);
    $inventory->farmer->update([
        'first_name' => 'Zenaida',
        'last_name' => 'Traceholder',
        'mobile_number' => '09170001111',
        'email' => 'private-trace@example.test',
        'government_id' => 'GOV-TRACE-999',
    ]);
    FarmerBankAccount::factory()->for($inventory->farmer)->create([
        'account_number' => '9988776655',
    ]);
    FarmFinancing::factory()->for($inventory->farm)->create([
        'amount' => 65001,
        'loan_balance' => 11111,
    ]);
    $user = traceabilityUser();
    $this->actingAs($user)->post(route('traceability.store'), [
        'inventory_id' => $inventory->id,
        'quantity' => 10,
        'unit' => 'kg',
        'notes' => 'Private lot note XYZ',
    ]);
    $lot = TraceabilityLot::query()->firstOrFail();

    $this->get(route('trace.public', ['lot_code' => $lot->lot_code]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('traceability/public')
            ->where('record.lot_code', $lot->lot_code)
            ->where('record.municipality', 'Kadingilan')
            ->where('record.verification_status', 'verified')
            ->missing('record.notes')
        )
        ->assertDontSee('09170001111')
        ->assertDontSee('private-trace@example.test')
        ->assertDontSee('GOV-TRACE-999')
        ->assertDontSee('9988776655')
        ->assertDontSee('Zenaida')
        ->assertDontSee('Private lot note XYZ')
        ->assertDontSee('65001')
        ->assertDontSee('11111');

    $this->get('/trace/SF-2026-999999')
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('traceability/public')
            ->where('record', null)
        );
});

test('qr format information matches error correction level L and mask 0', function () {
    expect(app(QrCode::class)->formatBits(0))->toBe(0b111011111000100);

    $modules = app(QrCode::class)->modules('http://surefarm.test/trace/SF-2026-000001');

    expect($modules[0][0])->toBeTrue()
        ->and($modules[0][6])->toBeTrue()
        ->and($modules[1][1])->toBeFalse();
});

test('farm farmer and dashboard summaries count the lot', function () {
    $inventory = greenBeanInventory(40);
    $this->actingAs(traceabilityUser())->post(route('traceability.store'), [
        'inventory_id' => $inventory->id,
        'quantity' => 10,
        'unit' => 'kg',
    ]);

    $this->actingAs(traceabilityUser(UserRole::Admin))
        ->get(route('farms.show', $inventory->farm_id))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.traceability_lots.0.quantity_label', '10 kg')
            ->where('farm.traceability_lots.0.status', 'active')
        );

    $this->actingAs(traceabilityUser(UserRole::Admin))
        ->get(route('farmers.show', $inventory->farmer_id))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farmer.traceability_summary.active_lots', 1)
            ->where('farmer.traceability_summary.traced_label', '10 kg')
        );

    $this->actingAs(traceabilityUser(UserRole::Admin))
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('traceability_summary.active_lots', 1)
            ->where('traceability_summary.green_bean_lots', 1)
            ->where('traceability_summary.traced_label', '10 kg')
        );
});

test('field verifiers can view lots and cannot create them', function () {
    $inventory = greenBeanInventory();
    $lot = TraceabilityLot::factory()->create([
        'farm_id' => $inventory->farm_id,
        'farmer_id' => $inventory->farmer_id,
        'current_inventory_id' => $inventory->id,
        'crop_type' => CropType::Coffee,
    ]);

    $this->actingAs(traceabilityUser(UserRole::FieldVerifier))
        ->get(route('traceability.show', $lot))
        ->assertOk();

    $this->actingAs(traceabilityUser(UserRole::FieldVerifier))
        ->post(route('traceability.store'), [
            'inventory_id' => $inventory->id,
            'quantity' => 5,
            'unit' => 'kg',
        ])
        ->assertForbidden();

    $this->actingAs(traceabilityUser(UserRole::Farmer))
        ->get(route('traceability.index'))
        ->assertForbidden();
});

test('cherry inventory cannot start a traceability lot', function () {
    $inventory = greenBeanInventory();
    $inventory->update(['processing_stage_id' => traceabilityStage('COFFEE_CHERRY')->id]);

    $this->actingAs(traceabilityUser())
        ->post(route('traceability.store'), [
            'inventory_id' => $inventory->id,
            'quantity' => 5,
            'unit' => 'kg',
        ])
        ->assertSessionHasErrors('inventory_id');
});
