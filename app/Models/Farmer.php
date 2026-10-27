<?php

namespace App\Models;

use App\FarmerStatus;
use App\Models\Concerns\VisibleToRegistry;
use Database\Factories\FarmerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property FarmerStatus $status
 * @property string|null $government_id
 * @property int $farms_count
 */
#[Fillable([
    'farmer_id',
    'first_name',
    'middle_name',
    'last_name',
    'suffix',
    'date_of_birth',
    'government_id',
    'photo_path',
    'purok_sitio',
    'sitio_purok_code',
    'barangay_code',
    'lgu_code',
    'security_control_code',
    'barangay',
    'municipality',
    'province',
    'mobile_number',
    'email',
    'cooperative_id',
    'user_id',
    'status',
])]
#[Hidden(['government_id'])]
class Farmer extends Model
{
    /** @use HasFactory<FarmerFactory> */
    use HasFactory, VisibleToRegistry;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => FarmerStatus::class,
            'date_of_birth' => 'date',
            'government_id' => 'encrypted',
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
     * @return HasMany<FarmerWalletTransaction, $this>
     */
    public function walletTransactions(): HasMany
    {
        return $this->hasMany(FarmerWalletTransaction::class);
    }

    /**
     * @return BelongsTo<Cooperative, $this>
     */
    public function cooperative(): BelongsTo
    {
        return $this->belongsTo(Cooperative::class);
    }

    /**
     * @return HasMany<CooperativeMembership, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(CooperativeMembership::class);
    }

    /**
     * @return HasMany<Farm, $this>
     */
    public function farms(): HasMany
    {
        return $this->hasMany(Farm::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function fullName(): string
    {
        return collect([$this->first_name, $this->middle_name, $this->last_name, $this->suffix])
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
