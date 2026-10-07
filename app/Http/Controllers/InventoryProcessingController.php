<?php

namespace App\Http\Controllers;

use App\Actions\ProcessCoffeeInventory;
use App\Http\Requests\StoreInventoryProcessingRequest;
use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Services\InventoryStock;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InventoryProcessingController extends Controller
{
    public function index(InventoryStock $stock): Response
    {
        $movements = InventoryMovement::query()
            ->with(['sourceStage', 'destinationStage', 'creator', 'inventory.farm', 'inventory.farmer'])
            ->where('movement_type', InventoryMovementType::Processing)
            ->orderByDesc('movement_date')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (InventoryMovement $movement): array => [
                ...$movement->present(),
                'farm_name' => $movement->inventory?->farm?->displayName(),
                'farmer_name' => $movement->inventory?->farmer?->fullName(),
            ])
            ->all();

        return Inertia::render('inventory/processing', [
            'summary' => $stock->balances(),
            'movements' => $movements,
        ]);
    }

    public function create(Request $request, InventoryStock $stock): Response
    {
        $selectedId = $request->integer('inventory') ?: null;
        $lots = Inventory::query()
            ->with(['stage', 'farm', 'farmer'])
            ->where('status', InventoryStatus::Available)
            ->where('quantity', '>', 0)
            ->orderByDesc('id')
            ->get()
            ->map(function (Inventory $inventory) use ($stock): ?array {
                $next = $inventory->stage === null ? null : $stock->nextStage($inventory->stage);

                if ($next === null) {
                    return null;
                }

                return [
                    'id' => $inventory->id,
                    'label' => $inventory->quantityLabel().' · '.($inventory->stage->name ?? 'Coffee'),
                    'farm_name' => $inventory->farm?->displayName() ?? 'Farm',
                    'farmer_name' => $inventory->farmer?->fullName() ?? 'Farmer',
                    'quantity' => (float) $inventory->quantity,
                    'unit' => $inventory->unit,
                    'stage_name' => $inventory->stage->name,
                    'location' => $inventory->location ?? '',
                    'next_stage_id' => $next->id,
                    'next_stage_name' => $next->name,
                ];
            })
            ->filter()
            ->values()
            ->all();

        return Inertia::render('inventory/process', [
            'lots' => $lots,
            'selectedInventoryId' => $selectedId,
            'today' => now()->toDateString(),
        ]);
    }

    public function store(StoreInventoryProcessingRequest $request, ProcessCoffeeInventory $process): RedirectResponse
    {
        $destination = $process->handle($request->validated(), $request->user()?->id);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Coffee processed into '.$destination->stage()->value('name').'.',
        ]);

        return to_route('inventory.show', $request->integer('inventory_id'));
    }
}
