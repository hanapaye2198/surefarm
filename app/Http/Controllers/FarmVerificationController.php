<?php

namespace App\Http\Controllers;

use App\Actions\DecideFarmVerification;
use App\Actions\StartFarmVerification;
use App\CropType;
use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\Http\Requests\DecideFarmVerificationRequest;
use App\Http\Requests\StartFarmVerificationRequest;
use App\Http\Requests\StoreFarmVerificationInspectionRequest;
use App\Models\Farm;
use App\Models\FarmVerification;
use App\Models\FarmVerificationPhoto;
use App\Models\User;
use App\Services\FarmAreaComparison;
use App\Services\RegistryScope;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class FarmVerificationController extends Controller
{
    public function __construct(private FarmAreaComparison $areas) {}

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $verificationStatus = $request->string('verification_status')->trim()->toString();
        $crop = $request->string('crop')->trim()->toString();
        $province = $request->string('province')->trim()->toString();
        $municipality = $request->string('municipality')->trim()->toString();
        $mobileQueue = $request->is('api/mobile/*')
            ? $request->string('queue')->trim()->toString()
            : '';
        $farms = $this->visibleFarms()
            ->with([
                'farmer',
                'boundary',
                'verifications' => fn (Relation $query) => $query
                    ->whereNull('result')
                    ->select([
                        'id',
                        'farm_id',
                        'result',
                        'boundary_revision',
                        'boundary_captured_at',
                        'started_at',
                        'boundary_capture_method',
                        'boundary_geojson',
                        'gps_point_captured_at',
                        'measured_area_hectares',
                    ]),
            ])
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';

                $query->where(function ($query) use ($like, $search): void {
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
                });
            })
            ->when(
                FarmVerificationStatus::tryFrom($verificationStatus),
                fn ($query, FarmVerificationStatus $verificationStatus) => $query->where('verification_status', $verificationStatus),
            )
            ->when($mobileQueue === 'assignments', fn ($query) => $query->whereIn('verification_status', [
                FarmVerificationStatus::Pending,
                FarmVerificationStatus::InProgress,
            ]))
            ->when($mobileQueue === 'history', fn ($query) => $query->whereIn('verification_status', [
                FarmVerificationStatus::Verified,
                FarmVerificationStatus::Failed,
                FarmVerificationStatus::NeedsReview,
            ]))
            ->when(
                CropType::tryFrom($crop),
                fn ($query, CropType $crop) => $query->where('crop_type', $crop),
            )
            ->when($province !== '', fn ($query) => $query->where('province', $province))
            ->when($municipality !== '', fn ($query) => $query->where('municipality', $municipality))
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Farm $farm): array => $this->listRow($farm));

        return Inertia::render('farm-verification/index', [
            'farms' => $farms,
            'filters' => [
                'search' => $search,
                'verification_status' => $this->enumValue(FarmVerificationStatus::tryFrom($verificationStatus)),
                'crop' => $this->cropValue(CropType::tryFrom($crop)),
                'province' => $province,
                'municipality' => $municipality,
            ],
            'summary' => [
                'pending' => $this->statusCount(FarmVerificationStatus::Pending),
                'in_progress' => $this->statusCount(FarmVerificationStatus::InProgress),
                'verified' => $this->statusCount(FarmVerificationStatus::Verified),
                'failed' => $this->statusCount(FarmVerificationStatus::Failed),
                'needs_review' => $this->statusCount(FarmVerificationStatus::NeedsReview),
            ],
            'verificationStatuses' => $this->statusOptions(),
            'crops' => $this->cropOptions(),
            'provinces' => $this->locationOptions('province'),
            'municipalities' => $this->locationOptions('municipality'),
        ]);
    }

    public function show(Request $request, Farm $farm): Response
    {
        $this->authorizeAssignedFarm($request->user(), $farm);
        $farm->load([
            'farmer',
            'boundary.creator:id,name',
            'boundary.editor:id,name',
            'verifications.verifier:id,name',
            'verifications.starter:id,name',
            'verifications.boundaryCapturer:id,name',
            'verifications.photos.uploader:id,name',
        ]);
        $openVerification = $farm->verifications->first(fn (FarmVerification $verification): bool => $verification->result === null);
        $hasFreshCandidate = $openVerification?->hasFreshBoundaryCapture() === true;
        $comparisonMeasuredArea = $openVerification !== null
            ? ($hasFreshCandidate ? $openVerification->measured_area_hectares : null)
            : $farm->boundary?->gps_measured_area_hectares;

        $comparison = $this->areas->calculate(
            $farm->declared_area_hectares,
            $comparisonMeasuredArea,
        );
        $canManageBoundary = $openVerification !== null
            && $request->is('api/mobile/*')
            && $farm->verification_status === FarmVerificationStatus::InProgress
            && $request->user() instanceof User
            && ! $request->user()->isSuspended()
            && $request->user()->hasRole(UserRole::FieldVerifier, UserRole::Admin)
            && app(RegistryScope::class)->canViewFarm($request->user(), $farm);

        $boundary = $hasFreshCandidate
            ? [
                'geojson' => $openVerification->boundary_geojson,
                'gps_point_accuracies' => $openVerification->gps_point_accuracies,
                'gps_point_captured_at' => $openVerification->gps_point_captured_at,
                'capture_method' => $openVerification->boundary_capture_method,
                'gps_measured_area_hectares' => (float) $openVerification->measured_area_hectares,
                'captured_by' => $openVerification->boundaryCapturer?->name,
                'captured_at' => $openVerification->boundary_captured_at === null
                    ? null
                    : Carbon::parse($openVerification->boundary_captured_at)->format('M j, Y g:i A'),
                'updated_by' => null,
                'updated_at' => null,
                'can_manage_boundary' => $canManageBoundary,
            ]
            : ($farm->boundary === null ? null : [
                'geojson' => $farm->boundary->boundary_geojson,
                'gps_point_accuracies' => $farm->boundary->gps_point_accuracies,
                'gps_point_captured_at' => $farm->boundary->gps_point_captured_at,
                'capture_method' => $farm->boundary->capture_method,
                'gps_measured_area_hectares' => (float) $farm->boundary->gps_measured_area_hectares,
                'captured_by' => $farm->boundary->creator?->name,
                'captured_at' => $farm->boundary->captured_at?->format('M j, Y g:i A'),
                'updated_by' => $farm->boundary->editor?->name,
                'updated_at' => $farm->boundary->updated_at?->format('M j, Y'),
                'can_manage_boundary' => $canManageBoundary,
            ]);

        return Inertia::render('farm-verification/show', [
            'farm' => [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->displayName(),
                'farmer_name' => $farm->farmer->fullName(),
                'farmer_id' => $farm->farmer->farmer_id,
                'crop_label' => $farm->crop_type->label(),
                'geofence_status' => $farm->geofenceStatus(),
                'geofence_status_label' => $farm->geofenceStatusLabel(),
                'location' => $this->location($farm),
                'farm_status' => $farm->status->value,
                'verification_status' => $farm->verification_status->value,
                'verified_area' => $farm->verified_area_hectares === null
                    ? 'Not yet verified'
                    : $this->areas->hectares((float) $farm->verified_area_hectares),
                'declared_area_hectares' => (float) $farm->declared_area_hectares,
                'latitude' => $farm->latitude,
                'longitude' => $farm->longitude,
            ],
            'comparison' => [
                'declared_area' => $this->areas->hectares((float) $farm->declared_area_hectares),
                'measured_area' => $comparison === null
                    ? 'Not yet measured'
                    : $this->areas->hectares($comparison['measured']),
                'difference' => $comparison === null
                    ? '—'
                    : $this->areas->hectares($comparison['difference']),
                'variance' => $comparison === null
                    ? '—'
                    : $this->areas->percent($comparison['variance']),
                // An accepted boundary remains viewable as a reference during
                // re-verification, even before the new attempt has a capture.
                'has_boundary' => $farm->boundary !== null || $hasFreshCandidate,
            ],
            'boundary' => $boundary,
            'history' => $farm->verifications
                ->map(fn (FarmVerification $verification): array => $verification->present())
                ->values()
                ->all(),
            'inspection' => $openVerification === null ? null : [
                'checklist' => $openVerification->inspection_checklist ?? [],
                'verification_reference' => $openVerification->verification_reference,
                'boundary_revision' => (int) $openVerification->boundary_revision,
                'boundary_captured_for_attempt' => $openVerification->hasFreshBoundaryCapture(),
                'photos' => $openVerification->photos
                    ->where('boundary_revision', (int) $openVerification->boundary_revision)
                    ->map(fn ($photo): array => $photo->present())
                    ->values()
                    ->all(),
            ],
            'google_maps_api_key' => config('services.google_maps.browser_api_key'),
        ]);
    }

    public function store(StartFarmVerificationRequest $request, Farm $farm, StartFarmVerification $start): RedirectResponse
    {
        try {
            $actor = $request->user();

            if (! $actor instanceof User) {
                abort(403);
            }

            $start->handle($farm, $actor, $request->is('api/mobile/*'));
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);

            return back()->withErrors([
                'verification' => 'The verification could not be started. Please try again.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Verification started.',
        ]);

        return to_route('farm-verification.show', $farm);
    }

    public function update(DecideFarmVerificationRequest $request, Farm $farm, DecideFarmVerification $decide): RedirectResponse
    {
        $verifier = $request->user();

        if (! $verifier instanceof User) {
            abort(403);
        }

        $result = $request->validated('result');
        $decision = $result instanceof FarmVerificationResult
            ? $result
            : FarmVerificationResult::from((string) $result);

        $remarks = $request->validated('remarks');

        try {
            $decide->handle(
                $farm,
                $verifier,
                $decision,
                is_string($remarks) ? $remarks : null,
            );
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);

            return back()->withErrors([
                'verification' => 'The verification could not be saved. Please try again.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Verification result saved.',
        ]);

        return to_route('farm-verification.show', $farm);
    }

    public function inspection(StoreFarmVerificationInspectionRequest $request, Farm $farm): RedirectResponse
    {
        $photo = $request->file('evidence_photo');
        $path = $photo?->store('farm-verifications/evidence', 'local');

        if (! is_string($path)) {
            return back()->withErrors(['evidence_photo' => 'The evidence photo could not be saved.']);
        }

        try {
            DB::transaction(function () use ($request, $farm, $photo, $path): void {
                $lockedFarm = Farm::query()->lockForUpdate()->findOrFail($farm->id);

                if ($lockedFarm->verification_status !== FarmVerificationStatus::InProgress) {
                    throw ValidationException::withMessages([
                        'verification' => 'This verification is no longer open.',
                    ]);
                }

                $verification = $lockedFarm->verifications()
                    ->whereNull('result')
                    ->lockForUpdate()
                    ->latest('id')
                    ->first();

                if ($verification === null || ! $verification->hasFreshBoundaryCapture()) {
                    throw ValidationException::withMessages([
                        'verification' => 'Start the verification and save its GPS boundary before adding inspection evidence.',
                    ]);
                }

                $submittedRevision = $request->validated('boundary_revision');
                if ((int) $submittedRevision !== (int) $verification->boundary_revision) {
                    throw ValidationException::withMessages([
                        'verification' => 'The farm boundary changed in another session. Reload this page and review the updated boundary before continuing.',
                    ]);
                }

                $verification->photos()->create([
                    'evidence_type' => $request->validated('evidence_type') ?? 'general_farm_view',
                    'boundary_revision' => $verification->boundary_revision,
                    'storage_path' => $path,
                    'original_name' => $photo->getClientOriginalName(),
                    'mime_type' => $photo->getMimeType() ?? 'application/octet-stream',
                    'file_size' => $photo->getSize(),
                    'captured_at' => filled($request->validated('captured_at'))
                        ? Carbon::parse($request->validated('captured_at'))
                        : null,
                    'latitude' => $request->validated('latitude'),
                    'longitude' => $request->validated('longitude'),
                    'uploaded_by' => $request->user()?->id,
                ]);

                $checklist = [
                    'farm_exists' => (bool) $request->validated('farm_exists'),
                    'location_matches' => (bool) $request->validated('location_matches'),
                    'crop_observed' => (bool) $request->validated('crop_observed'),
                    'boundary_captured' => (bool) $request->validated('boundary_captured'),
                    'area_checked' => (bool) $request->validated('area_checked'),
                    'required_photos_captured' => $verification->photos()
                        ->where('boundary_revision', $verification->boundary_revision)
                        ->exists(),
                    'farmer_or_representative_met' => (bool) $request->validated('farmer_or_representative_met'),
                    'observations' => $request->validated('remarks'),
                ];

                $verification->update([
                    'inspection_checklist' => $checklist,
                ]);
            });
        } catch (ValidationException $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($path);
            report($exception);

            return back()->withErrors(['evidence_photo' => 'The inspection evidence could not be saved. Please try again.']);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Inspection checklist and evidence saved.']);

        return to_route('farm-verification.show', $farm);
    }

    public function photo(Request $request, FarmVerificationPhoto $photo): StreamedResponse
    {
        $photo->loadMissing('verification.farm');
        $farm = $photo->verification?->farm;
        $user = $request->user();

        abort_unless($user instanceof User && $farm instanceof Farm, 404);

        $canView = app(RegistryScope::class)->canViewFarm($user, $farm);

        abort_unless($canView, 404);
        abort_unless(Storage::disk('local')->exists($photo->storage_path), 404);

        return Storage::disk('local')->response($photo->storage_path);
    }

    public function signedPhoto(FarmVerificationPhoto $photo): StreamedResponse
    {
        abort_unless(Storage::disk('local')->exists($photo->storage_path), 404);

        return Storage::disk('local')->response($photo->storage_path);
    }

    /**
     * @return array{
     *     id: int,
     *     farm_id: string,
     *     farm_name: string,
     *     farmer_name: string,
     *     crop_label: string,
     *     declared_area: string,
     *     measured_area: string,
     *     variance: string,
     *     verification_status: string
     * }
     */
    private function listRow(Farm $farm): array
    {
        $openVerification = $farm->verifications->first();
        $hasFreshCandidate = $openVerification?->hasFreshBoundaryCapture() === true;
        $measuredArea = $openVerification !== null
            ? ($hasFreshCandidate ? $openVerification->measured_area_hectares : null)
            : $farm->boundary?->gps_measured_area_hectares;
        $comparison = $this->areas->calculate(
            $farm->declared_area_hectares,
            $measuredArea,
        );

        return [
            'id' => $farm->id,
            'farm_id' => $farm->farm_id,
            'farm_name' => $farm->displayName(),
            'farmer_name' => $farm->farmer->fullName(),
            'farmer_id' => $farm->farmer->farmer_id,
            'location' => $farm->locationLabel(),
            'crop_label' => $farm->crop_type->label(),
            'declared_area' => $this->areas->hectares((float) $farm->declared_area_hectares),
            'boundary_saved' => $openVerification !== null
                ? $hasFreshCandidate
                : $farm->boundary !== null,
            'geofence_status' => $farm->geofenceStatus(),
            'geofence_status_label' => $farm->geofenceStatusLabel(),
            'measured_area' => $comparison === null
                ? 'Not yet measured'
                : $this->areas->hectares($comparison['measured']),
            'variance' => $comparison === null
                ? '—'
                : $this->areas->percent($comparison['variance']),
            'verification_status' => $farm->verification_status->value,
        ];
    }

    /**
     * Registry scope stays in place for every role. Field verifier access
     * comes from open farm_verifier_assignments records.
     *
     * @return Builder<Farm>
     */
    private function visibleFarms(): Builder
    {
        $viewer = $this->registryViewer();

        if ($viewer instanceof User && $viewer->isSuspended()) {
            return Farm::query()->whereRaw('0 = 1');
        }

        return Farm::query()->visibleTo($viewer);
    }

    private function statusCount(FarmVerificationStatus $status): int
    {
        return $this->visibleFarms()
            ->where('verification_status', $status)
            ->count();
    }

    private function location(Farm $farm): string
    {
        $location = collect([
            $farm->purok_sitio,
            $farm->barangay,
            $farm->municipality,
            $farm->province,
        ])->filter(fn (?string $part): bool => $part !== null && trim($part) !== '')->implode(', ');

        return $location !== '' ? $location : '—';
    }

    private function enumValue(?FarmVerificationStatus $status): string
    {
        return $status === null ? '' : $status->value;
    }

    private function cropValue(?CropType $crop): string
    {
        return $crop === null ? '' : $crop->value;
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function statusOptions(): array
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
    private function locationOptions(string $column): array
    {
        $options = $this->visibleFarms()
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->all();

        return array_values($options);
    }

    private function authorizeAssignedFarm(mixed $user, Farm $farm): void
    {
        abort_unless(
            $user instanceof User && app(RegistryScope::class)->canViewFarm($user, $farm),
            404,
        );
    }
}
