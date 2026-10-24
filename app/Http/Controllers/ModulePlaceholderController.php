<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\UserRole;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ModulePlaceholderController extends Controller
{
    /**
     * Modules that do not have their own workflow yet.
     * Finance and insurance stay here for the mobile API. The web sidebar
     * opens the farm records instead.
     *
     * @var array<string, array{title: string, description: string, status: string, icon: string}>
     */
    private const MODULES = [
        'crop-management' => [
            'title' => 'Crop Management',
            'description' => 'A separate crop-management workspace is not available. Day-to-day crop work is recorded under Farm Activities, Production, and Harvest.',
            'status' => 'planned',
            'icon' => 'sprout',
        ],
        'finance' => [
            'title' => 'Finance',
            'description' => 'Financing is recorded on each farm. Open a farm record to view or update it.',
            'status' => 'partial',
            'icon' => 'landmark',
        ],
        'insurance' => [
            'title' => 'Insurance',
            'description' => 'Crop insurance is recorded on each farm. Open a farm record to view or update it.',
            'status' => 'partial',
            'icon' => 'shield',
        ],
        'logistics-export' => [
            'title' => 'Logistics & Export',
            'description' => 'Logistics and export tools are not available yet.',
            'status' => 'planned',
            'icon' => 'truck',
        ],
        'reports' => [
            'title' => 'Reports',
            'description' => 'Dashboard summaries are available. A separate reports workspace is not available yet.',
            'status' => 'planned',
            'icon' => 'chart',
        ],
    ];

    public function show(Request $request, string $module): Response
    {
        $page = self::MODULES[$module] ?? null;

        if ($page === null) {
            abort(404);
        }

        return Inertia::render('modules/placeholder', [
            'module' => $module,
            ...$page,
            'links' => $this->links($request, $module),
        ]);
    }

    /**
     * @return list<array{label: string, href: string}>
     */
    private function links(Request $request, string $module): array
    {
        $user = $request->user();
        $canOperate = $user instanceof User && $user->canAccess(UserRole::Operations, UserRole::FieldVerifier);

        return match ($module) {
            'crop-management' => $canOperate ? [
                ['label' => 'Farm activities', 'href' => route('farm-activities.index')],
                ['label' => 'Production', 'href' => route('production.index')],
                ['label' => 'Harvest', 'href' => route('harvest.index')],
            ] : [],
            'cooperatives' => $canOperate ? [
                ['label' => 'Open farmers', 'href' => route('farmers.index')],
            ] : [],
            'reports' => [
                ['label' => 'Open dashboard', 'href' => route('dashboard')],
            ],
            'finance' => $canOperate ? [
                ['label' => 'Open finance records', 'href' => route('finance.index')],
            ] : [],
            'insurance' => $canOperate ? [
                ['label' => 'Open insurance records', 'href' => route('insurance.index')],
            ] : [],
            default => [],
        };
    }
}
