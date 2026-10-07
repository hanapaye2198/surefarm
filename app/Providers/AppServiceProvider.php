<?php

namespace App\Providers;

use App\Contracts\FarmerIdGenerator;
use App\Contracts\FarmIdGenerator;
use App\Contracts\LotCodeGenerator;
use App\Contracts\VerificationReferenceGenerator;
use App\Services\DemoFarmerIdGenerator;
use App\Services\DemoFarmIdGenerator;
use App\Services\DemoLotCodeGenerator;
use App\Services\DemoVerificationReferenceGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
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
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
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
