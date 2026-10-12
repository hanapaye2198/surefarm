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
 */
#[Fillable([
    'farm_id',
    'verification_reference',
    'previous_status',
    'declared_area_hectares',
    'measured_area_hectares',
    'difference_hectares',
    'variance_percentage',
    'result',
    'remarks',
    'inspection_checklist',
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
            'inspection_checklist' => 'array',
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

    /**
     * @return HasMany<FarmVerificationPhoto, $this>
     */
    public function photos(): HasMany
    {
        return $this->hasMany(FarmVerificationPhoto::class);
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
     *     verified_by: string|null,
     *     remarks: string|null
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
            'difference' => $this->difference_hectares === null
                ? null
                : number_format((float) $this->difference_hectares, 2, '.', '').' ha',
            'variance' => $this->variance_percentage === null
                ? null
                : number_format((float) $this->variance_percentage, 2, '.', '').'%',
            'verified_by' => $this->verifier?->name,
            'remarks' => $this->remarks,
            'inspection_checklist' => $this->inspection_checklist ?? [],
            'photos' => $this->relationLoaded('photos')
                ? $this->photos->map(fn (FarmVerificationPhoto $photo): array => $photo->present())->values()->all()
                : [],
        ];
    }
}
