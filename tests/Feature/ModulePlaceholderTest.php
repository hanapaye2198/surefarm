<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot open an unfinished module', function () {
    $this->get(route('modules.show', 'crop-management'))
        ->assertRedirect(route('login'));
});

test('unfinished modules show an empty future release page', function (string $module, string $title, string $description) {
    $this->actingAs(User::factory()->create())
        ->get(route('modules.show', $module))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('modules/placeholder')
            ->where('title', $title)
            ->where('module', $module)
            ->where('description', $description)
            ->missing('summary'));
})->with([
    'crop management' => ['crop-management', 'Crop Management', 'Crop management tools will be available in a future SureFarm release.'],
    'finance' => ['finance', 'Finance', 'Finance tools will be available in a future SureFarm release.'],
    'insurance' => ['insurance', 'Insurance', 'Insurance tools will be available in a future SureFarm release.'],
    'logistics' => ['logistics-export', 'Logistics & Export', 'Logistics and export tools will be available in a future SureFarm release.'],
    'cooperatives' => ['cooperatives', 'Cooperatives', 'Cooperative management will be available in a future SureFarm release.'],
    'reports' => ['reports', 'Reports', 'Reports will be available in a future SureFarm release.'],
]);

test('unknown modules are not found', function () {
    $this->actingAs(User::factory()->create())
        ->get('/modules/traceability')
        ->assertNotFound();
});
