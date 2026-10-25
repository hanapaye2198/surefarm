<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farm_verifications', function (Blueprint $table): void {
            // Mobile verification can start before the verifier has walked
            // and saved a boundary, so the measurements are unknown at first.
            $table->decimal('measured_area_hectares', 10, 2)->nullable()->change();
            $table->decimal('difference_hectares', 10, 2)->nullable()->change();
            $table->decimal('variance_percentage', 8, 2)->nullable()->change();

            // Keep the polygon used for each attempt after the farm's current
            // boundary is replaced during a later reverification.
            $table->json('boundary_geojson')->nullable();
            $table->json('gps_point_accuracies')->nullable();
            $table->json('previous_boundary_geojson')->nullable();
            $table->json('previous_gps_point_accuracies')->nullable();
            $table->decimal('previous_measured_area_hectares', 10, 2)->nullable();
            $table->timestamp('boundary_captured_at')->nullable();
            $table->unsignedInteger('boundary_revision')->default(0);
            $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at')->nullable();
        });

        Schema::table('farm_verification_photos', function (Blueprint $table): void {
            $table->unsignedInteger('boundary_revision')->default(0);
        });
    }

    public function down(): void
    {
        $hasIncompleteMeasurements = DB::table('farm_verifications')
            ->whereNull('measured_area_hectares')
            ->orWhereNull('difference_hectares')
            ->orWhereNull('variance_percentage')
            ->exists();

        Schema::table('farm_verifications', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('started_by');
            $table->dropColumn([
                'boundary_geojson',
                'gps_point_accuracies',
                'previous_boundary_geojson',
                'previous_gps_point_accuracies',
                'previous_measured_area_hectares',
                'boundary_captured_at',
                'boundary_revision',
                'started_at',
            ]);
        });

        Schema::table('farm_verification_photos', function (Blueprint $table): void {
            $table->dropColumn('boundary_revision');
        });

        // Do not fabricate zero measurements just to roll the migration back.
        // The columns stay nullable if an open mobile attempt has no boundary.
        if (! $hasIncompleteMeasurements) {
            Schema::table('farm_verifications', function (Blueprint $table): void {
                $table->decimal('measured_area_hectares', 10, 2)->nullable(false)->change();
                $table->decimal('difference_hectares', 10, 2)->nullable(false)->change();
                $table->decimal('variance_percentage', 8, 2)->nullable(false)->change();
            });
        }
    }
};
