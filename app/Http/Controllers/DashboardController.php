<?php

namespace App\Http\Controllers;

use App\CropType;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Services\InventoryStock;
use App\Services\ProductionLedger;
use App\Services\TraceabilitySummary;
use Illuminate\Database\Eloquent\Builder;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(ProductionLedger $ledger, InventoryStock $stock, TraceabilitySummary $traceability): Response
    {
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
