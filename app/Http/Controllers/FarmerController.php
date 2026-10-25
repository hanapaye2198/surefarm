<?php

namespace App\Http\Controllers;

use App\Actions\RegisterFarmer;
use App\Actions\UpdateFarmerDetails;
use App\BankAccountStatus;
use App\Contracts\FarmerIdGenerator;
use App\CooperativeStatus;
use App\Http\Requests\StoreFarmerRequest;
use App\Http\Requests\UpdateFarmerDetailsRequest;
use App\Models\Cooperative;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\FarmFinancing;
use App\Models\FarmInsurance;
use App\Models\FarmVerification;
use App\Models\FarmVerificationPhoto;
use App\Models\User;
use App\Services\FarmPortfolio;
use App\Services\InventoryStock;
use App\Services\ProductionLedger;
use App\Services\RegistryScope;
use App\Services\TraceabilitySummary;
use App\UserRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class FarmerController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();
        $viewer = $request->user();
        $viewer = $viewer instanceof User ? $viewer : null;

        $farmers = Farmer::query()
            ->visibleTo($viewer)
            ->with('cooperative')
            ->withCount(['farms' => fn ($query) => $query->visibleTo($viewer)])
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';

                $query->where(function ($query) use ($like): void {
                    $query->where('farmer_id', 'like', $like)
                        ->orWhere('first_name', 'like', $like)
                        ->orWhere('last_name', 'like', $like)
                        ->orWhere('mobile_number', 'like', $like);
                });
            })
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Farmer $farmer): array => [
                'id' => $farmer->id,
                'farmer_id' => $farmer->farmer_id,
                'name' => $farmer->fullName(),
                'location' => $farmer->locationLabel(),
                'cooperative' => $farmer->cooperative?->name,
                'farms_count' => $farmer->farms_count,
                'status' => $farmer->status->value,
            ]);

        return Inertia::render('farmers/index', [
            'farmers' => $farmers,
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    public function create(FarmerIdGenerator $farmerIds): Response
    {
        $nextSequence = ((int) Farmer::query()->max('id')) + 1;

        return Inertia::render('farmers/create', [
            'farmerId' => $farmerIds->fromSequence($nextSequence),
            'cooperatives' => Cooperative::query()
                ->where('status', CooperativeStatus::Active)
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function store(StoreFarmerRequest $request, RegisterFarmer $register, RegistryScope $scope): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $scope->ensureProvince($actor, $request->string('province')->trim()->toString());

        try {
            $farmer = $register->handle(
                $request->safe()->except(['photo']),
                $request->file('photo'),
                $actor,
            );
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);

            return back()->withInput()->withErrors([
                'farmer' => 'The farmer could not be registered. Please try again.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farmer registered successfully.',
        ]);

        return to_route('farmers.show', $farmer);
    }

    public function edit(Farmer $farmer): Response
    {
        $farmer->load('bankAccount');
        $account = $farmer->bankAccount;

        return Inertia::render('farmers/edit', [
            'farmer' => [
                'id' => $farmer->id,
                'farmer_id' => $farmer->farmer_id,
                'full_name' => $farmer->fullName(),
                'suffix' => $farmer->suffix,
                'user_id' => $farmer->user_id === null ? '' : (string) $farmer->user_id,
                'date_of_birth' => $farmer->date_of_birth?->format('Y-m-d') ?? '',
                'government_id' => $farmer->government_id ?? '',
                'sitio_purok_code' => $farmer->sitio_purok_code ?? '',
                'barangay_code' => $farmer->barangay_code ?? '',
                'lgu_code' => $farmer->lgu_code ?? '',
                'security_control_code' => $farmer->security_control_code ?? '',
                'has_bank_account' => $account !== null,
                'bank_name' => $account?->bank_name ?? '',
                'account_number' => '',
                'account_number_hint' => $account?->maskedAccountNumber(),
                'account_name' => $account?->account_name ?? $farmer->fullName(),
                'bank_account_status' => $account?->status->value ?? BankAccountStatus::Unverified->value,
            ],
        ]);
    }

    public function update(
        UpdateFarmerDetailsRequest $request,
        Farmer $farmer,
        UpdateFarmerDetails $update,
    ): RedirectResponse {
        try {
            $update->handle($farmer, $request->validated());
        } catch (Throwable $exception) {
            report($exception);

            return back()->withInput()->withErrors([
                'farmer' => 'The farmer details could not be saved. Please try again.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farmer details saved.',
        ]);

        return to_route('farmers.show', $farmer);
    }

    public function show(Farmer $farmer, FarmPortfolio $portfolio, ProductionLedger $ledger, InventoryStock $stock, TraceabilitySummary $traceability): Response
    {
        $viewer = request()->user();
        $viewer = $viewer instanceof User ? $viewer : null;
        $canViewSensitiveDetails = $viewer instanceof User
            && ! $viewer->isSuspended()
            && $viewer->canAccess(UserRole::Operations);

        $farmer->load([
            'spouse',
            'cooperative',
            'bankAccount',
            'farms' => fn ($query) => $query->visibleTo($viewer)->with([
                'boundary',
                'insurances' => fn ($insurance) => $insurance->latest('id'),
                'financings' => fn ($financing) => $financing->orderByDesc('date_granted')->orderByDesc('id'),
            ])->orderBy('id'),
        ]);

        $farms = $farmer->farms->values();

        return Inertia::render('farmers/show', [
            'farmer' => [
                'id' => $farmer->id,
                'farmer_id' => $farmer->farmer_id,
                'full_name' => $farmer->fullName(),
                'first_name' => $farmer->first_name,
                'middle_name' => $farmer->middle_name,
                'last_name' => $farmer->last_name,
                'suffix' => $farmer->suffix,
                'sitio_purok_code' => $farmer->sitio_purok_code,
                'barangay_code' => $farmer->barangay_code,
                'lgu_code' => $farmer->lgu_code,
                'security_control_code' => $farmer->security_control_code,
                'date_of_birth' => $farmer->date_of_birth?->format('F j, Y'),
                'government_id' => $canViewSensitiveDetails ? $farmer->government_id : null,
                'address' => $farmer->addressLabel(),
                'photo_url' => $farmer->photo_path !== null
                    ? route('farmers.photo', $farmer)
                    : null,
                'purok_sitio' => $farmer->purok_sitio,
                'barangay' => $farmer->barangay,
                'municipality' => $farmer->municipality,
                'province' => $farmer->province,
                'mobile_number' => $farmer->mobile_number,
                'email' => $farmer->email,
                'status' => $farmer->status->value,
                'cooperative' => $farmer->cooperative?->name,
                'member_since' => $farmer->created_at?->format('Y'),
                'registration_date' => $farmer->created_at?->format('F j, Y'),
                'bank_account' => ! $canViewSensitiveDetails || $farmer->bankAccount === null ? null : [
                    'bank_name' => $farmer->bankAccount->bank_name,
                    'account_number' => $farmer->bankAccount->maskedAccountNumber(),
                    'account_name' => $farmer->bankAccount->account_name,
                    'status' => $farmer->bankAccount->status->value,
                    'status_label' => $farmer->bankAccount->status->label(),
                ],
                'spouse' => ! $canViewSensitiveDetails || $farmer->spouse === null ? null : [
                    'first_name' => $farmer->spouse->first_name,
                    'middle_name' => $farmer->spouse->middle_name,
                    'last_name' => $farmer->spouse->last_name,
                    'full_name' => $farmer->spouse->fullName(),
                ],
                'farms' => $farms
                    ->map(fn (Farm $farm, int $index): array => $portfolio->card(
                        $farm,
                        $index + 1,
                        $farmer->fullName(),
                    ))
                    ->values()
                    ->all(),
                'farm_summary' => $portfolio->summary($farms),
                'farm_filters' => $portfolio->filterOptions(),
                'activity_count' => $this->activityCount($farmer),
                'recent_activities' => $this->recentActivities($farmer),
                'production_summary' => $ledger->farmerSummary($farmer),
                'inventory_summary' => $stock->balances(farmerId: $farmer->id, viewer: $viewer),
                'traceability_summary' => $traceability->metrics(farmerId: $farmer->id, viewer: $viewer),
                'documents' => $this->documents($farmer),
                'verification_history' => $this->verificationHistory($farmer),
                'farm_coverage' => $farms->values()->map(function (Farm $farm, int $index) use ($canViewSensitiveDetails): array {
                    return [
                        'id' => $farm->id,
                        'number_label' => 'Farm '.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
                        'farm_id' => $farm->farm_id,
                        'farm_name' => $farm->displayName(),
                        'insurances' => $canViewSensitiveDetails
                            ? $farm->insurances
                                ->map(fn (FarmInsurance $insurance): array => $insurance->present())
                                ->values()
                                ->all()
                            : [],
                        'financings' => $canViewSensitiveDetails
                            ? $farm->financings
                                ->map(fn (FarmFinancing $financing): array => $financing->present())
                                ->values()
                                ->all()
                            : [],
                    ];
                })->all(),
            ],
        ]);
    }

    public function photo(Farmer $farmer): StreamedResponse
    {
        if ($farmer->photo_path === null || ! Storage::disk('local')->exists($farmer->photo_path)) {
            abort(404);
        }

        return Storage::disk('local')->response($farmer->photo_path);
    }

    private function activityCount(Farmer $farmer): int
    {
        $viewer = request()->user();

        return FarmActivity::query()
            ->visibleTo($viewer instanceof User ? $viewer : null)
            ->whereHas('farm', fn ($query) => $query->where('farmer_id', $farmer->id))
            ->count();
    }

    /**
     * Latest activities across this farmer's farms only.
     *
     * @return list<array<string, mixed>>
     */
    private function recentActivities(Farmer $farmer): array
    {
        $viewer = request()->user();

        return FarmActivity::query()
            ->visibleTo($viewer instanceof User ? $viewer : null)
            ->with(['farm', 'activityType'])
            ->whereHas('farm', fn ($query) => $query->where('farmer_id', $farmer->id))
            ->orderByDesc('activity_date')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn (FarmActivity $activity): array => $activity->summaryRow())
            ->values()
            ->all();
    }

    /**
     * Profile photo, drone images, and verification photos already stored
     * for this farmer. There is no separate documents table.
     *
     * @return list<array{id: string, label: string, name: string, href: string, recorded_at: string|null}>
     */
    private function documents(Farmer $farmer): array
    {
        $documents = [];

        if ($farmer->photo_path !== null) {
            $documents[] = [
                'id' => 'farmer-photo-'.$farmer->id,
                'label' => 'Profile photo',
                'name' => $farmer->fullName(),
                'href' => route('farmers.photo', $farmer),
                'recorded_at' => $farmer->updated_at?->format('M j, Y'),
            ];
        }

        foreach ($farmer->farms as $farm) {
            if ($farm->drone_image_path === null) {
                continue;
            }

            $documents[] = [
                'id' => 'drone-'.$farm->id,
                'label' => 'Drone image',
                'name' => $farm->displayName(),
                'href' => route('farms.drone-image', $farm),
                'recorded_at' => $farm->updated_at?->format('M j, Y'),
            ];
        }

        $photos = FarmVerificationPhoto::query()
            ->with(['verification.farm', 'uploader'])
            ->whereHas('verification.farm', fn ($query) => $query
                ->where('farmer_id', $farmer->id)
                ->visibleTo($this->registryViewer()))
            ->orderBy('id')
            ->get();

        foreach ($photos as $photo) {
            $presented = $photo->present();
            $name = $presented['name'] ?? null;
            $farm = $photo->verification?->farm;

            $documents[] = [
                'id' => 'photo-'.$photo->id,
                'label' => 'Verification photo',
                'name' => is_string($name) && $name !== '' ? $name : ($farm?->displayName() ?? 'Photo'),
                'href' => is_string($presented['url'] ?? null) ? $presented['url'] : route('farmers.show', $farmer),
                'recorded_at' => $photo->verification?->verified_at?->format('M j, Y')
                    ?? $photo->created_at?->format('M j, Y'),
            ];
        }

        return $documents;
    }

    /**
     * Verification attempts across this farmer's farms, newest first.
     *
     * @return list<array{id: int, date: string, reference: string, result: string|null, verified_by: string|null, remarks: string|null, farm_record_id: int, farm_name: string}>
     */
    private function verificationHistory(Farmer $farmer): array
    {
        return FarmVerification::query()
            ->with(['farm', 'verifier'])
            ->whereHas('farm', fn ($query) => $query
                ->where('farmer_id', $farmer->id)
                ->visibleTo($this->registryViewer()))
            ->orderByDesc('verified_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (FarmVerification $verification): array => [
                'id' => $verification->id,
                'date' => ($verification->verified_at ?? $verification->created_at)?->format('M j, Y') ?? '—',
                'reference' => $verification->verification_reference,
                'result' => $verification->result?->value,
                'verified_by' => $verification->verifier?->name,
                'remarks' => $verification->remarks,
                'farm_record_id' => $verification->farm_id,
                'farm_name' => $verification->farm?->displayName() ?? 'Farm',
            ])
            ->all();
    }
}
