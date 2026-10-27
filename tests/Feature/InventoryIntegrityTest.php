<?php

use App\AccessEventAction;
use App\Actions\MarkInventoryDamaged;
use App\Actions\ProcessCoffeeInventory;
use App\Actions\ReceiveHarvestIntoInventory;
use App\CropType;
use App\HarvestStatus;
use App\InventoryMovementType;
use App\Models\AccessEvent;
use App\Models\FarmHarvest;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\InventoryProcessingStage;
use App\Models\User;
use App\Services\InventoryStock;
use App\UserRole;
use Database\Seeders\InventoryProcessingStageSeeder;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(InventoryProcessingStageSeeder::class);
});

function integrityOperationsUser(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

function integrityStage(string $code): InventoryProcessingStage
{
    return InventoryProcessingStage::query()->where('code', $code)->firstOrFail();
}

/**
 * @return array<string, mixed>
 */
function integrityReceipt(FarmHarvest $harvest, float|int|string $quantity, ?string $token = null): array
{
    return [
        'quantity' => $quantity,
        'unit' => $harvest->unit,
        'processing_stage_id' => integrityStage('COFFEE_CHERRY')->id,
        'received_date' => '2026-10-07',
        'receipt_token' => $token,
    ];
}

test('a receipt in another unit is rejected and does not create stock', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);

    $this->actingAs(integrityOperationsUser())
        ->post(route('harvest.receive.store', $harvest), [
            ...integrityReceipt($harvest, 80),
            'unit' => 'tons',
        ])
        ->assertSessionHasErrors('unit');

    expect(Inventory::query()->count())->toBe(0)
        ->and(InventoryMovement::query()->count())->toBe(0);
});

test('receipts cannot exceed the harvest or use a negative quantity', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = integrityOperationsUser();

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 60))
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 50))
        ->assertSessionHasErrors('quantity');

    expect(fn () => app(ReceiveHarvestIntoInventory::class)->handle($harvest, [
        ...integrityReceipt($harvest, -5),
        'quantity' => -5,
    ], $user->id))->toThrow(ValidationException::class);

    expect(Inventory::query()->count())->toBe(1)
        ->and((float) Inventory::query()->firstOrFail()->quantity)->toBe(60.0)
        ->and(app(InventoryStock::class)->remainingReceivable($harvest->fresh()))->toBe(40.0);
});

test('decimal receipts use cent arithmetic', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => '0.30',
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = integrityOperationsUser();

    foreach (['0.10', '0.10', '0.10'] as $quantity) {
        $this->actingAs($user)
            ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, $quantity))
            ->assertRedirect();
    }

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, '0.01'))
        ->assertSessionHasErrors('quantity');

    expect(Inventory::query()->count())->toBe(3)
        ->and(app(InventoryStock::class)->remainingReceivable($harvest->fresh()))->toBe(0.0);
});

test('the same receipt token cannot create a second movement', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = integrityOperationsUser();
    $token = '6d9f5c2e-3a4b-4c1d-9e8f-1234567890ab';

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 25, $token))
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 25, $token))
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 30, $token))
        ->assertSessionHasErrors('receipt_token');

    expect(Inventory::query()->count())->toBe(1)
        ->and(InventoryMovement::query()->count())->toBe(1)
        ->and(AccessEvent::query()->where('action', AccessEventAction::InventoryReceived)->count())->toBe(1);
});

test('a failed movement rolls back the inventory receipt', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);

    InventoryMovement::creating(function (): void {
        throw new RuntimeException('movement failed');
    });

    try {
        expect(fn () => app(ReceiveHarvestIntoInventory::class)->handle(
            $harvest,
            integrityReceipt($harvest, 10),
            integrityOperationsUser()->id,
        ))->toThrow(RuntimeException::class);

        expect(Inventory::query()->count())->toBe(0)
            ->and(InventoryMovement::query()->count())->toBe(0);
    } finally {
        InventoryMovement::flushEventListeners();
    }
});

test('a received harvest cannot change unit or fall below the received quantity', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
        'harvest_date' => '2026-10-01',
    ]);
    $user = integrityOperationsUser();

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 60))
        ->assertRedirect();

    $payload = [
        'harvest_date' => '2026-10-01',
        'quantity' => 50,
        'unit' => 'kg',
        'quality_grade' => null,
        'status' => HarvestStatus::Completed->value,
        'notes' => null,
    ];

    $this->actingAs($user)
        ->put(route('harvest.update', $harvest), $payload)
        ->assertSessionHasErrors('quantity');

    $this->actingAs($user)
        ->put(route('harvest.update', $harvest), [...$payload, 'quantity' => 100, 'unit' => 'tons'])
        ->assertSessionHasErrors('unit');

    $this->actingAs($user)
        ->put(route('harvest.update', $harvest), [...$payload, 'quantity' => 100, 'status' => HarvestStatus::Planned->value])
        ->assertSessionHasErrors('status');

    $this->actingAs($user)
        ->put(route('harvest.update', $harvest), [...$payload, 'quantity' => 80])
        ->assertRedirect();

    $harvest->refresh();

    expect((float) $harvest->quantity)->toBe(80.0)
        ->and($harvest->unit)->toBe('kg')
        ->and($harvest->status)->toBe(HarvestStatus::Completed)
        ->and(AccessEvent::query()->where('action', AccessEventAction::HarvestCorrected)->count())->toBe(1);
});

test('a receipt can be reversed once and the quantity returns to the harvest', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = integrityOperationsUser();

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 40))
        ->assertRedirect();

    $inventory = Inventory::query()->firstOrFail();
    $receipt = InventoryMovement::query()->where('movement_type', InventoryMovementType::Receipt)->firstOrFail();

    $this->actingAs($user)
        ->post(route('inventory.receipts.reverse', [$inventory, $receipt]))
        ->assertRedirect(route('inventory.show', $inventory));

    $this->actingAs($user)
        ->post(route('inventory.receipts.reverse', [$inventory, $receipt]))
        ->assertSessionHasErrors('movement');

    $inventory->refresh();

    expect((float) $inventory->quantity)->toBe(0.0)
        ->and(InventoryMovement::query()->where('movement_type', InventoryMovementType::Reversal)->count())->toBe(1)
        ->and(InventoryMovement::query()->where('movement_type', InventoryMovementType::Receipt)->count())->toBe(1)
        ->and(app(InventoryStock::class)->remainingReceivable($harvest->fresh()))->toBe(100.0)
        ->and(app(InventoryStock::class)->discrepancies($user))->toBe([])
        ->and(AccessEvent::query()->where('action', AccessEventAction::InventoryReceiptReversed)->count())->toBe(1);
});

test('a receipt cannot be reversed after the coffee is processed', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = integrityOperationsUser();

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 100))
        ->assertRedirect();

    $inventory = Inventory::query()->firstOrFail();

    app(ProcessCoffeeInventory::class)->handle([
        'inventory_id' => $inventory->id,
        'input_quantity' => 10,
        'output_quantity' => 8,
        'destination_stage_id' => integrityStage('PARCHMENT')->id,
        'processing_date' => '2026-10-08',
    ], $user->id);

    $receipt = InventoryMovement::query()->where('movement_type', InventoryMovementType::Receipt)->firstOrFail();

    $this->actingAs($user)
        ->post(route('inventory.receipts.reverse', [$inventory, $receipt]))
        ->assertSessionHasErrors('movement');

    expect((float) $inventory->fresh()->quantity)->toBe(90.0);
});

test('processing and damage stay reconciled to their movements', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = integrityOperationsUser();
    $stock = app(InventoryStock::class);

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 100))
        ->assertRedirect();

    $inventory = Inventory::query()->firstOrFail();

    app(MarkInventoryDamaged::class)->handle($inventory, [
        'quantity' => 10,
        'reason' => 'Mold on the stored cherry.',
        'movement_date' => '2026-10-08',
    ], $user->id);

    expect($stock->discrepancies($user))->toBe([]);

    $available = Inventory::query()->whereKey($inventory->id)->firstOrFail();

    app(ProcessCoffeeInventory::class)->handle([
        'inventory_id' => $available->id,
        'input_quantity' => 20,
        'output_quantity' => 16,
        'destination_stage_id' => integrityStage('PARCHMENT')->id,
        'processing_date' => '2026-10-09',
    ], $user->id);

    expect($stock->discrepancies($user))->toBe([]);
});

test('reconciliation reports a stored balance and corrects it without a new movement', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = integrityOperationsUser();

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 100))
        ->assertRedirect();

    $inventory = Inventory::query()->firstOrFail();
    $inventory->quantity = '40.00';
    $inventory->save();

    $this->actingAs($user)
        ->get(route('inventory.reconciliation'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('inventory/reconciliation')
            ->has('discrepancies', 1)
            ->where('discrepancies.0.id', $inventory->id)
            ->where('discrepancies.0.stored', '40.00')
            ->where('discrepancies.0.movements', '100.00'));

    $this->actingAs($user)
        ->post(route('inventory.reconciliation.update', $inventory), [
            'reason' => 'Stored quantity had been overwritten.',
        ])
        ->assertRedirect(route('inventory.reconciliation'));

    expect((float) $inventory->fresh()->quantity)->toBe(100.0)
        ->and(InventoryMovement::query()->count())->toBe(1)
        ->and(AccessEvent::query()->where('action', AccessEventAction::InventoryBalanceCorrected)->count())->toBe(1);

    $this->actingAs($user)
        ->get(route('inventory.reconciliation'))
        ->assertInertia(fn (Assert $page) => $page->has('discrepancies', 0));
});

test('a negative movement total is reported and is not overwritten', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = integrityOperationsUser();

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 100))
        ->assertRedirect();

    $inventory = Inventory::query()->firstOrFail();
    $receipt = InventoryMovement::query()->firstOrFail();

    InventoryMovement::query()->create([
        'inventory_id' => $inventory->id,
        'quantity' => 250,
        'unit' => 'kg',
        'movement_type' => InventoryMovementType::Reversal,
        'movement_date' => '2026-10-08',
        'reference_type' => 'harvest',
        'reference_id' => $harvest->id,
        'reverses_movement_id' => $receipt->id,
        'created_by' => $user->id,
    ]);

    $this->actingAs($user)
        ->post(route('inventory.reconciliation.update', $inventory), [
            'reason' => 'Try to hide the negative total.',
        ])
        ->assertSessionHasErrors('reason');

    expect((float) $inventory->fresh()->quantity)->toBe(100.0);
});

test('a legacy receipt in another unit is listed and new mismatched receipts stay blocked', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $user = integrityOperationsUser();
    $inventory = Inventory::factory()->create([
        'farmer_id' => $harvest->farm->farmer_id,
        'farm_id' => $harvest->farm_id,
        'harvest_id' => $harvest->id,
        'processing_stage_id' => integrityStage('COFFEE_CHERRY')->id,
        'quantity' => 2,
        'unit' => 'tons',
    ]);

    InventoryMovement::query()->create([
        'inventory_id' => $inventory->id,
        'quantity' => 2,
        'unit' => 'tons',
        'movement_type' => InventoryMovementType::Receipt,
        'movement_date' => '2026-10-07',
        'reference_type' => 'harvest',
        'reference_id' => $harvest->id,
        'created_by' => $user->id,
    ]);

    $this->actingAs($user)
        ->get(route('inventory.reconciliation'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('incompatible_receipts', 1)
            ->where('incompatible_receipts.0.receipt_unit', 'tons')
            ->where('incompatible_receipts.0.harvest_unit', 'kg'));

    $this->actingAs($user)
        ->post(route('harvest.receive.store', $harvest), [
            ...integrityReceipt($harvest, 1),
            'unit' => 'bags',
        ])
        ->assertSessionHasErrors('unit');
});

test('farmers and field verifiers cannot reverse a receipt', function () {
    $harvest = FarmHarvest::factory()->create([
        'quantity' => 100,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'crop_type' => CropType::Coffee,
    ]);
    $operations = integrityOperationsUser();

    $this->actingAs($operations)
        ->post(route('harvest.receive.store', $harvest), integrityReceipt($harvest, 20))
        ->assertRedirect();

    $inventory = Inventory::query()->firstOrFail();
    $receipt = InventoryMovement::query()->firstOrFail();
    $farmer = User::factory()->create(['role' => UserRole::Farmer]);
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);
    assignFarmVerifier($verifier, $harvest->farm);

    $this->actingAs($farmer)
        ->post(route('inventory.receipts.reverse', [$inventory, $receipt]))
        ->assertNotFound();

    $this->actingAs($verifier)
        ->post(route('inventory.receipts.reverse', [$inventory, $receipt]))
        ->assertForbidden();

    expect((float) $inventory->fresh()->quantity)->toBe(20.0);
});
