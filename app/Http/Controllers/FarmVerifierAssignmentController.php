<?php

namespace App\Http\Controllers;

use App\Actions\AssignFarmVerifier;
use App\Actions\RevokeFarmVerifierAssignment;
use App\Http\Requests\StoreFarmVerifierAssignmentRequest;
use App\Models\FarmVerifierAssignment;
use App\Models\User;
use App\UserRole;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class FarmVerifierAssignmentController extends Controller
{
    public function store(
        StoreFarmVerifierAssignmentRequest $request,
        User $user,
        AssignFarmVerifier $assign,
    ): RedirectResponse {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $assign->handle($actor, $user, (string) $request->validated('farm_code'));

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farm assigned.',
        ]);

        return to_route('users.show', $user);
    }

    public function destroy(
        User $user,
        FarmVerifierAssignment $assignment,
        RevokeFarmVerifierAssignment $revoke,
    ): RedirectResponse {
        $actor = request()->user();

        if (! $actor instanceof User || $actor->role !== UserRole::Admin || $actor->isSuspended()) {
            abort(403);
        }

        $revoke->handle($actor, $user, $assignment);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Assignment revoked.',
        ]);

        return to_route('users.show', $user);
    }
}
