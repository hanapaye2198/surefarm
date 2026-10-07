<?php

namespace App\Http\Controllers;

use App\Actions\ReceiveHarvestIntoInventory;
use App\HarvestStatus;
use App\Http\Requests\StoreHarvestInventoryRequest;
use App\Models\FarmHarvest;
use App\Models\InventoryProcessingStage;
use App\ProcessingStageStatus;
use App\Services\InventoryStock;
use App\Services\ProductionLedger;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class HarvestInventoryController extends Controller
{
    public function create(FarmHarvest $harvest, InventoryStock $stock): Response
    {
        $harvest->load('farm.farmer');

        return Inertia::render('inventory/receive', [
            'harvest' => $harvest->present(),
            'remaining' => $stock->remainingReceivable($harvest),
            'stages' => $this->stages(),
            'units' => ProductionLedger::UNITS,
            'can_receive' => $harvest->status === HarvestStatus::Completed,
            'today' => now()->toDateString(),
        ]);
    }

    public function store(
        StoreHarvestInventoryRequest $request,
        FarmHarvest $harvest,
        ReceiveHarvestIntoInventory $receive,
    ): RedirectResponse {
        $inventory = $receive->handle($harvest, $request->validated(), $request->user()?->id);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Harvest received into inventory.',
        ]);

        return to_route('inventory.show', $inventory);
    }

    /**
     * @return list<array{id: int, name: string, code: string}>
     */
    private function stages(): array
    {
        return InventoryProcessingStage::query()
            ->where('status', ProcessingStageStatus::Active)
            ->orderBy('sequence')
            ->get(['id', 'name', 'code'])
            ->map(fn (InventoryProcessingStage $stage): array => [
                'id' => $stage->id,
                'name' => $stage->name,
                'code' => $stage->code,
            ])
            ->all();
    }
}
