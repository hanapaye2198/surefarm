<?php

namespace App\Services;

use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\FarmHarvest;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\InventoryProcessingStage;
use App\Models\User;
use App\ProcessingStageStatus;
use App\Support\DecimalQuantity;
use Illuminate\Support\Collection;

/**
 * On-hand coffee is the available quantity on inventory rows.
 * Movements explain how that balance changed. Units are not converted.
 */
class InventoryStock
{
    public function __construct(private ProductionLedger $ledger) {}

    public function nextStage(InventoryProcessingStage $stage): ?InventoryProcessingStage
    {
        return InventoryProcessingStage::query()
            ->where('status', ProcessingStageStatus::Active)
            ->where('sequence', '>', $stage->sequence)
            ->orderBy('sequence')
            ->first();
    }

    public function receivedQuantity(FarmHarvest $harvest, string $unit): float
    {
        return $this->receivedCents($harvest, $unit) / 100;
    }

    public function receivedCents(FarmHarvest $harvest, ?string $unit = null): int
    {
        $unit ??= $harvest->unit;

        return $this->movementCentsForHarvest($harvest, $unit, InventoryMovementType::Receipt)
            - $this->movementCentsForHarvest($harvest, $unit, InventoryMovementType::Reversal);
    }

    public function remainingReceivable(FarmHarvest $harvest): float
    {
        $remaining = DecimalQuantity::cents($harvest->quantity) - $this->receivedCents($harvest);

        return max(0, $remaining) / 100;
    }

    public function movementCents(Inventory $inventory): int
    {
        $total = 0;

        foreach ($this->movementsFor($inventory) as $movement) {
            $total += $this->effectCents($movement, $inventory->id);
        }

        return $total;
    }

    /**
     * Stored on-hand quantity compared with the sum of its movements.
     *
     * @return list<array{id: int, stored: string, movements: string, unit: string, farm: string|null, stage: string|null}>
     */
    public function discrepancies(?User $viewer): array
    {
        $rows = [];

        $query = Inventory::query()->with(['farm:id,farm_name', 'stage:id,name'])->orderBy('id');

        if ($viewer instanceof User) {
            $query->visibleTo($viewer);
        }

        $query->chunkById(100, function (Collection $inventories) use (&$rows): void {
            /** @var Collection<int, Inventory> $inventories */
            $ids = $inventories->pluck('id')->all();
            $movements = InventoryMovement::query()
                ->where(function ($query) use ($ids): void {
                    $query->whereIn('inventory_id', $ids)
                        ->orWhereIn('destination_inventory_id', $ids);
                })
                ->get()
                ->groupBy(fn (InventoryMovement $movement): int => (int) $movement->inventory_id);

            $incoming = InventoryMovement::query()
                ->whereIn('destination_inventory_id', $ids)
                ->get()
                ->groupBy(fn (InventoryMovement $movement): int => (int) $movement->destination_inventory_id);

            foreach ($inventories as $inventory) {
                $stored = DecimalQuantity::cents($inventory->quantity);
                $calculated = 0;

                foreach ($movements->get($inventory->id, collect()) as $movement) {
                    if ($movement->inventory_id === $inventory->id) {
                        $calculated += $this->effectCents($movement, $inventory->id);
                    }
                }

                foreach ($incoming->get($inventory->id, collect()) as $movement) {
                    if ($movement->inventory_id !== $inventory->id) {
                        $calculated += $this->effectCents($movement, $inventory->id);
                    }
                }

                if ($stored === $calculated) {
                    continue;
                }

                $rows[] = [
                    'id' => $inventory->id,
                    'stored' => DecimalQuantity::fromCents($stored),
                    'movements' => DecimalQuantity::fromCents($calculated),
                    'unit' => $inventory->unit,
                    'farm' => $inventory->farm?->farm_name,
                    'stage' => $inventory->stage?->name,
                ];
            }
        });

        return $rows;
    }

    /**
     * Receipts saved in a unit SureFarm does not convert to the harvest unit.
     *
     * @return list<array{movement_id: int, inventory_id: int|null, harvest_id: int, receipt_unit: string, harvest_unit: string, quantity: string}>
     */
    public function incompatibleReceipts(?User $viewer): array
    {
        $harvests = FarmHarvest::query()
            ->when($viewer instanceof User, fn ($query) => $query->visibleTo($viewer))
            ->get(['id', 'unit']);

        if ($harvests->isEmpty()) {
            return [];
        }

        $units = $harvests->pluck('unit', 'id');
        $rows = [];

        $receipts = InventoryMovement::query()
            ->where('movement_type', InventoryMovementType::Receipt)
            ->where('reference_type', 'harvest')
            ->whereIn('reference_id', $units->keys())
            ->orderBy('id')
            ->get();

        foreach ($receipts as $movement) {
            $harvestUnit = (string) $units->get($movement->reference_id);

            if ($movement->unit === $harvestUnit) {
                continue;
            }

            $rows[] = [
                'movement_id' => $movement->id,
                'inventory_id' => $movement->inventory_id,
                'harvest_id' => (int) $movement->reference_id,
                'receipt_unit' => $movement->unit,
                'harvest_unit' => $harvestUnit,
                'quantity' => DecimalQuantity::fromCents(DecimalQuantity::cents($movement->quantity)),
            ];
        }

        return $rows;
    }

    /**
     * @return array{
     *     stages: list<array{id: int, name: string, code: string, sequence: int, quantity: float, unit: string, label: string}>,
     *     total_label: string,
     *     has_records: bool,
     *     chart: list<array{name: string, quantity: float, unit: string, share: int}>
     * }
     */
    public function balances(?int $farmId = null, ?int $farmerId = null, ?User $viewer = null): array
    {
        $stages = InventoryProcessingStage::query()
            ->where('status', ProcessingStageStatus::Active)
            ->orderBy('sequence')
            ->get();

        $totals = Inventory::query()
            ->selectRaw('processing_stage_id, unit, SUM(quantity) as total')
            ->where('status', InventoryStatus::Available)
            ->where('quantity', '>', 0)
            ->when($farmId !== null, fn ($query) => $query->where('farm_id', $farmId))
            ->when($farmerId !== null, fn ($query) => $query->where('farmer_id', $farmerId))
            ->when($viewer instanceof User, fn ($query) => $query->visibleTo($viewer))
            ->groupBy('processing_stage_id', 'unit')
            ->get()
            ->groupBy('processing_stage_id');

        $rows = $stages->map(function (InventoryProcessingStage $stage) use ($totals): array {
            /** @var Collection<int, object{unit: string, total: numeric-string|float|int}> $group */
            $group = $totals->get($stage->id, collect());
            $primary = $this->primaryTotal($group);

            return [
                'id' => $stage->id,
                'name' => $stage->name,
                'code' => $stage->code,
                'sequence' => $stage->sequence,
                'quantity' => $primary['quantity'],
                'unit' => $primary['unit'],
                'label' => $primary['label'],
            ];
        })->values();

        $hasRecords = $rows->contains(fn (array $row): bool => $row['quantity'] > 0);
        $total = $this->combinedLabel($rows);

        $max = (float) $rows->max('quantity');

        return [
            'stages' => $rows->all(),
            'total_label' => $total,
            'has_records' => $hasRecords,
            'chart' => $rows->map(fn (array $row): array => [
                'name' => $row['name'],
                'quantity' => $row['quantity'],
                'unit' => $row['unit'],
                'share' => $max > 0 ? (int) round(($row['quantity'] / $max) * 100) : 0,
            ])->all(),
        ];
    }

    /**
     * @param  Collection<int, object{unit: string, total: numeric-string|float|int}>  $group
     * @return array{quantity: float, unit: string, label: string}
     */
    private function primaryTotal(Collection $group): array
    {
        if ($group->isEmpty()) {
            return [
                'quantity' => 0,
                'unit' => 'kg',
                'label' => '0 kg',
            ];
        }

        $preferred = $group->firstWhere('unit', 'kg') ?? $group->first();
        $quantity = round((float) $preferred->total, 2);
        $parts = $group
            ->sortBy(fn (object $row): int => $row->unit === 'kg' ? 0 : 1)
            ->map(fn (object $row): string => $this->ledger->quantityLabel($row->total, $row->unit))
            ->values();

        return [
            'quantity' => $quantity,
            'unit' => (string) $preferred->unit,
            'label' => $parts->implode(' · '),
        ];
    }

    /**
     * @param  Collection<int, array{quantity: float, unit: string, label: string}>  $rows
     */
    private function combinedLabel(Collection $rows): string
    {
        $withStock = $rows->filter(fn (array $row): bool => $row['quantity'] > 0);

        if ($withStock->isEmpty()) {
            return '0 kg';
        }

        $units = $withStock->pluck('unit')->unique();

        if ($units->count() === 1) {
            $unit = (string) $units->first();
            $sum = round((float) $withStock->sum('quantity'), 2);

            return $this->ledger->quantityLabel($sum, $unit);
        }

        return $withStock->pluck('label')->implode(' · ');
    }

    private function movementCentsForHarvest(FarmHarvest $harvest, string $unit, InventoryMovementType $type): int
    {
        $total = InventoryMovement::query()
            ->where('movement_type', $type)
            ->where('reference_type', 'harvest')
            ->where('reference_id', $harvest->id)
            ->where('unit', $unit)
            ->sum('quantity');

        return DecimalQuantity::cents($total);
    }

    /**
     * @return Collection<int, InventoryMovement>
     */
    private function movementsFor(Inventory $inventory): Collection
    {
        return InventoryMovement::query()
            ->where(function ($query) use ($inventory): void {
                $query->where('inventory_id', $inventory->id)
                    ->orWhere('destination_inventory_id', $inventory->id);
            })
            ->get();
    }

    private function effectCents(InventoryMovement $movement, int $inventoryId): int
    {
        if ($movement->inventory_id === $inventoryId) {
            $cents = DecimalQuantity::cents($movement->quantity);

            return match ($movement->movement_type) {
                InventoryMovementType::Receipt => $cents,
                InventoryMovementType::Adjustment => $movement->direction === 'increase' ? $cents : -$cents,
                InventoryMovementType::Damage,
                InventoryMovementType::Processing,
                InventoryMovementType::Reversal,
                InventoryMovementType::Release => -$cents,
            };
        }

        if ($movement->destination_inventory_id !== $inventoryId) {
            return 0;
        }

        return match ($movement->movement_type) {
            InventoryMovementType::Processing => DecimalQuantity::cents($movement->output_quantity ?? 0),
            InventoryMovementType::Damage => DecimalQuantity::cents($movement->quantity),
            InventoryMovementType::Receipt,
            InventoryMovementType::Adjustment,
            InventoryMovementType::Release,
            InventoryMovementType::Reversal => 0,
        };
    }
}
