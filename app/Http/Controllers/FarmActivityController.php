<?php

namespace App\Http\Controllers;

use App\Actions\RecordFarmActivity;
use App\Actions\UpdateFarmActivity;
use App\ActivityStatus;
use App\ActivityTypeStatus;
use App\CropType;
use App\Http\Requests\StoreFarmActivityRequest;
use App\Http\Requests\UpdateFarmActivityRequest;
use App\Models\ActivityType;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\User;
use App\UserRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FarmActivityController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $farmId = $request->integer('farm') ?: null;
        $farmerId = $request->integer('farmer') ?: null;
        $crop = CropType::tryFrom($request->string('crop')->trim()->toString());
        $activityTypeId = $request->integer('activity_type') ?: null;
        $status = ActivityStatus::tryFrom($request->string('status')->trim()->toString());
        $from = $this->dateFilter($request->string('from')->trim()->toString());
        $to = $this->dateFilter($request->string('to')->trim()->toString());

        $activities = FarmActivity::query()
            ->with(['farm.farmer', 'activityType', 'creator'])
            ->when($farmId !== null, fn ($query) => $query->where('farm_id', $farmId))
            ->when($farmerId !== null, function ($query) use ($farmerId): void {
                $query->whereHas('farm', fn ($query) => $query->where('farmer_id', $farmerId));
            })
            ->when($crop !== null, fn ($query) => $query->where('crop_type', $crop))
            ->when($activityTypeId !== null, fn ($query) => $query->where('activity_type_id', $activityTypeId))
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->when($from !== null, fn ($query) => $query->whereDate('activity_date', '>=', $from))
            ->when($to !== null, fn ($query) => $query->whereDate('activity_date', '<=', $to))
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';

                $query->where(function ($query) use ($like, $search): void {
                    $query->whereHas('farm', function ($query) use ($like, $search): void {
                        $query->where('farm_id', 'like', $like)
                            ->orWhere('farm_name', 'like', $like)
                            ->orWhereHas('farmer', function ($query) use ($search): void {
                                $words = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];

                                foreach ($words as $word) {
                                    $wordLike = '%'.addcslashes($word, '%_\\').'%';

                                    $query->where(function ($query) use ($wordLike): void {
                                        $query->where('first_name', 'like', $wordLike)
                                            ->orWhere('middle_name', 'like', $wordLike)
                                            ->orWhere('last_name', 'like', $wordLike);
                                    });
                                }
                            });
                    })->orWhereHas('activityType', fn ($query) => $query->where('name', 'like', $like));
                });
            })
            ->orderByDesc('activity_date')
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (FarmActivity $activity): array => $activity->present());

        $user = $request->user();

        return Inertia::render('farm-activities/index', [
            'activities' => $activities,
            'filters' => [
                'search' => $search,
                'farm' => $farmId === null ? '' : (string) $farmId,
                'farmer' => $farmerId === null ? '' : (string) $farmerId,
                'crop' => $crop?->value ?? '',
                'activity_type' => $activityTypeId === null ? '' : (string) $activityTypeId,
                'status' => $status?->value ?? '',
                'from' => $from ?? '',
                'to' => $to ?? '',
            ],
            'farms' => $this->farmOptions(),
            'farmers' => $this->farmerOptions(),
            'crops' => $this->cropOptions(),
            'activityTypes' => $this->activityTypeOptions(includeInactive: true),
            'statuses' => $this->statusOptions(),
            'can_record' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function create(Request $request): Response
    {
        $farmId = $request->integer('farm');

        return Inertia::render('farm-activities/create', [
            'farms' => $this->farmOptions(),
            'activityTypes' => $this->activityTypeOptions(includeInactive: false),
            'statuses' => $this->statusOptions(),
            'selectedFarmId' => Farm::query()->whereKey($farmId)->exists() ? $farmId : null,
            'today' => now()->toDateString(),
        ]);
    }

    public function store(StoreFarmActivityRequest $request, RecordFarmActivity $record): RedirectResponse
    {
        $activity = $record->handle($request->validated(), $request->user());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farm activity recorded.',
        ]);

        return to_route('farms.show', [
            'farm' => $activity->farm_id,
            'tab' => 'activities',
        ]);
    }

    public function show(FarmActivity $activity): Response
    {
        $activity->load(['farm.farmer', 'activityType', 'creator']);
        $user = request()->user();

        return Inertia::render('farm-activities/show', [
            'activity' => $activity->present(),
            'can_edit' => $user instanceof User && $user->canAccess(UserRole::Operations),
        ]);
    }

    public function edit(FarmActivity $activity): Response
    {
        $activity->load(['farm.farmer', 'activityType']);

        return Inertia::render('farm-activities/edit', [
            'activity' => $activity->present(),
            'farm' => [
                'id' => $activity->farm_id,
                'farm_id' => $activity->farm->farm_id,
                'farm_name' => $activity->farm->displayName(),
                'farmer_name' => $activity->farm->farmer->fullName(),
                'crop_type' => $activity->farm->crop_type->value,
                'crop_label' => $activity->farm->crop_type->label(),
            ],
            'activityTypes' => $this->activityTypeOptions(
                includeInactive: false,
                includeId: $activity->activity_type_id,
            ),
            'statuses' => $this->statusOptions(),
        ]);
    }

    public function update(UpdateFarmActivityRequest $request, FarmActivity $activity, UpdateFarmActivity $update): RedirectResponse
    {
        $update->handle($activity, $request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farm activity updated.',
        ]);

        return to_route('farm-activities.show', $activity);
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
     * @return list<array{id: int, name: string, category: string|null}>
     */
    private function activityTypeOptions(bool $includeInactive, ?int $includeId = null): array
    {
        return ActivityType::query()
            ->when(! $includeInactive, function ($query) use ($includeId): void {
                $query->where(function ($query) use ($includeId): void {
                    $query->where('status', ActivityTypeStatus::Active);

                    if ($includeId !== null) {
                        $query->orWhere('id', $includeId);
                    }
                });
            })
            ->orderBy('name')
            ->get()
            ->map(fn (ActivityType $type): array => [
                'id' => $type->id,
                'name' => $type->status === ActivityTypeStatus::Inactive
                    ? $type->name.' (Inactive)'
                    : $type->name,
                'category' => $type->category?->label(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return array_values(collect(ActivityStatus::cases())
            ->map(fn (ActivityStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ])
            ->all());
    }
}
