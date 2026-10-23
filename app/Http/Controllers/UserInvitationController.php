<?php

namespace App\Http\Controllers;

use App\Actions\InviteUser;
use App\Actions\RevokeUserInvitation;
use App\Http\Requests\StoreUserInvitationRequest;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class UserInvitationController extends Controller
{
    public function store(StoreUserInvitationRequest $request, InviteUser $invite): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        /** @var array{name: string, email: string, role: string} $invitation */
        $invitation = $request->safe()->only(['name', 'email', 'role']);

        $invite->handle($invitation, $actor);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Invitation sent.',
        ]);

        return to_route('users.index');
    }

    public function destroy(Request $request, UserInvitation $invitation, RevokeUserInvitation $revoke): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $revoke->handle($actor, $invitation);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Invitation revoked.',
        ]);

        return to_route('users.index');
    }
}
