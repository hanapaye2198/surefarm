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
use App\Services\FarmPortfolio;
use App\Services\InventoryStock;
use App\Services\ProductionLedger;
use App\Services\TraceabilitySummary;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class FarmerController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        $farmers = Farmer::query()
            ->with('cooperative')
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

    public function store(StoreFarmerRequest $request, RegisterFarmer $register): RedirectResponse
    {
        try {
            $farmer = $register->handle(
                $request->safe()->except(['photo']),
                $request->file('photo'),
            );
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
                'date_of_birth' => $farmer->date_of_birth?->format('Y-m-d') ?? '',
                'government_id' => $farmer->government_id ?? '',
                'has_bank_account' => $account !== null,
                'bank_name' => $account?->bank_name ?? '',
                'account_number' => $account?->account_number ?? '',
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
        $farmer->load([
            'spouse',
            'cooperative',
            'bankAccount',
            'farms' => fn ($query) => $query->with([
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
                'date_of_birth' => $farmer->date_of_birth?->format('F j, Y'),
                'government_id' => $farmer->government_id,
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
                'bank_account' => $farmer->bankAccount === null ? null : [
                    'bank_name' => $farmer->bankAccount->bank_name,
                    'account_number' => $farmer->bankAccount->maskedAccountNumber(),
                    'account_name' => $farmer->bankAccount->account_name,
                    'status' => $farmer->bankAccount->status->value,
                    'status_label' => $farmer->bankAccount->status->label(),
                ],
                'spouse' => $farmer->spouse === null ? null : [
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
                'inventory_summary' => $stock->balances(farmerId: $farmer->id),
                'traceability_summary' => $traceability->metrics(farmerId: $farmer->id),
                'farm_coverage' => $farms->values()->map(function (Farm $farm, int $index): array {
                    return [
                        'id' => $farm->id,
                        'number_label' => 'Farm '.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
                        'farm_id' => $farm->farm_id,
                        'farm_name' => $farm->displayName(),
                        'insurances' => $farm->insurances
                            ->map(fn (FarmInsurance $insurance): array => $insurance->present())
                            ->values()
                            ->all(),
                        'financings' => $farm->financings
                            ->map(fn (FarmFinancing $financing): array => $financing->present())
                            ->values()
                            ->all(),
                    ];
                })->all(),
            ],
        ]);
    }

    public function photo(Farmer $farmer): StreamedResponse
    {
        if ($farmer->photo_path === null || ! Storage::exists($farmer->photo_path)) {
            abort(404);
        }

        return Storage::response($farmer->photo_path);
    }

    private function activityCount(Farmer $farmer): int
    {
        return FarmActivity::query()
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
        return FarmActivity::query()
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
}
