<?php

namespace App\Services;

use App\Models\CooperativeOfficer;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\FarmHarvest;
use App\Models\FarmProduction;
use App\Models\FarmVerifierAssignment;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\RegistryGrant;
use App\Models\TraceabilityLot;
use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * Record scope is separate from role permissions.
 *
 * An administrator or operations account sees the national registry only
 * when an open platform grant exists. A province grant limits both roles
 * to that province. A field verifier sees assigned farms only, even if a
 * platform grant was recorded by mistake. A cooperative officer sees
 * farmers whose current cooperative is one they are assigned to. A farmer
 * sees the farmer record linked to the account, and nothing matched by
 * name or phone.
 */
class RegistryScope
{
    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public function constrain(Builder $query, User $user): Builder
    {
        if ($user->isSuspended()) {
            $query->whereRaw('0 = 1');

            return $query;
        }

        $model = $query->getModel();

        if ($model instanceof InventoryMovement) {
            $query->whereHas(
                'inventory',
                function (Builder $inventory) use ($user): void {
                    $this->constrain($inventory, $user);
                },
            );

            return $query;
        }

        if ($this->seesEntireRegistry($user)) {
            return $query;
        }

        if ($model instanceof Farmer) {
            return $this->constrainFarmers($query, $user);
        }

        if ($model instanceof Farm) {
            return $this->constrainFarms($query, $user);
        }

        if ($model instanceof FarmActivity || $model instanceof FarmHarvest || $model instanceof FarmProduction) {
            $query->whereIn($query->qualifyColumn('farm_id'), $this->visibleFarmIds($user));

            return $query;
        }

        if ($model instanceof Inventory || $model instanceof TraceabilityLot) {
            return $this->constrainFarmOrFarmer($query, $user);
        }

        $query->whereRaw('0 = 1');

        return $query;
    }

    public function seesEntireRegistry(User $user): bool
    {
        if ($user->isSuspended() || ! $user->hasRole(UserRole::Admin, UserRole::Operations)) {
            return false;
        }

        return $this->openGrants($user)
            ->where('kind', RegistryGrantKind::Platform)
            ->exists();
    }

    public function canViewFarmer(User $user, Farmer $farmer): bool
    {
        return Farmer::query()->whereKey($farmer->id)->visibleTo($user)->exists();
    }

    public function canViewFarm(User $user, Farm $farm): bool
    {
        if ($user->isSuspended()) {
            return false;
        }

        if ($user->role === UserRole::FieldVerifier && $farm->assigned_verifier_id === $user->id) {
            return true;
        }

        return Farm::query()->whereKey($farm->id)->visibleTo($user)->exists();
    }

    public function ensureProvince(User $user, ?string $province): void
    {
        if ($this->seesEntireRegistry($user) || $this->provinceIsAssigned($user, $province)) {
            return;
        }

        throw ValidationException::withMessages([
            'province' => 'That province is outside your assignment.',
        ]);
    }

    public function provinceIsAssigned(User $user, ?string $province): bool
    {
        if ($this->seesEntireRegistry($user)) {
            return true;
        }

        $province = trim((string) $province);

        if ($province === '' || ! $user->hasRole(UserRole::Admin, UserRole::Operations)) {
            return false;
        }

        return $this->openGrants($user)
            ->where('kind', RegistryGrantKind::Province)
            ->where('province', $province)
            ->exists();
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function constrainFarmers(Builder $query, User $user): Builder
    {
        match ($user->role) {
            UserRole::Admin, UserRole::Operations => $query->whereIn(
                $query->qualifyColumn('province'),
                $this->provinceNames($user),
            ),
            UserRole::FieldVerifier => $query->whereIn(
                $query->qualifyColumn('id'),
                Farm::query()->select('farmer_id')->whereIn('id', $this->assignedFarmIds($user)),
            ),
            UserRole::CooperativeOfficer => $query->whereIn(
                $query->qualifyColumn('cooperative_id'),
                $this->assignedCooperativeIds($user),
            ),
            UserRole::Farmer => $query->where($query->qualifyColumn('user_id'), $user->id),
        };

        return $query;
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function constrainFarms(Builder $query, User $user): Builder
    {
        match ($user->role) {
            UserRole::Admin, UserRole::Operations => $query->whereIn(
                $query->qualifyColumn('province'),
                $this->provinceNames($user),
            ),
            UserRole::FieldVerifier => $query->whereIn(
                $query->qualifyColumn('id'),
                $this->assignedFarmIds($user),
            ),
            UserRole::CooperativeOfficer => $query->whereIn(
                $query->qualifyColumn('farmer_id'),
                $this->visibleFarmerIds($user),
            ),
            UserRole::Farmer => $query->whereIn(
                $query->qualifyColumn('farmer_id'),
                Farmer::query()->select('id')->where('user_id', $user->id),
            ),
        };

        return $query;
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function constrainFarmOrFarmer(Builder $query, User $user): Builder
    {
        $query->where(function (Builder $query) use ($user): void {
            $query->whereIn($query->qualifyColumn('farm_id'), $this->visibleFarmIds($user))
                ->orWhere(function (Builder $query) use ($user): void {
                    $query->whereNull($query->qualifyColumn('farm_id'))
                        ->whereIn($query->qualifyColumn('farmer_id'), $this->visibleFarmerIds($user));
                });
        });

        return $query;
    }

    /**
     * @return Builder<Farm>
     */
    private function visibleFarmIds(User $user): Builder
    {
        return $this->constrainFarms(Farm::query()->select('farms.id'), $user);
    }

    /**
     * @return Builder<Farmer>
     */
    private function visibleFarmerIds(User $user): Builder
    {
        return $this->constrainFarmers(Farmer::query()->select('farmers.id'), $user);
    }

    /**
     * @return Builder<FarmVerifierAssignment>
     */
    private function assignedFarmIds(User $user): Builder
    {
        return FarmVerifierAssignment::query()
            ->select('farm_id')
            ->where('user_id', $user->id)
            ->whereNull('revoked_at');
    }

    /**
     * @return Builder<CooperativeOfficer>
     */
    private function assignedCooperativeIds(User $user): Builder
    {
        return CooperativeOfficer::query()
            ->select('cooperative_id')
            ->where('user_id', $user->id)
            ->whereNull('revoked_at');
    }

    /**
     * @return Builder<RegistryGrant>
     */
    private function provinceNames(User $user): Builder
    {
        return $this->openGrants($user)
            ->select('province')
            ->where('kind', RegistryGrantKind::Province)
            ->whereNotNull('province');
    }

    /**
     * @return Builder<RegistryGrant>
     */
    private function openGrants(User $user): Builder
    {
        return RegistryGrant::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at');
    }
}
