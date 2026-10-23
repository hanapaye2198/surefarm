<?php

namespace App\Http\Controllers;

use App\Actions\GrantRegistryAccess;
use App\Actions\RevokeRegistryGrant;
use App\Http\Requests\StoreRegistryGrantRequest;
use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class RegistryGrantController extends Controller
{
    public function store(StoreRegistryGrantRequest $request, User $user, GrantRegistryAccess $grant): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $kind = $request->validated('kind');
        $kind = $kind instanceof RegistryGrantKind ? $kind : RegistryGrantKind::from((string) $kind);

        $province = $request->validated('province');

        $grant->handle(
            $actor,
            $user,
            $kind,
            is_string($province) ? $province : null,
        );

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Access updated.',
        ]);

        return to_route('users.show', $user);
    }

    public function destroy(User $user, RegistryGrant $grant, RevokeRegistryGrant $revoke): RedirectResponse
    {
        $actor = request()->user();

        if (! $actor instanceof User || $actor->role !== UserRole::Admin || $actor->isSuspended()) {
            abort(403);
        }

        $revoke->handle($actor, $user, $grant);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Access revoked.',
        ]);

        return to_route('users.show', $user);
    }
}
