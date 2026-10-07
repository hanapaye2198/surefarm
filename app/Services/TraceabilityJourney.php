<?php

namespace App\Services;

use App\FarmVerificationStatus;
use App\InventoryMovementType;
use App\Models\Farm;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\InventoryProcessingStage;
use App\Models\TraceabilityEvent;
use App\Models\TraceabilityLot;
use App\TraceabilityEventType;
use Illuminate\Support\Collection;

/**
 * Traceability events point at harvests and inventory movements.
 * Those records stay the source of the dates and quantities.
 */
class TraceabilityJourney
{
    public function __construct(
        private ProductionLedger $ledger,
        private FarmAreaComparison $areas,
        private QrCode $qrCode,
    ) {}

    public function record(TraceabilityLot $lot, ?int $userId): void
    {
        $lot->loadMissing(['farm', 'harvest', 'inventory']);
        $events = [];

        if ($lot->farm !== null) {
            $events[] = $this->event(
                $lot,
                TraceabilityEventType::Origin,
                $lot->farm->created_at?->toDateString(),
                'farm',
                $lot->farm_id,
                $userId,
            );
        }

        if ($lot->harvest !== null) {
            $events[] = $this->event(
                $lot,
                TraceabilityEventType::Harvest,
                $lot->harvest->harvest_date?->toDateString(),
                'farm_harvest',
                $lot->harvest_id,
                $userId,
            );
        }

        if ($lot->inventory !== null) {
            foreach ($this->receipts($lot->inventory) as $movement) {
                $events[] = $this->event(
                    $lot,
                    TraceabilityEventType::InventoryReceipt,
                    $movement->movement_date?->toDateString(),
                    'inventory_movement',
                    $movement->id,
                    $userId,
                );
            }

            foreach ($this->processingMovements($lot->inventory) as $movement) {
                $events[] = $this->event(
                    $lot,
                    TraceabilityEventType::Processing,
                    $movement->movement_date?->toDateString(),
                    'inventory_movement',
                    $movement->id,
                    $userId,
                );
            }
        }

        $events[] = $this->event(
            $lot,
            TraceabilityEventType::TraceabilityCreated,
            now()->toDateString(),
            'traceability_lot',
            $lot->id,
            $userId,
        );

        foreach ($events as $event) {
            TraceabilityEvent::query()->create($event);
        }
    }

    /**
     * Authenticated lot detail. Farmer contact details stay off this payload
     * only when the caller is the public page.
     *
     * @return array<string, mixed>
     */
    public function detail(TraceabilityLot $lot): array
    {
        $lot->loadMissing([
            'farmer',
            'farm.boundary',
            'harvest',
            'inventory.stage',
        ]);

        $farm = $lot->farm;
        $comparison = $farm === null
            ? null
            : $this->areas->calculate(
                $farm->declared_area_hectares,
                $farm->boundary?->gps_measured_area_hectares,
            );

        return [
            'lot' => $this->lotCard($lot, $farm, $comparison),
            'journey' => $this->journeyRows($lot),
            'receipt' => $this->receiptRow($lot),
            'timeline' => $this->timeline($lot, $farm),
            'qr_svg' => $this->qrCode->svg($this->publicUrl($lot)),
            'public_url' => $this->publicUrl($lot),
            'stages' => InventoryProcessingStage::query()->orderBy('sequence')->pluck('name')->all(),
        ];
    }

    /**
     * Fields a buyer may see. Contact, identity, bank, finance, and notes are omitted.
     *
     * @return array<string, mixed>
     */
    public function publicRecord(TraceabilityLot $lot): array
    {
        $lot->loadMissing(['farm', 'harvest', 'inventory.stage']);
        $farm = $lot->farm;

        return [
            'lot_code' => $lot->lot_code,
            'crop' => $lot->crop_type?->label() ?? $farm?->crop_type->label(),
            'farm_name' => $farm?->displayName(),
            'municipality' => $farm?->municipality,
            'province' => $farm?->province,
            'harvest_date' => $lot->harvest?->harvest_date?->format('F j, Y'),
            'quantity_label' => $this->ledger->quantityLabel($lot->quantity, $lot->unit),
            'stage' => $lot->inventory?->stage?->name,
            'verification_status' => $farm?->verification_status->value,
            'verification_label' => $farm === null ? null : $this->verificationLabel($farm->verification_status),
            'receipt' => $this->receiptRow($lot),
            'journey' => $this->journeyRows($lot),
        ];
    }

    public function publicUrl(TraceabilityLot $lot): string
    {
        return route('trace.public', ['lot_code' => $lot->lot_code]);
    }

    /**
     * @param  array{declared: float, measured: float, difference: float, variance: float}|null  $comparison
     * @return array<string, mixed>
     */
    private function lotCard(TraceabilityLot $lot, ?Farm $farm, ?array $comparison): array
    {
        $harvest = $lot->harvest;

        return [
            'id' => $lot->id,
            'lot_code' => $lot->lot_code,
            'quantity' => (float) $lot->quantity,
            'quantity_label' => $this->ledger->quantityLabel($lot->quantity, $lot->unit),
            'unit' => $lot->unit,
            'status' => $lot->status->value,
            'status_label' => $lot->status->label(),
            'notes' => $lot->notes,
            'created_at' => $lot->created_at?->format('F j, Y'),
            'crop' => $lot->crop_type?->label() ?? $farm?->crop_type->label(),
            'stage' => $lot->inventory?->stage?->name,
            'farmer' => $lot->farmer === null ? null : [
                'id' => $lot->farmer->id,
                'farmer_id' => $lot->farmer->farmer_id,
                'full_name' => $lot->farmer->fullName(),
            ],
            'farm' => $farm === null ? null : [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->displayName(),
                'location' => $farm->locationLabel(),
                'municipality' => $farm->municipality,
                'province' => $farm->province,
                'declared_area' => $this->areas->hectares((float) $farm->declared_area_hectares),
                'verified_area' => $farm->verified_area_hectares === null
                    ? 'Not yet verified'
                    : $this->areas->hectares((float) $farm->verified_area_hectares),
                'variance' => $comparison === null ? '—' : $this->areas->percent($comparison['variance']),
                'verification_status' => $farm->verification_status->value,
                'verification_label' => $this->verificationLabel($farm->verification_status),
                'latitude' => $farm->latitude === null ? null : (float) $farm->latitude,
                'longitude' => $farm->longitude === null ? null : (float) $farm->longitude,
                'has_location' => $farm->hasGeolocation() || $farm->boundary !== null,
                'boundary' => $farm->boundary?->boundary_geojson,
            ],
            'harvest' => $harvest === null ? null : [
                'id' => $harvest->id,
                'label' => 'Harvest #'.str_pad((string) $harvest->id, 3, '0', STR_PAD_LEFT),
                'harvest_date' => $harvest->harvest_date?->format('M j, Y'),
                'harvest_date_long' => $harvest->harvest_date?->format('F j, Y'),
                'quantity_label' => $this->ledger->quantityLabel($harvest->quantity, $harvest->unit),
                'status' => $harvest->status->value,
                'status_label' => $harvest->status->label(),
            ],
        ];
    }

    /**
     * @return list<array{date: string|null, from_stage: string|null, input_label: string, to_stage: string|null, output_label: string|null}>
     */
    private function journeyRows(TraceabilityLot $lot): array
    {
        if ($lot->inventory === null) {
            return [];
        }

        return $this->processingMovements($lot->inventory)
            ->map(function (InventoryMovement $movement): array {
                $movement->loadMissing(['sourceStage', 'destinationStage']);

                return [
                    'date' => $movement->movement_date?->format('M j, Y'),
                    'from_stage' => $movement->sourceStage?->name,
                    'input_label' => $this->ledger->quantityLabel($movement->quantity, $movement->unit),
                    'to_stage' => $movement->destinationStage?->name,
                    'output_label' => $movement->output_quantity === null
                        ? null
                        : $this->ledger->quantityLabel($movement->output_quantity, $movement->unit),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array{date: string|null, quantity_label: string, stage: string|null}|null
     */
    private function receiptRow(TraceabilityLot $lot): ?array
    {
        if ($lot->inventory === null) {
            return null;
        }

        $receipt = $this->receipts($lot->inventory)->sortBy('movement_date')->first();

        if ($receipt === null) {
            return null;
        }

        $receipt->loadMissing('destinationStage');

        return [
            'date' => $receipt->movement_date?->format('M j, Y'),
            'quantity_label' => $this->ledger->quantityLabel($receipt->quantity, $receipt->unit),
            'stage' => $receipt->destinationStage?->name,
        ];
    }

    /**
     * @return list<array{title: string, date: string|null, detail: string}>
     */
    private function timeline(TraceabilityLot $lot, ?Farm $farm): array
    {
        $items = [];

        if ($farm !== null) {
            $items[] = [
                'title' => 'Farm origin',
                'date' => $farm->created_at?->format('M j, Y'),
                'detail' => collect([$farm->displayName(), $farm->locationLabel()])->filter()->implode(' · '),
            ];
        }

        if ($lot->harvest !== null) {
            $items[] = [
                'title' => 'Harvest',
                'date' => $lot->harvest->harvest_date?->format('M j, Y'),
                'detail' => $this->ledger->quantityLabel($lot->harvest->quantity, $lot->harvest->unit)
                    .' · '.$lot->harvest->status->label(),
            ];
        }

        $receipt = $this->receiptRow($lot);

        if ($receipt !== null) {
            $items[] = [
                'title' => 'Inventory receipt',
                'date' => $receipt['date'],
                'detail' => $receipt['quantity_label'].' · '.($receipt['stage'] ?? 'Inventory'),
            ];
        }

        foreach ($this->journeyRows($lot) as $step) {
            $items[] = [
                'title' => trim(($step['from_stage'] ?? 'Coffee').' → '.($step['to_stage'] ?? 'Next stage')),
                'date' => $step['date'],
                'detail' => $step['input_label'].' → '.($step['output_label'] ?? $step['input_label']),
            ];
        }

        $items[] = [
            'title' => 'Current stage',
            'date' => $lot->created_at?->format('M j, Y'),
            'detail' => $this->ledger->quantityLabel($lot->quantity, $lot->unit)
                .' · '.($lot->inventory?->stage?->name ?? 'Coffee'),
        ];

        return $items;
    }

    /**
     * @return array<string, mixed>
     */
    private function event(
        TraceabilityLot $lot,
        TraceabilityEventType $type,
        ?string $date,
        string $referenceType,
        ?int $referenceId,
        ?int $userId,
    ): array {
        return [
            'traceability_lot_id' => $lot->id,
            'event_type' => $type->value,
            'event_date' => $date,
            'quantity' => null,
            'unit' => null,
            'source_reference_type' => $referenceType,
            'source_reference_id' => $referenceId,
            'description' => null,
            'created_by' => $userId,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    /**
     * @return Collection<int, InventoryMovement>
     */
    private function processingMovements(Inventory $inventory): Collection
    {
        return $this->ancestorMovements($inventory, InventoryMovementType::Processing)
            ->sortBy([
                ['movement_date', 'asc'],
                ['id', 'asc'],
            ])
            ->values();
    }

    /**
     * @return Collection<int, InventoryMovement>
     */
    private function receipts(Inventory $inventory): Collection
    {
        $ancestorIds = $this->ancestorIds($inventory);

        return InventoryMovement::query()
            ->with(['destinationStage'])
            ->where('movement_type', InventoryMovementType::Receipt)
            ->whereIn('inventory_id', $ancestorIds)
            ->orderBy('movement_date')
            ->orderBy('id')
            ->get();
    }

    /**
     * @return Collection<int, InventoryMovement>
     */
    private function ancestorMovements(Inventory $inventory, InventoryMovementType $type): Collection
    {
        $pending = [$inventory->id];
        $seen = [];
        $movements = collect();

        while ($pending !== []) {
            $current = array_shift($pending);

            if (isset($seen[$current])) {
                continue;
            }

            $seen[$current] = true;
            $batch = InventoryMovement::query()
                ->with(['sourceStage', 'destinationStage'])
                ->where('destination_inventory_id', $current)
                ->where('movement_type', $type)
                ->get();

            foreach ($batch as $movement) {
                $movements->push($movement);

                if ($movement->inventory_id !== null) {
                    $pending[] = $movement->inventory_id;
                }
            }
        }

        return $movements;
    }

    /**
     * @return list<int>
     */
    private function ancestorIds(Inventory $inventory): array
    {
        $ids = [$inventory->id];

        foreach ($this->ancestorMovements($inventory, InventoryMovementType::Processing) as $movement) {
            if ($movement->inventory_id !== null) {
                $ids[] = $movement->inventory_id;
            }
        }

        return array_values(array_unique($ids));
    }

    private function verificationLabel(FarmVerificationStatus $status): string
    {
        return match ($status) {
            FarmVerificationStatus::Pending => 'Pending',
            FarmVerificationStatus::InProgress => 'In progress',
            FarmVerificationStatus::Verified => 'Verified',
            FarmVerificationStatus::Failed => 'Failed',
            FarmVerificationStatus::NeedsReview => 'Needs review',
        };
    }
}
