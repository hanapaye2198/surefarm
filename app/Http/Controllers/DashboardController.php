<?php

namespace App\Http\Controllers;

use App\CropType;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\FarmHarvest;
use App\Models\FarmProduction;
use App\Models\User;
use App\Services\InventoryStock;
use App\Services\ProductionLedger;
use App\Services\TraceabilitySummary;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request, ProductionLedger $ledger, InventoryStock $stock, TraceabilitySummary $traceability): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->role === UserRole::FieldVerifier) {
            $assignedFarms = Farm::query()->where('assigned_verifier_id', $user->id);
            $assignedPreview = (clone $assignedFarms)->with('farmer')->latest('id')->limit(4)->get()
                ->map(fn (Farm $farm): array => [
                    'id' => $farm->id,
                    'farm_id' => $farm->farm_id,
                    'farm_name' => $farm->displayName(),
                    'farmer_name' => $farm->farmer?->fullName(),
                    'location' => $farm->locationLabel(),
                    'verification_status' => $farm->verification_status->value,
                ])->values()->all();
            $declared = (float) (clone $assignedFarms)->sum('declared_area_hectares');
            $coffee = (float) (clone $assignedFarms)
                ->where('crop_type', CropType::Coffee)
                ->sum('declared_area_hectares');
            $verified = (float) (clone $assignedFarms)
                ->where('verification_status', FarmVerificationStatus::Verified)
                ->sum('verified_area_hectares');

            return Inertia::render('dashboard', [
                'mobile_dashboard_mode' => 'verifier_dashboard',
                'summary' => [
                    'assigned_farms' => (clone $assignedFarms)->count(),
                    'registered_farms' => (clone $assignedFarms)->count(),
                    'pending_verification' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::Pending)->count(),
                    'in_progress' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::InProgress)->count(),
                    'completed_farms' => (clone $assignedFarms)->whereIn('verification_status', [FarmVerificationStatus::Verified, FarmVerificationStatus::Failed])->count(),
                    'verified_farms' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::Verified)->count(),
                    'needs_review' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::NeedsReview)->count(),
                    'failed' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::Failed)->count(),
                ],
                'area_summary' => [
                    'total_declared_hectares' => round($declared, 2),
                    'total_verified_hectares' => round($verified, 2),
                    'coffee_hectares' => round($coffee, 2),
                    'other_crop_hectares' => round($declared - $coffee, 2),
                ],
                'assigned_farms_preview' => $assignedPreview,
                'recent_activities' => [],
                'recent_harvests' => [],
                'recent_lots' => [],
            ]);
        }

        // Farmer accounts are restricted to their linked farmer profile.
        if ($user instanceof User && $user->role === UserRole::Farmer) {
            $farmer = $user->farmer()->with('farms')->first();

            if ($farmer !== null) {
                $farms = $farmer->farms();
                $recentActivities = FarmActivity::query()
                    ->with(['farm', 'activityType'])
                    ->whereHas('farm', fn (Builder $query) => $query->where('farmer_id', $farmer->id))
                    ->latest('activity_date')->latest('id')->limit(4)->get()
                    ->map(fn (FarmActivity $activity): array => $activity->summaryRow())
                    ->values()->all();
                $recentHarvests = FarmHarvest::query()
                    ->with(['farm.farmer', 'production'])
                    ->whereHas('farm', fn (Builder $query) => $query->where('farmer_id', $farmer->id))
                    ->latest('harvest_date')->latest('id')->limit(3)->get()
                    ->map(fn (FarmHarvest $harvest): array => $harvest->summaryRow())
                    ->values()->all();
                $recentProductions = FarmProduction::query()
                    ->with(['farm.farmer'])
                    ->whereHas('farm', fn (Builder $query) => $query->where('farmer_id', $farmer->id))
                    ->latest('id')->limit(3)->get()
                    ->map(fn (FarmProduction $production): array => $production->present())
                    ->values()->all();
                $recentNotifications = $user->notifications()->latest()->limit(4)->get()
                    ->map(fn ($notification): array => [
                        'id' => $notification->id,
                        'title' => $notification->data['title'] ?? 'SureFarm update',
                        'message' => $notification->data['message'] ?? '',
                        'farm_name' => $notification->data['farm_name'] ?? null,
                        'status' => $notification->data['status'] ?? null,
                        'created_at' => $notification->created_at?->format('M j, Y g:i A'),
                        'read' => $notification->read_at !== null,
                    ])->values()->all();

                return Inertia::render('dashboard', [
                    'mobile_dashboard_mode' => 'farmer_dashboard',
                    'account' => ['name' => $user->name, 'email' => $user->email],
                    'farmer' => [
                        'name' => $farmer->fullName(),
                        'farmer_id' => $farmer->farmer_id,
                    ],
                    'unread_notifications' => $user->unreadNotifications()->count(),
                    'recent_notifications' => $recentNotifications,
                    'recent_activities' => $recentActivities,
                    'recent_harvests' => $recentHarvests,
                    'recent_productions' => $recentProductions,
                    'summary' => [
                        'registered_farms' => (clone $farms)->count(),
                        'pending_verification' => (clone $farms)->where('verification_status', FarmVerificationStatus::Pending)->count(),
                        'in_progress' => (clone $farms)->where('verification_status', FarmVerificationStatus::InProgress)->count(),
                        'verified_farms' => (clone $farms)->where('verification_status', FarmVerificationStatus::Verified)->count(),
                        'needs_review' => (clone $farms)->where('verification_status', FarmVerificationStatus::NeedsReview)->count(),
                        'failed' => (clone $farms)->where('verification_status', FarmVerificationStatus::Failed)->count(),
                    ],
                ]);
            }

            return Inertia::render('dashboard', [
                'mobile_dashboard_mode' => 'farmer_account_not_linked',
                'account' => [
                    'name' => $user->name,
                    'email' => $user->email,
                ],
                // Keep the shared web dashboard's props shape while returning
                // no aggregate or other-farmer data to this account.
                'summary' => [
                    'registered_farmers' => 0,
                    'registered_farms' => 0,
                    'total_coffee_farm_area_hectares' => 0,
                    'verified_farms' => 0,
                    'pending_verification' => 0,
                    'in_progress' => 0,
                    'needs_review' => 0,
                    'failed' => 0,
                ],
                'area_summary' => [
                    'total_declared_hectares' => 0,
                    'total_verified_hectares' => 0,
                    'coffee_hectares' => 0,
                    'other_crop_hectares' => 0,
                ],
                'locations' => [],
                'verified_lands' => [],
                'recent_activities' => [],
                'harvest_summary' => [
                    'expected_label' => '0',
                    'actual_label' => '0',
                    'remaining_label' => '0',
                    'exceeds' => false,
                    'message' => null,
                    'progress' => null,
                    'has_records' => false,
                    'harvesting_farms' => 0,
                ],
                'recent_harvests' => [],
                'inventory_summary' => [
                    'stages' => [],
                    'total_label' => '0',
                    'has_records' => false,
                    'chart' => [],
                ],
                'traceability_summary' => [
                    'active_lots' => 0,
                    'green_bean_lots' => 0,
                    'traced_label' => '0',
                    'has_records' => false,
                ],
                'recent_lots' => [],
            ]);
        }

        $coffeeArea = $this->declaredHectares(CropType::Coffee);
        $totalDeclared = $this->declaredHectares();

        return Inertia::render('dashboard', [
            'summary' => [
                'registered_farmers' => Farmer::query()->count(),
                'registered_farms' => Farm::query()->count(),
                'total_coffee_farm_area_hectares' => $coffeeArea,
                'verified_farms' => $this->activeVerificationCount(FarmVerificationStatus::Verified),
                'pending_verification' => $this->activeVerificationCount(FarmVerificationStatus::Pending),
                'in_progress' => $this->activeVerificationCount(FarmVerificationStatus::InProgress),
                'needs_review' => $this->activeVerificationCount(FarmVerificationStatus::NeedsReview),
                'failed' => $this->activeVerificationCount(FarmVerificationStatus::Failed),
            ],
            'area_summary' => [
                'total_declared_hectares' => $totalDeclared,
                'total_verified_hectares' => $this->verifiedHectares(),
                'coffee_hectares' => $coffeeArea,
                'other_crop_hectares' => round($totalDeclared - $coffeeArea, 2),
            ],
            'locations' => $this->locations(),
            'verified_lands' => $this->verifiedLands(),
            'recent_activities' => $this->recentActivities(),
            'harvest_summary' => $ledger->dashboardSummary(),
            'recent_harvests' => $ledger->recentHarvests(),
            'inventory_summary' => $stock->balances(),
            'traceability_summary' => $traceability->metrics(),
            'recent_lots' => $traceability->recent(),
        ]);
    }

    /**
     * Declared hectares for active farms. Coffee area uses the same
     * declared value and does not include GPS or verified area.
     */
    private function declaredHectares(?CropType $crop = null): float
    {
        $query = $this->activeFarms();

        if ($crop !== null) {
            $query->where('crop_type', $crop);
        }

        return round((float) $query->sum('declared_area_hectares'), 2);
    }

    /**
     * Verified hectares on active farms whose current status is verified.
     * History rows are not summed, and declared area is left untouched.
     */
    private function verifiedHectares(): float
    {
        return round((float) $this->activeFarms()
            ->where('verification_status', FarmVerificationStatus::Verified)
            ->sum('verified_area_hectares'), 2);
    }

    private function activeVerificationCount(FarmVerificationStatus $status): int
    {
        return $this->activeFarms()
            ->where('verification_status', $status)
            ->count();
    }

    /**
     * @return Builder<Farm>
     */
    private function activeFarms(): Builder
    {
        return Farm::query()->where('status', FarmStatus::Active);
    }

    /**
     * Farms that can be plotted. Coordinates are a location only and
     * do not change verification status.
     *
     * @return list<array{
     *     id: int,
     *     farm_id: string,
     *     farm_name: string,
     *     farmer_name: string,
     *     crop_label: string,
     *     declared_area_hectares: float,
     *     verification_status: string,
     *     status: string,
     *     latitude: float,
     *     longitude: float
     * }>
     */
    private function locations(): array
    {
        $locations = Farm::query()
            ->select([
                'id',
                'farmer_id',
                'farm_id',
                'farm_name',
                'crop_type',
                'declared_area_hectares',
                'verification_status',
                'status',
                'latitude',
                'longitude',
            ])
            ->with('farmer:id,first_name,middle_name,last_name')
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderBy('farm_id')
            ->get()
            ->map(fn (Farm $farm): array => [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->displayName(),
                'farmer_name' => $farm->farmer->fullName(),
                'crop_label' => $farm->crop_type->label(),
                'declared_area_hectares' => (float) $farm->declared_area_hectares,
                'verification_status' => $farm->verification_status->value,
                'status' => $farm->status->value,
                'latitude' => (float) $farm->latitude,
                'longitude' => (float) $farm->longitude,
            ])
            ->all();

        return array_values($locations);
    }

    /**
     * Saved boundaries of active farms whose current status is verified.
     * Pending and inactive farms are not included.
     *
     * @return list<array{
     *     id: int,
     *     farm_id: string,
     *     farm_name: string,
     *     farmer_name: string,
     *     crop_label: string,
     *     verified_area_hectares: float|null,
     *     boundary: array{type: string, coordinates: array<int, array<int, array<int, float>>>}
     * }>
     */
    private function verifiedLands(): array
    {
        $lands = $this->activeFarms()
            ->where('verification_status', FarmVerificationStatus::Verified)
            ->whereHas('boundary')
            ->with([
                'farmer:id,first_name,middle_name,last_name',
                'boundary:id,farm_id,boundary_geojson',
            ])
            ->orderBy('farm_id')
            ->get()
            ->map(function (Farm $farm): ?array {
                $boundary = $farm->boundary;

                if ($boundary === null) {
                    return null;
                }

                return [
                    'id' => $farm->id,
                    'farm_id' => $farm->farm_id,
                    'farm_name' => $farm->displayName(),
                    'farmer_name' => $farm->farmer->fullName(),
                    'crop_label' => $farm->crop_type->label(),
                    'verified_area_hectares' => $farm->verified_area_hectares === null
                        ? null
                        : (float) $farm->verified_area_hectares,
                    'boundary' => $boundary->boundary_geojson,
                ];
            })
            ->filter()
            ->values()
            ->all();

        return array_values($lands);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function recentActivities(): array
    {
        return FarmActivity::query()
            ->with(['farm', 'activityType'])
            ->orderByDesc('activity_date')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn (FarmActivity $activity): array => $activity->summaryRow())
            ->values()
            ->all();
    }
}
