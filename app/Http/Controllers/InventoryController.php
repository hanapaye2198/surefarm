<?php

namespace App\Http\Controllers;

use App\InventoryStatus;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\InventoryProcessingStage;
use App\Models\User;
use App\ProcessingStageStatus;
use App\Services\InventoryStock;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function index(Request $request, InventoryStock $stock): Response
    {
        $search = $request->string('search')->trim()->toString();
        $farmId = $request->integer('farm') ?: null;
        $farmerId = $request->integer('farmer') ?: null;
        $stageId = $request->integer('stage') ?: null;
        $status = InventoryStatus::tryFrom($request->string('status')->trim()->toString());
        $location = $request->string('location')->trim()->toString();
        $from = $this->dateFilter($request->string('from')->trim()->toString());
        $to = $this->dateFilter($request->string('to')->trim()->toString());

        $inventories = Inventory::query()
            ->with(['farmer', 'farm', 'harvest', 'stage'])
            ->where('quantity', '>', 0)
            ->when($farmId !== null, fn (Builder $query) => $query->where('farm_id', $farmId))
            ->when($farmerId !== null, fn (Builder $query) => $query->where('farmer_id', $farmerId))
            ->when($stageId !== null, fn (Builder $query) => $query->where('processing_stage_id', $stageId))
            ->when($status !== null, fn (Builder $query) => $query->where('status', $status))
            ->when($location !== '', fn (Builder $query) => $query->where('location', 'like', '%'.addcslashes($location, '%_\\').'%'))
            ->when($from !== null, fn (Builder $query) => $query->whereDate('received_date', '>=', $from))
            ->when($to !== null, fn (Builder $query) => $query->whereDate('received_date', '<=', $to))
            ->when($search !== '', fn (Builder $query) => $this->applySearch($query, $search))
            ->orderByDesc('received_date')
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Inventory $inventory): array => $inventory->present());

        $user = $request->user();

        return Inertia::render('inventory/index', [
            'inventories' => $inventories,
            'summary' => $stock->balances(),
            'filters' => [
                'search' => $search,
                'farm' => $farmId === null ? '' : (string) $farmId,
                'farmer' => $farmerId === null ? '' : (string) $farmerId,
                'stage' => $stageId === null ? '' : (string) $stageId,
                'status' => $status?->value ?? '',
                'location' => $location,
                'from' => $from ?? '',
                'to' => $to ?? '',
            ],
            'farms' => $this->farmOptions(),
            'farmers' => $this->farmerOptions(),
            'stages' => $this->stageOptions(),
            'statuses' => $this->statusOptions(),
            'can_manage' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function show(Request $request, Inventory $inventory, InventoryStock $stock): Response
    {
        $inventory->load(['farmer', 'farm', 'harvest', 'stage']);
        $user = $request->user();
        $canManage = $user instanceof User && $user->canAccess(UserRole::Operations);
        $next = $inventory->stage === null ? null : $stock->nextStage($inventory->stage);

        $movements = InventoryMovement::query()
            ->with(['sourceStage', 'destinationStage', 'creator'])
            ->where(function (Builder $query) use ($inventory): void {
                $query->where('inventory_id', $inventory->id)
                    ->orWhere('destination_inventory_id', $inventory->id);
            })
            ->orderByDesc('movement_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (InventoryMovement $movement): array => $movement->present())
            ->values()
            ->all();

        return Inertia::render('inventory/show', [
            'inventory' => $inventory->present(),
            'movements' => $movements,
            'can_manage' => $canManage,
            'can_process' => $canManage
                && $inventory->status === InventoryStatus::Available
                && (float) $inventory->quantity > 0
                && $next !== null,
            'can_trace' => $canManage
                && $inventory->status === InventoryStatus::Available
                && (float) $inventory->quantity > 0
                && in_array($inventory->stage?->code, config('traceability.eligible_stage_codes', []), true),
            'next_stage' => $next === null ? null : [
                'id' => $next->id,
                'name' => $next->name,
            ],
        ]);
    }

    private function applySearch(Builder $query, string $search): void
    {
        $like = '%'.addcslashes($search, '%_\\').'%';

        $query->where(function (Builder $query) use ($like, $search): void {
            $query->whereHas('farm', function (Builder $query) use ($like): void {
                $query->where('farm_id', 'like', $like)
                    ->orWhere('farm_name', 'like', $like);
            })->orWhereHas('farmer', function (Builder $query) use ($like, $search): void {
                $query->where('farmer_id', 'like', $like);

                $words = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];

                if ($words === []) {
                    return;
                }

                $query->orWhere(function (Builder $query) use ($words): void {
                    foreach ($words as $word) {
                        $wordLike = '%'.addcslashes($word, '%_\\').'%';

                        $query->where(function (Builder $query) use ($wordLike): void {
                            $query->where('first_name', 'like', $wordLike)
                                ->orWhere('middle_name', 'like', $wordLike)
                                ->orWhere('last_name', 'like', $wordLike);
                        });
                    }
                });
            });

            if (ctype_digit($search)) {
                $query->orWhere('harvest_id', (int) $search);
            }
        });
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function farmOptions(): array
    {
        return Farm::query()
            ->orderBy('farm_name')
            ->orderBy('id')
            ->get()
            ->map(fn (Farm $farm): array => [
                'id' => $farm->id,
                'name' => $farm->displayName(),
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function farmerOptions(): array
    {
        return Farmer::query()
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(fn (Farmer $farmer): array => [
                'id' => $farmer->id,
                'name' => $farmer->fullName(),
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function stageOptions(): array
    {
        return InventoryProcessingStage::query()
            ->where('status', ProcessingStageStatus::Active)
            ->orderBy('sequence')
            ->get()
            ->map(fn (InventoryProcessingStage $stage): array => [
                'id' => $stage->id,
                'name' => $stage->name,
            ])
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return array_map(
            fn (InventoryStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ],
            InventoryStatus::cases(),
        );
    }

    private function dateFilter(string $value): ?string
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        $date = date_create_immutable($value);

        if ($date === false || $date->format('Y-m-d') !== $value) {
            return null;
        }

        return $value;
    }
}
