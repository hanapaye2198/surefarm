<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('traceability_lots', function (Blueprint $table) {
            $table->id();
            $table->string('lot_code')->unique();
            $table->foreignId('farmer_id')->constrained()->restrictOnDelete();
            $table->foreignId('farm_id')->constrained()->restrictOnDelete();
            $table->string('crop_type')->nullable();
            $table->foreignId('harvest_id')->nullable()->constrained('farm_harvests')->nullOnDelete();
            $table->foreignId('current_inventory_id')->nullable()->constrained('inventories')->nullOnDelete();
            $table->decimal('quantity', 12, 2);
            $table->string('unit');
            $table->string('status');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'crop_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('traceability_lots');
    }
};
