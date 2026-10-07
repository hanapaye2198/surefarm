<?php

namespace App\Models;

use Database\Factories\FarmBoundaryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * The web-map polygon for a farm. Measured area lives here and must
 * not be copied onto farms.declared_area_hectares.
 *
 * @property array{type: string, coordinates: array<int, array<int, array<int, float>>>} $boundary_geojson
 * @property string|null $gps_measured_area_hectares
 * @property Carbon|null $captured_at
 */
#[Fillable([
    'farm_id',
    'boundary_geojson',
    'gps_measured_area_hectares',
    'created_by',
    'updated_by',
    'captured_at',
])]
class FarmBoundary extends Model
{
    /** @use HasFactory<FarmBoundaryFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'boundary_geojson' => 'array',
            'gps_measured_area_hectares' => 'decimal:2',
            'captured_at' => 'datetime',
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
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
