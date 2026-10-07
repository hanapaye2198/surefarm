<?php

namespace App\Http\Controllers;

use App\Models\TraceabilityLot;
use App\Services\TraceabilityJourney;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class TraceabilityPublicController extends Controller
{
    public function show(Request $request, string $lot_code, TraceabilityJourney $journey): Response
    {
        $lot = TraceabilityLot::query()->where('lot_code', $lot_code)->first();

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
