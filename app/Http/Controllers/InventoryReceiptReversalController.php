<?php

namespace App\Http\Controllers;

use App\Actions\ReverseHarvestReceipt;
use App\Http\Requests\StoreInventoryReceiptReversalRequest;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class InventoryReceiptReversalController extends Controller
{
    public function store(
        StoreInventoryReceiptReversalRequest $request,
        Inventory $inventory,
        InventoryMovement $movement,
        ReverseHarvestReceipt $reverse,
    ): RedirectResponse {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        if ($movement->inventory_id !== $inventory->id) {
            abort(404);
        }

        $reverse->handle($inventory, $movement, $actor);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Receipt reversed. The original receipt remains in the ledger.',
        ]);

        return to_route('inventory.show', $inventory);
    }
}
