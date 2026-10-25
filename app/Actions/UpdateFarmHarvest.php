<?php

namespace App\Actions;

use App\AccessEventAction;
use App\HarvestStatus;
use App\Models\FarmHarvest;
use App\Models\User;
use App\Services\InventoryStock;
use App\Support\DecimalQuantity;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class UpdateFarmHarvest
{
    public function __construct(
        private InventoryStock $stock,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * Correct a harvest in place. The farm, production link, creator,
     * and original created_at are preserved. A harvest that has already
     * been received cannot change unit or drop below the received quantity.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(FarmHarvest $harvest, array $data, ?User $actor = null): FarmHarvest
    {
        return DB::transaction(function () use ($harvest, $data, $actor): FarmHarvest {
            $harvest = FarmHarvest::query()->whereKey($harvest->id)->lockForUpdate()->firstOrFail();
            $received = $this->stock->receivedCents($harvest);

            if ($received > 0) {
                if (($data['unit'] ?? null) !== $harvest->unit) {
                    throw ValidationException::withMessages([
                        'unit' => 'The unit cannot change after coffee from this harvest has been received.',
                    ]);
                }

                try {
                    $quantity = DecimalQuantity::cents($data['quantity'] ?? null);
                } catch (InvalidArgumentException) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Quantity must be a number with at most 2 decimal places.',
                    ]);
                }

                if ($quantity < $received) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Quantity cannot be less than the amount already received into inventory.',
                    ]);
                }

                $status = $data['status'] instanceof HarvestStatus ? $data['status']->value : (string) ($data['status'] ?? '');

                if ($status !== HarvestStatus::Completed->value) {
                    throw ValidationException::withMessages([
                        'status' => 'A harvest stays completed after coffee has been received into inventory.',
                    ]);
                }
            }

            $before = [
                'quantity' => DecimalQuantity::fromCents(DecimalQuantity::cents($harvest->quantity)),
                'unit' => $harvest->unit,
                'status' => $harvest->status->value,
                'coffee_variety' => $harvest->coffee_variety,
                'estimated_green_bean_quantity_kg' => $harvest->estimated_green_bean_quantity_kg === null
                    ? null
                    : (string) $harvest->estimated_green_bean_quantity_kg,
            ];

            $harvest->update([
                'harvest_date' => $data['harvest_date'],
                'quantity' => $data['quantity'],
                'unit' => $data['unit'],
                'coffee_variety' => $data['coffee_variety'] ?? null,
                'estimated_green_bean_quantity_kg' => $data['estimated_green_bean_quantity_kg'] ?? null,
                'quality_grade' => $data['quality_grade'] ?? null,
                'status' => $data['status'],
                'notes' => $data['notes'] ?? null,
            ]);

            $harvest->refresh();

            if ($actor instanceof User) {
                $after = [
                    'quantity' => DecimalQuantity::fromCents(DecimalQuantity::cents($harvest->quantity)),
                    'unit' => $harvest->unit,
                    'status' => $harvest->status->value,
                    'coffee_variety' => $harvest->coffee_variety,
                    'estimated_green_bean_quantity_kg' => $harvest->estimated_green_bean_quantity_kg === null
                        ? null
                        : (string) $harvest->estimated_green_bean_quantity_kg,
                ];

                if ($before !== $after) {
                    $this->accessEvents->handle($actor, AccessEventAction::HarvestCorrected, null, $harvest, [
                        'quantity_from' => $before['quantity'],
                        'quantity_to' => $after['quantity'],
                        'unit_from' => $before['unit'],
                        'unit_to' => $after['unit'],
                        'status_from' => $before['status'],
                        'status_to' => $after['status'],
                        'variety_from' => $before['coffee_variety'],
                        'variety_to' => $after['coffee_variety'],
                        'green_bean_kg_from' => $before['estimated_green_bean_quantity_kg'],
                        'green_bean_kg_to' => $after['estimated_green_bean_quantity_kg'],
                    ]);
                }
            }

            return $harvest->load(['farm.farmer', 'production', 'creator', 'photos.uploader']);
        });
    }
}
