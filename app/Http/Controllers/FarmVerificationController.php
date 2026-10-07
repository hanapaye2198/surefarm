<?php

namespace App\Http\Controllers;

use App\Actions\DecideFarmVerification;
use App\Actions\StartFarmVerification;
use App\CropType;
use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\Http\Requests\DecideFarmVerificationRequest;
use App\Http\Requests\StartFarmVerificationRequest;
use App\Models\Farm;
use App\Models\FarmVerification;
use App\Models\User;
use App\Services\FarmAreaComparison;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
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

        $farms = Farm::query()
            ->with(['farmer', 'boundary'])
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

    public function show(Farm $farm): Response
    {
        $farm->load([
            'farmer',
            'boundary.creator:id,name',
            'boundary.editor:id,name',
            'verifications.verifier:id,name',
        ]);

        $comparison = $this->areas->calculate(
            $farm->declared_area_hectares,
            $farm->boundary?->gps_measured_area_hectares,
        );

        return Inertia::render('farm-verification/show', [
            'farm' => [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->displayName(),
                'farmer_name' => $farm->farmer->fullName(),
                'farmer_id' => $farm->farmer->farmer_id,
                'crop_label' => $farm->crop_type->label(),
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
                'has_boundary' => $comparison !== null,
            ],
            'boundary' => $farm->boundary === null ? null : [
                'geojson' => $farm->boundary->boundary_geojson,
                'gps_measured_area_hectares' => (float) $farm->boundary->gps_measured_area_hectares,
                'captured_by' => $farm->boundary->creator?->name,
                'captured_at' => $farm->boundary->captured_at?->format('M j, Y'),
                'updated_by' => $farm->boundary->editor?->name,
                'updated_at' => $farm->boundary->updated_at?->format('M j, Y'),
            ],
            'history' => $farm->verifications
                ->map(fn (FarmVerification $verification): array => $verification->present())
                ->values()
                ->all(),
        ]);
    }

    public function store(StartFarmVerificationRequest $request, Farm $farm, StartFarmVerification $start): RedirectResponse
    {
        try {
            $start->handle($farm);
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
        $comparison = $this->areas->calculate(
            $farm->declared_area_hectares,
            $farm->boundary?->gps_measured_area_hectares,
        );

        return [
            'id' => $farm->id,
            'farm_id' => $farm->farm_id,
            'farm_name' => $farm->displayName(),
            'farmer_name' => $farm->farmer->fullName(),
            'crop_label' => $farm->crop_type->label(),
            'declared_area' => $this->areas->hectares((float) $farm->declared_area_hectares),
            'measured_area' => $comparison === null
                ? 'Not yet measured'
                : $this->areas->hectares($comparison['measured']),
            'variance' => $comparison === null
                ? '—'
                : $this->areas->percent($comparison['variance']),
            'verification_status' => $farm->verification_status->value,
        ];
    }

    private function statusCount(FarmVerificationStatus $status): int
    {
        return Farm::query()
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
        $options = Farm::query()
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->all();

        return array_values($options);
    }
}
