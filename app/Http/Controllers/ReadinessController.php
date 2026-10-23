<?php

namespace App\Http\Controllers;

use App\Services\ReadinessProbe;
use Illuminate\Http\JsonResponse;

class ReadinessController extends Controller
{
    public function __invoke(ReadinessProbe $probe): JsonResponse
    {
        $report = $probe->report();

        return response()->json($report, $report['status'] === 'ok' ? 200 : 503)
            ->header('Cache-Control', 'no-store');
    }
}
