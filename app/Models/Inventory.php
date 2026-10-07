<?php

namespace App\Models;

use App\CropType;
use App\InventoryStatus;
use App\Services\ProductionLedger;
use Database\Factories\InventoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property CropType|null $crop_type
 * @property InventoryStatus $status
 */
#[Fillable([
    'farmer_id',
    'farm_id',
    'harvest_id',
    'processing_stage_id',
    'crop_type',
    'quantity',
    'unit',
    'status',
    'location',
    'received_date',
    'notes',
])]
class Inventory extends Model
{
    /** @use HasFactory<InventoryFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'crop_type' => CropType::class,
            'quantity' => 'decimal:2',
            'status' => InventoryStatus::class,
            'received_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Farmer, $this>
     */
    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    /**
     * @return BelongsTo<Farm, $this>
     */
    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
    }

    /**
     * @return BelongsTo<FarmHarvest, $this>
     */
    public function harvest(): BelongsTo
    {
        return $this->belongsTo(FarmHarvest::class, 'harvest_id');
    }

    /**
     * @return BelongsTo<InventoryProcessingStage, $this>
     */
    public function stage(): BelongsTo
    {
        return $this->belongsTo(InventoryProcessingStage::class, 'processing_stage_id');
    }

    /**
     * @return HasMany<InventoryMovement, $this>
     */
    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function quantityLabel(): string
    {
        return app(ProductionLedger::class)->quantityLabel($this->quantity, $this->unit);
    }

    public function harvestLabel(): ?string
    {
        if ($this->harvest_id === null) {
            return null;
        }

        return 'Harvest #'.str_pad((string) $this->harvest_id, 3, '0', STR_PAD_LEFT);
    }

    /**
     * @return array<string, mixed>
     */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'received_date' => $this->received_date?->format('M j, Y'),
            'received_date_long' => $this->received_date?->format('F j, Y'),
            'received_date_input' => $this->received_date?->format('Y-m-d'),
            'quantity' => (float) $this->quantity,
            'quantity_label' => $this->quantityLabel(),
            'unit' => $this->unit,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'location' => $this->location,
            'notes' => $this->notes,
            'crop_label' => $this->crop_type?->label() ?? $this->farm?->crop_type->label() ?? 'Coffee',
            'stage' => $this->stage === null ? null : [
                'id' => $this->stage->id,
                'name' => $this->stage->name,
                'code' => $this->stage->code,
                'sequence' => $this->stage->sequence,
            ],
            'farmer' => $this->farmer === null ? null : [
                'id' => $this->farmer->id,
                'farmer_id' => $this->farmer->farmer_id,
                'name' => $this->farmer->fullName(),
            ],
            'farm' => $this->farm === null ? null : [
                'id' => $this->farm->id,
                'farm_id' => $this->farm->farm_id,
                'farm_name' => $this->farm->displayName(),
            ],
            'harvest' => $this->harvest_id === null ? null : [
                'id' => $this->harvest_id,
                'label' => $this->harvestLabel(),
                'harvest_date' => $this->harvest?->harvest_date?->format('F j, Y'),
                'quantity_label' => $this->harvest?->quantityLabel(),
            ],
        ];
    }
}
