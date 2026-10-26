<?php

namespace App\Http\Controllers;

use App\Actions\RegisterFarm;
use App\Actions\UpdateFarmDetails;
use App\ActivityStatus;
use App\Contracts\FarmIdGenerator;
use App\CropType;
use App\FarmStatus;
use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\HarvestStatus;
use App\Http\Requests\StoreFarmRequest;
use App\Http\Requests\UpdateFarmRequest;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\FarmFinancing;
use App\Models\FarmHarvest;
use App\Models\FarmInsurance;
use App\Models\FarmProduction;
use App\Models\FarmVerification;
use App\Models\User;
use App\Services\FarmAreaComparison;
use App\Services\FarmFieldMap;
use App\Services\FarmPortfolio;
use App\Services\InventoryStock;
use App\Services\ProductionLedger;
use App\Services\RegistryScope;
use App\Services\TraceabilitySummary;
use App\UserRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class FarmController extends Controller
{
    public function __construct(
        private FarmAreaComparison $areas,
        private FarmPortfolio $portfolio,
        private ProductionLedger $ledger,
    ) {}

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $verificationStatus = $request->string('verification_status')->trim()->toString();
        $status = $request->string('status')->trim()->toString();
        $viewer = $request->user();
        $viewer = $viewer instanceof User ? $viewer : null;

        $farms = Farm::query()
            ->visibleTo($viewer)
            ->with(['farmer', 'boundary'])
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $crops = $this->matchingCrops($search);

                $query->where(function ($query) use ($like, $search, $crops): void {
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

                    if ($crops !== []) {
                        $query->orWhereIn('crop_type', $crops);
                    }
                });
            })
            ->when(
                FarmVerificationStatus::tryFrom($verificationStatus),
                fn ($query, FarmVerificationStatus $verificationStatus) => $query->where('verification_status', $verificationStatus),
            )
            ->when(
                FarmStatus::tryFrom($status),
                fn ($query, FarmStatus $status) => $query->where('status', $status),
            )
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Farm $farm): array => [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->displayName(),
                'farmer_name' => $farm->farmer->fullName(),
                'crop_label' => $farm->crop_type->label(),
                'declared_area_hectares' => (float) $farm->declared_area_hectares,
                'location' => $farm->locationLabel(),
                'verification_status' => $farm->verification_status->value,
                'geofence_status' => $farm->geofenceStatus(),
                'geofence_status_label' => $farm->geofenceStatusLabel(),
                'status' => $farm->status->value,
            ]);

        return Inertia::render('farms/index', [
            'farms' => $farms,
            'filters' => [
                'search' => $search,
                'verification_status' => $this->enumValue(FarmVerificationStatus::tryFrom($verificationStatus)),
                'status' => $this->enumValue(FarmStatus::tryFrom($status)),
            ],
            'verificationStatuses' => $this->verificationOptions(),
            'statuses' => $this->statusOptions(),
        ]);
    }

    public function chooseFarmer(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        $farmers = Farmer::query()
            ->withCount('farms')
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';

                $query->where(function ($query) use ($like): void {
                    $query->where('farmer_id', 'like', $like)
                        ->orWhere('first_name', 'like', $like)
                        ->orWhere('last_name', 'like', $like)
                        ->orWhere('mobile_number', 'like', $like);
                });
            })
            ->orderBy('last_name')
            ->orderBy('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Farmer $farmer): array => [
                'id' => $farmer->id,
                'farmer_id' => $farmer->farmer_id,
                'name' => $farmer->fullName(),
                'location' => $farmer->locationLabel(),
                'farms_count' => $farmer->farms_count,
            ]);

        return Inertia::render('farms/register', [
            'farmers' => $farmers,
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    public function create(Farmer $farmer, FarmIdGenerator $farmIds): Response
    {
        $nextSequence = ((int) Farm::query()->max('id')) + 1;

        return Inertia::render('farms/create', [
            'farmId' => $farmIds->fromSequence($nextSequence),
            'farmer' => [
                'id' => $farmer->id,
                'farmer_id' => $farmer->farmer_id,
                'full_name' => $farmer->fullName(),
                'purok_sitio' => $farmer->purok_sitio,
                'barangay' => $farmer->barangay,
                'municipality' => $farmer->municipality,
                'province' => $farmer->province,
            ],
            'cropTypes' => $this->portfolio->filterOptions()['crops'],
            'statuses' => $this->portfolio->filterOptions()['statuses'],
            'stages' => $this->portfolio->filterOptions()['stages'],
            'ownerships' => $this->portfolio->filterOptions()['ownerships'],
        ]);
    }

    public function store(StoreFarmRequest $request, Farmer $farmer, RegisterFarm $register, RegistryScope $scope): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $scope->ensureProvince($actor, $request->string('province')->trim()->toString());

        try {
            $farm = $register->handle(
                $farmer,
                $request->safe()->except(['drone_image']),
                $request->file('drone_image'),
                $actor,
            );
        } catch (Throwable $exception) {
            report($exception);

            return back()->withInput()->withErrors([
                'farm' => 'The farm could not be registered. Please try again.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farm registered successfully.',
        ]);

        return to_route('farms.show', $farm);
    }

    public function edit(Farm $farm): Response
    {
        $farm->load('farmer');

        return Inertia::render('farms/edit', [
            'farm' => [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->farm_name ?? '',
                'crop_type' => $farm->crop_type->value,
                'declared_area_hectares' => number_format((float) $farm->declared_area_hectares, 2, '.', ''),
                'purok_sitio' => $farm->purok_sitio ?? '',
                'barangay' => $farm->barangay ?? '',
                'municipality' => $farm->municipality ?? '',
                'province' => $farm->province ?? '',
                'latitude' => $farm->latitude ?? '',
                'longitude' => $farm->longitude ?? '',
                'status' => $farm->status->value,
                'current_stage' => $farm->current_stage?->value ?? '',
                'number_of_hills' => $farm->number_of_hills === null ? '' : (string) $farm->number_of_hills,
                'data_validated' => match ($farm->data_validated) {
                    true => '1',
                    false => '0',
                    default => '',
                },
                'property_ownership' => $farm->property_ownership?->value ?? '',
                'contracted_value_estimated' => $this->decimalInput($farm->contracted_value_estimated),
                'input_support_amount' => $this->decimalInput($farm->input_support_amount),
                'financing_support_amount' => $this->decimalInput($farm->financing_support_amount),
                'notes' => $farm->notes ?? '',
                'drone_image_url' => $farm->drone_image_path === null
                    ? null
                    : route('farms.drone-image', $farm),
                'farmer' => [
                    'id' => $farm->farmer->id,
                    'full_name' => $farm->farmer->fullName(),
                ],
            ],
            ...$this->portfolio->filterOptions(),
        ]);
    }

    public function update(
        UpdateFarmRequest $request,
        Farm $farm,
        UpdateFarmDetails $update,
    ): RedirectResponse {
        $previousVerificationStatus = $farm->verification_status;

        try {
            $updatedFarm = $update->handle(
                $farm,
                $request->safe()->except(['drone_image']),
                $request->file('drone_image'),
                $request->user() instanceof User ? $request->user() : null,
            );
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);

            return back()->withInput()->withErrors([
                'farm' => 'The farm details could not be saved. Please try again.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $previousVerificationStatus !== FarmVerificationStatus::NeedsReview
                && $updatedFarm->verification_status === FarmVerificationStatus::NeedsReview
                    ? 'Farm details saved. The previous verification is marked needs review; its verified area remains in the history.'
                    : 'Farm details saved.',
        ]);

        return to_route('farms.show', $farm);
    }

    public function show(Request $request, Farm $farm, InventoryStock $stock, TraceabilitySummary $traceability, FarmFieldMap $fieldMap): Response
    {
        $farm->load([
            'farmer',
            'boundary.creator:id,name',
            'boundary.editor:id,name',
            'areaDeclarations.recorder:id,name',
            'verifications.verifier:id,name',
            'verifications.starter:id,name',
            'verifications.boundaryCapturer:id,name',
            'verifications.photos.uploader:id,name',
            'insurances' => fn ($query) => $query->latest('id'),
            'financings' => fn ($query) => $query
                ->orderByRaw('date_granted is null')
                ->orderByDesc('date_granted')
                ->orderByDesc('id'),
        ]);

        $user = $request->user();
        $canManageCoverage = $user instanceof User && $user->canAccess(UserRole::Operations);
        $isLinkedFarmer = $user instanceof User
            && ! $user->isSuspended()
            && $user->role === UserRole::Farmer
            && (int) $farm->farmer->user_id === (int) $user->id;
        $canViewCoverage = $user instanceof User
            && ! $user->isSuspended()
            && ($user->canAccess(UserRole::Operations, UserRole::FieldVerifier) || $isLinkedFarmer);
        $reference = $this->portfolio->card($farm, 1, $farm->farmer->fullName());

        if (! $canManageCoverage) {
            unset($reference['contracted_value'], $reference['input_support'], $reference['financing_support']);
        }

        $comparison = $this->areaComparison($farm);
        $hidesPrivateCoverage = $user instanceof User
            && $user->hasRole(UserRole::FieldVerifier, UserRole::CooperativeOfficer);

        return Inertia::render('farms/show', [
            'farm' => [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->displayName(),
                'crop_label' => $farm->crop_type->label(),
                'declared_area_hectares' => (float) $farm->declared_area_hectares,
                'measured_area' => $comparison['measured_area'],
                'gps_measured_area_hectares' => $comparison['gps_measured_area_hectares'],
                'verified_area' => $farm->verified_area_hectares === null
                    ? 'Not yet verified'
                    : $this->areas->hectares((float) $farm->verified_area_hectares),
                'verifications' => $farm->verifications
                    ->map(fn (FarmVerification $verification): array => $verification->present())
                    ->values()
                    ->all(),
                'area_declarations' => $farm->areaDeclarations
                    ->map(fn ($declaration): array => $declaration->present())
                    ->values()
                    ->all(),
                'documents' => $this->documents($farm),
                'difference' => $comparison['difference'],
                'variance' => $comparison['variance'],
                'boundary' => $farm->boundary === null ? null : [
                    'geojson' => $farm->boundary->boundary_geojson,
                    'gps_point_accuracies' => $farm->boundary->gps_point_accuracies,
                    'gps_point_captured_at' => $farm->boundary->gps_point_captured_at,
                    'capture_method' => $farm->boundary->capture_method,
                    'gps_measured_area_hectares' => (float) $farm->boundary->gps_measured_area_hectares,
                    'captured_by' => $farm->boundary->creator?->name,
                    'captured_at' => $farm->boundary->captured_at?->format('M j, Y g:i A'),
                    'updated_by' => $farm->boundary->editor?->name,
                    'updated_at' => $farm->boundary->updated_at?->format('M j, Y'),
                ],
                'can_manage_boundary' => $user instanceof User
                    && ! $user->isSuspended()
                    && (
                        ($user->canAccess(UserRole::Operations)
                            && $farm->verification_status !== FarmVerificationStatus::InProgress
                            && ! $this->hasVerifiedBoundary($farm))
                        || ($user->hasRole(UserRole::FieldVerifier, UserRole::Admin)
                            && $request->is('api/mobile/*')
                            && $farm->verification_status === FarmVerificationStatus::InProgress
                            && app(RegistryScope::class)->canViewFarm($user, $farm))
                    ),
                'can_remove_boundary' => $user instanceof User
                    && $user->role === UserRole::Admin
                    && $farm->verification_status !== FarmVerificationStatus::InProgress
                    && ! $this->hasVerifiedBoundary($farm),
                'boundary_review' => $fieldMap->review($farm, $user instanceof User ? $user : null),
                'purok_sitio' => $farm->purok_sitio,
                'barangay' => $farm->barangay,
                'municipality' => $farm->municipality,
                'province' => $farm->province,
                'latitude' => $farm->latitude,
                'longitude' => $farm->longitude,
                'verification_status' => $farm->verification_status->value,
                'geofence_status' => $farm->geofenceStatus(),
                'geofence_status_label' => $farm->geofenceStatusLabel(),
                'status' => $farm->status->value,
                'notes' => $farm->notes,
                'registered_at' => $farm->created_at?->format('F j, Y'),
                'updated_at' => $farm->updated_at?->format('F j, Y'),
                'farmer' => [
                    'id' => $farm->farmer->id,
                    'farmer_id' => $farm->farmer->farmer_id,
                    'full_name' => $farm->farmer->fullName(),
                ],
                'reference' => $reference,
                'can_edit' => $user instanceof User && $user->canAccess(UserRole::Operations),
                'can_record_activity' => $user instanceof User && $user->canAccess(UserRole::Operations),
                'can_record_production' => $user instanceof User && $user->canAccess(UserRole::Operations),
                'recent_activity' => $this->recentActivityLabel($farm),
                'activity_summary' => $this->activitySummary($farm),
                'activities' => $this->farmActivities($farm),
                'production_summary' => $this->ledger->farmSummary($farm),
                'productions' => $this->farmProductions($farm),
                'harvests' => $this->farmHarvests($farm),
                'can_manage_coverage' => $canManageCoverage,
                'insurances' => $hidesPrivateCoverage || ! $canViewCoverage
                    ? []
                    : $farm->insurances
                        ->map(fn (FarmInsurance $insurance): array => $insurance->present())
                        ->values()
                        ->all(),
                'financings' => $hidesPrivateCoverage || ! $canViewCoverage
                    ? []
                    : $farm->financings
                        ->map(function (FarmFinancing $financing) use ($canManageCoverage): array {
                            $presented = $financing->present();

                            if ($canManageCoverage) {
                                $presented['finance_url'] = route('finance.show', $financing);
                            }

                            return $presented;
                        })
                        ->values()
                        ->all(),
                'inventory_summary' => $stock->balances($farm->id),
                'traceability_lots' => $traceability->forFarm($farm->id),
            ],
            'google_maps_api_key' => config('services.google_maps.browser_api_key'),
        ]);
    }

    public function droneImage(Farm $farm): StreamedResponse
    {
        if ($farm->drone_image_path === null || ! Storage::disk('local')->exists($farm->drone_image_path)) {
            abort(404);
        }

        return Storage::disk('local')->response($farm->drone_image_path);
    }

    public function signedDroneImage(Farm $farm): StreamedResponse
    {
        if ($farm->drone_image_path === null || ! Storage::disk('local')->exists($farm->drone_image_path)) {
            abort(404);
        }

        return Storage::disk('local')->response($farm->drone_image_path);
    }

    /**
     * Web-map measured area stays separate from declared area.
     * A missing boundary is not shown as 0.00 ha.
     *
     * @return array{
     *     measured_area: string,
     *     gps_measured_area_hectares: float|null,
     *     difference: string,
     *     variance: string
     * }
     */
    private function areaComparison(Farm $farm): array
    {
        $comparison = $this->areas->calculate(
            $farm->declared_area_hectares,
            $farm->boundary?->gps_measured_area_hectares,
        );

        if ($comparison === null) {
            return [
                'measured_area' => 'Not yet measured',
                'gps_measured_area_hectares' => null,
                'difference' => '—',
                'variance' => '—',
            ];
        }

        return [
            'measured_area' => $this->areas->hectares($comparison['measured']),
            'gps_measured_area_hectares' => $comparison['measured'],
            'difference' => $this->areas->hectares($comparison['difference']),
            'variance' => $this->areas->percent($comparison['variance']),
        ];
    }

    private function hasVerifiedBoundary(Farm $farm): bool
    {
        if ($farm->verified_area_hectares !== null || $farm->verification_status === FarmVerificationStatus::Verified) {
            return true;
        }

        return $farm->verifications->contains(
            fn (FarmVerification $verification): bool => $verification->result === FarmVerificationResult::Verified,
        );
    }

    /**
     * @return list<string>
     */
    private function matchingCrops(string $search): array
    {
        $needle = mb_strtolower($search);

        return array_values(collect(CropType::cases())
            ->filter(fn (CropType $crop): bool => str_contains(mb_strtolower($crop->label()), $needle)
                || str_contains($crop->value, $needle))
            ->map(fn (CropType $crop): string => $crop->value)
            ->all());
    }

    private function enumValue(FarmVerificationStatus|FarmStatus|null $status): string
    {
        if ($status === null) {
            return '';
        }

        return $status->value;
    }

    /**
     * Activities for this farm only. Counts come from the same rows.
     *
     * @return list<array<string, mixed>>
     */
    private function farmActivities(Farm $farm): array
    {
        return $farm->activities()
            ->with(['activityType', 'creator'])
            ->orderByDesc('activity_date')
            ->orderByDesc('id')
            ->get()
            ->each(fn (FarmActivity $activity) => $activity->setRelation('farm', $farm))
            ->map(fn (FarmActivity $activity): array => $activity->present())
            ->values()
            ->all();
    }

    /**
     * @return array{total: int, completed: int, in_progress: int, planned: int, cancelled: int}
     */
    private function activitySummary(Farm $farm): array
    {
        $counts = $farm->activities()
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $completed = (int) ($counts[ActivityStatus::Completed->value] ?? 0);
        $inProgress = (int) ($counts[ActivityStatus::InProgress->value] ?? 0);
        $planned = (int) ($counts[ActivityStatus::Planned->value] ?? 0);
        $cancelled = (int) ($counts[ActivityStatus::Cancelled->value] ?? 0);

        return [
            'total' => $completed + $inProgress + $planned + $cancelled,
            'completed' => $completed,
            'in_progress' => $inProgress,
            'planned' => $planned,
            'cancelled' => $cancelled,
        ];
    }

    private function recentActivityLabel(Farm $farm): string
    {
        $latest = $farm->activities()
            ->with('activityType')
            ->orderByDesc('activity_date')
            ->orderByDesc('id')
            ->first();

        return $latest?->activityType?->name ?? 'No farm activities recorded yet.';
    }

    /**
     * Files already stored for this farm. There is no separate documents table.
     *
     * @return list<array{id: string, label: string, name: string, href: string, recorded_at: string|null}>
     */
    private function documents(Farm $farm): array
    {
        $documents = [];

        if ($farm->drone_image_path !== null) {
            $documents[] = [
                'id' => 'drone-'.$farm->id,
                'label' => 'Drone image',
                'name' => $farm->displayName(),
                'href' => route('farms.drone-image', $farm),
                'recorded_at' => $farm->updated_at?->format('M j, Y'),
            ];
        }

        foreach ($farm->verifications as $verification) {
            foreach ($verification->photos as $photo) {
                $presented = $photo->present();
                $name = $presented['name'] ?? null;

                $documents[] = [
                    'id' => 'photo-'.$photo->id,
                    'label' => 'Verification photo',
                    'name' => is_string($name) && $name !== '' ? $name : 'Photo',
                    'href' => is_string($presented['url'] ?? null) ? $presented['url'] : route('farms.show', $farm),
                    'recorded_at' => Carbon::parse($verification->verified_at ?? $verification->created_at)->format('M j, Y'),
                ];
            }
        }

        return $documents;
    }

    private function decimalInput(mixed $amount): string
    {
        if ($amount === null || $amount === '') {
            return '';
        }

        return number_format((float) $amount, 2, '.', '');
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function verificationOptions(): array
    {
        return array_values(collect(FarmVerificationStatus::cases())
            ->map(fn (FarmVerificationStatus $status): array => [
                'value' => $status->value,
                'label' => str_replace('_', ' ', ucfirst($status->value)),
            ])
            ->all());
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return array_values(collect(FarmStatus::cases())
            ->map(fn (FarmStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ])
            ->all());
    }

    /**
     * Expected production for this farm, with completed harvest totals.
     *
     * @return list<array<string, mixed>>
     */
    private function farmProductions(Farm $farm): array
    {
        return $farm->productions()
            ->withSum(['harvests as harvested_quantity' => function ($query): void {
                $query->where('status', HarvestStatus::Completed)
                    ->whereColumn('farm_harvests.unit', 'farm_productions.unit');
            }], 'quantity')
            ->orderByDesc('id')
            ->get()
            ->each(function (FarmProduction $production) use ($farm): void {
                $production->setRelation('farm', $farm);
            })
            ->map(fn (FarmProduction $production): array => $production->present())
            ->values()
            ->all();
    }

    /**
     * Harvest history for this farm only.
     *
     * @return list<array<string, mixed>>
     */
    private function farmHarvests(Farm $farm): array
    {
        return $farm->harvests()
            ->with(['production', 'creator'])
            ->orderByDesc('harvest_date')
            ->orderByDesc('id')
            ->get()
            ->each(function (FarmHarvest $harvest) use ($farm): void {
                $harvest->setRelation('farm', $farm);
            })
            ->map(fn (FarmHarvest $harvest): array => $harvest->present())
            ->values()
            ->all();
    }
}
