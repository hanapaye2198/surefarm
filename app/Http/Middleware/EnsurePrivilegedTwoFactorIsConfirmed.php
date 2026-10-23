<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePrivilegedTwoFactorIsConfirmed
{
    /**
     * Routes an administrator or operations user may open before
     * two-factor authentication is confirmed.
     *
     * @var list<string>
     */
    private const ALLOWED_ROUTES = [
        'logout',
        'security.edit',
        'user-password.update',
        'password.confirm',
        'password.confirm.store',
        'password.confirmation',
        'verification.notice',
        'verification.verify',
        'verification.send',
        'two-factor.enable',
        'two-factor.confirm',
        'two-factor.disable',
        'two-factor.qr-code',
        'two-factor.secret-key',
        'two-factor.recovery-codes',
        'two-factor.regenerate-recovery-codes',
    ];

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('auth.require_two_factor')) {
            return $next($request);
        }

        $user = $request->user();

        if (! $user instanceof User || ! $user->requiresConfirmedTwoFactor() || $user->hasConfirmedTwoFactor()) {
            return $next($request);
        }

        if (in_array($request->route()?->getName(), self::ALLOWED_ROUTES, true)) {
            return $next($request);
        }

        return redirect()
            ->route('security.edit')
            ->with('status', 'Confirm two-factor authentication before using SureFarm.');
    }
}
