<?php

use App\Http\Controllers\Api\MobileAuthController;
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
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\TraceabilityController;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile')->name('api.mobile.')->group(function (): void {
    Route::post('login', [MobileAuthController::class, 'login'])->middleware('throttle:6,1');
    Route::post('two-factor', [MobileAuthController::class, 'completeTwoFactor'])->middleware('throttle:6,1');

    Route::middleware(['auth:sanctum', 'verified', 'abilities:mobile'])->group(function (): void {
        Route::get('me', [MobileAuthController::class, 'me']);
        Route::delete('logout', [MobileAuthController::class, 'logout']);

        Route::middleware('App\\Http\\Middleware\\NormalizeMobileApiResponse')->group(function (): void {
            Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
            Route::get('modules/{module}', [ModulePlaceholderController::class, 'show'])
                ->where('module', 'crop-management|finance|insurance|logistics-export|cooperatives|reports');

            Route::middleware('role:operations')->group(function (): void {
                Route::get('farmers/create', [FarmerController::class, 'create']);
                Route::post('farmers', [FarmerController::class, 'store']);
                Route::get('farmers/{farmer}/edit', [FarmerController::class, 'edit']);
                Route::put('farmers/{farmer}', [FarmerController::class, 'update']);

                Route::get('farmers/{farmer}/farms/create', [FarmController::class, 'create']);
                Route::post('farmers/{farmer}/farms', [FarmController::class, 'store']);
                Route::get('farms/{farm}/edit', [FarmController::class, 'edit']);
                Route::put('farms/{farm}', [FarmController::class, 'update']);
                Route::post('farms/{farm}/boundary', [FarmBoundaryController::class, 'store']);
                Route::put('farms/{farm}/boundary', [FarmBoundaryController::class, 'update']);

                Route::get('farm-activities/create', [FarmActivityController::class, 'create']);
                Route::post('farm-activities', [FarmActivityController::class, 'store']);
                Route::get('farm-activities/{activity}/edit', [FarmActivityController::class, 'edit']);
                Route::put('farm-activities/{activity}', [FarmActivityController::class, 'update']);

                Route::get('production/create', [FarmProductionController::class, 'create']);
                Route::post('production', [FarmProductionController::class, 'store']);
                Route::get('production/{production}/edit', [FarmProductionController::class, 'edit']);
                Route::put('production/{production}', [FarmProductionController::class, 'update']);

                Route::get('harvest/create', [FarmHarvestController::class, 'create']);
                Route::post('harvest', [FarmHarvestController::class, 'store']);
                Route::get('harvest/{harvest}/edit', [FarmHarvestController::class, 'edit']);
                Route::put('harvest/{harvest}', [FarmHarvestController::class, 'update']);
                Route::get('harvest/{harvest}/receive', [HarvestInventoryController::class, 'create']);
                Route::post('harvest/{harvest}/receive', [HarvestInventoryController::class, 'store']);

                Route::get('inventory/process/create', [InventoryProcessingController::class, 'create']);
                Route::post('inventory/process', [InventoryProcessingController::class, 'store']);
                Route::get('inventory/{inventory}/adjust', [InventoryAdjustmentController::class, 'create']);
                Route::post('inventory/{inventory}/adjust', [InventoryAdjustmentController::class, 'store']);
                Route::get('inventory/{inventory}/damage', [InventoryDamageController::class, 'create']);
                Route::post('inventory/{inventory}/damage', [InventoryDamageController::class, 'store']);

                Route::get('traceability/create', [TraceabilityController::class, 'create']);
                Route::post('traceability', [TraceabilityController::class, 'store']);

                Route::get('farms/{farm}/insurance/create', [FarmInsuranceController::class, 'create']);
                Route::post('farms/{farm}/insurance', [FarmInsuranceController::class, 'store']);
                Route::get('farms/{farm}/insurance/{insurance}/edit', [FarmInsuranceController::class, 'edit']);
                Route::put('farms/{farm}/insurance/{insurance}', [FarmInsuranceController::class, 'update']);
                Route::get('farms/{farm}/financing/create', [FarmFinancingController::class, 'create']);
                Route::post('farms/{farm}/financing', [FarmFinancingController::class, 'store']);
                Route::get('farms/{farm}/financing/{financing}/edit', [FarmFinancingController::class, 'edit']);
                Route::put('farms/{farm}/financing/{financing}', [FarmFinancingController::class, 'update']);
            });

            Route::middleware('role:admin')->group(function (): void {
                Route::delete('farms/{farm}/boundary', [FarmBoundaryController::class, 'destroy']);
                Route::get('settings/activity-types', [ActivityTypeController::class, 'index']);
                Route::post('settings/activity-types', [ActivityTypeController::class, 'store']);
                Route::get('settings/activity-types/{activityType}/edit', [ActivityTypeController::class, 'edit']);
                Route::put('settings/activity-types/{activityType}', [ActivityTypeController::class, 'update']);
            });

            Route::middleware('role:operations,field_verifier')->group(function (): void {
                Route::get('farmers', [FarmerController::class, 'index']);
                Route::get('farmers/{farmer}/photo', [FarmerController::class, 'photo']);
                Route::get('farmers/{farmer}', [FarmerController::class, 'show']);
                Route::get('farms', [FarmController::class, 'index']);
                Route::get('farms/{farm}/drone-image', [FarmController::class, 'droneImage']);
                Route::get('farms/{farm}', [FarmController::class, 'show']);
                Route::get('farm-activities', [FarmActivityController::class, 'index']);
                Route::get('farm-activities/{activity}', [FarmActivityController::class, 'show']);
                Route::get('production', [FarmProductionController::class, 'index']);
                Route::get('production/{production}', [FarmProductionController::class, 'show']);
                Route::get('harvest', [FarmHarvestController::class, 'index']);
                Route::get('harvest/{harvest}', [FarmHarvestController::class, 'show']);
                Route::get('inventory/processing', [InventoryProcessingController::class, 'index']);
                Route::get('inventory', [InventoryController::class, 'index']);
                Route::get('inventory/{inventory}', [InventoryController::class, 'show']);
                Route::get('traceability', [TraceabilityController::class, 'index']);
                Route::get('traceability/{lot}/print', [TraceabilityController::class, 'print']);
                Route::get('traceability/{lot}', [TraceabilityController::class, 'show']);
            });

            Route::middleware('role:field_verifier')->group(function (): void {
                Route::get('farm-verification', [FarmVerificationController::class, 'index']);
                Route::get('farm-verification/{farm}', [FarmVerificationController::class, 'show']);
                Route::post('farm-verification/{farm}', [FarmVerificationController::class, 'store']);
                Route::put('farm-verification/{farm}', [FarmVerificationController::class, 'update']);
            });

            Route::get('settings/profile', [ProfileController::class, 'edit']);
            Route::patch('settings/profile', [ProfileController::class, 'update']);
            Route::delete('settings/profile', [ProfileController::class, 'destroy']);
            Route::get('settings/security', [SecurityController::class, 'edit']);
            Route::put('settings/security', [SecurityController::class, 'update']);
        });
    });
});
