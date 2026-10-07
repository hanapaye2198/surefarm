<?php

namespace App\Http\Controllers;

use App\Actions\RecordFarmInsurance;
use App\Actions\UpdateFarmInsurance;
use App\Http\Requests\StoreFarmInsuranceRequest;
use App\Http\Requests\UpdateFarmInsuranceRequest;
use App\Models\Farm;
use App\Models\FarmInsurance;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class FarmInsuranceController extends Controller
{
    public function create(Farm $farm): Response
    {
        $farm->load('farmer');

        return Inertia::render('farm-insurance/create', [
            'farm' => $this->farmOption($farm),
        ]);
    }

    public function store(StoreFarmInsuranceRequest $request, Farm $farm, RecordFarmInsurance $record): RedirectResponse
    {
        $record->handle([
            ...$request->validated(),
            'farm_id' => $farm->id,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Crop insurance saved for '.$farm->displayName().'.',
        ]);

        return to_route('farms.show', ['farm' => $farm, 'tab' => 'insurance']);
    }

    public function edit(Farm $farm, FarmInsurance $insurance): Response
    {
        abort_unless($insurance->farm_id === $farm->id, 404);

        $farm->load('farmer');

        return Inertia::render('farm-insurance/edit', [
            'farm' => $this->farmOption($farm),
            'insurance' => $insurance->present(),
        ]);
    }

    public function update(
        UpdateFarmInsuranceRequest $request,
        Farm $farm,
        FarmInsurance $insurance,
        UpdateFarmInsurance $update,
    ): RedirectResponse {
        abort_unless($insurance->farm_id === $farm->id, 404);

        $update->handle($insurance, $request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Crop insurance updated for '.$farm->displayName().'.',
        ]);

        return to_route('farms.show', ['farm' => $farm, 'tab' => 'insurance']);
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
}
