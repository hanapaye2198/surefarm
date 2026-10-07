<?php

use App\CropType;
use App\FinancingType;
use App\HarvestStatus;
use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\Farm;
use App\Models\FarmFinancing;
use App\Models\FarmHarvest;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\InventoryProcessingStage;
use App\Models\User;
use App\UserRole;
use Database\Seeders\InventoryProcessingStageSeeder;
use Inertia\Testing\AssertableInertia as Assert;

function inventoryOperationsUser(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

beforeEach(function () {
    $this->seed(InventoryProcessingStageSeeder::class);
});

function inventoryStage(string $code): InventoryProcessingStage
{
    return InventoryProcessingStage::query()->where('code', $code)->firstOrFail();
}

test('processing stage seeder is idempotent', function () {
    $this->seed(InventoryProcessingStageSeeder::class);

    expect(InventoryProcessingStage::query()->count())->toBe(4)
        ->and(InventoryProcessingStage::query()->pluck('code')->sort()->values()->all())
        ->toBe(['COFFEE_CHERRY', 'DRIED_COFFEE', 'GREEN_BEANS', 'PARCHMENT']);
});

test('a completed coffee harvest can be received without changing the harvest', function () {
    $farm = Farm::factory()->create([
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 2.84,
        'financing_support_amount' => 8000,
    ]);
    $harvest = FarmHarvest::factory()->for($farm)->create([
        'quantity' => 950,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    FarmFinancing::factory()->for($farm)->create([
        'amount' => 100000,
        'loan_balance' => 65000,
        'financing_type' => FinancingType::Govt,
    ]);

    $this->actingAs(inventoryOperationsUser())
        ->post(route('harvest.receive.store', $harvest), [
            'quantity' => 900,
            'unit' => 'kg',
            'processing_stage_id' => inventoryStage('COFFEE_CHERRY')->id,
            'location' => 'Farm Storage',
            'received_date' => '2026-10-07',
            'notes' => 'First receipt',
        ])
        ->assertRedirect();

    $inventory = Inventory::query()->firstOrFail();
    $harvest->refresh();
    $financing = FarmFinancing::query()->firstOrFail();

    expect($inventory->farmer_id)->toBe($farm->farmer_id)
        ->and($inventory->farm_id)->toBe($farm->id)
        ->and($inventory->harvest_id)->toBe($harvest->id)
        ->and($inventory->crop_type)->toBe(CropType::Coffee)
        ->and($inventory->status)->toBe(InventoryStatus::Available)
        ->and((float) $inventory->quantity)->toBe(900.0)
        ->and((float) $harvest->quantity)->toBe(950.0)
        ->and((float) $financing->amount)->toBe(100000.0)
        ->and(InventoryMovement::query()->where('movement_type', InventoryMovementType::Receipt)->count())->toBe(1);
});

test('inventory quantity must be greater than zero and cannot exceed the harvest', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = inventoryOperationsUser();
    $stage = inventoryStage('COFFEE_CHERRY')->id;

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), [
            'quantity' => 0,
            'unit' => 'kg',
            'processing_stage_id' => $stage,
            'received_date' => '2026-10-07',
        ])
        ->assertSessionHasErrors('quantity');

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), [
            'quantity' => 101,
            'unit' => 'kg',
            'processing_stage_id' => $stage,
            'received_date' => '2026-10-07',
        ])
        ->assertSessionHasErrors('quantity');

    expect(Inventory::query()->count())->toBe(0);
});

test('only a completed coffee harvest can be received', function () {
    $planned = FarmHarvest::factory()->create([
        'status' => HarvestStatus::Planned,
        'crop_type' => CropType::Coffee,
    ]);
    $cacao = FarmHarvest::factory()->create([
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Cacao,
    ]);
    $user = inventoryOperationsUser();
    $payload = [
        'quantity' => 10,
        'unit' => 'kg',
        'processing_stage_id' => inventoryStage('COFFEE_CHERRY')->id,
        'received_date' => '2026-10-07',
    ];

    $this->actingAs($user)->post(route('harvest.receive.store', $planned), $payload)->assertSessionHasErrors('quantity');
    $this->actingAs($user)->post(route('harvest.receive.store', $cacao), $payload)->assertSessionHasErrors('quantity');
    expect(Inventory::query()->count())->toBe(0);
});

test('processing follows the next stage and records yield', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 950,
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = inventoryOperationsUser();
    $cherry = inventoryStage('COFFEE_CHERRY');
    $dried = inventoryStage('DRIED_COFFEE');
    $parchment = inventoryStage('PARCHMENT');
    $green = inventoryStage('GREEN_BEANS');

    $this->actingAs($user)->post(route('harvest.receive.store', $harvest), [
        'quantity' => 900,
        'unit' => 'kg',
        'processing_stage_id' => $cherry->id,
        'received_date' => '2026-10-07',
    ])->assertRedirect();

    $source = Inventory::query()->firstOrFail();

    $this->actingAs($user)->post(route('inventory.process.store'), [
        'inventory_id' => $source->id,
        'input_quantity' => 500,
        'output_quantity' => 350,
        'destination_stage_id' => $dried->id,
        'processing_date' => '2026-10-08',
    ])->assertRedirect(route('inventory.show', $source));

    $source->refresh();
    $driedStock = Inventory::query()->where('processing_stage_id', $dried->id)->firstOrFail();
    $movement = InventoryMovement::query()->where('movement_type', InventoryMovementType::Processing)->firstOrFail();

    expect((float) $source->quantity)->toBe(400.0)
        ->and((float) $driedStock->quantity)->toBe(350.0)
        ->and($driedStock->harvest_id)->toBe($harvest->id)
        ->and($driedStock->farm_id)->toBe($harvest->farm_id)
        ->and((float) $movement->quantity)->toBe(500.0)
        ->and((float) $movement->output_quantity)->toBe(350.0)
        ->and($movement->source_stage_id)->toBe($cherry->id)
        ->and($movement->destination_stage_id)->toBe($dried->id);

    $this->actingAs($user)->post(route('inventory.process.store'), [
        'inventory_id' => $source->id,
        'input_quantity' => 10,
        'output_quantity' => 0,
        'destination_stage_id' => $dried->id,
        'processing_date' => '2026-10-08',
    ])->assertSessionHasErrors('output_quantity');

    $this->actingAs($user)->post(route('inventory.process.store'), [
        'inventory_id' => $source->id,
        'input_quantity' => 0,
        'output_quantity' => 10,
        'destination_stage_id' => $dried->id,
        'processing_date' => '2026-10-08',
    ])->assertSessionHasErrors('input_quantity');

    $this->actingAs($user)->post(route('inventory.process.store'), [
        'inventory_id' => $source->id,
        'input_quantity' => 500,
        'output_quantity' => 100,
        'destination_stage_id' => $dried->id,
        'processing_date' => '2026-10-08',
    ])->assertSessionHasErrors('input_quantity');

    $this->actingAs($user)->post(route('inventory.process.store'), [
        'inventory_id' => $source->id,
        'input_quantity' => 100,
        'output_quantity' => 80,
        'destination_stage_id' => $green->id,
        'processing_date' => '2026-10-08',
    ])->assertSessionHasErrors('destination_stage_id');

    expect((float) $source->refresh()->quantity)->toBe(400.0)
        ->and(Inventory::query()->where('processing_stage_id', $parchment->id)->count())->toBe(0)
        ->and(Inventory::query()->where('processing_stage_id', $green->id)->count())->toBe(0);

    $this->actingAs($user)->post(route('inventory.process.store'), [
        'inventory_id' => $driedStock->id,
        'input_quantity' => 200,
        'output_quantity' => 140,
        'destination_stage_id' => $parchment->id,
        'processing_date' => '2026-10-09',
    ])->assertRedirect();

    expect((float) $driedStock->refresh()->quantity)->toBe(150.0)
        ->and((float) Inventory::query()->where('processing_stage_id', $parchment->id)->value('quantity'))->toBe(140.0);
});

test('a failed processing movement rolls back both balances', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 900,
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = inventoryOperationsUser();

    $this->actingAs($user)->post(route('harvest.receive.store', $harvest), [
        'quantity' => 900,
        'unit' => 'kg',
        'processing_stage_id' => inventoryStage('COFFEE_CHERRY')->id,
        'received_date' => '2026-10-07',
    ]);

    $source = Inventory::query()->firstOrFail();

    InventoryMovement::creating(function (InventoryMovement $movement): void {
        if ($movement->movement_type === InventoryMovementType::Processing) {
            throw new RuntimeException('stop');
        }
    });

    try {
        $this->withoutExceptionHandling();

        expect(fn () => $this->actingAs($user)->post(route('inventory.process.store'), [
            'inventory_id' => $source->id,
            'input_quantity' => 500,
            'output_quantity' => 350,
            'destination_stage_id' => inventoryStage('DRIED_COFFEE')->id,
            'processing_date' => '2026-10-08',
        ]))->toThrow(RuntimeException::class);
    } finally {
        InventoryMovement::flushEventListeners();
    }

    expect((float) $source->refresh()->quantity)->toBe(900.0)
        ->and(Inventory::query()->count())->toBe(1)
        ->and(InventoryMovement::query()->where('movement_type', InventoryMovementType::Processing)->count())->toBe(0);
});

test('adjustments and damage keep movement history', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 500,
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = inventoryOperationsUser();

    $this->actingAs($user)->post(route('harvest.receive.store', $harvest), [
        'quantity' => 500,
        'unit' => 'kg',
        'processing_stage_id' => inventoryStage('COFFEE_CHERRY')->id,
        'received_date' => '2026-10-07',
    ]);

    $inventory = Inventory::query()->firstOrFail();

    $this->actingAs($user)->post(route('inventory.adjust.store', $inventory), [
        'quantity' => 20,
        'direction' => 'decrease',
        'reason' => 'Damaged during storage',
        'movement_date' => '2026-10-08',
    ])->assertRedirect();

    expect((float) $inventory->refresh()->quantity)->toBe(480.0)
        ->and(InventoryMovement::query()->where('movement_type', InventoryMovementType::Adjustment)->count())->toBe(1);

    $this->actingAs($user)->post(route('inventory.damage.store', $inventory), [
        'quantity' => 20,
        'reason' => 'Mold',
        'movement_date' => '2026-10-09',
    ])->assertRedirect();

    $damaged = Inventory::query()->where('status', InventoryStatus::Damaged)->firstOrFail();

    expect((float) $inventory->refresh()->quantity)->toBe(460.0)
        ->and((float) $damaged->quantity)->toBe(20.0)
        ->and($damaged->harvest_id)->toBe($harvest->id)
        ->and(InventoryMovement::query()->where('movement_type', InventoryMovementType::Damage)->count())->toBe(1);
});

test('farm farmer and dashboard inventory summaries use available stock', function () {
    $farm = Farm::factory()->create(['crop_type' => CropType::Coffee]);
    $harvest = FarmHarvest::factory()->for($farm)->create([
        'quantity' => 900,
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = inventoryOperationsUser();

    $this->actingAs($user)->post(route('harvest.receive.store', $harvest), [
        'quantity' => 900,
        'unit' => 'kg',
        'processing_stage_id' => inventoryStage('COFFEE_CHERRY')->id,
        'received_date' => '2026-10-07',
    ]);

    $source = Inventory::query()->firstOrFail();

    $this->actingAs($user)->post(route('inventory.process.store'), [
        'inventory_id' => $source->id,
        'input_quantity' => 500,
        'output_quantity' => 350,
        'destination_stage_id' => inventoryStage('DRIED_COFFEE')->id,
        'processing_date' => '2026-10-08',
    ]);

    $this->actingAs($user)
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.inventory_summary.total_label', '750 kg')
            ->where('farm.inventory_summary.stages.0.label', '400 kg')
            ->where('farm.inventory_summary.stages.1.label', '350 kg'));

    $this->actingAs($user)
        ->get(route('farmers.show', $farm->farmer_id))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farmer.inventory_summary.total_label', '750 kg'));

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('inventory_summary.total_label', '750 kg')
            ->where('inventory_summary.has_records', true));
});

test('field verifiers can view inventory and cannot change it', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);
    $farmer = User::factory()->create(['role' => UserRole::Farmer]);

    $this->actingAs(inventoryOperationsUser())->post(route('harvest.receive.store', $harvest), [
        'quantity' => 100,
        'unit' => 'kg',
        'processing_stage_id' => inventoryStage('COFFEE_CHERRY')->id,
        'received_date' => '2026-10-07',
    ]);

    $inventory = Inventory::query()->firstOrFail();

    $this->actingAs($verifier)
        ->get(route('inventory.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('inventory/index')
            ->where('inventories.data.0.quantity_label', '100 kg')
            ->where('can_manage', false));

    $this->actingAs($verifier)
        ->post(route('inventory.process.store'), [
            'inventory_id' => $inventory->id,
            'input_quantity' => 10,
            'output_quantity' => 8,
            'destination_stage_id' => inventoryStage('DRIED_COFFEE')->id,
            'processing_date' => '2026-10-08',
        ])
        ->assertForbidden();

    $this->actingAs($farmer)->get(route('inventory.show', $inventory))->assertForbidden();
    $this->actingAs($farmer)->post(route('harvest.receive.store', $harvest), [
        'quantity' => 10,
        'unit' => 'kg',
        'processing_stage_id' => inventoryStage('COFFEE_CHERRY')->id,
        'received_date' => '2026-10-07',
    ])->assertForbidden();

    expect((float) $inventory->refresh()->quantity)->toBe(100.0);
});
