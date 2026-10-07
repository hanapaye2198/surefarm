<?php

namespace App\Models;

use App\CropType;
use App\TraceabilityLotStatus;
use Database\Factories\TraceabilityLotFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property CropType|null $crop_type
 * @property TraceabilityLotStatus $status
 */
#[Fillable([
    'lot_code',
    'farmer_id',
    'farm_id',
    'crop_type',
    'harvest_id',
    'current_inventory_id',
    'quantity',
    'unit',
    'status',
    'notes',
    'created_by',
])]
class TraceabilityLot extends Model
{
    /** @use HasFactory<TraceabilityLotFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'crop_type' => CropType::class,
            'quantity' => 'decimal:2',
            'status' => TraceabilityLotStatus::class,
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
     * @return BelongsTo<Inventory, $this>
     */
    public function inventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class, 'current_inventory_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<TraceabilityEvent, $this>
     */
    public function events(): HasMany
    {
        return $this->hasMany(TraceabilityEvent::class);
    }
}
