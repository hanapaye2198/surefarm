<?php

use App\ActivityStatus;
use App\ActivityTypeStatus;
use App\CropType;
use App\FarmDevelopmentStage;
use App\FarmVerificationStatus;
use App\Models\ActivityType;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\User;
use App\UserRole;
use Database\Seeders\ActivityTypeSeeder;
use Inertia\Testing\AssertableInertia as Assert;

function activityOperationsUser(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

function activityAdmin(): User
{
    return User::factory()->create([
        'role' => UserRole::Admin,
    ]);
}

/**
 * @return array<string, mixed>
 */
function activityPayload(Farm $farm, ActivityType $type, array $overrides = []): array
{
    return [
        'farm_id' => $farm->id,
        'activity_type_id' => $type->id,
        'crop_type' => $farm->crop_type->value,
        'activity_date' => '2026-10-07',
        'status' => ActivityStatus::Completed->value,
        'description' => 'Applied organic fertilizer to the coffee plots.',
        'performed_by' => 'Juan',
        'quantity' => 50,
        'unit' => 'kg',
        'cost_amount' => 2500,
        'remarks' => 'Rain expected tomorrow.',
        ...$overrides,
    ];
}

test('the activity type seeder is idempotent', function () {
    $this->seed(ActivityTypeSeeder::class);
    $this->seed(ActivityTypeSeeder::class);

    expect(ActivityType::query()->count())->toBe(12);
    expect(ActivityType::query()->where('code', 'fertilizer_application')->count())->toBe(1);

    $planting = ActivityType::query()->where('code', 'planting')->firstOrFail();
    $planting->update([
        'name' => 'Planting revised',
        'status' => ActivityTypeStatus::Inactive,
    ]);

    $this->seed(ActivityTypeSeeder::class);

    $planting->refresh();

    expect(ActivityType::query()->count())->toBe(12);
    expect($planting->name)->toBe('Planting revised');
    expect($planting->status)->toBe(ActivityTypeStatus::Inactive);
});

test('an activity can be recorded for a farm without changing farm area or stage', function () {
    $this->seed(ActivityTypeSeeder::class);
    $farm = Farm::factory()->create([
        'farm_name' => 'North Coffee Farm',
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 2.84,
        'verified_area_hectares' => 2.79,
        'verification_status' => FarmVerificationStatus::Verified,
        'current_stage' => FarmDevelopmentStage::Harvest,
    ]);
    $type = ActivityType::query()->where('code', 'planting')->firstOrFail();

    $this->actingAs(activityOperationsUser())
        ->post(route('farm-activities.store'), activityPayload($farm, $type, [
            'crop_type' => null,
            'status' => null,
        ]))
        ->assertRedirect(route('farms.show', ['farm' => $farm->id, 'tab' => 'activities']));

    $activity = FarmActivity::query()->firstOrFail();
    $farm->refresh();

    expect($activity->status)->toBe(ActivityStatus::Completed);
    expect($activity->crop_type)->toBeNull();
    expect($activity->created_by)->not->toBeNull();
    expect((float) $farm->declared_area_hectares)->toBe(2.84);
    expect((float) $farm->verified_area_hectares)->toBe(2.79);
    expect($farm->verification_status)->toBe(FarmVerificationStatus::Verified);
    expect($farm->current_stage)->toBe(FarmDevelopmentStage::Harvest);
});

test('an activity requires a farm, an active activity type, and a date', function () {
    $this->seed(ActivityTypeSeeder::class);
    $farm = Farm::factory()->create();
    $type = ActivityType::query()->where('code', 'weeding')->firstOrFail();
    $user = activityOperationsUser();

    $this->actingAs($user)
        ->post(route('farm-activities.store'), activityPayload($farm, $type, [
            'farm_id' => null,
        ]))
        ->assertSessionHasErrors('farm_id');

    $this->actingAs($user)
        ->post(route('farm-activities.store'), activityPayload($farm, $type, [
            'activity_type_id' => null,
        ]))
        ->assertSessionHasErrors('activity_type_id');

    $this->actingAs($user)
        ->post(route('farm-activities.store'), activityPayload($farm, $type, [
            'activity_date' => null,
        ]))
        ->assertSessionHasErrors('activity_date');

    expect(FarmActivity::query()->count())->toBe(0);
});

test('an invalid activity status is rejected', function () {
    $this->seed(ActivityTypeSeeder::class);
    $farm = Farm::factory()->create();
    $type = ActivityType::query()->where('code', 'irrigation')->firstOrFail();

    $this->actingAs(activityOperationsUser())
        ->post(route('farm-activities.store'), activityPayload($farm, $type, [
            'status' => 'verified',
        ]))
        ->assertSessionHasErrors('status');
});

test('quantity and cost cannot be negative', function () {
    $this->seed(ActivityTypeSeeder::class);
    $farm = Farm::factory()->create();
    $type = ActivityType::query()->where('code', 'weeding')->firstOrFail();
    $user = activityOperationsUser();

    $this->actingAs($user)
        ->post(route('farm-activities.store'), activityPayload($farm, $type, [
            'quantity' => -1,
        ]))
        ->assertSessionHasErrors('quantity');

    $this->actingAs($user)
        ->post(route('farm-activities.store'), activityPayload($farm, $type, [
            'cost_amount' => -5,
        ]))
        ->assertSessionHasErrors('cost_amount');
});

test('a crop must belong to the selected farm', function () {
    $this->seed(ActivityTypeSeeder::class);
    $farm = Farm::factory()->create([
        'crop_type' => CropType::Coffee,
    ]);
    $type = ActivityType::query()->where('code', 'fertilizer_application')->firstOrFail();
    $user = activityOperationsUser();

    $this->actingAs($user)
        ->post(route('farm-activities.store'), activityPayload($farm, $type, [
            'crop_type' => CropType::Cacao->value,
        ]))
        ->assertSessionHasErrors('crop_type');

    $this->actingAs($user)
        ->post(route('farm-activities.store'), activityPayload($farm, $type))
        ->assertRedirect();

    expect(FarmActivity::query()->firstOrFail()->crop_type)->toBe(CropType::Coffee);
});

test('an activity appears only on its own farm profile', function () {
    $this->seed(ActivityTypeSeeder::class);
    $farmer = Farmer::factory()->create([
        'first_name' => 'Maria',
        'middle_name' => null,
        'last_name' => 'Santos',
    ]);
    $farm = Farm::factory()->for($farmer)->create([
        'farm_name' => 'North Coffee Farm',
        'crop_type' => CropType::Coffee,
    ]);
    $other = Farm::factory()->for($farmer)->create([
        'farm_name' => 'Riverside Farm',
        'crop_type' => CropType::Cacao,
    ]);
    $type = ActivityType::query()->where('code', 'fertilizer_application')->firstOrFail();

    $this->actingAs(activityOperationsUser())
        ->post(route('farm-activities.store'), activityPayload($farm, $type));

    $this->actingAs(activityOperationsUser())
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.activity_summary.total', 1)
            ->where('farm.activity_summary.completed', 1)
            ->where('farm.activities.0.activity_type', 'Fertilizer Application')
            ->where('farm.activities.0.crop_label', 'Coffee')
            ->where('farm.activities.0.activity_date', 'Oct 7, 2026')
            ->where('farm.recent_activity', 'Fertilizer Application'));

    $this->actingAs(activityOperationsUser())
        ->get(route('farms.show', $other))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.activities', [])
            ->where('farm.activity_summary.total', 0)
            ->where('farm.recent_activity', 'No farm activities recorded yet.'));
});

test('the farmer profile and dashboard use recorded activities', function () {
    $this->seed(ActivityTypeSeeder::class);
    $farmer = Farmer::factory()->create([
        'first_name' => 'Maria',
        'last_name' => 'Santos',
    ]);
    $otherFarmer = Farmer::factory()->create();
    $farm = Farm::factory()->for($farmer)->create([
        'farm_name' => 'North Coffee Farm',
    ]);
    $otherFarm = Farm::factory()->for($otherFarmer)->create([
        'farm_name' => 'Upper Kadingilan Farm',
    ]);
    $fertilizer = ActivityType::query()->where('code', 'fertilizer_application')->firstOrFail();
    $inspection = ActivityType::query()->where('code', 'farm_inspection')->firstOrFail();
    $user = activityOperationsUser();

    FarmActivity::factory()->create([
        'farm_id' => $farm->id,
        'activity_type_id' => $fertilizer->id,
        'crop_type' => CropType::Coffee,
        'activity_date' => '2026-10-07',
        'created_by' => $user->id,
    ]);
    FarmActivity::factory()->create([
        'farm_id' => $otherFarm->id,
        'activity_type_id' => $inspection->id,
        'activity_date' => '2026-10-06',
        'created_by' => $user->id,
    ]);

    $this->actingAs($user)
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farmer.activity_count', 1)
            ->has('farmer.recent_activities', 1)
            ->where('farmer.recent_activities.0.farm_name', 'North Coffee Farm')
            ->where('farmer.recent_activities.0.activity', 'Fertilizer Application'));

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('recent_activities', 2)
            ->where('recent_activities.0.activity', 'Fertilizer Application')
            ->where('recent_activities.0.farm_name', 'North Coffee Farm')
            ->where('recent_activities.1.activity', 'Farm Inspection'));

    $this->actingAs($user)
        ->get(route('farm-activities.index', [
            'farm' => $farm->id,
            'status' => ActivityStatus::Completed->value,
            'crop' => CropType::Coffee->value,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farm-activities/index')
            ->has('activities.data', 1)
            ->where('activities.data.0.activity_type', 'Fertilizer Application')
            ->where('filters.farm', (string) $farm->id)
            ->where('filters.status', ActivityStatus::Completed->value)
            ->where('filters.crop', CropType::Coffee->value));

    $this->actingAs($user)
        ->get(route('farm-activities.index', [
            'farmer' => $otherFarmer->id,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('activities.data', 1)
            ->where('activities.data.0.activity_type', 'Farm Inspection')
            ->where('activities.data.0.farm.farm_name', 'Upper Kadingilan Farm'));
});

test('completed activities are not deleted and planned activities can be cancelled', function () {
    $this->seed(ActivityTypeSeeder::class);
    $farm = Farm::factory()->create();
    $type = ActivityType::query()->where('code', 'pest_control')->firstOrFail();
    $user = activityOperationsUser();
    $completed = FarmActivity::factory()->create([
        'farm_id' => $farm->id,
        'activity_type_id' => $type->id,
        'status' => ActivityStatus::Completed,
        'activity_date' => '2026-10-01',
        'created_by' => $user->id,
    ]);
    $planned = FarmActivity::factory()->create([
        'farm_id' => $farm->id,
        'activity_type_id' => $type->id,
        'status' => ActivityStatus::Planned,
        'activity_date' => '2026-10-08',
        'created_by' => $user->id,
    ]);

    $this->actingAs($user)
        ->delete(route('farm-activities.show', $completed))
        ->assertMethodNotAllowed();

    expect(FarmActivity::query()->whereKey($completed->id)->exists())->toBeTrue();
    expect($completed->refresh()->status)->toBe(ActivityStatus::Completed);

    $this->actingAs($user)
        ->put(route('farm-activities.update', $planned), activityPayload($farm, $type, [
            'farm_id' => Farm::factory()->create()->id,
            'status' => ActivityStatus::Cancelled->value,
            'activity_date' => '2026-10-08',
        ]))
        ->assertRedirect(route('farm-activities.show', $planned));

    $planned->refresh();

    expect($planned->status)->toBe(ActivityStatus::Cancelled);
    expect($planned->farm_id)->toBe($farm->id);
});

test('activity management follows existing roles', function () {
    $this->seed(ActivityTypeSeeder::class);
    $farm = Farm::factory()->create();
    $type = ActivityType::query()->where('code', 'harvest')->firstOrFail();
    $payload = activityPayload($farm, $type);

    $this->actingAs(User::factory()->create(['role' => UserRole::Farmer]))
        ->get(route('farm-activities.index'))
        ->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => UserRole::Farmer]))
        ->post(route('farm-activities.store'), $payload)
        ->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => UserRole::FieldVerifier]))
        ->get(route('farm-activities.index'))
        ->assertOk();

    $this->actingAs(User::factory()->create(['role' => UserRole::FieldVerifier]))
        ->post(route('farm-activities.store'), $payload)
        ->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => UserRole::FieldVerifier]))
        ->get(route('activity-types.index'))
        ->assertForbidden();

    $this->actingAs(activityOperationsUser())
        ->get(route('activity-types.index'))
        ->assertForbidden();

    $this->actingAs(activityOperationsUser())
        ->post(route('farm-activities.store'), $payload)
        ->assertRedirect();

    $this->actingAs(activityAdmin())
        ->get(route('activity-types.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('activity-types/index')
            ->has('activityTypes', 12));

    $this->actingAs(activityAdmin())
        ->post(route('activity-types.store'), [
            'name' => 'Soil Sampling',
            'code' => 'soil_sampling',
            'category' => 'inspection',
            'status' => 'active',
        ])
        ->assertRedirect(route('activity-types.index'));

    $created = ActivityType::query()->where('code', 'soil_sampling')->firstOrFail();

    $this->actingAs(activityAdmin())
        ->put(route('activity-types.update', $created), [
            'name' => 'Soil Sampling',
            'code' => 'soil_sampling',
            'category' => 'inspection',
            'status' => 'inactive',
        ])
        ->assertRedirect(route('activity-types.index'));

    expect($created->refresh()->status)->toBe(ActivityTypeStatus::Inactive);

    $this->actingAs(activityOperationsUser())
        ->post(route('farm-activities.store'), activityPayload($farm, $created))
        ->assertSessionHasErrors('activity_type_id');
});

test('guests cannot open farm activities', function () {
    $this->get(route('farm-activities.index'))
        ->assertRedirect(route('login'));
});
