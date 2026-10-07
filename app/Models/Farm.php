<?php

namespace App\Models;

use App\CropType;
use App\FarmDevelopmentStage;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\PropertyOwnership;
use Database\Factories\FarmFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property CropType $crop_type
 * @property FarmVerificationStatus $verification_status
 * @property FarmStatus $status
 * @property FarmDevelopmentStage|null $current_stage
 * @property PropertyOwnership|null $property_ownership
 * @property bool|null $data_validated
 */
#[Fillable([
    'farm_id',
    'farmer_id',
    'farm_name',
    'crop_type',
    'declared_area_hectares',
    'verified_area_hectares',
    'purok_sitio',
    'barangay',
    'municipality',
    'province',
    'latitude',
    'longitude',
    'verification_status',
    'status',
    'current_stage',
    'number_of_hills',
    'data_validated',
    'property_ownership',
    'contracted_value_estimated',
    'input_support_amount',
    'financing_support_amount',
    'drone_image_path',
    'notes',
])]
class Farm extends Model
{
    /** @use HasFactory<FarmFactory> */
    use HasFactory;

    /**
     * Declared area is the farmer's declared area. Later GPS and
     * verification values must be stored separately and must not
     * overwrite declared_area_hectares.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'crop_type' => CropType::class,
            'declared_area_hectares' => 'decimal:2',
            'verified_area_hectares' => 'decimal:2',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'verification_status' => FarmVerificationStatus::class,
            'status' => FarmStatus::class,
            'current_stage' => FarmDevelopmentStage::class,
            'property_ownership' => PropertyOwnership::class,
            'contracted_value_estimated' => 'decimal:2',
            'input_support_amount' => 'decimal:2',
            'financing_support_amount' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Farmer, $this>
     */
    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    /**
     * The current web-map boundary. A farm has one boundary.
     * Saving it must not change declared area or verification status.
     *
     * @return HasOne<FarmBoundary, $this>
     */
    public function boundary(): HasOne
    {
        return $this->hasOne(FarmBoundary::class);
    }

    /**
     * Verification attempts, newest first. History is kept when a
     * farm is verified again.
     *
     * @return HasMany<FarmVerification, $this>
     */
    public function verifications(): HasMany
    {
        return $this->hasMany(FarmVerification::class)->latest('id');
    }

    /**
     * @return HasMany<FarmActivity, $this>
     */
    public function activities(): HasMany
    {
        return $this->hasMany(FarmActivity::class);
    }

    /**
     * Expected production estimates. Harvest totals are not stored here.
     *
     * @return HasMany<FarmProduction, $this>
     */
    public function productions(): HasMany
    {
        return $this->hasMany(FarmProduction::class);
    }

    /**
     * Actual harvest transactions for this farm.
     *
     * @return HasMany<FarmHarvest, $this>
     */
    public function harvests(): HasMany
    {
        return $this->hasMany(FarmHarvest::class);
    }

    /**
     * Crop insurance records for this farm. A farmer may have many farms,
     * and each farm keeps its own insurance history.
     *
     * @return HasMany<FarmInsurance, $this>
     */
    public function insurances(): HasMany
    {
        return $this->hasMany(FarmInsurance::class);
    }

    /**
     * Financing grants for this farm. These are not income or expense rows.
     *
     * @return HasMany<FarmFinancing, $this>
     */
    public function financings(): HasMany
    {
        return $this->hasMany(FarmFinancing::class);
    }

    public function displayName(): string
    {
        $name = trim((string) $this->farm_name);

        return $name !== '' ? $name : 'Unnamed farm';
    }

    public function locationLabel(): string
    {
        return collect([$this->municipality, $this->province])
            ->filter()
            ->implode(', ');
    }

    public function addressLabel(): string
    {
        return collect([
            $this->purok_sitio,
            $this->barangay,
            $this->municipality,
            $this->province,
        ])->filter()->implode(', ');
    }

    public function hasGeolocation(): bool
    {
        return $this->latitude !== null && $this->longitude !== null;
    }

    /**
     * Null means the number of hills has not been recorded.
     */
    protected function numberOfHills(): Attribute
    {
        return Attribute::make(
            get: fn (mixed $value): ?int => $value === null ? null : (int) $value,
            set: fn (mixed $value): ?int => $value === null ? null : (int) $value,
        );
    }

    /**
     * Null means the business has not recorded a data-validation answer.
     * False means the answer was No. This is not farm verification.
     */
    protected function dataValidated(): Attribute
    {
        return Attribute::make(
            get: function (mixed $value): ?bool {
                if ($value === null) {
                    return null;
                }

                return (bool) $value;
            },
            set: fn (mixed $value): ?bool => $value === null ? null : (bool) $value,
        );
    }
}
