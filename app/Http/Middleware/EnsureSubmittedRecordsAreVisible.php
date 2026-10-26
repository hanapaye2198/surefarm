<?php

namespace App\Http\Middleware;

use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\FarmCrop;
use App\Models\Farmer;
use App\Models\FarmFinancing;
use App\Models\FarmHarvest;
use App\Models\FarmInsurance;
use App\Models\FarmProduction;
use App\Models\FarmVerification;
use App\Models\FarmVerificationPhoto;
use App\Models\FinancingDocument;
use App\Models\FinancingTransaction;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\TraceabilityLot;
use App\Models\User;
use App\Services\RegistryScope;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSubmittedRecordsAreVisible
{
    public function __construct(private RegistryScope $scope) {}

    /**
     * Scope both submitted foreign keys and route-bound records. Lists
     * use visibleTo(); this middleware protects direct detail, edit,
     * mutation, and media endpoints that receive a model in the URL.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return $next($request);
        }

        $this->rejectHidden($request, 'farm_id', Farm::query()->find($request->integer('farm_id')), $user);
        $this->rejectHidden($request, 'farmer_id', Farmer::query()->find($request->integer('farmer_id')), $user);
        $this->rejectHidden($request, 'inventory_id', Inventory::query()->find($request->integer('inventory_id')), $user);

        foreach ($request->route()?->parameters() ?? [] as $parameter) {
            if ($parameter instanceof Model) {
                $this->rejectHiddenRecord($parameter, $user);
            }
        }

        return $next($request);
    }

    private function rejectHidden(Request $request, string $field, mixed $record, User $user): void
    {
        if (! $request->filled($field) || $record === null) {
            return;
        }

        $this->rejectHiddenRecord($record, $user);
    }

    private function rejectHiddenRecord(Model $record, User $user): void
    {
        $visible = match (true) {
            $record instanceof Farm => $this->scope->canViewFarm($user, $record),
            $record instanceof Farmer => $this->scope->canViewFarmer($user, $record),
            $record instanceof FarmVerification => Farm::query()
                ->whereKey($record->farm_id)
                ->visibleTo($user)
                ->exists(),
            $record instanceof FarmActivity,
            $record instanceof FarmCrop,
            $record instanceof FarmFinancing,
            $record instanceof FarmHarvest,
            $record instanceof FarmInsurance,
            $record instanceof FarmProduction => Farm::query()
                ->whereKey($record->farm_id)
                ->visibleTo($user)
                ->exists(),
            $record instanceof FarmVerificationPhoto => FarmVerification::query()
                ->whereKey($record->farm_verification_id)
                ->whereHas('farm', fn ($farm) => $farm->visibleTo($user))
                ->exists(),
            $record instanceof FinancingTransaction, $record instanceof FinancingDocument => FarmFinancing::query()
                ->whereKey($record->farm_financing_id)
                ->whereHas('farm', fn ($farm) => $farm->visibleTo($user))
                ->exists(),
            $record instanceof Inventory => Inventory::query()->whereKey($record->id)->visibleTo($user)->exists(),
            $record instanceof InventoryMovement => InventoryMovement::query()->whereKey($record->id)->visibleTo($user)->exists(),
            $record instanceof TraceabilityLot => TraceabilityLot::query()->whereKey($record->id)->visibleTo($user)->exists(),
            default => null,
        };

        if ($visible === false) {
            abort(404);
        }
    }
}
