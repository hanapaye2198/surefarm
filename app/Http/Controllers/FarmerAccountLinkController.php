<?php

namespace App\Http\Controllers;

use App\Actions\LinkFarmerAccount;
use App\Actions\UnlinkFarmerAccount;
use App\Http\Requests\LinkFarmerAccountRequest;
use App\Models\User;
use App\UserRole;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class FarmerAccountLinkController extends Controller
{
    public function store(LinkFarmerAccountRequest $request, User $user, LinkFarmerAccount $link): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $link->handle($actor, $user, (string) $request->validated('farmer_code'));

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farmer record linked.',
        ]);

        return to_route('users.show', $user);
    }

    public function destroy(User $user, UnlinkFarmerAccount $unlink): RedirectResponse
    {
        $actor = request()->user();

        if (! $actor instanceof User || $actor->role !== UserRole::Admin || $actor->isSuspended()) {
            abort(403);
        }

        $unlink->handle($actor, $user);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farmer record unlinked.',
        ]);

        return to_route('users.show', $user);
    }
}
