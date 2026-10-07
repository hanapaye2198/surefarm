<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Expected production for a farm. Harvest rows are stored separately
     * and must not overwrite this estimate.
     */
    public function up(): void
    {
        Schema::create('farm_productions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained()->cascadeOnDelete();
            $table->string('crop_type', 32)->nullable();
            $table->string('production_period', 64)->nullable();
            $table->decimal('expected_quantity', 12, 2)->nullable();
            $table->string('unit', 32)->default('kg');
            $table->string('notes', 1000)->nullable();
            $table->string('status', 32)->default('active')->index();
            $table->timestamps();

            $table->index('production_period');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farm_productions');
    }
};
