<?php

namespace App\Http\Middleware;

use App\Models\Farm;
use App\Models\Farmer;
use App\Models\Inventory;
use App\Models\User;
use App\Services\RegistryScope;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSubmittedRecordsAreVisible
{
    public function __construct(private RegistryScope $scope) {}

    /**
     * A crafted farm, farmer, or inventory id cannot pull another
     * account's record into a create or update request. Missing ids
     * are left for validation.
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

        return $next($request);
    }

    private function rejectHidden(Request $request, string $field, mixed $record, User $user): void
    {
        if (! $request->filled($field) || $record === null) {
            return;
        }

        $visible = match (true) {
            $record instanceof Farm => $this->scope->canViewFarm($user, $record),
            $record instanceof Farmer => $this->scope->canViewFarmer($user, $record),
            $record instanceof Inventory => Inventory::query()->whereKey($record->id)->visibleTo($user)->exists(),
            default => false,
        };

        if (! $visible) {
            abort(404);
        }
    }
}
