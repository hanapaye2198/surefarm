<?php

namespace App\Services;

use App\Models\TraceabilityLot;
use App\TraceabilityLotStatus;
use Illuminate\Database\Eloquent\Builder;

class TraceabilitySummary
{
    public function __construct(private ProductionLedger $ledger) {}

    /**
     * @return array{active_lots: int, green_bean_lots: int, completed_lots: int, traced_label: string, has_records: bool}
     */
    public function metrics(?int $farmId = null, ?int $farmerId = null): array
    {
        $query = $this->scoped($farmId, $farmerId);

        return [
            'active_lots' => (clone $query)->where('status', TraceabilityLotStatus::Active)->count(),
            'green_bean_lots' => (clone $query)
                ->whereHas('inventory.stage', fn (Builder $stage): Builder => $stage->where('code', 'GREEN_BEANS'))
                ->count(),
            'completed_lots' => (clone $query)->where('status', TraceabilityLotStatus::Completed)->count(),
            'traced_label' => $this->tracedLabel(clone $query),
            'has_records' => (clone $query)->exists(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function recent(?int $limit = 5): array
    {
        return TraceabilityLot::query()
            ->with(['farmer', 'farm', 'harvest', 'inventory.stage'])
            ->latest('id')
            ->limit($limit)
            ->get()
            ->map(fn (TraceabilityLot $lot): array => $this->row($lot))
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function forFarm(int $farmId): array
    {
        return TraceabilityLot::query()
            ->with(['harvest', 'inventory.stage'])
            ->where('farm_id', $farmId)
            ->latest('id')
            ->get()
            ->map(fn (TraceabilityLot $lot): array => $this->row($lot))
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function row(TraceabilityLot $lot): array
    {
        return [
            'id' => $lot->id,
            'lot_code' => $lot->lot_code,
            'quantity_label' => $this->ledger->quantityLabel($lot->quantity, $lot->unit),
            'unit' => $lot->unit,
            'status' => $lot->status->value,
            'status_label' => $lot->status->label(),
            'stage' => $lot->inventory?->stage?->name,
            'crop' => $lot->crop_type?->label(),
            'harvest_date' => $lot->harvest?->harvest_date?->format('M j, Y'),
            'farmer' => $lot->farmer === null ? null : [
                'id' => $lot->farmer->id,
                'name' => $lot->farmer->fullName(),
            ],
            'farm' => $lot->farm === null ? null : [
                'id' => $lot->farm->id,
                'farm_id' => $lot->farm->farm_id,
                'farm_name' => $lot->farm->displayName(),
            ],
        ];
    }

    private function tracedLabel(Builder $query): string
    {
        $totals = $query
            ->where('status', '!=', TraceabilityLotStatus::Cancelled)
            ->selectRaw('unit, SUM(quantity) as total')
            ->groupBy('unit')
            ->get();

        if ($totals->isEmpty()) {
            return '0 kg';
        }

        $preferred = $totals->firstWhere('unit', 'kg') ?? $totals->first();

        if ($totals->count() > 1) {
            return $totals
                ->map(fn (TraceabilityLot $row): string => $this->ledger->quantityLabel($row->total, $row->unit))
                ->implode(' · ');
        }

        return $this->ledger->quantityLabel($preferred->total, $preferred->unit);
    }

    private function scoped(?int $farmId, ?int $farmerId): Builder
    {
        return TraceabilityLot::query()
            ->when($farmId !== null, fn (Builder $query): Builder => $query->where('farm_id', $farmId))
            ->when($farmerId !== null, fn (Builder $query): Builder => $query->where('farmer_id', $farmerId));
    }
}
