<?php

namespace App\Models;

use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use Database\Factories\FarmVerificationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A historical verification attempt. Declared area on this record is a
 * snapshot. It must not be written back to the farm.
 *
 * @property FarmVerificationStatus|null $previous_status
 * @property FarmVerificationResult|null $result
 * @property array<string, mixed>|null $inspection_checklist
 * @property array<string, mixed>|null $boundary_geojson
 * @property array<int, float|null>|null $gps_point_accuracies
 * @property array<int, string>|null $gps_point_captured_at
 * @property string|null $boundary_capture_method
 * @property bool $mobile_workflow
 */
#[Fillable([
    'farm_id',
    'verification_reference',
    'previous_status',
    'declared_area_hectares',
    'measured_area_hectares',
    'difference_hectares',
    'variance_percentage',
    'boundary_geojson',
    'gps_point_accuracies',
    'gps_point_captured_at',
    'boundary_capture_method',
    'previous_boundary_geojson',
    'previous_gps_point_accuracies',
    'previous_gps_point_captured_at',
    'previous_boundary_capture_method',
    'previous_boundary_captured_at',
    'previous_measured_area_hectares',
    'boundary_captured_at',
    'boundary_captured_by',
    'boundary_revision',
    'started_by',
    'started_at',
    'result',
    'remarks',
    'inspection_checklist',
    'mobile_workflow',
    'verified_by',
    'verified_at',
])]
class FarmVerification extends Model
{
    /** @use HasFactory<FarmVerificationFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'previous_status' => FarmVerificationStatus::class,
            'declared_area_hectares' => 'decimal:2',
            'measured_area_hectares' => 'decimal:2',
            'difference_hectares' => 'decimal:2',
            'variance_percentage' => 'decimal:2',
            'boundary_geojson' => 'array',
            'gps_point_accuracies' => 'array',
            'gps_point_captured_at' => 'array',
            'previous_gps_point_captured_at' => 'array',
            'previous_boundary_geojson' => 'array',
            'previous_gps_point_accuracies' => 'array',
            'previous_measured_area_hectares' => 'decimal:2',
            'boundary_captured_at' => 'datetime',
            'previous_boundary_captured_at' => 'datetime',
            'boundary_revision' => 'integer',
            'started_at' => 'datetime',
            'inspection_checklist' => 'array',
            'mobile_workflow' => 'boolean',
            'result' => FarmVerificationResult::class,
            'verified_at' => 'datetime',
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
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /** @return BelongsTo<User, $this> */
    public function starter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'started_by');
    }

    /** @return BelongsTo<User, $this> */
    public function boundaryCapturer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'boundary_captured_by');
    }

    /**
     * @return HasMany<FarmVerificationPhoto, $this>
     */
    public function photos(): HasMany
    {
        return $this->hasMany(FarmVerificationPhoto::class);
    }

    public function hasFreshBoundaryCapture(): bool
    {
        if (! ((int) $this->boundary_revision > 0
            && $this->boundary_captured_at !== null
            && $this->started_at !== null
            && $this->boundary_captured_at->greaterThanOrEqualTo($this->started_at)
            && $this->boundary_capture_method === 'device_gps')) {
            return false;
        }

        $ring = $this->boundary_geojson['coordinates'][0] ?? null;
        $timestamps = $this->gps_point_captured_at;

        if (! is_array($ring) || count($ring) < 4 || ! is_array($timestamps)) {
            return false;
        }

        $pointCount = count($ring) - 1;

        if (count($timestamps) !== $pointCount) {
            return false;
        }

        foreach ($timestamps as $timestamp) {
            try {
                if (! is_string($timestamp)) {
                    return false;
                }

                // Point times come from the verifier's device and can drift
                // from the server clock. Parse them as reported metadata, but
                // use the server-recorded boundary_captured_at above to decide
                // whether this boundary belongs to the current attempt.
                \Illuminate\Support\Carbon::parse($timestamp);
            } catch (\Throwable) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array{
     *     id: int,
     *     date: string,
     *     reference: string,
     *     previous_status: string|null,
     *     result: string|null,
     *     declared_area: string,
     *     measured_area: string|null,
     *     difference: string|null,
     *     variance: string|null,
     *     boundary_captured_by: string|null,
     *     verified_by: string|null,
     *     remarks: string|null,
     *     boundary_geojson: array<string, mixed>|null,
     *     gps_point_accuracies: array<int, float|null>|null,
     *     previous_boundary_geojson: array<string, mixed>|null,
     *     previous_gps_point_accuracies: array<int, float|null>|null,
     *     boundary_revision: int,
     *     boundary_captured_at: string|null,
     *     started_by: string|null,
     *     started_at: string|null
     * }
     */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'date' => ($this->verified_at ?? $this->created_at)?->format('M j, Y') ?? '—',
            'reference' => $this->verification_reference,
            'previous_status' => $this->previous_status?->value,
            'result' => $this->result?->value,
            'declared_area' => number_format((float) $this->declared_area_hectares, 2, '.', '').' ha',
            'measured_area' => $this->measured_area_hectares === null
                ? null
                : number_format((float) $this->measured_area_hectares, 2, '.', '').' ha',
            'verified_area' => $this->result === FarmVerificationResult::Verified
                && $this->measured_area_hectares !== null
                    ? number_format((float) $this->measured_area_hectares, 2, '.', '').' ha'
                    : null,
            'difference' => $this->difference_hectares === null
                ? null
                : number_format((float) $this->difference_hectares, 2, '.', '').' ha',
            'variance' => $this->variance_percentage === null
                ? null
                : number_format((float) $this->variance_percentage, 2, '.', '').'%',
            'verified_by' => $this->verifier?->name,
            'remarks' => $this->remarks,
            'boundary_geojson' => $this->boundary_geojson,
            'gps_point_accuracies' => $this->gps_point_accuracies,
            'gps_point_captured_at' => $this->gps_point_captured_at,
            'boundary_capture_method' => $this->boundary_capture_method,
            'previous_boundary_geojson' => $this->previous_boundary_geojson,
            'previous_gps_point_accuracies' => $this->previous_gps_point_accuracies,
            'previous_gps_point_captured_at' => $this->previous_gps_point_captured_at,
            'previous_boundary_capture_method' => $this->previous_boundary_capture_method,
            'previous_boundary_captured_at' => $this->previous_boundary_captured_at?->toIso8601String(),
            'boundary_revision' => (int) $this->boundary_revision,
            'boundary_captured_at' => $this->boundary_captured_at?->format('M j, Y g:i A'),
            'boundary_captured_by' => $this->boundaryCapturer?->name,
            'started_by' => $this->starter?->name,
            'started_at' => $this->started_at?->format('M j, Y g:i A'),
            'inspection_checklist' => $this->inspection_checklist ?? [],
            'photos' => $this->relationLoaded('photos')
                ? $this->photos->map(fn (FarmVerificationPhoto $photo): array => $photo->present())->values()->all()
                : [],
        ];
    }
}
