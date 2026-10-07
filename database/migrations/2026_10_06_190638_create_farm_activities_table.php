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
        Schema::create('farm_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained()->cascadeOnDelete();
            $table->foreignId('activity_type_id')->constrained()->restrictOnDelete();
            $table->string('crop_type', 32)->nullable();
            $table->date('activity_date');
            $table->string('status', 32)->default('completed')->index();
            $table->string('description', 500)->nullable();
            $table->string('performed_by')->nullable();
            $table->decimal('quantity', 10, 2)->nullable();
            $table->string('unit', 32)->nullable();
            $table->decimal('cost_amount', 12, 2)->nullable();
            $table->string('remarks', 1000)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['farm_id', 'activity_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('farm_activities');
    }
};
