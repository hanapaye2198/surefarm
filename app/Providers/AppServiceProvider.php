<?php

namespace App\Providers;

use App\Contracts\FarmerIdGenerator;
use App\Contracts\FarmIdGenerator;
use App\Contracts\LotCodeGenerator;
use App\Contracts\VerificationReferenceGenerator;
use App\Logging\RedactingContextLogProcessor;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\FarmFinancing;
use App\Models\FarmHarvest;
use App\Models\FarmInsurance;
use App\Models\FarmProduction;
use App\Models\Inventory;
use App\Models\TraceabilityLot;
use App\Models\User;
use App\Services\DemoFarmerIdGenerator;
use App\Services\DemoFarmIdGenerator;
use App\Services\DemoLotCodeGenerator;
use App\Services\DemoVerificationReferenceGenerator;
use App\Services\ErrorTracker;
use App\Services\RegistryScope;
use App\Support\LogRedactor;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Contracts\Log\ContextLogProcessor as ContextLogProcessorContract;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(FarmerIdGenerator::class, DemoFarmerIdGenerator::class);
        $this->app->bind(FarmIdGenerator::class, DemoFarmIdGenerator::class);
        $this->app->bind(VerificationReferenceGenerator::class, DemoVerificationReferenceGenerator::class);
        $this->app->bind(LotCodeGenerator::class, DemoLotCodeGenerator::class);
        $this->app->bind(ContextLogProcessorContract::class, function (Application $app): ContextLogProcessorContract {
            return new RedactingContextLogProcessor($app->make(LogRedactor::class));
        });
        $this->app->singleton(ErrorTracker::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->bindScopedRegistryRecords();
    }

    /**
     * Out-of-scope registry ids respond as missing so a guessed id
     * does not confirm that another person's record exists.
     */
    private function bindScopedRegistryRecords(): void
    {
        $models = [
            'farmer' => Farmer::class,
            'farm' => Farm::class,
            'activity' => FarmActivity::class,
            'production' => FarmProduction::class,
            'harvest' => FarmHarvest::class,
            'inventory' => Inventory::class,
            'lot' => TraceabilityLot::class,
            'insurance' => FarmInsurance::class,
            'financing' => FarmFinancing::class,
        ];

        foreach ($models as $parameter => $class) {
            Route::bind($parameter, function (string $value) use ($class): Model {
                $model = $class::query()->whereKey($value)->first();
                $user = auth()->user();

                if (! $model instanceof Model || ! $user instanceof User || ! $this->recordIsVisible($user, $model)) {
                    abort(404);
                }

                return $model;
            });
        }
    }

    private function recordIsVisible(User $user, Model $model): bool
    {
        $scope = app(RegistryScope::class);

        if ($model instanceof Farmer) {
            return $scope->canViewFarmer($user, $model);
        }

        if ($model instanceof Farm) {
            return $scope->canViewFarm($user, $model);
        }

        if ($model instanceof FarmInsurance || $model instanceof FarmFinancing) {
            $farm = $model->farm()->first();
            $routeFarm = request()->route('farm');

            if (! $farm instanceof Farm || ! $scope->canViewFarm($user, $farm)) {
                return false;
            }

            return ! $routeFarm instanceof Farm || $routeFarm->is($farm);
        }

        return $scope->constrain($model->newQuery()->whereKey($model->getKey()), $user)->exists();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
