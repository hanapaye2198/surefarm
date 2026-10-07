<?php

namespace App\Models;

use App\CropType;
use App\HarvestStatus;
use App\Services\ProductionLedger;
use Database\Factories\FarmHarvestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An actual harvest for one farm. Several harvests may belong to the
 * same farm and the same production estimate.
 *
 * @property HarvestStatus $status
 * @property CropType|null $crop_type
 */
#[Fillable([
    'farm_id',
    'crop_type',
    'production_id',
    'harvest_date',
    'quantity',
    'unit',
    'quality_grade',
    'status',
    'notes',
    'created_by',
])]
class FarmHarvest extends Model
{
    /** @use HasFactory<FarmHarvestFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'crop_type' => CropType::class,
            'harvest_date' => 'date',
            'quantity' => 'decimal:2',
            'status' => HarvestStatus::class,
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
     * @return BelongsTo<FarmProduction, $this>
     */
    public function production(): BelongsTo
    {
        return $this->belongsTo(FarmProduction::class, 'production_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function cropLabel(): string
    {
        return $this->crop_type?->label() ?? 'Farm-wide';
    }

    public function quantityLabel(): string
    {
        return app(ProductionLedger::class)->quantityLabel($this->quantity, $this->unit);
    }

    /**
     * @return array{id: int, harvest_date: string|null, farm_name: string, farmer_name: string, crop_label: string, quantity_label: string, status: string, status_label: string}
     */
    public function summaryRow(): array
    {
        return [
            'id' => $this->id,
            'harvest_date' => $this->harvest_date?->format('M j, Y'),
            'farm_name' => $this->farm?->displayName() ?? 'Farm',
            'farmer_name' => $this->farm?->farmer?->fullName() ?? '—',
            'crop_label' => $this->cropLabel(),
            'quantity_label' => $this->quantityLabel(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'harvest_date' => $this->harvest_date?->format('M j, Y'),
            'harvest_date_long' => $this->harvest_date?->format('F j, Y'),
            'harvest_date_input' => $this->harvest_date?->format('Y-m-d'),
            'quantity' => (float) $this->quantity,
            'quantity_input' => number_format((float) $this->quantity, 2, '.', ''),
            'quantity_label' => $this->quantityLabel(),
            'unit' => $this->unit,
            'quality_grade' => $this->quality_grade,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'notes' => $this->notes,
            'crop_type' => $this->crop_type?->value,
            'crop_label' => $this->cropLabel(),
            'production_id' => $this->production_id,
            'production_period' => $this->production?->production_period,
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
            'created_by' => $this->creator?->name,
            'created_at' => $this->created_at?->format('F j, Y'),
        ];
    }
}
