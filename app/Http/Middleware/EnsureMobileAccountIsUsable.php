<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureMobileAccountIsUsable
{
    /**
     * Keep mobile bearer tokens subject to the same account and MFA rules as
     * authenticated web sessions.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return $next($request);
        }

        if ($user->isSuspended()) {
            return new JsonResponse([
                'message' => 'This account is suspended.',
                'code' => 'account_suspended',
            ], 403);
        }

        if (
            config('auth.require_two_factor')
            && $user->requiresConfirmedTwoFactor()
            && ! $user->hasConfirmedTwoFactor()
        ) {
            return new JsonResponse([
                'message' => 'Confirm two-factor authentication on the SureFarm website before using the mobile app.',
                'code' => 'two_factor_setup_required',
            ], 403);
        }

        return $next($request);
    }
}
