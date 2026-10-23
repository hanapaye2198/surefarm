<?php

namespace App\Http\Controllers;

use App\Actions\UpdateUserRole;
use App\Http\Requests\UpdateUserRoleRequest;
use App\Models\AccessEvent;
use App\Models\Cooperative;
use App\Models\FarmVerifierAssignment;
use App\Models\RegistryGrant;
use App\Models\User;
use App\Models\UserInvitation;
use App\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $actor = $request->user();
        $search = $request->string('search')->trim()->toString();
        $role = UserRole::tryFrom($request->string('role')->trim()->toString());
        $status = $request->string('status')->trim()->toString();
        $cooperativeId = $request->integer('cooperative') ?: null;
        $assignment = $request->string('assignment')->trim()->toString();
        $sort = $request->string('sort')->trim()->toString();
        $sort = in_array($sort, ['name', 'email', 'created_at'], true) ? $sort : 'name';
        $direction = $request->string('direction')->trim()->toString() === 'desc' ? 'desc' : 'asc';

        $onlyAdministratorId = $this->onlyAdministratorId();

        $users = User::query()
            ->with([
                'farmerProfile.cooperative:id,name',
                'registryGrants' => fn ($query) => $query->whereNull('revoked_at'),
            ])
            ->withCount([
                'farmAssignments as open_assignments_count' => fn ($query) => $query->whereNull('revoked_at'),
            ])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $query->where(function (Builder $query) use ($like): void {
                    $query->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like);
                });
            })
            ->when($role !== null, fn (Builder $query) => $query->where('role', $role))
            ->when($status === 'active', fn (Builder $query) => $query->whereNull('suspended_at'))
            ->when($status === 'suspended', fn (Builder $query) => $query->whereNotNull('suspended_at'))
            ->when($cooperativeId !== null, function (Builder $query) use ($cooperativeId): void {
                $query->whereHas('farmerProfile', fn (Builder $profile) => $profile->where('cooperative_id', $cooperativeId));
            })
            ->when($assignment === 'assigned', function (Builder $query): void {
                $query->whereHas('farmAssignments', fn (Builder $assignments) => $assignments->whereNull('revoked_at'));
            })
            ->orderBy($sort, $direction)
            ->paginate(15)
            ->withQueryString()
            ->through(fn (User $user): array => $this->accountRow($user, $actor, $onlyAdministratorId));

        return Inertia::render('users/index', [
            'users' => $users,
            'stats' => [
                'total' => User::query()->count(),
                'active' => User::query()->whereNull('suspended_at')->count(),
                'suspended' => User::query()->whereNotNull('suspended_at')->count(),
                'open_invitations' => $this->openInvitations()->count(),
            ],
            'filters' => [
                'search' => $search,
                'role' => $role instanceof UserRole ? $role->value : '',
                'status' => in_array($status, ['active', 'suspended'], true) ? $status : '',
                'cooperative' => $cooperativeId ?? '',
                'assignment' => $assignment === 'assigned' ? 'assigned' : '',
                'sort' => $sort,
                'direction' => $direction,
            ],
            'cooperatives' => Cooperative::query()->orderBy('name')->get(['id', 'name']),
            'invitations' => $this->openInvitations()
                ->with('inviter:id,name')
                ->orderByDesc('id')
                ->get()
                ->map(fn (UserInvitation $invitation): array => [
                    'id' => $invitation->id,
                    'name' => $invitation->name,
                    'email' => $invitation->email,
                    'role' => $invitation->role->value,
                    'role_label' => $invitation->role->label(),
                    'expires_at' => $invitation->expires_at->timezone(config('app.timezone'))->format('M j, Y g:i A'),
                    'invited_by' => $invitation->inviter?->name,
                ])
                ->values()
                ->all(),
            'roles' => $this->roles(),
        ]);
    }

    public function show(User $user): Response
    {
        $actor = request()->user();
        $user->load([
            'farmerProfile.cooperative:id,name',
            'registryGrants.grantor:id,name',
            'farmAssignments.farm:id,farm_id,farm_name',
            'farmAssignments.assigner:id,name',
        ]);

        return Inertia::render('users/show', [
            'account' => $this->accountRow($user, $actor, $this->onlyAdministratorId()),
            'farmer' => $user->farmerProfile === null ? null : [
                'farmer_code' => $user->farmerProfile->farmer_id,
                'name' => $user->farmerProfile->fullName(),
                'cooperative' => $user->farmerProfile->cooperative?->name,
            ],
            'grants' => $user->registryGrants
                ->sortByDesc('id')
                ->take(50)
                ->values()
                ->map(fn (RegistryGrant $grant): array => [
                    'id' => $grant->id,
                    'kind' => $grant->kind->value,
                    'province' => $grant->province,
                    'open' => $grant->isOpen(),
                    'granted_by' => $grant->grantor?->name,
                    'created_at' => $grant->created_at?->timezone(config('app.timezone'))->format('M j, Y g:i A'),
                ])
                ->all(),
            'assignments' => $user->farmAssignments
                ->sortByDesc('id')
                ->take(50)
                ->values()
                ->map(fn (FarmVerifierAssignment $assignment): array => [
                    'id' => $assignment->id,
                    'farm_code' => $assignment->farm?->farm_id,
                    'farm_name' => $assignment->farm?->displayName(),
                    'open' => $assignment->isOpen(),
                    'assigned_by' => $assignment->assigner?->name,
                    'assigned_at' => $assignment->assigned_at->timezone(config('app.timezone'))->format('M j, Y'),
                    'revoked_at' => $assignment->revoked_at?->timezone(config('app.timezone'))->format('M j, Y'),
                ])
                ->all(),
            'events' => AccessEvent::query()
                ->with('actor:id,name')
                ->where('subject_user_id', $user->id)
                ->latest('id')
                ->limit(20)
                ->get()
                ->map(fn (AccessEvent $event): array => [
                    'id' => $event->id,
                    'action' => $event->action->value,
                    'actor' => $event->actor?->name,
                    'metadata' => $event->metadata,
                    'created_at' => $event->created_at->timezone(config('app.timezone'))->format('M j, Y g:i A'),
                ])
                ->all(),
            'roles' => $this->roles(),
        ]);
    }

    public function update(UpdateUserRoleRequest $request, User $user, UpdateUserRole $update): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $update->handle($actor, $user, UserRole::from((string) $request->validated('role')));

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Role updated.',
        ]);

        return to_route('users.show', $user);
    }

    /**
     * @return Builder<UserInvitation>
     */
    private function openInvitations(): Builder
    {
        return UserInvitation::query()
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now());
    }

    private function onlyAdministratorId(): ?int
    {
        $activeAdministratorIds = User::query()
            ->where('role', UserRole::Admin)
            ->whereNull('suspended_at')
            ->pluck('id');

        return $activeAdministratorIds->count() === 1
            ? (int) $activeAdministratorIds->first()
            : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function accountRow(User $user, mixed $actor, ?int $onlyAdministratorId): array
    {
        $openGrants = $user->relationLoaded('registryGrants')
            ? $user->registryGrants->whereNull('revoked_at')
            : $user->registryGrants()->whereNull('revoked_at')->get();

        $scope = $openGrants
            ->map(fn (RegistryGrant $grant): string => $grant->kind->value === 'platform'
                ? 'Platform'
                : (string) $grant->province)
            ->filter()
            ->unique()
            ->values()
            ->implode(', ');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'role_label' => $user->role->label(),
            'suspended' => $user->isSuspended(),
            'two_factor_confirmed' => $user->hasConfirmedTwoFactor(),
            'is_self' => $actor instanceof User && $actor->is($user),
            'is_last_administrator' => $user->id === $onlyAdministratorId,
            'organization' => $user->farmerProfile?->cooperative?->name
                ?: ($scope !== '' ? $scope : null),
            'open_assignments_count' => $user->relationLoaded('farmAssignments')
                ? $user->farmAssignments->filter(fn (FarmVerifierAssignment $assignment): bool => $assignment->revoked_at === null)->count()
                : (int) $user->open_assignments_count,
            'created_at' => $user->created_at?->timezone(config('app.timezone'))->format('M j, Y'),
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function roles(): array
    {
        return array_map(
            fn (UserRole $role): array => [
                'value' => $role->value,
                'label' => $role->label(),
            ],
            UserRole::cases(),
        );
    }
}
