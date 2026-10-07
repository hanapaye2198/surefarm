<?php

namespace App\Http\Controllers;

use App\Actions\MarkInventoryDamaged;
use App\Http\Requests\StoreInventoryDamageRequest;
use App\Models\Inventory;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class InventoryDamageController extends Controller
{
    public function create(Inventory $inventory): Response
    {
        $inventory->load(['stage', 'farm', 'farmer']);

        return Inertia::render('inventory/damage', [
            'inventory' => $inventory->present(),
            'today' => now()->toDateString(),
        ]);
    }

    public function store(
        StoreInventoryDamageRequest $request,
        Inventory $inventory,
        MarkInventoryDamaged $damage,
    ): RedirectResponse {
        $damage->handle($inventory, $request->validated(), $request->user()?->id);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Damaged coffee recorded.',
        ]);

        return to_route('inventory.show', $inventory);
    }
}
