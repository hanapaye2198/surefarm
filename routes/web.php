<?php

use App\Http\Controllers\AcceptUserInvitationController;
use App\Http\Controllers\AccountNotificationController;
use App\Http\Controllers\CooperativeController;
use App\Http\Controllers\CooperativeMembershipController;
use App\Http\Controllers\CooperativeOfficerController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FarmActivityController;
use App\Http\Controllers\FarmBoundaryController;
use App\Http\Controllers\FarmController;
use App\Http\Controllers\FarmerAccountLinkController;
use App\Http\Controllers\FarmerController;
use App\Http\Controllers\FarmFinancingController;
use App\Http\Controllers\FarmHarvestController;
use App\Http\Controllers\FarmInsuranceController;
use App\Http\Controllers\FarmProductionController;
use App\Http\Controllers\FarmVerificationController;
use App\Http\Controllers\FarmVerifierAssignmentController;
use App\Http\Controllers\FinanceController;
use App\Http\Controllers\HarvestInventoryController;
use App\Http\Controllers\InventoryAdjustmentController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\InventoryDamageController;
use App\Http\Controllers\InventoryProcessingController;
use App\Http\Controllers\InventoryReceiptReversalController;
use App\Http\Controllers\InventoryReconciliationController;
use App\Http\Controllers\ModulePlaceholderController;
use App\Http\Controllers\RegistryGrantController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\Settings\ActivityTypeController;
use App\Http\Controllers\TraceabilityController;
use App\Http\Controllers\TraceabilityPublicController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\UserInvitationController;
use App\Http\Controllers\UserSuspensionController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware('guest')->group(function () {
    Route::get('invitations/{token}', [AcceptUserInvitationController::class, 'show'])
        ->where('token', '[A-Za-z0-9]+')
        ->name('invitations.show');
    Route::post('invitations/{token}', [AcceptUserInvitationController::class, 'store'])
        ->where('token', '[A-Za-z0-9]+')
        ->middleware('throttle:6,1')
        ->name('invitations.store');
});

Route::get('trace/{token}', [TraceabilityPublicController::class, 'show'])
    ->where('token', '[A-Za-z0-9]{40}')
    ->middleware('throttle:30,1')
    ->name('trace.public');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('search', SearchController::class)->name('search');
    Route::get('notifications', [AccountNotificationController::class, 'index'])->name('notifications.index');
    Route::post('notifications/{notification}/read', [AccountNotificationController::class, 'read'])->name('notifications.read');

    Route::get('modules/{module}', [ModulePlaceholderController::class, 'show'])
        ->where('module', 'crop-management|logistics-export|reports')
        ->name('modules.show');

    Route::middleware(['role:operations', 'registry.scope'])->group(function () {
        Route::get('farms/register', [FarmController::class, 'chooseFarmer'])->name('farms.register');
        Route::get('farmers/create', [FarmerController::class, 'create'])->name('farmers.create');
        Route::post('farmers', [FarmerController::class, 'store'])->name('farmers.store');
        Route::get('farmers/{farmer}/edit', [FarmerController::class, 'edit'])->name('farmers.edit');
        Route::put('farmers/{farmer}', [FarmerController::class, 'update'])->name('farmers.update');
        Route::get('farmers/{farmer}/farms/create', [FarmController::class, 'create'])->name('farmers.farms.create');
        Route::post('farmers/{farmer}/farms', [FarmController::class, 'store'])->name('farmers.farms.store');
        Route::get('farms/{farm}/edit', [FarmController::class, 'edit'])->name('farms.edit');
        Route::put('farms/{farm}', [FarmController::class, 'update'])->name('farms.update');
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
        Route::get('inventory/reconciliation', [InventoryReconciliationController::class, 'index'])->name('inventory.reconciliation');
        Route::post('inventory/{inventory}/reconciliation', [InventoryReconciliationController::class, 'update'])->name('inventory.reconciliation.update');
        Route::post('inventory/{inventory}/receipts/{movement}/reverse', [InventoryReceiptReversalController::class, 'store'])->name('inventory.receipts.reverse');
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
        Route::get('cooperatives/create', [CooperativeController::class, 'create'])->name('cooperatives.create');
        Route::post('cooperatives', [CooperativeController::class, 'store'])->name('cooperatives.store');
        Route::get('cooperatives/{cooperative}/edit', [CooperativeController::class, 'edit'])->name('cooperatives.edit');
        Route::put('cooperatives/{cooperative}', [CooperativeController::class, 'update'])->name('cooperatives.update');
        Route::put('cooperatives/{cooperative}/status', [CooperativeController::class, 'updateStatus'])->name('cooperatives.status.update');
        Route::post('cooperatives/{cooperative}/memberships', [CooperativeMembershipController::class, 'store'])->name('cooperatives.memberships.store');
        Route::put('cooperatives/{cooperative}/memberships/{membership}/suspend', [CooperativeMembershipController::class, 'suspend'])->name('cooperatives.memberships.suspend');
        Route::put('cooperatives/{cooperative}/memberships/{membership}/reactivate', [CooperativeMembershipController::class, 'reactivate'])->name('cooperatives.memberships.reactivate');
        Route::put('cooperatives/{cooperative}/memberships/{membership}/end', [CooperativeMembershipController::class, 'end'])->name('cooperatives.memberships.end');
        Route::post('cooperatives/{cooperative}/officers', [CooperativeOfficerController::class, 'store'])->name('cooperatives.officers.store');
        Route::delete('cooperatives/{cooperative}/officers/{officer}', [CooperativeOfficerController::class, 'destroy'])->name('cooperatives.officers.destroy');
    });

    Route::middleware(['role:admin', 'registry.scope'])->group(function () {
        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::get('users/{user}', [UserController::class, 'show'])->name('users.show');
        Route::patch('users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::post('users/{user}/farmer-link', [FarmerAccountLinkController::class, 'store'])->name('users.farmer-link.store');
        Route::delete('users/{user}/farmer-link', [FarmerAccountLinkController::class, 'destroy'])->name('users.farmer-link.destroy');
        Route::post('users/{user}/farm-assignments', [FarmVerifierAssignmentController::class, 'store'])->name('users.farm-assignments.store');
        Route::delete('users/{user}/farm-assignments/{assignment}', [FarmVerifierAssignmentController::class, 'destroy'])->name('users.farm-assignments.destroy');
        Route::post('users/{user}/registry-grants', [RegistryGrantController::class, 'store'])->name('users.registry-grants.store');
        Route::delete('users/{user}/registry-grants/{grant}', [RegistryGrantController::class, 'destroy'])->name('users.registry-grants.destroy');
        Route::post('users/{user}/suspension', [UserSuspensionController::class, 'store'])->name('users.suspension.store');
        Route::delete('users/{user}/suspension', [UserSuspensionController::class, 'destroy'])->name('users.suspension.destroy');
        Route::post('user-invitations', [UserInvitationController::class, 'store'])
            ->middleware('throttle:10,1')
            ->name('user-invitations.store');
        Route::delete('user-invitations/{invitation}', [UserInvitationController::class, 'destroy'])->name('user-invitations.destroy');

        Route::delete('farms/{farm}/boundary', [FarmBoundaryController::class, 'destroy'])->name('farms.boundary.destroy');
        Route::get('settings/activity-types', [ActivityTypeController::class, 'index'])->name('activity-types.index');
        Route::post('settings/activity-types', [ActivityTypeController::class, 'store'])->name('activity-types.store');
        Route::get('settings/activity-types/{activityType}/edit', [ActivityTypeController::class, 'edit'])->name('activity-types.edit');
        Route::put('settings/activity-types/{activityType}', [ActivityTypeController::class, 'update'])->name('activity-types.update');
    });

    Route::middleware(['role:admin,operations,field_verifier', 'registry.scope'])->group(function () {
        Route::post('farms/{farm}/boundary', [FarmBoundaryController::class, 'store'])->name('farms.boundary.store');
        Route::put('farms/{farm}/boundary', [FarmBoundaryController::class, 'update'])->name('farms.boundary.update');
    });

    Route::middleware('role:operations,cooperative_officer')->group(function () {
        Route::get('cooperatives', [CooperativeController::class, 'index'])->name('cooperatives.index');
        Route::get('cooperatives/{cooperative}', [CooperativeController::class, 'show'])->name('cooperatives.show');
    });

    Route::middleware(['role:operations,field_verifier', 'registry.scope'])->group(function () {
        Route::get('insurance', [FarmInsuranceController::class, 'index'])->name('insurance.index');
    });

    Route::middleware(['role:operations', 'registry.scope'])->group(function () {
        Route::get('finance/transactions', [FinanceController::class, 'transactions'])->name('finance.transactions');
        Route::get('finance/export', [FinanceController::class, 'export'])->name('finance.export');
        Route::get('finance/create', [FinanceController::class, 'create'])->name('finance.create');
        Route::post('finance', [FinanceController::class, 'store'])->name('finance.store');
        Route::get('finance', [FinanceController::class, 'index'])->name('finance.index');
        Route::get('finance/{financing}', [FinanceController::class, 'show'])->name('finance.show');
        Route::post('finance/{financing}/review', [FinanceController::class, 'review'])->name('finance.review');
        Route::post('finance/{financing}/approve', [FinanceController::class, 'approve'])->name('finance.approve');
        Route::post('finance/{financing}/reject', [FinanceController::class, 'reject'])->name('finance.reject');
        Route::post('finance/{financing}/cancel', [FinanceController::class, 'cancel'])->name('finance.cancel');
        Route::post('finance/{financing}/disburse', [FinanceController::class, 'disburse'])->name('finance.disburse');
        Route::post('finance/{financing}/repayments', [FinanceController::class, 'repay'])->name('finance.repayments.store');
        Route::post('finance/{financing}/default', [FinanceController::class, 'default'])->name('finance.default');
        Route::post('finance/{financing}/adjustments', [FinanceController::class, 'adjust'])->name('finance.adjustments.store');
        Route::post('finance/{financing}/transactions/{transaction}/reverse', [FinanceController::class, 'reverse'])->name('finance.transactions.reverse');
        Route::post('finance/{financing}/transactions/{transaction}/reconcile', [FinanceController::class, 'reconcile'])->name('finance.transactions.reconcile');
        Route::post('finance/{financing}/documents', [FinanceController::class, 'storeDocument'])->name('finance.documents.store');
        Route::get('finance/{financing}/documents/{document}', [FinanceController::class, 'document'])->name('finance.documents.show');
    });

    Route::middleware(['role:operations,field_verifier,farmer,cooperative_officer', 'registry.scope'])->group(function () {
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

    Route::middleware(['role:admin,field_verifier', 'registry.scope'])->group(function () {
        Route::get('farm-verification', [FarmVerificationController::class, 'index'])->name('farm-verification.index');
        Route::get('farm-verification/{farm}', [FarmVerificationController::class, 'show'])->name('farm-verification.show');
        Route::post('farm-verification/{farm}', [FarmVerificationController::class, 'store'])->name('farm-verification.store');
        Route::post('farm-verification/{farm}/inspection', [FarmVerificationController::class, 'inspection'])->name('farm-verification.inspection');
        Route::put('farm-verification/{farm}', [FarmVerificationController::class, 'update'])->name('farm-verification.update');
    });
});

require __DIR__.'/settings.php';
