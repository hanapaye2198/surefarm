<?php

namespace App\Services;

use App\AccessEventAction;
use App\CooperativeStatus;
use App\CropType;
use App\FarmStatus;
use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\Models\AccessEvent;
use App\Models\Cooperative;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\FarmVerification;
use App\Models\RegistryGrant;
use App\Models\User;
use App\Models\UserInvitation;
use App\RegistryGrantKind;
use App\UserRole;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Registry analytics for an administrator. Every farm figure is
 * calculated from farms visible through RegistryScope, then narrowed
 * by the validated filters. Declared and verified hectares are never
 * added together.
 */
class AdminLandAnalytics
{
    private const MAP_LIMIT = 400;

    public function __construct(private RegistryScope $scope) {}

    public function render(User $user, Request $request): Response
    {
        if ($user->role !== UserRole::Admin) {
            abort(403);
        }

        $filters = $this->filters($request);
        $farms = $this->farmQuery($user, $filters);
        $trendFarms = $this->farmQuery($user, $filters, false);

        return Inertia::render('admin-dashboard', [
            'registry' => [
                'scope' => $this->scopeLabel($user),
                'timezone' => (string) config('app.timezone'),
                'filters' => $filters,
                'active_filters' => $this->activeFilters($filters),
                'options' => $this->options($user, $filters),
                'metrics' => $this->metrics($user, $filters, $farms),
                'charts' => $this->charts($user, $filters, $farms, $trendFarms),
                'map' => $this->map($filters, clone $farms),
                'farms' => $this->table(clone $farms, $filters),
                'insights' => $this->insights($filters, clone $farms),
                'administration' => $this->administration(),
                'notes' => $this->notes(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function filters(Request $request): array
    {
        $input = collect($request->query())->map(function (mixed $value): mixed {
            if (! is_string($value)) {
                return $value;
            }

            $trimmed = trim($value);

            return $trimmed === '' ? null : $trimmed;
        })->all();

        $validated = Validator::make($input, [
            'search' => ['nullable', 'string', 'max:100'],
            'province' => ['nullable', 'string', 'max:120'],
            'municipality' => ['nullable', 'string', 'max:120'],
            'barangay' => ['nullable', 'string', 'max:120'],
            'farmer' => ['nullable', 'integer', 'min:1'],
            'farm' => ['nullable', 'integer', 'min:1'],
            'crop' => ['nullable', Rule::enum(CropType::class)],
            'verification_status' => ['nullable', 'string', Rule::in($this->verificationFilterValues())],
            'status' => ['nullable', Rule::enum(FarmStatus::class)],
            'boundary' => ['nullable', 'string', Rule::in(['mapped', 'missing'])],
            'location' => ['nullable', 'string', Rule::in(['incomplete'])],
            'area' => ['nullable', 'string', Rule::in(['differs', 'unrecorded'])],
            'registered_from' => ['nullable', 'date_format:Y-m-d'],
            'registered_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:registered_from'],
            'updated_from' => ['nullable', 'date_format:Y-m-d'],
            'updated_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:updated_from'],
            'layer' => ['nullable', 'string', Rule::in(['locations', 'boundaries', 'verified', 'pending', 'review', 'missing'])],
            'rank' => ['nullable', 'string', Rule::in(['declared', 'verified'])],
            'trend' => ['nullable', 'string', Rule::in(['30', '90', 'ytd', 'custom'])],
            'trend_from' => ['nullable', 'date_format:Y-m-d', 'required_if:trend,custom'],
            'trend_to' => ['nullable', 'date_format:Y-m-d', 'required_if:trend,custom', 'after_or_equal:trend_from'],
            'sort' => ['nullable', 'string', Rule::in(['declared_area', 'verified_area', 'farmer', 'location', 'updated'])],
            'direction' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', Rule::in([10, 25, 50])],
        ])->validate();

        $filters = [
            'search' => (string) ($validated['search'] ?? ''),
            'province' => (string) ($validated['province'] ?? ''),
            'municipality' => (string) ($validated['municipality'] ?? ''),
            'barangay' => (string) ($validated['barangay'] ?? ''),
            'farmer' => isset($validated['farmer']) ? (string) $validated['farmer'] : '',
            'farm' => isset($validated['farm']) ? (string) $validated['farm'] : '',
            'crop' => isset($validated['crop']) ? (string) $validated['crop'] : '',
            'verification_status' => (string) ($validated['verification_status'] ?? ''),
            'status' => isset($validated['status']) ? (string) $validated['status'] : '',
            'boundary' => (string) ($validated['boundary'] ?? ''),
            'location' => (string) ($validated['location'] ?? ''),
            'area' => (string) ($validated['area'] ?? ''),
            'registered_from' => (string) ($validated['registered_from'] ?? ''),
            'registered_to' => (string) ($validated['registered_to'] ?? ''),
            'updated_from' => (string) ($validated['updated_from'] ?? ''),
            'updated_to' => (string) ($validated['updated_to'] ?? ''),
            'layer' => (string) ($validated['layer'] ?? 'locations'),
            'rank' => (string) ($validated['rank'] ?? 'declared'),
            'trend' => (string) ($validated['trend'] ?? '30'),
            'trend_from' => (string) ($validated['trend_from'] ?? ''),
            'trend_to' => (string) ($validated['trend_to'] ?? ''),
            'sort' => (string) ($validated['sort'] ?? 'declared_area'),
            'direction' => (string) ($validated['direction'] ?? 'desc'),
            'per_page' => (int) ($validated['per_page'] ?? 10),
        ];

        if ($filters['trend'] === 'custom') {
            $start = Carbon::parse($filters['trend_from'])->startOfDay();
            $end = Carbon::parse($filters['trend_to'])->endOfDay();

            if ($start->diffInDays($end) > 366) {
                throw ValidationException::withMessages([
                    'trend_to' => 'Choose a trend range of 366 days or less.',
                ]);
            }
        }

        return $filters;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Farm>
     */
    private function farmQuery(User $user, array $filters, bool $withDates = true): Builder
    {
        $farms = Farm::query()->visibleTo($user);
        $this->applyGeography($farms, $filters);
        $this->applyFarmFilters($farms, $filters, $withDates);

        return $farms;
    }

    /**
     * @param  Builder<Farm>  $farms
     * @param  array<string, mixed>  $filters
     */
    private function applyGeography(Builder $farms, array $filters): void
    {
        $this->applyPlace($farms, 'province', (string) $filters['province']);
        $this->applyPlace($farms, 'municipality', (string) $filters['municipality']);
        $this->applyPlace($farms, 'barangay', (string) $filters['barangay']);
    }

    /**
     * @param  Builder<Farm>  $farms
     */
    private function applyPlace(Builder $farms, string $column, string $value): void
    {
        if ($value === '') {
            return;
        }

        if ($value === '__missing__') {
            $farms->where(function (Builder $query) use ($column): void {
                $query->whereNull($column)->orWhere($column, '');
            });

            return;
        }

        $farms->where($column, $value);
    }

    /**
     * @param  Builder<Farm>  $farms
     * @param  array<string, mixed>  $filters
     */
    private function applyFarmFilters(Builder $farms, array $filters, bool $withDates): void
    {
        if ($filters['farmer'] !== '') {
            $farms->where('farmer_id', (int) $filters['farmer']);
        }

        if ($filters['farm'] !== '') {
            $farms->whereKey((int) $filters['farm']);
        }

        if ($filters['crop'] !== '') {
            $farms->where('crop_type', $filters['crop']);
        }

        if ($filters['verification_status'] === 'unverified') {
            $farms->where('verification_status', '!=', FarmVerificationStatus::Verified);
        } elseif ($filters['verification_status'] !== '') {
            $farms->where('verification_status', $filters['verification_status']);
        }

        if ($filters['status'] !== '') {
            $farms->where('status', $filters['status']);
        }

        if ($filters['boundary'] === 'mapped') {
            $farms->whereHas('boundary');
        } elseif ($filters['boundary'] === 'missing') {
            $farms->whereDoesntHave('boundary');
        }

        if ($filters['location'] === 'incomplete') {
            $this->whereIncompleteLocation($farms);
        }

        if ($filters['area'] === 'differs') {
            $farms->whereNotNull('verified_area_hectares')
                ->whereColumn('declared_area_hectares', '!=', 'verified_area_hectares');
        } elseif ($filters['area'] === 'unrecorded') {
            $farms->whereNull('verified_area_hectares');
        }

        if ($filters['search'] !== '') {
            $search = (string) $filters['search'];
            $like = '%'.addcslashes($search, '%_\\').'%';

            $farms->where(function (Builder $query) use ($like, $search): void {
                $query->where('farm_id', 'like', $like)
                    ->orWhere('farm_name', 'like', $like)
                    ->orWhereHas('farmer', function (Builder $query) use ($search): void {
                        $words = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];

                        foreach ($words as $word) {
                            $wordLike = '%'.addcslashes((string) $word, '%_\\').'%';
                            $query->where(function (Builder $query) use ($wordLike): void {
                                $query->where('first_name', 'like', $wordLike)
                                    ->orWhere('middle_name', 'like', $wordLike)
                                    ->orWhere('last_name', 'like', $wordLike)
                                    ->orWhere('farmer_id', 'like', $wordLike);
                            });
                        }
                    });
            });
        }

        if (! $withDates) {
            return;
        }

        $this->applyDateRange($farms, 'created_at', (string) $filters['registered_from'], (string) $filters['registered_to']);
        $this->applyDateRange($farms, 'updated_at', (string) $filters['updated_from'], (string) $filters['updated_to']);
    }

    /**
     * @param  Builder<Farm>  $farms
     */
    private function applyDateRange(Builder $farms, string $column, string $from, string $to): void
    {
        if ($from !== '') {
            $farms->where($column, '>=', Carbon::parse($from)->startOfDay());
        }

        if ($to !== '') {
            $farms->where($column, '<=', Carbon::parse($to)->endOfDay());
        }
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  Builder<Farm>  $farms
     * @return list<array{key: string, label: string, display: string, detail: string, href: string|null}>
     */
    private function metrics(User $user, array $filters, Builder $farms): array
    {
        $farmCount = (clone $farms)->count();
        $declared = round((float) (clone $farms)->sum('declared_area_hectares'), 2);
        $verifiedRecorded = (clone $farms)
            ->whereNotNull('verified_area_hectares');
        $verified = round((float) (clone $verifiedRecorded)->sum('verified_area_hectares'), 2);
        $verifiedMissing = (clone $farms)
            ->where('verification_status', FarmVerificationStatus::Verified)
            ->whereNull('verified_area_hectares')
            ->count();
        $unverified = round((float) (clone $farms)
            ->whereNull('verified_area_hectares')
            ->sum('declared_area_hectares'), 2);

        $farmerDetail = $this->farmFiltersActive($filters)
            ? 'Farmers with at least one farm in this filtered set.'
            : 'Farmer records in this registry scope and location. A farmer with no farm is included.';

        return [
            $this->metric('farmers', 'Registered farmers', (string) $this->farmerCount($user, $filters, $farms), $farmerDetail, route('farmers.index')),
            $this->metric('farms', 'Registered farms', (string) $farmCount, 'Farm records matching the current filters, including inactive farms.', null),
            $this->metric('declared', 'Declared farm area', $this->hectares($declared), 'Farmer-reported area. It is not added to verified area.', null),
            $this->metric(
                'verified',
                'Verified farm area',
                $this->hectares($verified),
                $verifiedMissing > 0
                    ? "Sum of accepted verified area across farms. {$verifiedMissing} currently verified ".($verifiedMissing === 1 ? 'farm has' : 'farms have').' no verified area recorded and '.($verifiedMissing === 1 ? 'is' : 'are').' excluded from this sum.'
                    : 'Sum of accepted verified area across farms. A new verification does not remove the previously accepted area.',
                $this->url($filters, ['verification_status' => '']),
            ),
            $this->metric('unverified', 'Declared area without accepted area', $this->hectares($unverified), 'Declared hectares on farms with no recorded accepted verified area. This is not a measured gap.', $this->url($filters, ['area' => 'unrecorded'])),
            $this->metric('active', 'Active farms', (string) (clone $farms)->where('status', FarmStatus::Active)->count(), 'Farms whose farm status is active inside the current filters.', $this->url($filters, ['status' => FarmStatus::Active->value])),
            $this->metric('pending', 'Pending verification', (string) (clone $farms)->where('verification_status', FarmVerificationStatus::Pending)->count(), 'Farms whose current verification status is pending.', $this->url($filters, ['verification_status' => FarmVerificationStatus::Pending->value])),
            $this->metric('review', 'Needs review', (string) (clone $farms)->where('verification_status', FarmVerificationStatus::NeedsReview)->count(), 'Farms whose current verification status is needs review.', $this->url($filters, ['verification_status' => FarmVerificationStatus::NeedsReview->value])),
            $this->metric('mapped', 'Saved boundaries', (string) (clone $farms)->whereHas('boundary')->count(), 'Farms with a saved boundary polygon. The polygon is not a substitute for the verified-area field.', $this->url($filters, ['boundary' => 'mapped'])),
            $this->metric('missing', 'Missing boundaries', (string) (clone $farms)->whereDoesntHave('boundary')->count(), 'Farms with no saved polygon. A coordinate marker can still exist for these farms.', $this->url($filters, ['boundary' => 'missing'])),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  Builder<Farm>  $farms
     */
    private function farmerCount(User $user, array $filters, Builder $farms): int
    {
        $farmers = Farmer::query()->visibleTo($user);
        $this->applyFarmerPlace($farmers, 'province', (string) $filters['province']);
        $this->applyFarmerPlace($farmers, 'municipality', (string) $filters['municipality']);
        $this->applyFarmerPlace($farmers, 'barangay', (string) $filters['barangay']);

        if ($filters['farmer'] !== '') {
            $farmers->whereKey((int) $filters['farmer']);
        }

        if ($this->farmFiltersActive($filters)) {
            $farmers->whereIn('id', (clone $farms)->reorder()->select('farmer_id'));
        }

        return $farmers->count();
    }

    /**
     * @param  Builder<Farmer>  $farmers
     */
    private function applyFarmerPlace(Builder $farmers, string $column, string $value): void
    {
        if ($value === '') {
            return;
        }

        if ($value === '__missing__') {
            $farmers->where(function (Builder $query) use ($column): void {
                $query->whereNull($column)->orWhere($column, '');
            });

            return;
        }

        $farmers->where($column, $value);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function farmFiltersActive(array $filters): bool
    {
        foreach (['farm', 'crop', 'verification_status', 'status', 'boundary', 'location', 'area', 'search', 'registered_from', 'registered_to', 'updated_from', 'updated_to'] as $key) {
            if ($filters[$key] !== '') {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  Builder<Farm>  $farms
     * @param  Builder<Farm>  $trendFarms
     * @return array<string, mixed>
     */
    private function charts(User $user, array $filters, Builder $farms, Builder $trendFarms): array
    {
        $declared = round((float) (clone $farms)->sum('declared_area_hectares'), 2);
        $verified = round((float) (clone $farms)
            ->whereNotNull('verified_area_hectares')
            ->sum('verified_area_hectares'), 2);

        return [
            'comparison' => [
                ['label' => 'Declared', 'hectares' => $declared],
                ['label' => 'Verified', 'hectares' => $verified],
            ],
            'geography' => $this->geography($filters, clone $farms),
            'owners' => $this->owners($filters, clone $farms),
            'crops' => $this->crops(clone $farms),
            'statuses' => $this->statuses(clone $farms),
            'trend' => $this->trend($user, $filters, $trendFarms),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  Builder<Farm>  $farms
     * @return array{level: string, rows: list<array<string, mixed>>}
     */
    private function geography(array $filters, Builder $farms): array
    {
        $level = 'province';
        $column = 'province';

        if ($filters['province'] !== '' && $filters['province'] !== '__missing__') {
            $level = 'municipality';
            $column = 'municipality';
        }

        if ($filters['municipality'] !== '' && $filters['municipality'] !== '__missing__') {
            $level = 'barangay';
            $column = 'barangay';
        }

        $expression = "coalesce(nullif(farms.{$column}, ''), 'Not recorded')";
        $rows = $this->aggregate($farms)
            ->selectRaw("{$expression} as area_name")
            ->selectRaw("min(coalesce(farms.{$column}, '')) as area_value")
            ->selectRaw('count(*) as farms')
            ->selectRaw('sum(farms.declared_area_hectares) as declared_hectares')
            ->selectRaw(
                'sum(case when farms.verification_status = ? then farms.verified_area_hectares else null end) as verified_hectares',
                [FarmVerificationStatus::Verified->value],
            )
            ->groupByRaw($expression)
            ->orderByDesc('declared_hectares')
            ->get();

        return [
            'level' => $level,
            'rows' => $rows->map(function ($row) use ($filters, $level): array {
                $value = (string) $row->area_value;
                $filterValue = $value === '' ? '__missing__' : $value;
                $override = match ($level) {
                    'municipality' => ['municipality' => $filterValue, 'barangay' => null],
                    'barangay' => ['barangay' => $filterValue],
                    default => ['province' => $filterValue, 'municipality' => null, 'barangay' => null],
                };

                return [
                    'label' => (string) $row->area_name,
                    'farms' => (int) $row->farms,
                    'declared_hectares' => round((float) $row->declared_hectares, 2),
                    'verified_hectares' => round((float) ($row->verified_hectares ?? 0), 2),
                    'href' => $this->url($filters, $override),
                ];
            })->values()->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  Builder<Farm>  $farms
     * @return list<array<string, mixed>>
     */
    private function owners(array $filters, Builder $farms): array
    {
        $rank = $filters['rank'] === 'verified' ? 'verified_hectares' : 'declared_hectares';
        $rows = $this->aggregate($farms)
            ->select('farmer_id')
            ->selectRaw('count(*) as farm_count')
            ->selectRaw('sum(declared_area_hectares) as declared_hectares')
            ->selectRaw(
                'sum(case when verification_status = ? then verified_area_hectares else null end) as verified_hectares',
                [FarmVerificationStatus::Verified->value],
            )
            ->selectRaw(
                'sum(case when verification_status = ? then 1 else 0 end) as verified_farms',
                [FarmVerificationStatus::Verified->value],
            )
            ->selectRaw(
                'sum(case when verification_status = ? then 1 else 0 end) as pending_farms',
                [FarmVerificationStatus::Pending->value],
            )
            ->groupBy('farmer_id')
            ->orderByDesc($rank)
            ->limit(8)
            ->get();

        $farmers = Farmer::query()
            ->whereIn('id', $rows->pluck('farmer_id'))
            ->get()
            ->keyBy('id');

        return $rows->map(function ($row) use ($farmers, $filters): array {
            $farmer = $farmers->get($row->farmer_id);

            return [
                'farmer_id' => (int) $row->farmer_id,
                'farmer_name' => $farmer?->fullName() ?? 'Unknown farmer',
                'farmer_reference' => $farmer?->farmer_id ?? '',
                'farms' => (int) $row->farm_count,
                'declared_hectares' => round((float) $row->declared_hectares, 2),
                'verified_hectares' => round((float) ($row->verified_hectares ?? 0), 2),
                'verified_farms' => (int) $row->verified_farms,
                'pending_farms' => (int) $row->pending_farms,
                'profile_href' => $farmer === null ? null : route('farmers.show', $farmer),
                'filter_href' => $this->url($filters, ['farmer' => (string) $row->farmer_id, 'farm' => null]),
            ];
        })->values()->all();
    }

    /**
     * @param  Builder<Farm>  $farms
     * @return list<array{crop: string, label: string, farms: int, declared_hectares: float, verified_hectares: float}>
     */
    private function crops(Builder $farms): array
    {
        $rows = $this->aggregate($farms)
            ->select('crop_type')
            ->selectRaw('count(*) as farm_count')
            ->selectRaw('sum(declared_area_hectares) as declared_hectares')
            ->selectRaw(
                'sum(case when verification_status = ? then verified_area_hectares else null end) as verified_hectares',
                [FarmVerificationStatus::Verified->value],
            )
            ->groupBy('crop_type')
            ->orderByDesc('declared_hectares')
            ->get();

        return $rows->map(function ($row): array {
            $crop = $row->crop_type instanceof CropType ? $row->crop_type : CropType::tryFrom((string) $row->crop_type);

            return [
                'crop' => $crop?->value ?? (string) $row->crop_type,
                'label' => $crop?->label() ?? (string) $row->crop_type,
                'farms' => (int) $row->farm_count,
                'declared_hectares' => round((float) $row->declared_hectares, 2),
                'verified_hectares' => round((float) ($row->verified_hectares ?? 0), 2),
            ];
        })->values()->all();
    }

    /**
     * @param  Builder<Farm>  $farms
     * @return list<array{status: string, label: string, farms: int, declared_hectares: float}>
     */
    private function statuses(Builder $farms): array
    {
        $rows = $this->aggregate($farms)
            ->select('verification_status')
            ->selectRaw('count(*) as farm_count')
            ->selectRaw('sum(declared_area_hectares) as declared_hectares')
            ->groupBy('verification_status')
            ->get()
            ->keyBy(fn ($row): string => $row->verification_status instanceof FarmVerificationStatus
                ? $row->verification_status->value
                : (string) $row->verification_status);

        return array_map(function (FarmVerificationStatus $status) use ($rows): array {
            $row = $rows->get($status->value);

            return [
                'status' => $status->value,
                'label' => $this->verificationLabel($status),
                'farms' => (int) ($row->farm_count ?? 0),
                'declared_hectares' => round((float) ($row->declared_hectares ?? 0), 2),
            ];
        }, FarmVerificationStatus::cases());
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  Builder<Farm>  $trendFarms
     * @return array{window: string, monthly: bool, note: string, points: list<array{label: string, farmers: int, farms: int, verified: int}>}
     */
    private function trend(User $user, array $filters, Builder $trendFarms): array
    {
        [$start, $end, $monthly] = $this->trendWindow($filters);
        $buckets = $this->buckets($start, $end, $monthly);
        $farmerCounts = $this->countedBuckets(
            $this->trendFarmers($user, $filters)->whereBetween('created_at', [$start, $end]),
            'created_at',
            $monthly,
            false,
        );
        $farmCounts = $this->countedBuckets(
            (clone $trendFarms)->whereBetween('created_at', [$start, $end]),
            'created_at',
            $monthly,
            false,
        );
        $verifiedCounts = $this->countedBuckets(
            FarmVerification::query()
                ->where('result', FarmVerificationResult::Verified)
                ->whereBetween('verified_at', [$start, $end])
                ->whereIn('farm_id', (clone $trendFarms)->select('farms.id')),
            'verified_at',
            $monthly,
            true,
        );

        $points = [];

        foreach ($buckets as $key => $label) {
            $points[] = [
                'label' => $label,
                'farmers' => $farmerCounts[$key] ?? 0,
                'farms' => $farmCounts[$key] ?? 0,
                'verified' => $verifiedCounts[$key] ?? 0,
            ];
        }

        return [
            'window' => $start->toDateString().' to '.$end->toDateString(),
            'monthly' => $monthly,
            'note' => 'Counts of new farmer records, new farm records, and farms with a verified decision in the period. Verified-area history is not stored, so this is not a hectare trend. Farmer counts follow the farmer record location and ignore crop, status, and boundary filters.',
            'points' => $points,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{0: CarbonInterface, 1: CarbonInterface, 2: bool}
     */
    private function trendWindow(array $filters): array
    {
        $end = now()->endOfDay();
        $start = match ($filters['trend']) {
            '90' => now()->subDays(89)->startOfDay(),
            'ytd' => now()->startOfYear(),
            'custom' => Carbon::parse((string) $filters['trend_from'])->startOfDay(),
            default => now()->subDays(29)->startOfDay(),
        };

        if ($filters['trend'] === 'custom') {
            $end = Carbon::parse((string) $filters['trend_to'])->endOfDay();
        }

        return [$start, $end, $start->diffInDays($end) > 31];
    }

    /**
     * @return array<string, string>
     */
    private function buckets(CarbonInterface $start, CarbonInterface $end, bool $monthly): array
    {
        $buckets = [];
        $cursor = $start->copy();

        if ($monthly) {
            $cursor = $cursor->startOfMonth();
            $last = $end->copy()->startOfMonth();

            while ($cursor->lte($last)) {
                $buckets[$cursor->format('Y-m')] = $cursor->format('M Y');
                $cursor = $cursor->addMonth();
            }

            return $buckets;
        }

        while ($cursor->copy()->startOfDay()->lte($end)) {
            $buckets[$cursor->format('Y-m-d')] = $cursor->format('M j');
            $cursor = $cursor->addDay();
        }

        return $buckets;
    }

    /**
     * @param  Builder<Model>  $query
     * @return array<string, int>
     */
    private function countedBuckets(Builder $query, string $column, bool $monthly, bool $distinctFarms): array
    {
        $bucket = $this->bucketSql($column, $monthly);
        $count = $distinctFarms ? 'count(distinct farm_id) as total' : 'count(*) as total';
        $counts = [];

        foreach ($this->aggregate($query)->selectRaw("{$bucket} as bucket")->selectRaw($count)->groupByRaw($bucket)->get() as $row) {
            $counts[(string) $row->bucket] = (int) $row->total;
        }

        return $counts;
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function aggregate(Builder $query): Builder
    {
        $query->getQuery()->columns = null;
        $query->reorder();

        return $query;
    }

    private function bucketSql(string $column, bool $monthly): string
    {
        if (! in_array($column, ['created_at', 'verified_at'], true)) {
            throw new \InvalidArgumentException('Unsupported trend column.');
        }

        $format = $monthly ? '%Y-%m' : '%Y-%m-%d';

        if (DB::connection()->getDriverName() === 'sqlite') {
            return "strftime('{$format}', {$column})";
        }

        return "DATE_FORMAT({$column}, '{$format}')";
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Farmer>
     */
    private function trendFarmers(User $user, array $filters): Builder
    {
        $farmers = Farmer::query()->visibleTo($user);
        $this->applyFarmerPlace($farmers, 'province', (string) $filters['province']);
        $this->applyFarmerPlace($farmers, 'municipality', (string) $filters['municipality']);
        $this->applyFarmerPlace($farmers, 'barangay', (string) $filters['barangay']);

        if ($filters['farmer'] !== '') {
            $farmers->whereKey((int) $filters['farmer']);
        }

        return $farmers;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  Builder<Farm>  $farms
     * @return array<string, mixed>
     */
    private function map(array $filters, Builder $farms): array
    {
        $matched = $this->layerQuery(clone $farms, (string) $filters['layer']);
        $total = (clone $farms)->count();
        $matchedCount = (clone $matched)->count();
        $features = (clone $matched)
            ->with([
                'farmer:id,farmer_id,first_name,middle_name,last_name',
                'boundary:id,farm_id,boundary_geojson',
            ])
            ->orderByRaw('case when exists (select 1 from farm_boundaries where farm_boundaries.farm_id = farms.id) or farms.latitude is not null then 0 else 1 end')
            ->orderBy('farm_id')
            ->limit(self::MAP_LIMIT)
            ->get()
            ->map(fn (Farm $farm): array => $this->mapFeature($farm, (string) $filters['layer']))
            ->values()
            ->all();

        return [
            'layer' => $filters['layer'],
            'matched' => $matchedCount,
            'drawn' => count($features),
            'truncated' => $matchedCount > self::MAP_LIMIT,
            'undrawn' => max($total - $matchedCount, 0),
            'features' => $features,
        ];
    }

    /**
     * @param  Builder<Farm>  $farms
     * @return Builder<Farm>
     */
    private function layerQuery(Builder $farms, string $layer): Builder
    {
        return match ($layer) {
            'boundaries' => $farms->whereHas('boundary'),
            'verified' => $farms
                ->whereNotNull('verified_area_hectares')
                ->whereHas('boundary'),
            'pending' => $farms->whereIn('verification_status', [
                FarmVerificationStatus::Pending,
                FarmVerificationStatus::InProgress,
            ]),
            'review' => $farms->where('verification_status', FarmVerificationStatus::NeedsReview),
            'missing' => $farms->whereDoesntHave('boundary'),
            default => $farms->whereNotNull('latitude')->whereNotNull('longitude'),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function mapFeature(Farm $farm, string $layer): array
    {
        $includePolygon = in_array($layer, ['boundaries', 'verified', 'pending', 'review'], true);
        $boundary = $includePolygon ? $farm->boundary?->boundary_geojson : null;

        return [
            'id' => $farm->id,
            'farm_id' => $farm->farm_id,
            'farm_name' => $farm->displayName(),
            'farmer_id' => $farm->farmer_id,
            'farmer_name' => $farm->farmer?->fullName() ?? 'Unknown farmer',
            'farmer_reference' => $farm->farmer?->farmer_id ?? '',
            'province' => $farm->province,
            'municipality' => $farm->municipality,
            'barangay' => $farm->barangay,
            'crop_label' => $farm->crop_type->label(),
            'declared_area_hectares' => round((float) $farm->declared_area_hectares, 2),
            'verified_area_hectares' => $farm->verified_area_hectares === null ? null : round((float) $farm->verified_area_hectares, 2),
            'verification_status' => $farm->verification_status->value,
            'verification_label' => $this->verificationLabel($farm->verification_status),
            'status' => $farm->status->value,
            'status_label' => $farm->status->label(),
            'boundary_status' => $farm->boundary === null ? 'missing' : 'mapped',
            'tenure' => $farm->property_ownership?->label(),
            'updated_at' => $farm->updated_at?->timezone((string) config('app.timezone'))->format('M j, Y'),
            'latitude' => $farm->latitude === null ? null : (float) $farm->latitude,
            'longitude' => $farm->longitude === null ? null : (float) $farm->longitude,
            'boundary' => $boundary,
            'farm_href' => route('farms.show', $farm),
            'farmer_href' => route('farmers.show', $farm->farmer_id),
        ];
    }

    /**
     * @param  Builder<Farm>  $farms
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function table(Builder $farms, array $filters): array
    {
        $direction = $filters['direction'] === 'asc' ? 'asc' : 'desc';

        match ($filters['sort']) {
            'verified_area' => $farms
                ->orderByRaw('farms.verified_area_hectares is null')
                ->orderBy('farms.verified_area_hectares', $direction),
            'farmer' => $farms
                ->orderBy(Farmer::query()->select('last_name')->whereColumn('farmers.id', 'farms.farmer_id'), $direction)
                ->orderBy(Farmer::query()->select('first_name')->whereColumn('farmers.id', 'farms.farmer_id'), $direction),
            'location' => $farms
                ->orderBy('province', $direction)
                ->orderBy('municipality', $direction)
                ->orderBy('barangay', $direction),
            'updated' => $farms->orderBy('updated_at', $direction),
            default => $farms->orderBy('declared_area_hectares', $direction),
        };

        $farms->orderBy('farm_id');

        $page = $farms
            ->with([
                'farmer:id,farmer_id,first_name,middle_name,last_name',
                'boundary:id,farm_id',
            ])
            ->paginate($filters['per_page'])
            ->withQueryString();

        return [
            'data' => $page->getCollection()->map(fn (Farm $farm): array => [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->displayName(),
                'farmer_id' => $farm->farmer_id,
                'farmer_name' => $farm->farmer?->fullName() ?? 'Unknown farmer',
                'farmer_reference' => $farm->farmer?->farmer_id ?? '',
                'province' => $farm->province,
                'municipality' => $farm->municipality,
                'barangay' => $farm->barangay,
                'crop_label' => $farm->crop_type->label(),
                'declared_area_hectares' => round((float) $farm->declared_area_hectares, 2),
                'verified_area_hectares' => $farm->verified_area_hectares === null ? null : round((float) $farm->verified_area_hectares, 2),
                'verification_status' => $farm->verification_status->value,
                'status' => $farm->status->value,
                'boundary_status' => $farm->boundary === null ? 'missing' : 'mapped',
                'tenure' => $farm->property_ownership?->label(),
                'updated_at' => $farm->updated_at?->timezone((string) config('app.timezone'))->format('M j, Y'),
                'farm_href' => route('farms.show', $farm),
                'farmer_href' => route('farmers.show', $farm->farmer_id),
            ])->values()->all(),
            'total' => $page->total(),
            'from' => $page->firstItem(),
            'to' => $page->lastItem(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'prev_page_url' => $page->previousPageUrl(),
            'next_page_url' => $page->nextPageUrl(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  Builder<Farm>  $farms
     * @return list<array{tone: string, title: string, detail: string, count: int, href: string}>
     */
    private function insights(array $filters, Builder $farms): array
    {
        $items = [
            $this->insight('action', 'Awaiting verification', 'Current status is pending.', (clone $farms)->where('verification_status', FarmVerificationStatus::Pending)->count(), $this->url($filters, ['verification_status' => FarmVerificationStatus::Pending->value])),
            $this->insight('action', 'Verification in progress', 'A verification is open and has not been decided.', (clone $farms)->where('verification_status', FarmVerificationStatus::InProgress)->count(), $this->url($filters, ['verification_status' => FarmVerificationStatus::InProgress->value])),
            $this->insight('action', 'Needs review', 'The latest decision asked for another review.', (clone $farms)->where('verification_status', FarmVerificationStatus::NeedsReview)->count(), $this->url($filters, ['verification_status' => FarmVerificationStatus::NeedsReview->value])),
            $this->insight('review', 'Verification failed', 'The latest decision is failed. Declared area was not changed.', (clone $farms)->where('verification_status', FarmVerificationStatus::Failed)->count(), $this->url($filters, ['verification_status' => FarmVerificationStatus::Failed->value])),
            $this->insight('review', 'No saved boundary', 'These farms have no polygon. Coordinates, when present, remain a point on the location layer.', (clone $farms)->whereDoesntHave('boundary')->count(), $this->url($filters, ['boundary' => 'missing'])),
            $this->insight('review', 'No accepted area recorded', 'These farms have no recorded verified area. The declared area remains available, but it is not treated as a measured value.', (clone $farms)->whereNull('verified_area_hectares')->count(), $this->url($filters, ['area' => 'unrecorded'])),
            $this->insight('info', 'Declared and verified area differ', 'Both measurements are recorded and they are not equal. SureFarm has no configured policy threshold for this list.', (clone $farms)->whereNotNull('verified_area_hectares')->whereColumn('declared_area_hectares', '!=', 'verified_area_hectares')->count(), $this->url($filters, ['area' => 'differs'])),
            $this->insight('review', 'Incomplete location', 'Province or municipality is blank, or the farm has neither a boundary nor coordinates. A blank barangay is optional and is not included here.', $this->incompleteLocationCount(clone $farms), $this->url($filters, ['location' => 'incomplete'])),
            $this->insight('info', 'Farmers with more than one farm', 'Area is summed across every farm registered to the same farmer.', $this->farmersWithSeveralFarms(clone $farms), $this->url($filters, ['rank' => 'declared'])),
            $this->insight('info', 'Inactive farms with a verified area', 'The farm is inactive and a verified area is still stored. Inactive land stays visible until a status filter removes it.', (clone $farms)->where('status', FarmStatus::Inactive)->whereNotNull('verified_area_hectares')->count(), $this->url($filters, ['status' => FarmStatus::Inactive->value])),
        ];

        return array_values(array_filter($items, fn (array $item): bool => $item['count'] > 0));
    }

    /**
     * @param  Builder<Farm>  $farms
     */
    private function incompleteLocationCount(Builder $farms): int
    {
        return $this->whereIncompleteLocation($farms)->count();
    }

    /**
     * @param  Builder<Farm>  $farms
     * @return Builder<Farm>
     */
    private function whereIncompleteLocation(Builder $farms): Builder
    {
        return $farms->where(function (Builder $query): void {
            $query->where(function (Builder $query): void {
                $query->whereNull('province')->orWhere('province', '');
            })->orWhere(function (Builder $query): void {
                $query->whereNull('municipality')->orWhere('municipality', '');
            })->orWhere(function (Builder $query): void {
                $query->whereDoesntHave('boundary')
                    ->where(function (Builder $query): void {
                        $query->whereNull('latitude')->orWhereNull('longitude');
                    });
            });
        });
    }

    /**
     * @param  Builder<Farm>  $farms
     */
    private function farmersWithSeveralFarms(Builder $farms): int
    {
        return $farms
            ->reorder()
            ->select('farmer_id')
            ->groupBy('farmer_id')
            ->havingRaw('count(*) > 1')
            ->get()
            ->count();
    }

    /**
     * @return array<string, mixed>
     */
    private function administration(): array
    {
        $roles = User::query()
            ->whereNull('suspended_at')
            ->selectRaw('role, count(*) as total')
            ->groupBy('role')
            ->pluck('total', 'role');

        return [
            'users' => array_map(fn (UserRole $role): array => [
                'role' => $role->value,
                'label' => $role->label(),
                'count' => (int) ($roles[$role->value] ?? 0),
            ], UserRole::cases()),
            'suspended_users' => User::query()->whereNotNull('suspended_at')->count(),
            'open_invitations' => UserInvitation::query()
                ->whereNull('accepted_at')
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->count(),
            'cooperatives' => array_map(fn (CooperativeStatus $status): array => [
                'status' => $status->value,
                'label' => ucfirst($status->value),
                'count' => Cooperative::query()->where('status', $status)->count(),
            ], CooperativeStatus::cases()),
            'open_grants' => RegistryGrant::query()->whereNull('revoked_at')->count(),
            'users_href' => route('users.index'),
            'cooperatives_href' => route('cooperatives.index'),
            'events' => AccessEvent::query()
                ->with('actor:id,name')
                ->latest('id')
                ->limit(5)
                ->get()
                ->map(fn (AccessEvent $event): array => [
                    'action' => $this->accessLabel($event->action),
                    'actor' => $event->actor?->name ?? 'Unknown account',
                    'at' => $event->created_at?->timezone((string) config('app.timezone'))->format('M j, Y g:i A'),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function options(User $user, array $filters): array
    {
        $optionFarms = $this->farmQuery($user, array_merge($filters, [
            'province' => '',
            'municipality' => '',
            'barangay' => '',
        ]));

        $provinces = $this->distinctPlaces(clone $optionFarms, 'province');
        $municipalities = $this->distinctPlaces(
            $this->farmQuery($user, array_merge($filters, ['municipality' => '', 'barangay' => ''])),
            'municipality',
        );
        $barangays = $this->distinctPlaces(
            $this->farmQuery($user, array_merge($filters, ['barangay' => ''])),
            'barangay',
        );

        $farmerIds = $this->farmQuery($user, array_merge($filters, ['farmer' => '', 'farm' => '']))
            ->select('farmer_id')
            ->distinct()
            ->limit(101)
            ->pluck('farmer_id');
        $farmers = Farmer::query()
            ->whereIn('id', $farmerIds)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();
        $farmChoices = $filters['farmer'] === ''
            ? collect()
            : Farm::query()
                ->visibleTo($user)
                ->where('farmer_id', (int) $filters['farmer'])
                ->orderBy('farm_id')
                ->limit(100)
                ->get(['id', 'farm_id', 'farm_name']);

        return [
            'provinces' => $provinces,
            'municipalities' => $municipalities,
            'barangays' => $barangays,
            'farmers' => $farmers->take(100)->map(fn (Farmer $farmer): array => [
                'value' => (string) $farmer->id,
                'label' => $farmer->fullName(),
                'reference' => $farmer->farmer_id,
            ])->values()->all(),
            'farmers_limited' => $farmers->count() > 100,
            'farms' => $farmChoices->map(fn (Farm $farm): array => [
                'value' => (string) $farm->id,
                'label' => $farm->displayName(),
                'reference' => $farm->farm_id,
            ])->values()->all(),
            'crops' => array_map(fn (CropType $crop): array => [
                'value' => $crop->value,
                'label' => $crop->label(),
            ], CropType::cases()),
            'verification_statuses' => [
                ['value' => 'unverified', 'label' => 'Not verified'],
                ...array_map(fn (FarmVerificationStatus $status): array => [
                    'value' => $status->value,
                    'label' => $this->verificationLabel($status),
                ], FarmVerificationStatus::cases()),
            ],
            'statuses' => array_map(fn (FarmStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ], FarmStatus::cases()),
            'boundaries' => [
                ['value' => 'mapped', 'label' => 'Saved boundary'],
                ['value' => 'missing', 'label' => 'No boundary'],
            ],
            'layers' => [
                ['value' => 'locations', 'label' => 'All farm locations'],
                ['value' => 'boundaries', 'label' => 'Saved boundaries'],
                ['value' => 'verified', 'label' => 'Verified farm land'],
                ['value' => 'pending', 'label' => 'Pending verification'],
                ['value' => 'review', 'label' => 'Needs review'],
                ['value' => 'missing', 'label' => 'Missing boundaries'],
            ],
            'ranks' => [
                ['value' => 'declared', 'label' => 'Declared area'],
                ['value' => 'verified', 'label' => 'Verified area'],
            ],
            'trends' => [
                ['value' => '30', 'label' => 'Last 30 days'],
                ['value' => '90', 'label' => 'Last 90 days'],
                ['value' => 'ytd', 'label' => 'Year to date'],
                ['value' => 'custom', 'label' => 'Custom range'],
            ],
        ];
    }

    /**
     * @param  Builder<Farm>  $farms
     * @return list<array{value: string, label: string}>
     */
    private function distinctPlaces(Builder $farms, string $column): array
    {
        $places = $farms
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->select($column)
            ->distinct()
            ->orderBy($column)
            ->limit(200)
            ->pluck($column);

        return $places->map(fn (mixed $place): array => [
            'value' => (string) $place,
            'label' => (string) $place,
        ])->values()->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array{label: string, href: string}>
     */
    private function activeFilters(array $filters): array
    {
        $chips = [];
        $labels = [
            'search' => 'Search',
            'province' => 'Province',
            'municipality' => 'Municipality',
            'barangay' => 'Barangay',
            'crop' => 'Crop',
            'verification_status' => 'Verification',
            'status' => 'Farm status',
            'boundary' => 'Boundary',
            'location' => 'Location',
            'area' => 'Area check',
            'registered_from' => 'Registered from',
            'registered_to' => 'Registered to',
            'updated_from' => 'Updated from',
            'updated_to' => 'Updated to',
        ];

        foreach ($labels as $key => $label) {
            $value = (string) $filters[$key];

            if ($value === '') {
                continue;
            }

            $display = $value === '__missing__' ? 'Not recorded' : $value;
            $clear = [$key => null];

            if ($key === 'province') {
                $clear['municipality'] = null;
                $clear['barangay'] = null;
            }

            if ($key === 'municipality') {
                $clear['barangay'] = null;
            }

            $chips[] = [
                'label' => $label.': '.$this->filterDisplay($key, $display),
                'href' => $this->url($filters, $clear),
            ];
        }

        if ($filters['farmer'] !== '') {
            $farmer = Farmer::query()->find((int) $filters['farmer']);
            $chips[] = [
                'label' => 'Farmer: '.($farmer?->fullName() ?? 'Selected farmer'),
                'href' => $this->url($filters, ['farmer' => null, 'farm' => null]),
            ];
        }

        if ($filters['farm'] !== '') {
            $farm = Farm::query()->find((int) $filters['farm']);
            $chips[] = [
                'label' => 'Farm: '.($farm?->displayName() ?? 'Selected farm'),
                'href' => $this->url($filters, ['farm' => null]),
            ];
        }

        return $chips;
    }

    private function filterDisplay(string $key, string $value): string
    {
        return match ($key) {
            'crop' => CropType::tryFrom($value)?->label() ?? $value,
            'verification_status' => $value === 'unverified'
                ? 'Not verified'
                : $this->verificationLabel(FarmVerificationStatus::tryFrom($value)),
            'status' => FarmStatus::tryFrom($value)?->label() ?? $value,
            'boundary' => $value === 'mapped' ? 'Saved boundary' : 'No boundary',
            'location' => 'Incomplete location',
            'area' => $value === 'differs' ? 'Declared and verified differ' : 'Verified area not recorded',
            default => $value,
        };
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array<string, string|null>  $overrides
     */
    private function url(array $filters, array $overrides): string
    {
        $query = array_merge($filters, $overrides);

        foreach ($overrides as $key => $value) {
            if ($value === null) {
                unset($query[$key]);
            }
        }

        unset($query['per_page']);

        if (($query['layer'] ?? '') === 'locations') {
            unset($query['layer']);
        }

        if (($query['rank'] ?? '') === 'declared') {
            unset($query['rank']);
        }

        if (($query['trend'] ?? '') === '30') {
            unset($query['trend']);
        }

        if (($query['sort'] ?? '') === 'declared_area') {
            unset($query['sort']);
        }

        if (($query['direction'] ?? '') === 'desc') {
            unset($query['direction']);
        }

        $query = array_filter(
            $query,
            fn (mixed $value): bool => $value !== null && $value !== '',
        );

        return route('dashboard', $query);
    }

    /**
     * @return array{key: string, label: string, display: string, detail: string, href: string|null}
     */
    private function metric(string $key, string $label, string $display, string $detail, ?string $href): array
    {
        return compact('key', 'label', 'display', 'detail', 'href');
    }

    /**
     * @return array{tone: string, title: string, detail: string, count: int, href: string}
     */
    private function insight(string $tone, string $title, string $detail, int $count, string $href): array
    {
        return compact('tone', 'title', 'detail', 'count', 'href');
    }

    private function hectares(float $hectares): string
    {
        return number_format($hectares, 2, '.', '').' ha';
    }

    private function scopeLabel(User $user): string
    {
        if ($this->scope->seesEntireRegistry($user)) {
            return 'Entire registry';
        }

        $provinces = RegistryGrant::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->where('kind', RegistryGrantKind::Province)
            ->whereNotNull('province')
            ->orderBy('province')
            ->pluck('province')
            ->unique()
            ->values();

        if ($provinces->isEmpty()) {
            return 'No open registry grant';
        }

        return 'Provinces: '.$provinces->join(', ');
    }

    /**
     * @return list<string>
     */
    private function verificationFilterValues(): array
    {
        return [
            'unverified',
            ...array_map(fn (FarmVerificationStatus $status): string => $status->value, FarmVerificationStatus::cases()),
        ];
    }

    private function verificationLabel(?FarmVerificationStatus $status): string
    {
        return match ($status) {
            FarmVerificationStatus::Pending => 'Pending',
            FarmVerificationStatus::InProgress => 'In progress',
            FarmVerificationStatus::Verified => 'Verified',
            FarmVerificationStatus::Failed => 'Failed',
            FarmVerificationStatus::NeedsReview => 'Needs review',
            null => 'Pending',
        };
    }

    private function accessLabel(AccessEventAction $action): string
    {
        return match ($action) {
            AccessEventAction::RoleChanged => 'Role changed',
            AccessEventAction::UserSuspended => 'Account suspended',
            AccessEventAction::UserRestored => 'Account restored',
            AccessEventAction::FarmerLinked => 'Farmer account linked',
            AccessEventAction::FarmerUnlinked => 'Farmer account unlinked',
            AccessEventAction::GrantCreated => 'Registry grant created',
            AccessEventAction::GrantRevoked => 'Registry grant revoked',
            AccessEventAction::AssignmentCreated => 'Verifier assigned',
            AccessEventAction::AssignmentRevoked => 'Verifier assignment revoked',
            AccessEventAction::HarvestCorrected => 'Harvest corrected',
            AccessEventAction::InventoryReceived => 'Inventory received',
            AccessEventAction::InventoryReceiptReversed => 'Inventory receipt reversed',
            AccessEventAction::InventoryBalanceCorrected => 'Inventory balance corrected',
            AccessEventAction::CooperativeRegistered => 'Cooperative registered',
            AccessEventAction::CooperativeUpdated => 'Cooperative updated',
            AccessEventAction::CooperativeStatusChanged => 'Cooperative status changed',
            AccessEventAction::MembershipStarted => 'Membership started',
            AccessEventAction::MembershipSuspended => 'Membership suspended',
            AccessEventAction::MembershipReactivated => 'Membership reactivated',
            AccessEventAction::MembershipEnded => 'Membership ended',
            AccessEventAction::OfficerAssigned => 'Officer assigned',
            AccessEventAction::OfficerRevoked => 'Officer revoked',
        };
    }

    /**
     * @return list<string>
     */
    private function notes(): array
    {
        return [
            'Declared area is the farmer-reported value. Verified area is the stored measurement for farms currently marked verified. The two are never added together.',
            'The person shown is the registered farmer on the farm record. Recorded tenure is a separate field and is not proof of legal title.',
            'Each farm stores one crop type. Crop charts count that farm’s area once.',
            'Trends count new records and verified decisions. The registry does not keep historical hectare snapshots.',
            'Map polygons are saved boundaries only. Farms without a polygon are shown as a point when coordinates exist, and only on layers that use points.',
            'Dates use the application timezone.',
        ];
    }
}
