<?php

namespace App\Models;

use App\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property UserRole $role
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $suspended_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property int $open_assignments_count
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /**
     * Least privilege when a caller forgets to assign a role.
     * The users table uses the same default.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'role' => 'farmer',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'suspended_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /**
     * The optional farmer profile owned by this login.
     *
     * @return HasOne<Farmer, $this>
     */
    public function farmer(): HasOne
    {
        return $this->hasOne(Farmer::class);
    }

    /**
     * @return HasOne<Farmer, $this>
     */
    public function farmerProfile(): HasOne
    {
        return $this->farmer();
    }

    /**
     * @return HasMany<CooperativeOfficer, $this>
     */
    public function cooperativeOfficers(): HasMany
    {
        return $this->hasMany(CooperativeOfficer::class);
    }

    /**
     * @return HasMany<RegistryGrant, $this>
     */
    public function registryGrants(): HasMany
    {
        return $this->hasMany(RegistryGrant::class);
    }

    /**
     * @return HasMany<FarmVerifierAssignment, $this>
     */
    public function farmAssignments(): HasMany
    {
        return $this->hasMany(FarmVerifierAssignment::class);
    }

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    public function requiresConfirmedTwoFactor(): bool
    {
        return $this->role->requiresConfirmedTwoFactor();
    }

    public function hasConfirmedTwoFactor(): bool
    {
        return $this->two_factor_confirmed_at !== null;
    }

    /**
     * True when no other active administrator would remain.
     * Pass $lock from inside a transaction that must not race.
     */
    public function isLastActiveAdministrator(bool $lock = false): bool
    {
        if ($this->role !== UserRole::Admin || $this->isSuspended()) {
            return false;
        }

        $others = self::query()
            ->where('role', UserRole::Admin)
            ->whereNull('suspended_at')
            ->whereKeyNot($this->id)
            ->when($lock, fn ($query) => $query->lockForUpdate());

        return $others->doesntExist();
    }

    public function hasRole(UserRole ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    /**
     * Administrators can open every role-restricted page.
     */
    public function canAccess(UserRole ...$roles): bool
    {
        if ($this->role === UserRole::Admin) {
            return true;
        }

        return $this->hasRole(...$roles);
    }
}
