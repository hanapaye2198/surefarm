<?php

namespace App\Http\Controllers;

use App\Actions\RestoreUserAccount;
use App\Actions\SuspendUserAccount;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class UserSuspensionController extends Controller
{
    public function store(Request $request, User $user, SuspendUserAccount $suspend): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $suspend->handle($actor, $user);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Account suspended.',
        ]);

        return to_route('users.index');
    }

    public function destroy(Request $request, User $user, RestoreUserAccount $restore): RedirectResponse
    {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $restore->handle($actor, $user);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Account restored.',
        ]);

        return to_route('users.index');
    }
}
