<?php

namespace App\Models;

use App\CropRecordStatus;
use App\CropType;
use App\Models\Concerns\VisibleToRegistry;
use Database\Factories\FarmCropFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Crop details recorded for one registered farm. The crop type must
 * stay the crop already stored on that farm.
 *
 * @property CropType $crop_type
 * @property CropRecordStatus $status
 * @property Carbon|null $planted_on
 */
#[Fillable([
    'farm_id',
    'crop_type',
    'variety',
    'area_hectares',
    'planted_on',
    'status',
    'notes',
])]
class FarmCrop extends Model
{
    /** @use HasFactory<FarmCropFactory> */
    use HasFactory, VisibleToRegistry;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'crop_type' => CropType::class,
            'area_hectares' => 'decimal:2',
            'planted_on' => 'date',
            'status' => CropRecordStatus::class,
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
     * @return array<string, mixed>
     */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'crop_type' => $this->crop_type->value,
            'crop_label' => $this->crop_type->label(),
            'variety' => $this->variety,
            'area_hectares' => $this->area_hectares === null ? null : (float) $this->area_hectares,
            'area_input' => $this->area_hectares === null
                ? ''
                : number_format((float) $this->area_hectares, 2, '.', ''),
            'area_label' => $this->area_hectares === null
                ? null
                : number_format((float) $this->area_hectares, 2).' ha',
            'planted_on' => $this->planted_on?->toDateString(),
            'planted_on_label' => $this->planted_on?->format('M j, Y'),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'notes' => $this->notes,
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
