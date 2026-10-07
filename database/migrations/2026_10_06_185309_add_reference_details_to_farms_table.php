<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('farms', function (Blueprint $table) {
            $table->string('current_stage', 32)->nullable()->after('status');
            $table->unsignedInteger('number_of_hills')->nullable()->after('current_stage');
            $table->boolean('data_validated')->nullable()->after('number_of_hills');
            $table->string('property_ownership', 32)->nullable()->after('data_validated');
            $table->decimal('contracted_value_estimated', 12, 2)->nullable()->after('property_ownership');
            $table->decimal('input_support_amount', 12, 2)->nullable()->after('contracted_value_estimated');
            $table->decimal('financing_support_amount', 12, 2)->nullable()->after('input_support_amount');
            $table->string('drone_image_path')->nullable()->after('financing_support_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('farms', function (Blueprint $table) {
            $table->dropColumn([
                'current_stage',
                'number_of_hills',
                'data_validated',
                'property_ownership',
                'contracted_value_estimated',
                'input_support_amount',
                'financing_support_amount',
                'drone_image_path',
            ]);
        });
    }
};
