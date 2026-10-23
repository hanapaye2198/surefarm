<?php

namespace App\Http\Controllers;

use App\Models\TraceabilityLot;
use App\Services\TraceabilityJourney;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class TraceabilityPublicController extends Controller
{
    public function show(Request $request, string $token, TraceabilityJourney $journey): Response
    {
        $lot = TraceabilityLot::query()->where('public_token', $token)->first();

        if ($lot === null) {
            return Inertia::render('traceability/public', [
                'record' => null,
            ])->toResponse($request)->setStatusCode(404);
        }

        return Inertia::render('traceability/public', [
            'record' => $journey->publicRecord($lot),
        ])->toResponse($request);
    }
}
