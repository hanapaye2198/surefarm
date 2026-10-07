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
        Schema::create('farm_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained()->cascadeOnDelete();
            $table->string('verification_reference', 64)->unique();
            $table->string('previous_status', 32)->nullable();
            $table->decimal('declared_area_hectares', 10, 2);
            $table->decimal('measured_area_hectares', 10, 2);
            $table->decimal('difference_hectares', 10, 2);
            $table->decimal('variance_percentage', 8, 2);
            $table->string('result', 32)->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('farm_verifications');
    }
};
