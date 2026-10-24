<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot open an unfinished module', function () {
    $this->get(route('modules.show', 'crop-management'))
        ->assertRedirect(route('login'));
});

test('unfinished modules show their real status', function (string $module, string $title, string $description, string $status) {
    $this->actingAs(User::factory()->create())
        ->get(route('modules.show', $module))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('modules/placeholder')
            ->where('title', $title)
            ->where('module', $module)
            ->where('description', $description)
            ->where('status', $status)
            ->missing('summary'));
})->with([
    'crop management' => ['crop-management', 'Crop Management', 'A separate crop-management workspace is not available. Day-to-day crop work is recorded under Farm Activities, Production, and Harvest.', 'planned'],
    'logistics' => ['logistics-export', 'Logistics & Export', 'Logistics and export tools are not available yet.', 'planned'],
    'reports' => ['reports', 'Reports', 'Dashboard summaries are available. A separate reports workspace is not available yet.', 'planned'],
]);

test('web finance and insurance placeholders are not live modules', function () {
    $this->actingAs(User::factory()->create())
        ->get('/modules/finance')
        ->assertNotFound();

    $this->actingAs(User::factory()->create())
        ->get('/modules/insurance')
        ->assertNotFound();
});

test('unknown modules are not found', function () {
    $this->actingAs(User::factory()->create())
        ->get('/modules/traceability')
        ->assertNotFound();
});
