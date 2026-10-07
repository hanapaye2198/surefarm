<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Actual harvest transactions. A farm can have many harvests.
     * Completing a harvest does not change farm area or verification.
     */
    public function up(): void
    {
        Schema::create('farm_harvests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained()->cascadeOnDelete();
            $table->string('crop_type', 32)->nullable();
            $table->foreignId('production_id')->nullable()->constrained('farm_productions')->nullOnDelete();
            $table->date('harvest_date')->index();
            $table->decimal('quantity', 12, 2);
            $table->string('unit', 32)->default('kg');
            $table->string('quality_grade', 64)->nullable();
            $table->string('status', 32)->default('completed')->index();
            $table->string('notes', 1000)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['farm_id', 'harvest_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farm_harvests');
    }
};
