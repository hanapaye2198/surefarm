<?php

namespace App\Models;

use App\ProcessingStageStatus;
use Database\Factories\InventoryProcessingStageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property ProcessingStageStatus $status
 */
#[Fillable([
    'name',
    'code',
    'description',
    'sequence',
    'status',
])]
class InventoryProcessingStage extends Model
{
    /** @use HasFactory<InventoryProcessingStageFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'status' => ProcessingStageStatus::class,
        ];
    }

    /**
     * @return HasMany<Inventory, $this>
     */
    public function inventories(): HasMany
    {
        return $this->hasMany(Inventory::class, 'processing_stage_id');
    }

    public static function coffeeCherry(): ?self
    {
        return self::query()->where('code', 'COFFEE_CHERRY')->first();
    }
}
