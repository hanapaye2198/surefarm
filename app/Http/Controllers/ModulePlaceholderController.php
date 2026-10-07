<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class ModulePlaceholderController extends Controller
{
    /**
     * Unfinished modules. These pages must not present sample records.
     *
     * @var array<string, array{title: string, description: string, icon: string}>
     */
    private const MODULES = [
        'crop-management' => [
            'title' => 'Crop Management',
            'description' => 'Crop management tools will be available in a future SureFarm release.',
            'icon' => 'sprout',
        ],
        'finance' => [
            'title' => 'Finance',
            'description' => 'Finance tools will be available in a future SureFarm release.',
            'icon' => 'landmark',
        ],
        'insurance' => [
            'title' => 'Insurance',
            'description' => 'Insurance tools will be available in a future SureFarm release.',
            'icon' => 'shield',
        ],
        'logistics-export' => [
            'title' => 'Logistics & Export',
            'description' => 'Logistics and export tools will be available in a future SureFarm release.',
            'icon' => 'truck',
        ],
        'cooperatives' => [
            'title' => 'Cooperatives',
            'description' => 'Cooperative management will be available in a future SureFarm release.',
            'icon' => 'handshake',
        ],
        'reports' => [
            'title' => 'Reports',
            'description' => 'Reports will be available in a future SureFarm release.',
            'icon' => 'chart',
        ],
    ];

    public function show(string $module): Response
    {
        $page = self::MODULES[$module] ?? null;

        if ($page === null) {
            abort(404);
        }

        return Inertia::render('modules/placeholder', [
            'module' => $module,
            ...$page,
        ]);
    }
}
