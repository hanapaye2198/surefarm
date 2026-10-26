<?php

namespace App\Http\Controllers;

use App\Actions\RecordFarmCrop;
use App\Actions\UpdateFarmCrop;
use App\CropRecordStatus;
use App\CropType;
use App\Http\Requests\StoreFarmCropRequest;
use App\Http\Requests\UpdateFarmCropRequest;
use App\Models\Farm;
use App\Models\FarmCrop;
use App\Models\Farmer;
use App\Models\User;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FarmCropController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $farmId = $request->integer('farm') ?: null;
        $farmerId = $request->integer('farmer') ?: null;
        $crop = CropType::tryFrom($request->string('crop')->trim()->toString());
        $status = CropRecordStatus::tryFrom($request->string('status')->trim()->toString());

        $crops = FarmCrop::query()
            ->visibleTo($this->registryViewer())
            ->with(['farm.farmer'])
            ->when($farmId !== null, fn (Builder $query) => $query->where('farm_id', $farmId))
            ->when($farmerId !== null, function (Builder $query) use ($farmerId): void {
                $query->whereHas('farm', fn (Builder $query) => $query->where('farmer_id', $farmerId));
            })
            ->when($crop !== null, fn (Builder $query) => $query->where('crop_type', $crop))
            ->when($status !== null, fn (Builder $query) => $query->where('status', $status))
            ->when($search !== '', fn (Builder $query) => $this->applySearch($query, $search))
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (FarmCrop $crop): array => $crop->present());

        $user = $request->user();

        return Inertia::render('crops/index', [
            'crops' => $crops,
            'filters' => [
                'search' => $search,
                'farm' => $farmId === null ? '' : (string) $farmId,
                'farmer' => $farmerId === null ? '' : (string) $farmerId,
                'crop' => $crop->value ?? '',
                'status' => $status->value ?? '',
            ],
            'farms' => $this->farmOptions(),
            'farmers' => $this->farmerOptions(),
            'cropTypes' => $this->cropOptions(),
            'statuses' => $this->statusOptions(),
            'can_record' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function create(Request $request): Response
    {
        $farmId = $request->integer('farm');

        return Inertia::render('crops/create', [
            'farms' => $this->farmOptions(),
            'statuses' => $this->statusOptions(),
            'selectedFarmId' => Farm::query()->visibleTo($this->registryViewer())->whereKey($farmId)->exists() ? $farmId : null,
        ]);
    }

    public function store(StoreFarmCropRequest $request, RecordFarmCrop $record): RedirectResponse
    {
        $crop = $record->handle($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Crop record saved.',
        ]);

        return to_route('crops.show', $crop);
    }

    public function show(FarmCrop $crop): Response
    {
        $crop->load(['farm.farmer']);
        $user = request()->user();

        return Inertia::render('crops/show', [
            'crop' => $crop->present(),
            'can_edit' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function edit(FarmCrop $crop): Response
    {
        $crop->load(['farm.farmer']);

        return Inertia::render('crops/edit', [
            'crop' => $crop->present(),
            'statuses' => $this->statusOptions(),
        ]);
    }

    public function update(UpdateFarmCropRequest $request, FarmCrop $crop, UpdateFarmCrop $update): RedirectResponse
    {
        $update->handle($crop, $request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Crop record updated.',
        ]);

        return to_route('crops.show', $crop);
    }

    /**
     * @param  Builder<FarmCrop>  $query
     */
    private function applySearch(Builder $query, string $search): void
    {
        $like = '%'.addcslashes($search, '%_\\').'%';

        $query->where(function (Builder $query) use ($like, $search): void {
            $query->where('variety', 'like', $like)
                ->orWhereHas('farm', function (Builder $query) use ($like, $search): void {
                    $query->where('farm_id', 'like', $like)
                        ->orWhere('farm_name', 'like', $like)
                        ->orWhereHas('farmer', function (Builder $query) use ($like, $search): void {
                            $query->where(function (Builder $query) use ($like, $search): void {
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
                });
        });
    }

    /**
     * @return list<array{id: int, farm_id: string, farm_name: string, farmer_name: string, crop_type: string, crop_label: string}>
     */
    private function farmOptions(): array
    {
        return array_values(Farm::query()
            ->visibleTo($this->registryViewer())
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
            ->all());
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function farmerOptions(): array
    {
        return array_values(Farmer::query()
            ->visibleTo($this->registryViewer())
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'middle_name', 'last_name'])
            ->map(fn (Farmer $farmer): array => [
                'id' => $farmer->id,
                'name' => $farmer->fullName(),
            ])
            ->values()
            ->all());
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
     * @return list<array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return array_values(collect(CropRecordStatus::cases())
            ->map(fn (CropRecordStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ])
            ->all());
    }
}
