<?php

namespace App\Http\Controllers;

use App\Actions\RecordFarmProduction;
use App\Actions\UpdateFarmProduction;
use App\CropType;
use App\HarvestStatus;
use App\Http\Requests\StoreFarmProductionRequest;
use App\Http\Requests\UpdateFarmProductionRequest;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\FarmProduction;
use App\Models\User;
use App\ProductionStatus;
use App\Services\ProductionLedger;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FarmProductionController extends Controller
{
    public function __construct(private ProductionLedger $ledger) {}

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $farmId = $request->integer('farm') ?: null;
        $farmerId = $request->integer('farmer') ?: null;
        $crop = CropType::tryFrom($request->string('crop')->trim()->toString());
        $period = $request->string('period')->trim()->toString();
        $status = ProductionStatus::tryFrom($request->string('status')->trim()->toString());

        $productions = FarmProduction::query()
            ->with(['farm.farmer'])
            ->withSum(['harvests as harvested_quantity' => function ($query): void {
                $query->where('status', HarvestStatus::Completed)
                    ->whereColumn('farm_harvests.unit', 'farm_productions.unit');
            }], 'quantity')
            ->when($farmId !== null, fn ($query) => $query->where('farm_id', $farmId))
            ->when($farmerId !== null, function ($query) use ($farmerId): void {
                $query->whereHas('farm', fn ($query) => $query->where('farmer_id', $farmerId));
            })
            ->when($crop !== null, fn ($query) => $query->where('crop_type', $crop))
            ->when($period !== '', fn ($query) => $query->where('production_period', $period))
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->when($search !== '', fn ($query) => $this->applySearch($query, $search))
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (FarmProduction $production): array => $production->present());

        $user = $request->user();

        return Inertia::render('production/index', [
            'productions' => $productions,
            'summary' => $this->ledger->productionIndexSummary(),
            'filters' => [
                'search' => $search,
                'farm' => $farmId === null ? '' : (string) $farmId,
                'farmer' => $farmerId === null ? '' : (string) $farmerId,
                'crop' => $crop?->value ?? '',
                'period' => $period,
                'status' => $status?->value ?? '',
            ],
            'farms' => $this->farmOptions(),
            'farmers' => $this->farmerOptions(),
            'crops' => $this->cropOptions(),
            'periods' => $this->periodOptions(),
            'statuses' => $this->statusOptions(),
            'can_record' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function create(Request $request): Response
    {
        $farmId = $request->integer('farm');

        return Inertia::render('production/create', [
            'farms' => $this->farmOptions(),
            'statuses' => $this->statusOptions(),
            'units' => ProductionLedger::UNITS,
            'selectedFarmId' => Farm::query()->whereKey($farmId)->exists() ? $farmId : null,
            'currentYear' => (string) now()->year,
        ]);
    }

    public function store(StoreFarmProductionRequest $request, RecordFarmProduction $record): RedirectResponse
    {
        $production = $record->handle($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Expected production recorded.',
        ]);

        return to_route('production.show', $production);
    }

    public function show(FarmProduction $production): Response
    {
        $production->load(['farm.farmer']);
        $production->loadSum(['harvests as harvested_quantity' => function ($query): void {
            $query->where('status', HarvestStatus::Completed)
                ->whereColumn('farm_harvests.unit', 'farm_productions.unit');
        }], 'quantity');

        $harvests = $production->harvests()
            ->with(['farm.farmer', 'creator'])
            ->orderByDesc('harvest_date')
            ->orderByDesc('id')
            ->get()
            ->each(fn ($harvest) => $harvest->setRelation('production', $production));

        $user = request()->user();

        return Inertia::render('production/show', [
            'production' => $production->present(),
            'harvests' => $harvests->map(fn ($harvest): array => $harvest->present())->values()->all(),
            'can_edit' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function edit(FarmProduction $production): Response
    {
        $production->load(['farm.farmer']);

        return Inertia::render('production/edit', [
            'production' => $production->present(),
            'statuses' => $this->statusOptions(),
            'units' => ProductionLedger::UNITS,
        ]);
    }

    public function update(UpdateFarmProductionRequest $request, FarmProduction $production, UpdateFarmProduction $update): RedirectResponse
    {
        $update->handle($production, $request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Expected production updated.',
        ]);

        return to_route('production.show', $production);
    }

    /**
     * @param  Builder<FarmProduction>  $query
     */
    private function applySearch($query, string $search): void
    {
        $like = '%'.addcslashes($search, '%_\\').'%';

        $query->whereHas('farm', function ($query) use ($like, $search): void {
            $query->where('farm_id', 'like', $like)
                ->orWhere('farm_name', 'like', $like)
                ->orWhereHas('farmer', function ($query) use ($like, $search): void {
                    $query->where(function ($query) use ($like, $search): void {
                        $query->where('farmer_id', 'like', $like);

                        $words = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];

                        if ($words === []) {
                            return;
                        }

                        $query->orWhere(function ($query) use ($words): void {
                            foreach ($words as $word) {
                                $wordLike = '%'.addcslashes($word, '%_\\').'%';

                                $query->where(function ($query) use ($wordLike): void {
                                    $query->where('first_name', 'like', $wordLike)
                                        ->orWhere('middle_name', 'like', $wordLike)
                                        ->orWhere('last_name', 'like', $wordLike);
                                });
                            }
                        });
                    });
                });
        });
    }

    /**
     * @return list<array{id: int, farm_id: string, farm_name: string, farmer_name: string, crop_type: string, crop_label: string}>
     */
    private function farmOptions(): array
    {
        return Farm::query()
            ->with('farmer:id,first_name,middle_name,last_name')
            ->orderBy('farm_name')
            ->orderBy('id')
            ->get()
            ->map(fn (Farm $farm): array => [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->displayName(),
                'farmer_name' => $farm->farmer->fullName(),
                'crop_type' => $farm->crop_type->value,
                'crop_label' => $farm->crop_type->label(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function farmerOptions(): array
    {
        return Farmer::query()
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'middle_name', 'last_name'])
            ->map(fn (Farmer $farmer): array => [
                'id' => $farmer->id,
                'name' => $farmer->fullName(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function cropOptions(): array
    {
        return array_values(collect(CropType::cases())
            ->map(fn (CropType $crop): array => [
                'value' => $crop->value,
                'label' => $crop->label(),
            ])
            ->all());
    }

    /**
     * @return list<string>
     */
    private function periodOptions(): array
    {
        return FarmProduction::query()
            ->whereNotNull('production_period')
            ->where('production_period', '!=', '')
            ->distinct()
            ->orderBy('production_period')
            ->pluck('production_period')
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return array_values(collect(ProductionStatus::cases())
            ->map(fn (ProductionStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ])
            ->all());
    }
}
