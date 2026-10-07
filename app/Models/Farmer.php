<?php

namespace App\Models;

use App\FarmerStatus;
use Database\Factories\FarmerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property FarmerStatus $status
 * @property int $farms_count
 */
#[Fillable([
    'farmer_id',
    'first_name',
    'middle_name',
    'last_name',
    'date_of_birth',
    'government_id',
    'photo_path',
    'purok_sitio',
    'barangay',
    'municipality',
    'province',
    'mobile_number',
    'email',
    'cooperative_id',
    'status',
])]
class Farmer extends Model
{
    /** @use HasFactory<FarmerFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => FarmerStatus::class,
            'date_of_birth' => 'date',
        ];
    }

    /**
     * @return HasOne<FarmerSpouse, $this>
     */
    public function spouse(): HasOne
    {
        return $this->hasOne(FarmerSpouse::class);
    }

    /**
     * @return HasOne<FarmerBankAccount, $this>
     */
    public function bankAccount(): HasOne
    {
        return $this->hasOne(FarmerBankAccount::class);
    }

    /**
     * @return BelongsTo<Cooperative, $this>
     */
    public function cooperative(): BelongsTo
    {
        return $this->belongsTo(Cooperative::class);
    }

    /**
     * @return HasMany<Farm, $this>
     */
    public function farms(): HasMany
    {
        return $this->hasMany(Farm::class);
    }

    public function fullName(): string
    {
        return collect([$this->first_name, $this->middle_name, $this->last_name])
            ->filter()
            ->implode(' ');
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
}
