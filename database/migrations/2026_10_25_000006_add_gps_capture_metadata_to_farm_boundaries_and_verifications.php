<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farm_boundaries', function (Blueprint $table): void {
            $table->json('gps_point_captured_at')->nullable();
            $table->string('capture_method', 24)->nullable();
        });

        Schema::table('farm_verifications', function (Blueprint $table): void {
            $table->json('gps_point_captured_at')->nullable();
            $table->json('previous_gps_point_captured_at')->nullable();
            $table->string('boundary_capture_method', 24)->nullable();
            $table->string('previous_boundary_capture_method', 24)->nullable();
            $table->timestamp('previous_boundary_captured_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('farm_boundaries', function (Blueprint $table): void {
            $table->dropColumn(['gps_point_captured_at', 'capture_method']);
        });

        Schema::table('farm_verifications', function (Blueprint $table): void {
            $table->dropColumn([
                'gps_point_captured_at',
                'previous_gps_point_captured_at',
                'boundary_capture_method',
                'previous_boundary_capture_method',
                'previous_boundary_captured_at',
            ]);
        });
    }
};
