<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'farm_id',
    'previous_area_hectares',
    'declared_area_hectares',
    'event_type',
    'recorded_by',
    'recorded_at',
])]
class FarmAreaDeclaration extends Model
{
    protected function casts(): array
    {
        return [
            'previous_area_hectares' => 'decimal:2',
            'declared_area_hectares' => 'decimal:2',
            'recorded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Farm, $this> */
    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
    }

    /** @return BelongsTo<User, $this> */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /** @return array<string, mixed> */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'previous_area_hectares' => $this->previous_area_hectares === null
                ? null
                : (float) $this->previous_area_hectares,
            'declared_area_hectares' => (float) $this->declared_area_hectares,
            'event_type' => $this->event_type,
            'recorded_by' => $this->recorder?->name,
            'recorded_at' => $this->recorded_at?->format('M j, Y g:i A'),
        ];
    }
}
