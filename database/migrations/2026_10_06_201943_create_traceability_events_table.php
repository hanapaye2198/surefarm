<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('traceability_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('traceability_lot_id')->constrained()->cascadeOnDelete();
            $table->string('event_type');
            $table->date('event_date')->nullable();
            $table->decimal('quantity', 12, 2)->nullable();
            $table->string('unit')->nullable();
            $table->string('source_reference_type')->nullable();
            $table->unsignedBigInteger('source_reference_id')->nullable();
            $table->text('description')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['traceability_lot_id', 'event_date']);
            $table->index(['source_reference_type', 'source_reference_id'], 'traceability_events_source_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('traceability_events');
    }
};
