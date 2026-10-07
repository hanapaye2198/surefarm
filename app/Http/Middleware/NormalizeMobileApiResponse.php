<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\ViewErrorBag;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reuses the existing, permission-checked Laravel page actions while
 * returning their data through the versioned native-client JSON contract.
 */
class NormalizeMobileApiResponse
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $request->headers->set('X-Inertia', 'true');

        return app(StartSession::class)->handle($request, function (Request $request) use ($next): Response {
            $response = $next($request);

            if ($response instanceof JsonResponse) {
                $payload = $response->getData(true);

                if (is_array($payload) && isset($payload['component'], $payload['props'])) {
                    $user = $request->user();
                    $props = $payload['props'];

                    if ($user !== null) {
                        $props['auth'] = ['user' => [
                            'id' => $user->id,
                            'name' => $user->name,
                            'email' => $user->email,
                            'role' => $user->role->value,
                        ]];
                    }

                    return response()->json([
                        'component' => $payload['component'],
                        'data' => $props,
                        'flash' => $payload['flash'] ?? [],
                    ], $response->getStatusCode());
                }
            }

            if ($response instanceof RedirectResponse) {
                $target = $response->getTargetUrl();
                $errors = $request->session()->pull('errors', []);

                if ($errors instanceof ViewErrorBag) {
                    $errors = $errors->getBag('default')->messages();
                }

                if (is_array($errors) && $errors !== []) {
                    return response()->json([
                        'message' => 'The requested change could not be saved.',
                        'errors' => $errors,
                    ], 422);
                }

                return response()->json([
                    'success' => true,
                    'redirect_url' => $target,
                ]);
            }

            return $response;
        });
    }
}
