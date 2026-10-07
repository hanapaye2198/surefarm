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
        Schema::create('inventories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farmer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('farm_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('harvest_id')->nullable()->constrained('farm_harvests')->nullOnDelete();
            $table->foreignId('processing_stage_id')->constrained('inventory_processing_stages')->restrictOnDelete();
            $table->string('crop_type')->nullable();
            $table->decimal('quantity', 12, 2);
            $table->string('unit');
            $table->string('status');
            $table->string('location')->nullable();
            $table->date('received_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['processing_stage_id', 'status']);
            $table->index('received_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventories');
    }
};
