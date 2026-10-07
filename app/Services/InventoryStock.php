<?php

namespace App\Services;

use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\FarmHarvest;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\InventoryProcessingStage;
use App\ProcessingStageStatus;
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
        return (float) InventoryMovement::query()
            ->where('movement_type', InventoryMovementType::Receipt)
            ->where('reference_type', 'harvest')
            ->where('reference_id', $harvest->id)
            ->where('unit', $unit)
            ->sum('quantity');
    }

    public function remainingReceivable(FarmHarvest $harvest): float
    {
        return round(max(0, (float) $harvest->quantity - $this->receivedQuantity($harvest, $harvest->unit)), 2);
    }

    /**
     * @return array{
     *     stages: list<array{id: int, name: string, code: string, sequence: int, quantity: float, unit: string, label: string}>,
     *     total_label: string,
     *     has_records: bool,
     *     chart: list<array{name: string, quantity: float, unit: string, share: int}>
     * }
     */
    public function balances(?int $farmId = null, ?int $farmerId = null): array
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
}
