<?php

namespace App\Models;

use App\ActivityStatus;
use App\CropType;
use Database\Factories\FarmActivityFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Operational history for one farm. Recording an activity does not
 * change the farm's declared area, measured area, or verification.
 *
 * @property ActivityStatus $status
 * @property CropType|null $crop_type
 */
#[Fillable([
    'farm_id',
    'activity_type_id',
    'crop_type',
    'activity_date',
    'status',
    'description',
    'performed_by',
    'quantity',
    'unit',
    'cost_amount',
    'remarks',
    'created_by',
])]
class FarmActivity extends Model
{
    /** @use HasFactory<FarmActivityFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'crop_type' => CropType::class,
            'activity_date' => 'date',
            'status' => ActivityStatus::class,
            'quantity' => 'decimal:2',
            'cost_amount' => 'decimal:2',
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
     * @return BelongsTo<ActivityType, $this>
     */
    public function activityType(): BelongsTo
    {
        return $this->belongsTo(ActivityType::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Compact row for dashboards and farmer summaries.
     *
     * @return array{id: int, activity_date: string|null, farm_id: int, farm_name: string, activity: string|null, status: string, status_label: string}
     */
    public function summaryRow(): array
    {
        return [
            'id' => $this->id,
            'activity_date' => $this->activity_date?->format('M j, Y'),
            'farm_id' => $this->farm_id,
            'farm_name' => $this->farm?->displayName() ?? 'Farm',
            'activity' => $this->activityType?->name,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
        ];
    }

    public function cropLabel(): string
    {
        return $this->crop_type?->label() ?? 'Farm-wide';
    }

    public function costLabel(): string
    {
        if ($this->cost_amount === null) {
            return '—';
        }

        return '₱'.number_format((float) $this->cost_amount, 2);
    }

    /**
     * @return array<string, mixed>
     */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'activity_date' => $this->activity_date?->format('M j, Y'),
            'activity_date_long' => $this->activity_date?->format('F j, Y'),
            'activity_date_input' => $this->activity_date?->format('Y-m-d'),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'description' => $this->description,
            'performed_by' => $this->performed_by,
            'quantity' => $this->quantity === null ? null : (float) $this->quantity,
            'quantity_label' => $this->quantity === null
                ? '—'
                : rtrim(rtrim(number_format((float) $this->quantity, 2, '.', ''), '0'), '.'),
            'unit' => $this->unit,
            'cost' => $this->costLabel(),
            'cost_amount' => $this->cost_amount === null ? null : (float) $this->cost_amount,
            'remarks' => $this->remarks,
            'crop_type' => $this->crop_type?->value,
            'crop_label' => $this->cropLabel(),
            'activity_type_id' => $this->activity_type_id,
            'activity_type' => $this->activityType?->name,
            'farm' => $this->farm === null ? null : [
                'id' => $this->farm->id,
                'farm_id' => $this->farm->farm_id,
                'farm_name' => $this->farm->displayName(),
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
