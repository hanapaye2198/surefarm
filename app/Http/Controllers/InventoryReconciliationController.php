<?php

namespace App\Http\Controllers;

use App\Actions\AlignInventoryBalance;
use App\Http\Requests\AlignInventoryBalanceRequest;
use App\Models\Inventory;
use App\Models\User;
use App\Services\InventoryStock;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InventoryReconciliationController extends Controller
{
    public function index(Request $request, InventoryStock $stock): Response
    {
        $viewer = $this->registryViewer();

        return Inertia::render('inventory/reconciliation', [
            'discrepancies' => $stock->discrepancies($viewer),
            'incompatible_receipts' => $stock->incompatibleReceipts($viewer),
        ]);
    }

    public function update(
        AlignInventoryBalanceRequest $request,
        Inventory $inventory,
        AlignInventoryBalance $align,
    ): RedirectResponse {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $align->handle($inventory, $actor, $request->string('reason')->toString());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Stored balance set to the movement total. No stock movement was added.',
        ]);

        return to_route('inventory.reconciliation');
    }
}
