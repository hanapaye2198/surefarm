<?php

namespace App\Http\Controllers;

use App\AccessEventAction;
use App\Actions\ChangeCooperativeStatus;
use App\Actions\RegisterCooperative;
use App\Actions\UpdateCooperative;
use App\CooperativeMembershipStatus;
use App\CooperativeStatus;
use App\FarmVerificationStatus;
use App\HarvestStatus;
use App\Http\Requests\StoreCooperativeRequest;
use App\Http\Requests\UpdateCooperativeRequest;
use App\Http\Requests\UpdateCooperativeStatusRequest;
use App\Models\AccessEvent;
use App\Models\Cooperative;
use App\Models\CooperativeMembership;
use App\Models\CooperativeOfficer;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\FarmHarvest;
use App\Models\User;
use App\Services\ProductionLedger;
use App\Services\RegistryScope;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CooperativeController extends Controller
{
    public function index(Request $request, RegistryScope $scope): Response
    {
        $viewer = $this->manager($request);
        $search = trim($request->string('search')->toString());
        $status = CooperativeStatus::tryFrom($request->string('status')->toString());
        $sort = $request->string('sort')->toString();
        $sort = in_array($sort, ['name', 'code', 'created_at'], true) ? $sort : 'name';
        $direction = $request->string('direction')->toString() === 'desc' ? 'desc' : 'asc';

        $cooperatives = $this->visibleCooperatives($viewer)
            ->withCount([
                'memberships as active_members_count' => fn (Builder $query) => $this->scopeMembershipCount($query, $viewer, $scope, CooperativeMembershipStatus::Active),
                'memberships as suspended_members_count' => fn (Builder $query) => $this->scopeMembershipCount($query, $viewer, $scope, CooperativeMembershipStatus::Suspended),
            ])
            ->when($status instanceof CooperativeStatus, fn (Builder $query) => $query->where('status', $status))
            ->when($search !== '', function (Builder $query) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $query->where(function (Builder $query) use ($like): void {
                    $query->where('name', 'like', $like)->orWhere('code', 'like', $like);
                });
            })
            ->orderBy($sort, $direction)
            ->orderBy('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Cooperative $cooperative): array => [
                'id' => $cooperative->id,
                'name' => $cooperative->name,
                'code' => $cooperative->code,
                'status' => $cooperative->status->value,
                'status_label' => $cooperative->status === CooperativeStatus::Active ? 'Active' : 'Inactive',
                'active_members_count' => $cooperative->active_members_count,
                'suspended_members_count' => $cooperative->suspended_members_count,
            ]);

        return Inertia::render('cooperatives/index', [
            'cooperatives' => $cooperatives,
            'filters' => [
                'search' => $search,
                'status' => $status instanceof CooperativeStatus ? $status->value : '',
                'sort' => $sort,
                'direction' => $direction,
            ],
            'can_manage' => $viewer->canAccess(UserRole::Operations),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('cooperatives/create');
    }

    public function store(StoreCooperativeRequest $request, RegisterCooperative $register): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $code = $request->validated('code');
        $cooperative = $register->handle($actor, [
            'name' => $request->string('name')->toString(),
            'code' => is_string($code) ? $code : null,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Cooperative registered.']);

        return to_route('cooperatives.show', $cooperative);
    }

    public function show(Request $request, Cooperative $cooperative, RegistryScope $scope, ProductionLedger $ledger): Response
    {
        $viewer = $this->manager($request);
        $this->ensureVisible($viewer, $cooperative);

        [$from, $to] = $this->period($request);
        $status = CooperativeMembershipStatus::tryFrom($request->string('membership')->toString());
        $search = trim($request->string('search')->toString());
        $scoped = $this->limitsMembers($viewer, $scope);
        $visibleFarmers = fn (): Builder => Farmer::query()->select('farmers.id')->visibleTo($viewer);

        $memberships = CooperativeMembership::query()
            ->where('cooperative_id', $cooperative->id)
            ->with('farmer:id,farmer_id,first_name,middle_name,last_name,province,cooperative_id')
            ->when($status instanceof CooperativeMembershipStatus, fn (Builder $query) => $query->where('status', $status))
            ->when($scoped, fn (Builder $query) => $query->whereIn('farmer_id', $visibleFarmers()))
            ->when($search !== '', function (Builder $query) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $query->whereHas('farmer', function (Builder $farmer) use ($like): void {
                    $farmer->where('farmer_id', 'like', $like)
                        ->orWhere('first_name', 'like', $like)
                        ->orWhere('last_name', 'like', $like);
                });
            })
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString();

        $visibleIds = array_flip(
            Farmer::query()
                ->whereIn('id', $memberships->getCollection()->pluck('farmer_id'))
                ->visibleTo($viewer)
                ->pluck('id')
                ->all(),
        );

        $memberships->setCollection($memberships->getCollection()->map(function (CooperativeMembership $membership) use ($visibleIds): array {
            $farmer = $membership->farmer;

            return [
                'id' => $membership->id,
                'status' => $membership->status->value,
                'status_label' => $membership->status->label(),
                'joined_on' => $membership->joined_on?->toDateString(),
                'ended_on' => $membership->ended_on?->toDateString(),
                'origin' => $membership->origin->label(),
                'farmer_name' => $farmer->fullName(),
                'farmer_code' => $farmer->farmer_id,
                'farmer_href_id' => isset($visibleIds[$farmer->id]) ? $farmer->id : null,
                'province' => $farmer->province,
            ];
        }));

        $openFarmerIds = CooperativeMembership::query()
            ->where('cooperative_id', $cooperative->id)
            ->whereNotNull('open_slot')
            ->when($scoped, fn (Builder $query) => $query->whereIn('farmer_id', $visibleFarmers()))
            ->select('farmer_id');

        $farms = Farm::query()->visibleTo($viewer)->whereIn('farmer_id', $openFarmerIds);
        $harvests = FarmHarvest::query()
            ->visibleTo($viewer)
            ->where('status', HarvestStatus::Completed)
            ->whereIn('farm_id', (clone $farms)->select('farms.id'))
            ->when($from !== null, fn (Builder $query) => $query->whereDate('harvest_date', '>=', $from))
            ->when($to !== null, fn (Builder $query) => $query->whereDate('harvest_date', '<=', $to))
            ->selectRaw('unit, SUM(quantity) as total')
            ->groupBy('unit')
            ->get();

        return Inertia::render('cooperatives/show', [
            'cooperative' => [
                'id' => $cooperative->id,
                'name' => $cooperative->name,
                'code' => $cooperative->code,
                'status' => $cooperative->status->value,
                'status_label' => $cooperative->status === CooperativeStatus::Active ? 'Active' : 'Inactive',
            ],
            'stats' => [
                'active_members' => $this->memberCount($cooperative, $scoped, $visibleFarmers, CooperativeMembershipStatus::Active),
                'suspended_members' => $this->memberCount($cooperative, $scoped, $visibleFarmers, CooperativeMembershipStatus::Suspended),
                'ended_members' => $this->memberCount($cooperative, $scoped, $visibleFarmers, CooperativeMembershipStatus::Ended),
                'farms' => (clone $farms)->count(),
                'verified_farms' => (clone $farms)->where('verification_status', FarmVerificationStatus::Verified)->count(),
                'activities' => FarmActivity::query()
                    ->visibleTo($viewer)
                    ->whereIn('farm_id', (clone $farms)->select('farms.id'))
                    ->when($from !== null, fn (Builder $query) => $query->whereDate('activity_date', '>=', $from))
                    ->when($to !== null, fn (Builder $query) => $query->whereDate('activity_date', '<=', $to))
                    ->count(),
            ],
            'harvests' => $harvests->map(fn (FarmHarvest $harvest): array => [
                'unit' => $harvest->unit,
                'label' => $ledger->quantityLabel($harvest->getAttribute('total'), $harvest->unit),
            ])->values()->all(),
            'memberships' => $memberships,
            'officers' => CooperativeOfficer::query()
                ->where('cooperative_id', $cooperative->id)
                ->whereNull('revoked_at')
                ->with('user:id,name')
                ->orderBy('id')
                ->get()
                ->map(fn (CooperativeOfficer $officer): array => [
                    'id' => $officer->id,
                    'name' => $officer->user instanceof User ? $officer->user->name : 'Officer',
                    'assigned_on' => $officer->assigned_at->toDateString(),
                ])
                ->all(),
            'history' => $this->history($cooperative),
            'filters' => [
                'from' => $from ?? '',
                'to' => $to ?? '',
                'search' => $search,
                'membership' => $status instanceof CooperativeMembershipStatus ? $status->value : '',
            ],
            'can_manage' => $viewer->canAccess(UserRole::Operations),
        ]);
    }

    public function edit(Request $request, Cooperative $cooperative): Response
    {
        $viewer = $this->manager($request);
        $this->ensureVisible($viewer, $cooperative);

        return Inertia::render('cooperatives/edit', [
            'cooperative' => [
                'id' => $cooperative->id,
                'name' => $cooperative->name,
                'code' => $cooperative->code ?? '',
            ],
        ]);
    }

    public function update(UpdateCooperativeRequest $request, Cooperative $cooperative, UpdateCooperative $update): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $code = $request->validated('code');
        $update->handle($actor, $cooperative, [
            'name' => $request->string('name')->toString(),
            'code' => is_string($code) ? $code : null,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Cooperative updated.']);

        return to_route('cooperatives.show', $cooperative);
    }

    public function updateStatus(
        UpdateCooperativeStatusRequest $request,
        Cooperative $cooperative,
        ChangeCooperativeStatus $change,
    ): RedirectResponse {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $change->handle($actor, $cooperative, CooperativeStatus::from($request->string('status')->toString()));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Cooperative status updated.']);

        return to_route('cooperatives.show', $cooperative);
    }

    private function manager(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User || $user->isSuspended()) {
            abort(403);
        }

        if ($user->role !== UserRole::CooperativeOfficer && ! $user->canAccess(UserRole::Operations)) {
            abort(403);
        }

        return $user;
    }

    /**
     * @return Builder<Cooperative>
     */
    private function visibleCooperatives(User $viewer): Builder
    {
        $query = Cooperative::query();

        if ($viewer->role === UserRole::CooperativeOfficer) {
            $query->whereIn('id', CooperativeOfficer::query()
                ->select('cooperative_id')
                ->where('user_id', $viewer->id)
                ->whereNull('revoked_at'));
        }

        return $query;
    }

    private function ensureVisible(User $viewer, Cooperative $cooperative): void
    {
        $visible = $this->visibleCooperatives($viewer)->whereKey($cooperative->id)->exists();

        if (! $visible) {
            abort(404);
        }
    }

    private function limitsMembers(User $viewer, RegistryScope $scope): bool
    {
        return ! $scope->seesEntireRegistry($viewer) && $viewer->role !== UserRole::CooperativeOfficer;
    }

    /**
     * @param  Builder<CooperativeMembership>  $query
     */
    private function scopeMembershipCount(Builder $query, User $viewer, RegistryScope $scope, CooperativeMembershipStatus $status): void
    {
        $query->where('status', $status);

        if ($this->limitsMembers($viewer, $scope)) {
            $query->whereIn('farmer_id', Farmer::query()->select('farmers.id')->visibleTo($viewer));
        }
    }

    /**
     * @param  callable(): Builder<Farmer>  $visibleFarmers
     */
    private function memberCount(Cooperative $cooperative, bool $scoped, callable $visibleFarmers, CooperativeMembershipStatus $status): int
    {
        return CooperativeMembership::query()
            ->where('cooperative_id', $cooperative->id)
            ->where('status', $status)
            ->when($scoped, fn (Builder $query) => $query->whereIn('farmer_id', $visibleFarmers()))
            ->count();
    }

    /**
     * @return array{0: ?string, 1: ?string}
     */
    private function period(Request $request): array
    {
        $from = $this->date($request->string('from')->toString());
        $to = $this->date($request->string('to')->toString());

        if ($from !== null && $to !== null && $from > $to) {
            return [$to, $from];
        }

        return [$from, $to];
    }

    private function date(string $value): ?string
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        $date = date_create_immutable($value);

        if ($date === false || $date->format('Y-m-d') !== $value) {
            return null;
        }

        return $value;
    }

    /**
     * @return list<array{id: int, action: string, summary: string, actor: string|null, created_at: string}>
     */
    private function history(Cooperative $cooperative): array
    {
        $membershipIds = CooperativeMembership::query()->where('cooperative_id', $cooperative->id)->select('id');

        $events = AccessEvent::query()
            ->with('actor:id,name')
            ->where(function (Builder $query) use ($cooperative, $membershipIds): void {
                $query->where(function (Builder $query) use ($cooperative): void {
                    $query->where('auditable_type', $cooperative->getMorphClass())
                        ->where('auditable_id', $cooperative->id);
                })->orWhere(function (Builder $query) use ($membershipIds): void {
                    $query->where('auditable_type', (new CooperativeMembership)->getMorphClass())
                        ->whereIn('auditable_id', $membershipIds);
                });
            })
            ->orderByDesc('id')
            ->limit(20)
            ->get();

        $rows = [];

        foreach ($events as $event) {
            $rows[] = [
                'id' => $event->id,
                'action' => $event->action->value,
                'summary' => $this->summary($event),
                'actor' => $event->actor instanceof User ? $event->actor->name : null,
                'created_at' => $event->created_at->toDateTimeString(),
            ];
        }

        return $rows;
    }

    private function summary(AccessEvent $event): string
    {
        $metadata = $event->metadata ?? [];
        $farmerCode = $metadata['farmer_code'] ?? null;
        $farmer = is_string($farmerCode) ? $farmerCode : 'a farmer';

        return match ($event->action) {
            AccessEventAction::CooperativeRegistered => 'Cooperative registered.',
            AccessEventAction::CooperativeUpdated => 'Cooperative details updated.',
            AccessEventAction::CooperativeStatusChanged => 'Status changed from '.(is_string($metadata['from'] ?? null) ? $metadata['from'] : 'previous').' to '.(is_string($metadata['to'] ?? null) ? $metadata['to'] : 'current').'.',
            AccessEventAction::MembershipStarted => 'Membership started for '.$farmer.'.',
            AccessEventAction::MembershipSuspended => 'Membership suspended for '.$farmer.'.',
            AccessEventAction::MembershipReactivated => 'Membership reactivated for '.$farmer.'.',
            AccessEventAction::MembershipEnded => 'Membership ended for '.$farmer.'.',
            AccessEventAction::OfficerAssigned => 'Cooperative officer assigned.',
            AccessEventAction::OfficerRevoked => 'Cooperative officer assignment ended.',
            default => $event->action->value,
        };
    }
}
