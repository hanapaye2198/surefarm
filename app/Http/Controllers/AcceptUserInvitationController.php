<?php

namespace App\Http\Controllers;

use App\Actions\AcceptUserInvitation;
use App\Http\Requests\AcceptUserInvitationRequest;
use App\Models\UserInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class AcceptUserInvitationController extends Controller
{
    public function show(string $token): Response
    {
        $invitation = $this->openInvitation($token);

        return Inertia::render('auth/accept-invitation', [
            'token' => $token,
            'name' => $invitation->name,
            'email' => $invitation->email,
            'roleLabel' => $invitation->role->label(),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(AcceptUserInvitationRequest $request, string $token, AcceptUserInvitation $accept): RedirectResponse
    {
        $user = $accept->handle($token, [
            'password' => (string) $request->validated('password'),
        ]);

        Auth::login($user);
        $request->session()->regenerate();
        $request->session()->put('auth.password_confirmed_at', time());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Your account is ready.',
        ]);

        if (config('auth.two_factor_enabled') && $user->requiresConfirmedTwoFactor()) {
            return to_route('security.edit');
        }

        return to_route('dashboard');
    }

    private function openInvitation(string $token): UserInvitation
    {
        $invitation = UserInvitation::query()
            ->where('token_hash', UserInvitation::hashToken($token))
            ->first();

        if ($invitation === null || ! $invitation->isOpen()) {
            abort(404);
        }

        return $invitation;
    }
}
