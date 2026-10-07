<?php

namespace App\Http\Controllers;

use App\Actions\AdjustInventory;
use App\Http\Requests\StoreInventoryAdjustmentRequest;
use App\Models\Inventory;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class InventoryAdjustmentController extends Controller
{
    public function create(Inventory $inventory): Response
    {
        $inventory->load(['stage', 'farm', 'farmer']);

        return Inertia::render('inventory/adjust', [
            'inventory' => $inventory->present(),
            'today' => now()->toDateString(),
        ]);
    }

    public function store(
        StoreInventoryAdjustmentRequest $request,
        Inventory $inventory,
        AdjustInventory $adjust,
    ): RedirectResponse {
        $adjust->handle($inventory, $request->validated(), $request->user()?->id);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Inventory adjustment recorded.',
        ]);

        return to_route('inventory.show', $inventory);
    }
}
