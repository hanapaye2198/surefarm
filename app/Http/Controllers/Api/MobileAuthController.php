<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;

class MobileAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string'],
            'device_name' => ['required', 'string', 'max:100'],
        ]);

        $user = User::query()->where('email', $credentials['email'])->first();

        if ($user === null || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->isSuspended()) {
            return $this->accessDenied('This account is suspended.', 'account_suspended');
        }

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Verify your email address before signing in.',
                'verification_required' => true,
            ], 403);
        }

        if (
            config('auth.require_two_factor')
            && $user->requiresConfirmedTwoFactor()
            && ! $user->hasConfirmedTwoFactor()
        ) {
            return $this->accessDenied(
                'Confirm two-factor authentication on the SureFarm website before using the mobile app.',
                'two_factor_setup_required',
            );
        }

        if ($user->hasEnabledTwoFactorAuthentication()) {
            $challengeToken = Str::random(64);
            Cache::put('surefarm:mobile-login:'.$challengeToken, [
                'user_id' => $user->id,
                'device_name' => $credentials['device_name'],
            ], now()->addMinutes(5));

            return response()->json([
                'two_factor_required' => true,
                'challenge_token' => $challengeToken,
            ], 202);
        }

        return $this->issueToken($user, $credentials['device_name']);
    }

    public function completeTwoFactor(Request $request, TwoFactorAuthenticationProvider $provider): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string', 'size:64'],
            'code' => ['nullable', 'string', 'max:20'],
            'recovery_code' => ['nullable', 'string', 'max:64'],
        ]);

        if (blank($data['code'] ?? null) && blank($data['recovery_code'] ?? null)) {
            throw ValidationException::withMessages([
                'code' => ['Enter your authentication code or a recovery code.'],
            ]);
        }

        $cacheKey = 'surefarm:mobile-login:'.$data['challenge_token'];
        $challenge = Cache::get($cacheKey);
        $user = is_array($challenge) ? User::query()->find($challenge['user_id'] ?? null) : null;

        if (! $user instanceof User || ! $user->hasEnabledTwoFactorAuthentication()) {
            throw ValidationException::withMessages([
                'challenge_token' => ['This sign-in challenge has expired. Sign in again.'],
            ]);
        }

        if ($user->isSuspended()) {
            Cache::forget($cacheKey);

            return $this->accessDenied('This account is suspended.', 'account_suspended');
        }

        if (
            config('auth.require_two_factor')
            && $user->requiresConfirmedTwoFactor()
            && ! $user->hasConfirmedTwoFactor()
        ) {
            Cache::forget($cacheKey);

            return $this->accessDenied(
                'Confirm two-factor authentication on the SureFarm website before using the mobile app.',
                'two_factor_setup_required',
            );
        }

        $valid = false;

        if (filled($data['code'] ?? null)) {
            $secret = Fortify::currentEncrypter()->decrypt($user->two_factor_secret);
            $valid = $provider->verify($secret, $data['code']);
        } else {
            $recoveryCode = $data['recovery_code'];
            $valid = collect($user->recoveryCodes())->contains(
                fn (string $code): bool => hash_equals($code, $recoveryCode),
            );

            if ($valid) {
                $user->replaceRecoveryCode($recoveryCode);
            }
        }

        if (! $valid) {
            throw ValidationException::withMessages([
                'code' => ['The authentication code is invalid.'],
            ]);
        }

        Cache::forget($cacheKey);

        return $this->issueToken($user, (string) $challenge['device_name']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->presentUser($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['success' => true]);
    }

    private function issueToken(User $user, string $deviceName): JsonResponse
    {
        if ($user->isSuspended()) {
            return $this->accessDenied('This account is suspended.', 'account_suspended');
        }

        if (
            config('auth.require_two_factor')
            && $user->requiresConfirmedTwoFactor()
            && ! $user->hasConfirmedTwoFactor()
        ) {
            return $this->accessDenied(
                'Confirm two-factor authentication on the SureFarm website before using the mobile app.',
                'two_factor_setup_required',
            );
        }

        $token = $user->createToken($deviceName, ['mobile'])->plainTextToken;

        return response()->json([
            'token_type' => 'Bearer',
            'access_token' => $token,
            'user' => $this->presentUser($user),
        ]);
    }

    private function accessDenied(string $message, string $code): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'code' => $code,
        ], 403);
    }

    /** @return array{id: int, name: string, email: string, role: string, farmer_profile_linked: bool} */
    private function presentUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'farmer_profile_linked' => $user->role->value === 'farmer' && $user->farmer()->exists(),
        ];
    }
}
