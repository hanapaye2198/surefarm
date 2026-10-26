<?php

namespace App\Http\Controllers;

use App\Actions\RecordFarmFinancing;
use App\Actions\UpdateFarmFinancing;
use App\FinancingType;
use App\Http\Requests\StoreFarmFinancingRequest;
use App\Http\Requests\UpdateFarmFinancingRequest;
use App\Models\Farm;
use App\Models\FarmFinancing;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class FarmFinancingController extends Controller
{
    public function create(Farm $farm): Response
    {
        $farm->load('farmer');

        return Inertia::render('farm-financing/create', [
            'farm' => $this->farmOption($farm),
            'financingTypes' => $this->financingTypes(),
        ]);
    }

    public function store(StoreFarmFinancingRequest $request, Farm $farm, RecordFarmFinancing $record): RedirectResponse
    {
        $record->handle([
            ...$request->validated(),
            'farm_id' => $farm->id,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Financing saved for '.$farm->displayName().'.',
        ]);

        return to_route('farms.show', ['farm' => $farm, 'tab' => 'financing']);
    }

    public function edit(Farm $farm, FarmFinancing $financing): Response
    {
        abort_unless($financing->farm_id === $farm->id, 404);

        $farm->load('farmer');

        return Inertia::render('farm-financing/edit', [
            'farm' => $this->farmOption($farm),
            'financing' => $financing->present(),
            'financingTypes' => $this->financingTypes(),
        ]);
    }

    public function update(
        UpdateFarmFinancingRequest $request,
        Farm $farm,
        FarmFinancing $financing,
        UpdateFarmFinancing $update,
    ): RedirectResponse {
        abort_unless($financing->farm_id === $farm->id, 404);

        $update->handle($financing, $request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Financing updated for '.$farm->displayName().'.',
        ]);

        return to_route('farms.show', ['farm' => $farm, 'tab' => 'financing']);
    }

    /**
     * @return array{id: int, farm_id: string, farm_name: string, farmer_name: string}
     */
    private function farmOption(Farm $farm): array
    {
        return [
            'id' => $farm->id,
            'farm_id' => $farm->farm_id,
            'farm_name' => $farm->displayName(),
            'farmer_name' => $farm->farmer->fullName(),
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function financingTypes(): array
    {
        return array_map(
            fn (FinancingType $type): array => [
                'value' => $type->value,
                'label' => $type->label(),
            ],
            FinancingType::cases(),
        );
    }
}
