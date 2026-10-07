<?php

namespace App\Http\Controllers;

use App\Actions\CreateTraceabilityLot;
use App\CropType;
use App\Http\Requests\StoreTraceabilityLotRequest;
use App\InventoryStatus;
use App\Models\Inventory;
use App\Models\InventoryProcessingStage;
use App\Models\TraceabilityLot;
use App\Models\User;
use App\Services\ProductionLedger;
use App\Services\TraceabilityJourney;
use App\Services\TraceabilitySummary;
use App\TraceabilityLotStatus;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TraceabilityController extends Controller
{
    public function index(Request $request, TraceabilitySummary $summary): Response
    {
        $search = $request->string('search')->trim()->toString();
        $stageId = $request->integer('stage') ?: null;
        $status = TraceabilityLotStatus::tryFrom($request->string('status')->trim()->toString());
        $crop = CropType::tryFrom($request->string('crop')->trim()->toString());
        $from = $this->dateFilter($request->string('from')->trim()->toString());
        $to = $this->dateFilter($request->string('to')->trim()->toString());

        $lots = TraceabilityLot::query()
            ->with(['farmer', 'farm', 'harvest', 'inventory.stage'])
            ->when($search !== '', fn (Builder $query): Builder => $this->applySearch($query, $search))
            ->when($stageId !== null, fn (Builder $query): Builder => $query->whereHas(
                'inventory',
                fn (Builder $inventory): Builder => $inventory->where('processing_stage_id', $stageId),
            ))
            ->when($status !== null, fn (Builder $query): Builder => $query->where('status', $status))
            ->when($crop !== null, fn (Builder $query): Builder => $query->where('crop_type', $crop))
            ->when($from !== null, fn (Builder $query): Builder => $query->whereHas(
                'harvest',
                fn (Builder $harvest): Builder => $harvest->whereDate('harvest_date', '>=', $from),
            ))
            ->when($to !== null, fn (Builder $query): Builder => $query->whereHas(
                'harvest',
                fn (Builder $harvest): Builder => $harvest->whereDate('harvest_date', '<=', $to),
            ))
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (TraceabilityLot $lot): array => $summary->row($lot));

        $user = $request->user();

        return Inertia::render('traceability/index', [
            'lots' => $lots,
            'summary' => $summary->metrics(),
            'filters' => [
                'search' => $search,
                'stage' => $stageId === null ? '' : (string) $stageId,
                'status' => $status?->value ?? '',
                'crop' => $crop?->value ?? '',
                'from' => $from ?? '',
                'to' => $to ?? '',
            ],
            'stages' => InventoryProcessingStage::query()->orderBy('sequence')->get(['id', 'name']),
            'statuses' => collect(TraceabilityLotStatus::cases())
                ->map(fn (TraceabilityLotStatus $status): array => [
                    'value' => $status->value,
                    'label' => $status->label(),
                ])
                ->all(),
            'crops' => collect(CropType::cases())
                ->map(fn (CropType $crop): array => [
                    'value' => $crop->value,
                    'label' => $crop->label(),
                ])
                ->all(),
            'can_manage' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function create(Request $request): Response
    {
        $selected = $request->integer('inventory') ?: null;
        $eligible = config('traceability.eligible_stage_codes', []);

        $inventories = Inventory::query()
            ->with(['farmer', 'farm', 'harvest', 'stage'])
            ->where('status', InventoryStatus::Available)
            ->where('quantity', '>', 0)
            ->whereHas('stage', fn (Builder $query): Builder => $query->whereIn('code', $eligible))
            ->orderByDesc('id')
            ->get()
            ->map(fn (Inventory $inventory): array => [
                'id' => $inventory->id,
                'label' => collect([
                    $inventory->farmer?->fullName(),
                    $inventory->farm?->displayName(),
                    $inventory->quantityLabel(),
                    $inventory->stage?->name,
                ])->filter()->implode(' · '),
                'quantity' => (float) $inventory->quantity,
                'unit' => $inventory->unit,
                'farmer' => $inventory->farmer?->fullName(),
                'farm' => $inventory->farm?->displayName(),
                'crop' => $inventory->crop_type?->label() ?? $inventory->farm?->crop_type->label(),
                'harvest' => $inventory->harvest === null
                    ? null
                    : $inventory->harvest->harvest_date?->format('F j, Y'),
                'stage' => $inventory->stage?->name,
            ])
            ->all();

        return Inertia::render('traceability/create', [
            'inventories' => $inventories,
            'selected_inventory_id' => $selected,
            'units' => ProductionLedger::UNITS,
        ]);
    }

    public function store(
        StoreTraceabilityLotRequest $request,
        CreateTraceabilityLot $create,
    ): RedirectResponse {
        $lot = $create->handle($request->validated(), $request->user()?->id);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Traceability lot '.$lot->lot_code.' created.',
        ]);

        return to_route('traceability.show', $lot);
    }

    public function show(TraceabilityLot $lot, TraceabilityJourney $journey, Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('traceability/show', [
            ...$journey->detail($lot),
            'can_manage' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function print(TraceabilityLot $lot, TraceabilityJourney $journey): Response
    {
        return Inertia::render('traceability/print', $journey->detail($lot));
    }

    private function applySearch(Builder $query, string $search): Builder
    {
        $like = '%'.addcslashes($search, '%_\\').'%';

        return $query->where(function (Builder $query) use ($like, $search): void {
            $query->where('lot_code', 'like', $like)
                ->orWhereHas('farm', function (Builder $query) use ($like): void {
                    $query->where('farm_id', 'like', $like)
                        ->orWhere('farm_name', 'like', $like);
                })
                ->orWhereHas('farmer', function (Builder $query) use ($like, $search): void {
                    $query->where('farmer_id', 'like', $like);
                    $words = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];

                    if ($words === []) {
                        return;
                    }

                    $query->orWhere(function (Builder $query) use ($words): void {
                        foreach ($words as $word) {
                            $wordLike = '%'.addcslashes($word, '%_\\').'%';
                            $query->where(function (Builder $query) use ($wordLike): void {
                                $query->where('first_name', 'like', $wordLike)
                                    ->orWhere('middle_name', 'like', $wordLike)
                                    ->orWhere('last_name', 'like', $wordLike);
                            });
                        }
                    });
                });
        });
    }

    private function dateFilter(string $value): ?string
    {
        if ($value === '' || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            return null;
        }

        return $value;
    }
}
