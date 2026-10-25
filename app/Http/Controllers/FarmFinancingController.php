<?php

namespace App\Http\Controllers;

use App\Actions\RecordFarmFinancing;
use App\Actions\UpdateFarmFinancing;
use App\FinancingType;
use App\Http\Requests\StoreFarmFinancingRequest;
use App\Http\Requests\UpdateFarmFinancingRequest;
use App\Models\Farm;
use App\Models\FarmFinancing;
use App\Models\User;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FarmFinancingController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        $records = FarmFinancing::query()
            ->whereHas('farm', fn (Builder $farm) => $farm->visibleTo($user))
            ->with(['farm.farmer'])
            ->latest('date_granted')
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(function (FarmFinancing $financing): array {
                $presented = $financing->present();

                return [
                    'id' => $financing->id,
                    'farm_record_id' => $financing->farm_id,
                    'farm_id' => $financing->farm->farm_id,
                    'farm_name' => $financing->farm->displayName(),
                    'farmer_name' => $financing->farm->farmer->fullName(),
                    'summary' => $presented['financing_type_label'].' · '.$presented['amount_label'],
                    'detail' => 'Balance '.$presented['loan_balance_label'],
                ];
            });

        return Inertia::render('coverage/index', [
            'kind' => 'financing',
            'title' => 'Finance',
            'description' => 'Financing is recorded on each farm. Open a farm to use the existing financing form.',
            'records' => $records,
            'can_manage' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

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
