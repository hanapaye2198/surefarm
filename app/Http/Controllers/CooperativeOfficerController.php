<?php

namespace App\Http\Controllers;

use App\Actions\AssignCooperativeOfficer;
use App\Actions\RevokeCooperativeOfficer;
use App\Http\Requests\ManageCooperativeMembershipRequest;
use App\Http\Requests\StoreCooperativeOfficerRequest;
use App\Models\Cooperative;
use App\Models\CooperativeOfficer;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class CooperativeOfficerController extends Controller
{
    public function store(
        StoreCooperativeOfficerRequest $request,
        Cooperative $cooperative,
        AssignCooperativeOfficer $assign,
    ): RedirectResponse {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        $assign->handle($actor, $cooperative, $request->string('email')->toString());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Cooperative officer assigned.']);

        return to_route('cooperatives.show', $cooperative);
    }

    public function destroy(
        ManageCooperativeMembershipRequest $request,
        Cooperative $cooperative,
        CooperativeOfficer $officer,
        RevokeCooperativeOfficer $revoke,
    ): RedirectResponse {
        $actor = $request->user();

        if (! $actor instanceof User) {
            abort(403);
        }

        if ($officer->cooperative_id !== $cooperative->id) {
            abort(404);
        }

        $subject = $officer->user;

        if (! $subject instanceof User) {
            abort(404);
        }

        $revoke->handle($actor, $subject, $officer);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Officer assignment ended.']);

        return to_route('cooperatives.show', $cooperative);
    }
}
