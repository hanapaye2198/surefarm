<?php

use Inertia\Testing\AssertableInertia as Assert;

test('shows the public SureFarm landing page', function () {
    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('welcome'));
});
