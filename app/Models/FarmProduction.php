<?php

namespace App\Models;

use App\CropType;
use App\HarvestStatus;
use App\ProductionStatus;
use App\Services\ProductionLedger;
use Database\Factories\FarmProductionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Expected production for one farm. Editing this estimate does not
 * rewrite harvest history.
 *
 * @property ProductionStatus $status
 * @property CropType|null $crop_type
 */
#[Fillable([
    'farm_id',
    'crop_type',
    'production_period',
    'expected_quantity',
    'unit',
    'notes',
    'status',
])]
class FarmProduction extends Model
{
    /** @use HasFactory<FarmProductionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'crop_type' => CropType::class,
            'expected_quantity' => 'decimal:2',
            'status' => ProductionStatus::class,
        ];
    }

    /**
     * @return BelongsTo<Farm, $this>
     */
    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
    }

    /**
     * Actual harvests recorded against this estimate.
     *
     * @return HasMany<FarmHarvest, $this>
     */
    public function harvests(): HasMany
    {
        return $this->hasMany(FarmHarvest::class, 'production_id');
    }

    public function cropLabel(): string
    {
        return $this->crop_type?->label() ?? 'Farm-wide';
    }

    /**
     * Completed harvests that use the same unit. Other units are not converted.
     */
    public function harvestedQuantity(): float
    {
        if (array_key_exists('harvested_quantity', $this->attributes)) {
            return round((float) $this->attributes['harvested_quantity'], 2);
        }

        return round((float) $this->harvests()
            ->where('status', HarvestStatus::Completed)
            ->where('unit', $this->unit)
            ->sum('quantity'), 2);
    }

    /**
     * @return array<string, mixed>
     */
    public function present(): array
    {
        $balance = app(ProductionLedger::class)->compare(
            $this->expected_quantity,
            $this->harvestedQuantity(),
            $this->unit,
        );

        return [
            'id' => $this->id,
            'production_period' => $this->production_period,
            'expected_quantity' => $this->expected_quantity === null ? null : (float) $this->expected_quantity,
            'expected_input' => $this->expected_quantity === null
                ? ''
                : number_format((float) $this->expected_quantity, 2, '.', ''),
            'expected_label' => $balance['expected_label'],
            'unit' => $this->unit,
            'notes' => $this->notes,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'crop_type' => $this->crop_type?->value,
            'crop_label' => $this->cropLabel(),
            'harvested_quantity' => $balance['actual'],
            'harvested_label' => $balance['actual_label'],
            'remaining_label' => $balance['remaining_label'],
            'exceeds' => $balance['exceeds'],
            'progress' => $balance['progress'],
            'message' => $balance['message'],
            'farm' => $this->farm === null ? null : [
                'id' => $this->farm->id,
                'farm_id' => $this->farm->farm_id,
                'farm_name' => $this->farm->displayName(),
                'crop_type' => $this->farm->crop_type->value,
                'crop_label' => $this->farm->crop_type->label(),
            ],
            'farmer' => $this->farm?->farmer === null ? null : [
                'id' => $this->farm->farmer->id,
                'name' => $this->farm->farmer->fullName(),
            ],
        ];
    }
}
