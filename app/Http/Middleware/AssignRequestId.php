<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AssignRequestId
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $incoming = $request->headers->get('X-Request-Id');
        $requestId = is_string($incoming) && preg_match('/^[A-Za-z0-9_-]{8,64}$/', $incoming) === 1
            ? $incoming
            : (string) Str::uuid();

        $request->attributes->set('request_id', $requestId);
        Context::add('request_id', $requestId);
        Context::add('environment', app()->environment());

        $response = $next($request);
        $response->headers->set('X-Request-Id', $requestId);

        return $response;
    }
}
