<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A crop record belongs to one registered farm and uses that farm's crop type.
     * Farm area, verification, production, and harvest rows stay on their own tables.
     */
    public function up(): void
    {
        Schema::create('farm_crops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained()->cascadeOnDelete();
            $table->string('crop_type', 32);
            $table->string('variety', 120)->nullable();
            $table->decimal('area_hectares', 10, 2)->nullable();
            $table->date('planted_on')->nullable();
            $table->string('status', 32)->default('active')->index();
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farm_crops');
    }
};
