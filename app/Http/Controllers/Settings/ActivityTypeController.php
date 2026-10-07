<?php

namespace App\Http\Controllers\Settings;

use App\ActivityCategory;
use App\ActivityTypeStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreActivityTypeRequest;
use App\Http\Requests\UpdateActivityTypeRequest;
use App\Models\ActivityType;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ActivityTypeController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('activity-types/index', [
            'activityTypes' => ActivityType::query()
                ->withCount('activities')
                ->orderBy('name')
                ->get()
                ->map(fn (ActivityType $type): array => $this->present($type))
                ->values()
                ->all(),
            'categories' => $this->categories(),
            'statuses' => $this->statuses(),
        ]);
    }

    public function store(StoreActivityTypeRequest $request): RedirectResponse
    {
        ActivityType::query()->create($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Activity type created.',
        ]);

        return to_route('activity-types.index');
    }

    public function edit(ActivityType $activityType): Response
    {
        return Inertia::render('activity-types/edit', [
            'activityType' => $this->present($activityType),
            'categories' => $this->categories(),
            'statuses' => $this->statuses(),
        ]);
    }

    public function update(UpdateActivityTypeRequest $request, ActivityType $activityType): RedirectResponse
    {
        $activityType->update($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Activity type updated.',
        ]);

        return to_route('activity-types.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function present(ActivityType $type): array
    {
        return [
            'id' => $type->id,
            'name' => $type->name,
            'code' => $type->code,
            'description' => $type->description,
            'category' => $type->category?->value,
            'category_label' => $type->category?->label() ?? '—',
            'status' => $type->status->value,
            'status_label' => $type->status->label(),
            'activities_count' => $type->activities_count ?? null,
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function categories(): array
    {
        return array_values(collect(ActivityCategory::cases())
            ->map(fn (ActivityCategory $category): array => [
                'value' => $category->value,
                'label' => $category->label(),
            ])
            ->all());
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function statuses(): array
    {
        return array_values(collect(ActivityTypeStatus::cases())
            ->map(fn (ActivityTypeStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ])
            ->all());
    }
}
