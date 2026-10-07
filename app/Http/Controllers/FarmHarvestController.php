<?php

namespace App\Http\Controllers;

use App\Actions\RecordFarmHarvest;
use App\Actions\UpdateFarmHarvest;
use App\CropType;
use App\HarvestStatus;
use App\Http\Requests\StoreFarmHarvestRequest;
use App\Http\Requests\UpdateFarmHarvestRequest;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\FarmHarvest;
use App\Models\FarmProduction;
use App\Models\User;
use App\Services\ProductionLedger;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FarmHarvestController extends Controller
{
    public function __construct(private ProductionLedger $ledger) {}

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $farmId = $request->integer('farm') ?: null;
        $farmerId = $request->integer('farmer') ?: null;
        $crop = CropType::tryFrom($request->string('crop')->trim()->toString());
        $status = HarvestStatus::tryFrom($request->string('status')->trim()->toString());
        $quality = $request->string('quality')->trim()->toString();
        $from = $this->dateFilter($request->string('from')->trim()->toString());
        $to = $this->dateFilter($request->string('to')->trim()->toString());

        $harvests = FarmHarvest::query()
            ->with(['farm.farmer', 'production'])
            ->when($farmId !== null, fn ($query) => $query->where('farm_id', $farmId))
            ->when($farmerId !== null, function ($query) use ($farmerId): void {
                $query->whereHas('farm', fn ($query) => $query->where('farmer_id', $farmerId));
            })
            ->when($crop !== null, fn ($query) => $query->where('crop_type', $crop))
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->when($quality !== '', function ($query) use ($quality): void {
                $query->where('quality_grade', 'like', '%'.addcslashes($quality, '%_\\').'%');
            })
            ->when($from !== null, fn ($query) => $query->whereDate('harvest_date', '>=', $from))
            ->when($to !== null, fn ($query) => $query->whereDate('harvest_date', '<=', $to))
            ->when($search !== '', fn ($query) => $this->applySearch($query, $search))
            ->orderByDesc('harvest_date')
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (FarmHarvest $harvest): array => $harvest->present());

        $user = $request->user();

        return Inertia::render('harvest/index', [
            'harvests' => $harvests,
            'summary' => $this->ledger->harvestIndexSummary(),
            'filters' => [
                'search' => $search,
                'farm' => $farmId === null ? '' : (string) $farmId,
                'farmer' => $farmerId === null ? '' : (string) $farmerId,
                'crop' => $crop?->value ?? '',
                'status' => $status?->value ?? '',
                'quality' => $quality,
                'from' => $from ?? '',
                'to' => $to ?? '',
            ],
            'farms' => $this->farmOptions(),
            'farmers' => $this->farmerOptions(),
            'crops' => $this->cropOptions(),
            'statuses' => $this->statusOptions(),
            'can_record' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function create(Request $request): Response
    {
        $requestedProduction = FarmProduction::query()->find($request->integer('production'));
        $farmId = $request->integer('farm') ?: $requestedProduction?->farm_id;
        $farmExists = $farmId !== null && Farm::query()->whereKey($farmId)->exists();

        return Inertia::render('harvest/create', [
            'farms' => $this->farmOptions(),
            'productions' => $this->productionOptions(),
            'statuses' => $this->statusOptions(),
            'units' => ProductionLedger::UNITS,
            'selectedFarmId' => $farmExists ? $farmId : null,
            'selectedProductionId' => $requestedProduction?->id,
            'today' => now()->toDateString(),
        ]);
    }

    public function store(StoreFarmHarvestRequest $request, RecordFarmHarvest $record): RedirectResponse
    {
        $harvest = $record->handle($request->validated(), $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Harvest recorded.',
        ]);

        if ($harvest->production_id !== null) {
            return to_route('production.show', $harvest->production_id);
        }

        return to_route('farms.show', [
            'farm' => $harvest->farm_id,
            'tab' => 'harvest',
        ]);
    }

    public function show(FarmHarvest $harvest): Response
    {
        $harvest->load(['farm.farmer', 'production', 'creator']);
        $user = request()->user();

        return Inertia::render('harvest/show', [
            'harvest' => $harvest->present(),
            'can_edit' => $user instanceof User && $user->canAccess(UserRole::Operations),
            'can_receive' => $user instanceof User
                && $user->canAccess(UserRole::Operations)
                && $harvest->status === HarvestStatus::Completed
                && ($harvest->crop_type ?? $harvest->farm->crop_type) === CropType::Coffee,
        ]);
    }

    public function edit(FarmHarvest $harvest): Response
    {
        $harvest->load(['farm.farmer', 'production']);

        return Inertia::render('harvest/edit', [
            'harvest' => $harvest->present(),
            'statuses' => $this->statusOptions(),
            'units' => ProductionLedger::UNITS,
        ]);
    }

    public function update(UpdateFarmHarvestRequest $request, FarmHarvest $harvest, UpdateFarmHarvest $update): RedirectResponse
    {
        $update->handle($harvest, $request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Harvest updated.',
        ]);

        return to_route('harvest.show', $harvest);
    }

    private function dateFilter(string $value): ?string
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        $date = date_create_immutable($value);

        if ($date === false || $date->format('Y-m-d') !== $value) {
            return null;
        }

        return $value;
    }

    /**
     * @param  Builder<FarmHarvest>  $query
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
     * @return list<array{id: int, farm_id: int, label: string, crop_type: string|null, unit: string}>
     */
    private function productionOptions(): array
    {
        return FarmProduction::query()
            ->orderByDesc('id')
            ->get()
            ->map(fn (FarmProduction $production): array => [
                'id' => $production->id,
                'farm_id' => $production->farm_id,
                'label' => collect([
                    $production->production_period,
                    $production->cropLabel(),
                    $production->expected_quantity === null
                        ? null
                        : $this->ledger->quantityLabel($production->expected_quantity, $production->unit),
                ])->filter()->implode(' · '),
                'crop_type' => $production->crop_type?->value,
                'unit' => $production->unit,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return array_values(collect(HarvestStatus::cases())
            ->map(fn (HarvestStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ])
            ->all());
    }
}
