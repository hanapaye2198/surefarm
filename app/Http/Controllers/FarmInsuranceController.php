<?php

namespace App\Http\Controllers;

use App\Actions\RecordFarmInsurance;
use App\Actions\UpdateFarmInsurance;
use App\Http\Requests\StoreFarmInsuranceRequest;
use App\Http\Requests\UpdateFarmInsuranceRequest;
use App\Models\Farm;
use App\Models\FarmInsurance;
use App\Models\User;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FarmInsuranceController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        $records = FarmInsurance::query()
            ->whereHas('farm', fn (Builder $farm) => $farm->visibleTo($user))
            ->with(['farm.farmer'])
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(function (FarmInsurance $insurance): array {
                $presented = $insurance->present();

                return [
                    'id' => $insurance->id,
                    'farm_record_id' => $insurance->farm_id,
                    'farm_id' => $insurance->farm->farm_id,
                    'farm_name' => $insurance->farm->displayName(),
                    'farmer_name' => $insurance->farm->farmer->fullName(),
                    'summary' => $presented['covered_label'] === 'Yes'
                        ? 'Covered · '.$presented['amount_label']
                        : 'Not covered',
                    'detail' => $presented['term_label'],
                ];
            });

        return Inertia::render('coverage/index', [
            'kind' => 'insurance',
            'title' => 'Insurance',
            'description' => 'Crop insurance is recorded on each farm. Open a farm to use the existing insurance form.',
            'records' => $records,
            'can_manage' => $user->canAccess(UserRole::Operations),
        ]);
    }

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
