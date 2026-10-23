<?php

namespace App\Http\Controllers;

use App\Actions\EndCooperativeMembership;
use App\Actions\EnrollCooperativeMember;
use App\Actions\ReactivateCooperativeMembership;
use App\Actions\SuspendCooperativeMembership;
use App\Http\Requests\ManageCooperativeMembershipRequest;
use App\Http\Requests\StoreCooperativeMembershipRequest;
use App\Models\Cooperative;
use App\Models\CooperativeMembership;
use App\Models\Farmer;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class CooperativeMembershipController extends Controller
{
    public function store(
        StoreCooperativeMembershipRequest $request,
        Cooperative $cooperative,
        EnrollCooperativeMember $enroll,
    ): RedirectResponse {
        $actor = $this->actor($request->user());
        $farmer = Farmer::query()
            ->where('farmer_id', $request->string('farmer_code')->toString())
            ->visibleTo($actor)
            ->first();

        if (! $farmer instanceof Farmer) {
            return back()->withErrors([
                'farmer_code' => 'No farmer with that ID is available in your registry.',
            ]);
        }

        $enroll->handle($actor, $farmer, $cooperative);

        return $this->back($cooperative, 'Farmer added to the cooperative.');
    }

    public function suspend(
        ManageCooperativeMembershipRequest $request,
        Cooperative $cooperative,
        CooperativeMembership $membership,
        SuspendCooperativeMembership $suspend,
    ): RedirectResponse {
        $this->belongsToCooperative($cooperative, $membership);
        $suspend->handle($this->actor($request->user()), $membership);

        return $this->back($cooperative, 'Membership suspended.');
    }

    public function reactivate(
        ManageCooperativeMembershipRequest $request,
        Cooperative $cooperative,
        CooperativeMembership $membership,
        ReactivateCooperativeMembership $reactivate,
    ): RedirectResponse {
        $this->belongsToCooperative($cooperative, $membership);
        $reactivate->handle($this->actor($request->user()), $membership);

        return $this->back($cooperative, 'Membership reactivated.');
    }

    public function end(
        ManageCooperativeMembershipRequest $request,
        Cooperative $cooperative,
        CooperativeMembership $membership,
        EndCooperativeMembership $end,
    ): RedirectResponse {
        $this->belongsToCooperative($cooperative, $membership);
        $end->handle($this->actor($request->user()), $membership);

        return $this->back($cooperative, 'Membership ended. The history stays on this cooperative.');
    }

    private function actor(mixed $user): User
    {
        if (! $user instanceof User) {
            abort(403);
        }

        return $user;
    }

    private function belongsToCooperative(Cooperative $cooperative, CooperativeMembership $membership): void
    {
        if ($membership->cooperative_id !== $cooperative->id) {
            abort(404);
        }
    }

    private function back(Cooperative $cooperative, string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return to_route('cooperatives.show', $cooperative);
    }
}
