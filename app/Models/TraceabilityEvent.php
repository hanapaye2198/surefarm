<?php

namespace App\Models;

use App\TraceabilityEventType;
use Database\Factories\TraceabilityEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property TraceabilityEventType $event_type
 */
#[Fillable([
    'traceability_lot_id',
    'event_type',
    'event_date',
    'quantity',
    'unit',
    'source_reference_type',
    'source_reference_id',
    'description',
    'created_by',
])]
class TraceabilityEvent extends Model
{
    /** @use HasFactory<TraceabilityEventFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'event_type' => TraceabilityEventType::class,
            'event_date' => 'date',
            'quantity' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<TraceabilityLot, $this>
     */
    public function lot(): BelongsTo
    {
        return $this->belongsTo(TraceabilityLot::class, 'traceability_lot_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
