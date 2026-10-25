<?php

namespace App\Http\Controllers;

use App\CropType;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\FarmBoundaryUpdateRequest;
use App\Models\Farmer;
use App\Models\FarmHarvest;
use App\Models\FarmProduction;
use App\Models\FarmVerification;
use App\Models\FarmVerifierAssignment;
use App\Models\User;
use App\Services\AdminLandAnalytics;
use App\Services\InventoryStock;
use App\Services\ProductionLedger;
use App\Services\TraceabilitySummary;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request, ProductionLedger $ledger, InventoryStock $stock, TraceabilitySummary $traceability, AdminLandAnalytics $analytics): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->role === UserRole::Admin && ! $request->is('api/*')) {
            return $analytics->render($user, $request);
        }

        if ($user instanceof User && $user->role === UserRole::FieldVerifier) {
            $assignedFarms = Farm::query()->visibleTo($user);
            $assignedPreview = (clone $assignedFarms)->with('farmer')->latest('id')->limit(4)->get()
                ->map(fn (Farm $farm): array => [
                    'id' => $farm->id,
                    'farm_id' => $farm->farm_id,
                    'farm_name' => $farm->displayName(),
                    'farmer_name' => $farm->farmer?->fullName(),
                    'location' => $farm->locationLabel(),
                    'verification_status' => $farm->verification_status->value,
                ])->values()->all();
            $assignedMapFarms = (clone $assignedFarms)
                ->with('farmer')
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->latest('id')
                ->get()
                ->map(fn (Farm $farm): array => [
                    'id' => $farm->id,
                    'farm_id' => $farm->farm_id,
                    'farm_name' => $farm->displayName(),
                    'farmer_name' => $farm->farmer?->fullName() ?? 'Farmer',
                    'location' => $farm->locationLabel(),
                    'crop_label' => $farm->crop_type->label(),
                    'declared_area_hectares' => (float) $farm->declared_area_hectares,
                    'status' => $farm->status->value,
                    'latitude' => (float) $farm->latitude,
                    'longitude' => (float) $farm->longitude,
                    'verification_status' => $farm->verification_status->value,
                ])->values()->all();
            $declared = (float) (clone $assignedFarms)->sum('declared_area_hectares');
            $coffee = (float) (clone $assignedFarms)
                ->where('crop_type', CropType::Coffee)
                ->sum('declared_area_hectares');
            $verified = (float) (clone $assignedFarms)
                ->whereNotNull('verified_area_hectares')
                ->sum('verified_area_hectares');
            $verifiedToday = FarmVerification::query()
                ->whereIn('farm_id', (clone $assignedFarms)->select('id'))
                ->where('verified_by', $user->id)
                ->where('result', 'verified')
                ->whereDate('verified_at', today())
                ->count();
            $todayAssignments = FarmVerifierAssignment::query()
                ->with(['farm.farmer'])
                ->where('user_id', $user->id)
                ->whereNull('revoked_at')
                ->where('scheduled_for', today()->toDateString())
                ->whereHas('farm', fn (Builder $query) => $query
                    ->visibleTo($user)
                    ->whereIn('verification_status', [
                        FarmVerificationStatus::Pending,
                        FarmVerificationStatus::InProgress,
                        FarmVerificationStatus::NeedsReview,
                    ]))
                ->orderBy('scheduled_for')
                ->get()
                ->map(fn (FarmVerifierAssignment $assignment): array => [
                    'id' => $assignment->farm->id,
                    'farm_id' => $assignment->farm->farm_id,
                    'farm_name' => $assignment->farm->displayName(),
                    'farmer_name' => $assignment->farm->farmer?->fullName(),
                    'location' => $assignment->farm->locationLabel(),
                    'verification_status' => $assignment->farm->verification_status->value,
                    'scheduled_for' => $assignment->scheduled_for?->format('Y-m-d'),
                ])->values()->all();
            $scheduledToday = count($todayAssignments);

            return Inertia::render('dashboard', [
                'mobile_dashboard_mode' => 'verifier_dashboard',
                'summary' => [
                    'assigned_farms' => (clone $assignedFarms)->count(),
                    'assigned_today' => $scheduledToday,
                    'scheduled_today' => $scheduledToday,
                    'registered_farms' => (clone $assignedFarms)->count(),
                    'pending_verification' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::Pending)->count(),
                    'in_progress' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::InProgress)->count(),
                    'completed_farms' => (clone $assignedFarms)->whereIn('verification_status', [
                        FarmVerificationStatus::Verified,
                        FarmVerificationStatus::Failed,
                        FarmVerificationStatus::NeedsReview,
                    ])->count(),
                    'verified_farms' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::Verified)->count(),
                    'needs_review' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::NeedsReview)->count(),
                    'failed' => (clone $assignedFarms)->where('verification_status', FarmVerificationStatus::Failed)->count(),
                    'verified_today' => $verifiedToday,
                ],
                'area_summary' => [
                    'total_declared_hectares' => round($declared, 2),
                    'total_verified_hectares' => round($verified, 2),
                    'coffee_hectares' => round($coffee, 2),
                    'other_crop_hectares' => round($declared - $coffee, 2),
                ],
                'assigned_farms_preview' => $assignedPreview,
                'today_assignments' => $todayAssignments,
                'assigned_farms_map' => $assignedMapFarms,
                'google_maps_api_key' => config('services.google_maps.browser_api_key'),
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
                        'kind' => $notification->data['kind'] ?? 'update',
                    ])->values()->all();
                $declaredArea = (float) (clone $farms)->sum('declared_area_hectares');
                $verifiedArea = (float) (clone $farms)
                    ->whereNotNull('verified_area_hectares')
                    ->sum('verified_area_hectares');

                return Inertia::render('dashboard', [
                    'mobile_dashboard_mode' => 'farmer_dashboard',
                    'account' => ['name' => $user->name, 'email' => $user->email],
                    'farmer' => [
                        'name' => $farmer->fullName(),
                        'farmer_id' => $farmer->farmer_id,
                        'photo_url' => $farmer->photo_path === null ? null : URL::temporarySignedRoute(
                            'api.mobile.media.farmer-photo',
                            now()->addMinutes(15),
                            ['farmer' => $farmer->id],
                        ),
                    ],
                    'unread_notifications' => $user->unreadNotifications()->count(),
                    'recent_notifications' => $recentNotifications,
                    'recent_activities' => $recentActivities,
                    'recent_harvests' => $recentHarvests,
                    'recent_productions' => $recentProductions,
                    'summary' => [
                        'registered_farms' => (clone $farms)->count(),
                        'declared_area_hectares' => round($declaredArea, 2),
                        'verified_area_hectares' => round($verifiedArea, 2),
                        'pending_verification' => (clone $farms)->where('verification_status', FarmVerificationStatus::Pending)->count(),
                        'in_progress' => (clone $farms)->where('verification_status', FarmVerificationStatus::InProgress)->count(),
                        'verified_farms' => (clone $farms)->where('verification_status', FarmVerificationStatus::Verified)->count(),
                        'needs_review' => (clone $farms)->where('verification_status', FarmVerificationStatus::NeedsReview)->count(),
                        'failed' => (clone $farms)->where('verification_status', FarmVerificationStatus::Failed)->count(),
                    ],
                ]);
            }

            if (! $request->is('api/*')) {
                return Inertia::render('account/restricted');
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

        $viewer = $user instanceof User ? $user : null;
        $coffeeArea = $this->declaredHectares(CropType::Coffee);
        $totalDeclared = $this->declaredHectares();
        $boundaryUpdateRequests = FarmBoundaryUpdateRequest::query()
            ->with(['farm.farmer'])
            ->where('status', 'pending')
            ->whereHas('farm', fn (Builder $query) => $query->visibleTo($viewer))
            ->latest('id')
            ->limit(8)
            ->get()
            ->map(fn (FarmBoundaryUpdateRequest $updateRequest): array => [
                'id' => $updateRequest->id,
                'farm_id' => $updateRequest->farm_id,
                'farm_code' => $updateRequest->farm?->farm_id,
                'farm_name' => $updateRequest->farm?->displayName(),
                'farmer_name' => $updateRequest->farm?->farmer?->fullName(),
                'reason' => $updateRequest->reason,
                'created_at' => $updateRequest->created_at?->format('M j, Y'),
            ])
            ->values()
            ->all();

        $summary = [
            'registered_farmers' => Farmer::query()->visibleTo($viewer)->count(),
            'registered_farms' => Farm::query()->visibleTo($viewer)->count(),
            'total_coffee_farm_area_hectares' => $coffeeArea,
            'verified_farms' => $this->activeVerificationCount(FarmVerificationStatus::Verified),
            'pending_verification' => $this->activeVerificationCount(FarmVerificationStatus::Pending),
            'in_progress' => $this->activeVerificationCount(FarmVerificationStatus::InProgress),
            'needs_review' => $this->activeVerificationCount(FarmVerificationStatus::NeedsReview),
            'failed' => $this->activeVerificationCount(FarmVerificationStatus::Failed),
        ];

        return Inertia::render('dashboard', [
            'summary' => $summary,
            'workspace' => $this->workspace($viewer, $summary),
            'area_summary' => [
                'total_declared_hectares' => $totalDeclared,
                'total_verified_hectares' => $this->verifiedHectares(),
                'coffee_hectares' => $coffeeArea,
                'other_crop_hectares' => round($totalDeclared - $coffeeArea, 2),
            ],
            'locations' => $this->locations(),
            'verified_lands' => $this->verifiedLands(),
            'recent_activities' => $this->recentActivities(),
            'harvest_summary' => $ledger->dashboardSummary($viewer),
            'recent_harvests' => $ledger->recentHarvests(viewer: $viewer),
            'inventory_summary' => $stock->balances(viewer: $viewer),
            'traceability_summary' => $traceability->metrics(viewer: $viewer),
            'recent_lots' => $traceability->recent(viewer: $viewer),
            'boundary_update_requests' => $boundaryUpdateRequests,
        ]);
    }

    /**
     * @param  array{
     *     pending_verification: int,
     *     in_progress: int,
     *     needs_review: int,
     *     failed: int
     * }  $summary
     * @return array{
     *     title: string,
     *     description: string,
     *     queues: list<array{status: string, label: string, count: int, href: string}>
     * }
     */
    private function workspace(?User $viewer, array $summary): array
    {
        $role = $viewer?->role;
        $copy = match ($role) {
            UserRole::Farmer => [
                'Your farms',
                'Verification status for the farms linked to your account. Counts are current totals.',
            ],
            UserRole::FieldVerifier => [
                'Assigned fieldwork',
                'Farms assigned to you. Open a status to continue that verification list.',
            ],
            UserRole::CooperativeOfficer => [
                'Cooperative overview',
                'Farmers and farms in the cooperatives assigned to you. Counts are current totals.',
            ],
            default => [
                'Operations',
                'Farmers, farms, and declared area inside your registry scope. Counts are current totals, not a date range.',
            ],
        };

        $queues = [
            $this->queue($viewer, FarmVerificationStatus::Pending, 'Awaiting verification', $summary['pending_verification']),
            $this->queue($viewer, FarmVerificationStatus::InProgress, 'Verification in progress', $summary['in_progress']),
            $this->queue($viewer, FarmVerificationStatus::NeedsReview, 'Needs review', $summary['needs_review']),
            $this->queue($viewer, FarmVerificationStatus::Failed, 'Verification failed', $summary['failed']),
        ];

        return [
            'title' => $copy[0],
            'description' => $copy[1],
            'queues' => $queues,
        ];
    }

    /**
     * @return array{status: string, label: string, count: int, href: string}
     */
    private function queue(?User $viewer, FarmVerificationStatus $status, string $label, int $count): array
    {
        return [
            'status' => $status->value,
            'label' => $label,
            'count' => $count,
            'href' => $this->verificationHref($viewer, $status),
        ];
    }

    private function verificationHref(?User $viewer, FarmVerificationStatus $status): string
    {
        $parameters = ['verification_status' => $status->value];

        if ($viewer instanceof User && $viewer->role === UserRole::FieldVerifier) {
            return route('farm-verification.index', $parameters);
        }

        return route('farms.index', $parameters);
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
     * Accepted verified hectares on active farms. A reverification does not
     * invalidate the previously accepted measurement. History rows are not
     * summed, and declared area is left untouched.
     */
    private function verifiedHectares(): float
    {
        return round((float) $this->activeFarms()
            ->whereNotNull('verified_area_hectares')
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
        return Farm::query()->visibleTo($this->registryViewer())->where('status', FarmStatus::Active);
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
            ->visibleTo($this->registryViewer())
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
     * Saved accepted boundaries of active farms. Reverification in progress
     * or awaiting follow-up does not hide the currently accepted boundary.
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
            ->whereNotNull('verified_area_hectares')
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
            ->visibleTo($this->registryViewer())
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
