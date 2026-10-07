<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FarmActivityController;
use App\Http\Controllers\FarmBoundaryController;
use App\Http\Controllers\FarmController;
use App\Http\Controllers\FarmerController;
use App\Http\Controllers\FarmFinancingController;
use App\Http\Controllers\FarmHarvestController;
use App\Http\Controllers\FarmInsuranceController;
use App\Http\Controllers\FarmProductionController;
use App\Http\Controllers\FarmVerificationController;
use App\Http\Controllers\HarvestInventoryController;
use App\Http\Controllers\InventoryAdjustmentController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\InventoryDamageController;
use App\Http\Controllers\InventoryProcessingController;
use App\Http\Controllers\ModulePlaceholderController;
use App\Http\Controllers\Settings\ActivityTypeController;
use App\Http\Controllers\TraceabilityController;
use App\Http\Controllers\TraceabilityPublicController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::get('trace/{lot_code}', [TraceabilityPublicController::class, 'show'])
    ->where('lot_code', '[A-Za-z0-9\-]+')
    ->name('trace.public');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('modules/{module}', [ModulePlaceholderController::class, 'show'])
        ->where('module', 'crop-management|finance|insurance|logistics-export|cooperatives|reports')
        ->name('modules.show');

    Route::middleware('role:operations')->group(function () {
        Route::get('farmers/create', [FarmerController::class, 'create'])->name('farmers.create');
        Route::post('farmers', [FarmerController::class, 'store'])->name('farmers.store');
        Route::get('farmers/{farmer}/edit', [FarmerController::class, 'edit'])->name('farmers.edit');
        Route::put('farmers/{farmer}', [FarmerController::class, 'update'])->name('farmers.update');
        Route::get('farmers/{farmer}/farms/create', [FarmController::class, 'create'])->name('farmers.farms.create');
        Route::post('farmers/{farmer}/farms', [FarmController::class, 'store'])->name('farmers.farms.store');
        Route::get('farms/{farm}/edit', [FarmController::class, 'edit'])->name('farms.edit');
        Route::put('farms/{farm}', [FarmController::class, 'update'])->name('farms.update');
        Route::post('farms/{farm}/boundary', [FarmBoundaryController::class, 'store'])->name('farms.boundary.store');
        Route::put('farms/{farm}/boundary', [FarmBoundaryController::class, 'update'])->name('farms.boundary.update');
        Route::get('farm-activities/create', [FarmActivityController::class, 'create'])->name('farm-activities.create');
        Route::post('farm-activities', [FarmActivityController::class, 'store'])->name('farm-activities.store');
        Route::get('farm-activities/{activity}/edit', [FarmActivityController::class, 'edit'])->name('farm-activities.edit');
        Route::put('farm-activities/{activity}', [FarmActivityController::class, 'update'])->name('farm-activities.update');
        Route::get('production/create', [FarmProductionController::class, 'create'])->name('production.create');
        Route::post('production', [FarmProductionController::class, 'store'])->name('production.store');
        Route::get('production/{production}/edit', [FarmProductionController::class, 'edit'])->name('production.edit');
        Route::put('production/{production}', [FarmProductionController::class, 'update'])->name('production.update');
        Route::get('harvest/create', [FarmHarvestController::class, 'create'])->name('harvest.create');
        Route::post('harvest', [FarmHarvestController::class, 'store'])->name('harvest.store');
        Route::get('harvest/{harvest}/edit', [FarmHarvestController::class, 'edit'])->name('harvest.edit');
        Route::put('harvest/{harvest}', [FarmHarvestController::class, 'update'])->name('harvest.update');
        Route::get('harvest/{harvest}/receive', [HarvestInventoryController::class, 'create'])->name('harvest.receive.create');
        Route::post('harvest/{harvest}/receive', [HarvestInventoryController::class, 'store'])->name('harvest.receive.store');
        Route::get('inventory/process/create', [InventoryProcessingController::class, 'create'])->name('inventory.process.create');
        Route::post('inventory/process', [InventoryProcessingController::class, 'store'])->name('inventory.process.store');
        Route::get('inventory/{inventory}/adjust', [InventoryAdjustmentController::class, 'create'])->name('inventory.adjust.create');
        Route::post('inventory/{inventory}/adjust', [InventoryAdjustmentController::class, 'store'])->name('inventory.adjust.store');
        Route::get('inventory/{inventory}/damage', [InventoryDamageController::class, 'create'])->name('inventory.damage.create');
        Route::post('inventory/{inventory}/damage', [InventoryDamageController::class, 'store'])->name('inventory.damage.store');
        Route::get('traceability/create', [TraceabilityController::class, 'create'])->name('traceability.create');
        Route::post('traceability', [TraceabilityController::class, 'store'])->name('traceability.store');
        Route::get('farms/{farm}/insurance/create', [FarmInsuranceController::class, 'create'])->name('farms.insurance.create');
        Route::post('farms/{farm}/insurance', [FarmInsuranceController::class, 'store'])->name('farms.insurance.store');
        Route::get('farms/{farm}/insurance/{insurance}/edit', [FarmInsuranceController::class, 'edit'])->name('farms.insurance.edit');
        Route::put('farms/{farm}/insurance/{insurance}', [FarmInsuranceController::class, 'update'])->name('farms.insurance.update');
        Route::get('farms/{farm}/financing/create', [FarmFinancingController::class, 'create'])->name('farms.financing.create');
        Route::post('farms/{farm}/financing', [FarmFinancingController::class, 'store'])->name('farms.financing.store');
        Route::get('farms/{farm}/financing/{financing}/edit', [FarmFinancingController::class, 'edit'])->name('farms.financing.edit');
        Route::put('farms/{farm}/financing/{financing}', [FarmFinancingController::class, 'update'])->name('farms.financing.update');
    });

    Route::middleware('role:admin')->group(function () {
        Route::delete('farms/{farm}/boundary', [FarmBoundaryController::class, 'destroy'])->name('farms.boundary.destroy');
        Route::get('settings/activity-types', [ActivityTypeController::class, 'index'])->name('activity-types.index');
        Route::post('settings/activity-types', [ActivityTypeController::class, 'store'])->name('activity-types.store');
        Route::get('settings/activity-types/{activityType}/edit', [ActivityTypeController::class, 'edit'])->name('activity-types.edit');
        Route::put('settings/activity-types/{activityType}', [ActivityTypeController::class, 'update'])->name('activity-types.update');
    });

    Route::middleware('role:operations,field_verifier')->group(function () {
        Route::get('farmers', [FarmerController::class, 'index'])->name('farmers.index');
        Route::get('farmers/{farmer}/photo', [FarmerController::class, 'photo'])->name('farmers.photo');
        Route::get('farmers/{farmer}', [FarmerController::class, 'show'])->name('farmers.show');
        Route::get('farms', [FarmController::class, 'index'])->name('farms.index');
        Route::get('farms/{farm}/drone-image', [FarmController::class, 'droneImage'])->name('farms.drone-image');
        Route::get('farms/{farm}', [FarmController::class, 'show'])->name('farms.show');
        Route::get('farm-activities', [FarmActivityController::class, 'index'])->name('farm-activities.index');
        Route::get('farm-activities/{activity}', [FarmActivityController::class, 'show'])->name('farm-activities.show');
        Route::get('production', [FarmProductionController::class, 'index'])->name('production.index');
        Route::get('production/{production}', [FarmProductionController::class, 'show'])->name('production.show');
        Route::get('harvest', [FarmHarvestController::class, 'index'])->name('harvest.index');
        Route::get('harvest/{harvest}', [FarmHarvestController::class, 'show'])->name('harvest.show');
        Route::get('inventory/processing', [InventoryProcessingController::class, 'index'])->name('inventory.processing');
        Route::get('inventory', [InventoryController::class, 'index'])->name('inventory.index');
        Route::get('inventory/{inventory}', [InventoryController::class, 'show'])->name('inventory.show');
        Route::get('traceability', [TraceabilityController::class, 'index'])->name('traceability.index');
        Route::get('traceability/{lot}/print', [TraceabilityController::class, 'print'])->name('traceability.print');
        Route::get('traceability/{lot}', [TraceabilityController::class, 'show'])->name('traceability.show');
    });

    Route::middleware('role:field_verifier')->group(function () {
        Route::get('farm-verification', [FarmVerificationController::class, 'index'])->name('farm-verification.index');
        Route::get('farm-verification/{farm}', [FarmVerificationController::class, 'show'])->name('farm-verification.show');
        Route::post('farm-verification/{farm}', [FarmVerificationController::class, 'store'])->name('farm-verification.store');
        Route::put('farm-verification/{farm}', [FarmVerificationController::class, 'update'])->name('farm-verification.update');
    });
});

require __DIR__.'/settings.php';
