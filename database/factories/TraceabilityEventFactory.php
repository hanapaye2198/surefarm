<?php

namespace Database\Factories;

use App\Models\TraceabilityEvent;
use App\Models\TraceabilityLot;
use App\TraceabilityEventType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TraceabilityEvent>
 */
class TraceabilityEventFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'traceability_lot_id' => TraceabilityLot::factory(),
            'event_type' => TraceabilityEventType::TraceabilityCreated,
            'event_date' => now()->toDateString(),
            'quantity' => null,
            'unit' => null,
            'source_reference_type' => null,
            'source_reference_id' => null,
            'description' => null,
            'created_by' => null,
        ];
    }
}
