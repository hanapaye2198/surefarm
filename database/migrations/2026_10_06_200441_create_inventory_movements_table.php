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
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('destination_inventory_id')->nullable()->constrained('inventories')->nullOnDelete();
            $table->foreignId('source_stage_id')->nullable()->constrained('inventory_processing_stages')->nullOnDelete();
            $table->foreignId('destination_stage_id')->nullable()->constrained('inventory_processing_stages')->nullOnDelete();
            $table->decimal('quantity', 12, 2);
            $table->decimal('output_quantity', 12, 2)->nullable();
            $table->string('unit');
            $table->string('movement_type');
            $table->string('direction')->nullable();
            $table->date('movement_date');
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('movement_date');
            $table->index(['reference_type', 'reference_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
    }
};
